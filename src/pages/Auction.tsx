import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PlayerCard } from "@/components/PlayerCard";
import { Player } from "@/lib/samplePlayers";
import { useGameData } from "@/contexts/GameDataContext";
import { getNextBid, IPL_TEAMS, SQUAD_CONSTRAINTS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  resolveAuction,
  listenSession,
  listenTeams,
  placeBid,
  resolveRtmDecision,
  resolveRtmTimeout,
  loadNextPlayer,
  skipCurrentPlayer,
  togglePauseAuction,
  startAcceleratedRound,
  skipAcceleratedRound,
  leaveGame,
  rejoinGame,
} from "@/lib/sessionService";
import { AIEngine } from "@/engine/aiEngine";
import { TeamDetailsPanel } from "@/components/TeamDetailsPanel";
import { RTMModal } from "@/components/RTMModal";
import { HammerSoldEffect } from "@/components/HammerSoldEffect";
import { TeamLogo } from "@/components/TeamLogo";
import { Header } from "@/components/Header";
import { TeamGrid } from "@/components/TeamGrid";
import { BidControls } from "@/components/BidControls";

export interface TeamState {
  id: string;
  name: string;
  shortName: string;
  color: string;
  logo?: string;
  purseRemaining: number;
  players: string[];
  retainedPlayers: string[];
  overseasCount: number;
  squadSize: number;
  rtmCards: number;
  playerPurchasePrices: Record<string, number>;
  isAI: boolean;
}

interface PendingRtmState {
  teamId?: string;
  playerId: string;
  price?: number;
  winningTeamId?: string;
  originalTeamId?: string;
  finalBid?: number;
  status?: "AWAIT_ORIGINAL" | "AWAIT_WINNER_COUNTER" | "AWAIT_ORIGINAL_MATCH";
  counterBid?: number;
  expiresAt?: { toMillis?: () => number };
}

const isOverseasPlayer = (player: any) => Boolean(player?.overseas ?? player?.isOverseas);

const formatCrPrice = (amount: number) => `₹${(Number(amount || 0) / 10000000).toFixed(2)} Cr`;

const normalizeRoleKey = (role: string) => {
  const key = String(role || "").toLowerCase();
  if (key.includes("wicket")) return "wk";
  if (key.includes("all")) return "ar";
  if (key.includes("bowl")) return "bowl";
  return "bat";
};

const buildLeaderboard = (teams: TeamState[], resolved: Record<string, { retained: Player[]; bought: Player[] }>) => {
  return teams
    .map((team) => {
      const roster = [...(resolved[team.id]?.retained || []), ...(resolved[team.id]?.bought || [])];
      const ratings = roster.map((p: any) => Number(p?.rating ?? p?.starRating ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
      const averagePlayerRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0;
      const roleSet = new Set(roster.map((p) => normalizeRoleKey(String((p as any).role || ""))));
      const squadBalanceBonus = roleSet.size * 2.5;
      const squadSize = Number(team.squadSize || roster.length);
      const squadSizeBonus = Math.max(0, Math.min(10, squadSize - SQUAD_CONSTRAINTS.MIN_SQUAD));
      const eliminated = squadSize < SQUAD_CONSTRAINTS.MIN_SQUAD;
      const teamScore = Number((averagePlayerRating * 10 + squadBalanceBonus + squadSizeBonus).toFixed(2));

      return {
        ...team,
        squadSize,
        averagePlayerRating,
        squadBalanceBonus,
        squadSizeBonus,
        teamScore,
        eliminated,
      };
    })
    .sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      return b.teamScore - a.teamScore;
    });
};

const Auction = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<TeamState[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pendingRtm, setPendingRtm] = useState<PendingRtmState | null>(null);
  const [commentary, setCommentary] = useState<string[]>([]);
  const [banner, setBanner] = useState<{ kind: 'SOLD' | 'UNSOLD'; price?: number; team?: string } | null>(null);
  const [showHammer, setShowHammer] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const [optimisticBid, setOptimisticBid] = useState<number | null>(null);
  const [optimisticBidderId, setOptimisticBidderId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [glowingTeamId, setGlowingTeamId] = useState<string | null>(null);
  const [aiThinkingTeamId, setAiThinkingTeamId] = useState<string | null>(null);

  const userId = localStorage.getItem("uid") || "";
  const { masterPlayerList } = useGameData();

  const prevBidRef = useRef<number>(0);
  const prevBidderRef = useRef<string | null>(null);
  const prevStatusRef = useRef<string>("IDLE");
  const autoAdvanceKeyRef = useRef<string | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const autoAdvanceHostTimeoutRef = useRef<number | null>(null);
  const rtmAiDecisionKeyRef = useRef<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const spokenMarksRef = useRef<{ three: string | null; one: string | null }>({ three: null, one: null });

  const playTone = useCallback((freq: number, duration = 0.12, volume = 0.04) => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // no-op
    }
  }, []);

  const speakLine = useCallback((line: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.rate = 0.95;
    utterance.pitch = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);


  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, setSession);
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    setPendingRtm((session?.pendingRtm as PendingRtmState) || null);
  }, [session?.pendingRtm]);

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenTeams(gameCode, (teamDocs) => {
      const enriched = (teamDocs as any[]).map((team) => ({ ...IPL_TEAMS.find((t) => t.id === team.id), ...team }));
      setTeams(enriched as TeamState[]);
    });
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    if (session && !["AUCTION", "AUCTION_COMPLETE", "ENDED"].includes(session.phase)) navigate(`/lobby/${gameCode}`);
  }, [session, gameCode, navigate]);

  const isHost = session?.hostId === userId;
  const queueLength = (session?.auctionQueue || []).length;
  const myTeamId = Object.entries(session?.selectedTeams || {}).find(([_, uid]) => uid === userId)?.[0] as string | undefined;
  const userTeam = teams.find((team) => team.id === myTeamId);

  useEffect(() => {
    if (!gameCode || !session?.disconnectedPlayers?.[userId]) return;
    rejoinGame(gameCode, userId).catch(() => undefined);
  }, [gameCode, userId, session?.disconnectedPlayers]);

  const currentAuction = session?.currentAuction;

  useEffect(() => {
    const serverBid = Number(currentAuction?.currentBid || 0);
    const serverBidder = currentAuction?.currentBidderId || null;

    if (optimisticBid === null && optimisticBidderId === null) return;

    if (serverBid >= Number(optimisticBid || 0) || serverBidder !== optimisticBidderId || currentAuction?.status !== "RUNNING") {
      setOptimisticBid(null);
      setOptimisticBidderId(null);
    }
  }, [currentAuction?.currentBid, currentAuction?.currentBidderId, currentAuction?.status, optimisticBid, optimisticBidderId]);

  const aiEngine = useMemo(() => new AIEngine(), []);

  const playerById = useMemo(() => new Map(masterPlayerList.map((p: any) => [p.id, p])), [masterPlayerList]);

  const currentPlayer = useMemo(() => masterPlayerList.find((p: any) => p.id === currentAuction?.activePlayerId) || null, [masterPlayerList, currentAuction?.activePlayerId]);
  const displayedCurrentBid = optimisticBid ?? Number(currentAuction?.currentBid || 0);
  const displayedCurrentBidderId = optimisticBidderId ?? (currentAuction?.currentBidderId || null);
  const currentBidderTeam = teams.find((team) => team.id === displayedCurrentBidderId);

  const nextBid = getNextBid(displayedCurrentBid || 0);
  const timerEndsAtMs = currentAuction?.timerEndsAt?.toMillis?.() || 0;
  const timerSeconds = Math.max(0, Math.floor((timerEndsAtMs - nowMs) / 1000));

  const teamPlayersResolved = useMemo(() => {
    const lookup = new Map(masterPlayerList.map((p: any) => [p.id, p]));
    return teams.reduce<Record<string, { retained: Player[]; bought: Player[] }>>((acc, team) => {
      acc[team.id] = {
        retained: (team.retainedPlayers || []).map((id) => lookup.get(id)).filter(Boolean) as Player[],
        bought: (team.players || []).map((id) => lookup.get(id)).filter(Boolean) as Player[],
      };
      return acc;
    }, {});
  }, [teams, masterPlayerList]);

  const canTeamBid = (team: TeamState | undefined, player: Player | null, amount: number) => {
    if (!team || !player) return false;
    if (currentAuction?.status !== "RUNNING") return false;
    if (displayedCurrentBidderId === team.id) return false;
    if (Number(team.purseRemaining || 0) < amount) return false;
    if (Number(team.squadSize || 0) >= SQUAD_CONSTRAINTS.MAX_SQUAD) return false;
    if (isOverseasPlayer(player) && Number(team.overseasCount || 0) >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) return false;
    return true;
  };

  const skipDisabled = useMemo(() => {
    if (!currentPlayer || !currentAuction) return true;
    return Number(currentAuction.currentBid || 0) > Number((currentPlayer as any).basePrice || 0);
  }, [currentPlayer, currentAuction]);

  const handleBid = useCallback(async (amount: number) => {
    if (!gameCode || !myTeamId || !userTeam || !currentPlayer) return;
    if (!canTeamBid(userTeam, currentPlayer, amount)) return;

    setOptimisticBid(amount);
    setOptimisticBidderId(myTeamId);

    try {
      await placeBid(gameCode, myTeamId, amount);
    } catch {
      setOptimisticBid(null);
      setOptimisticBidderId(null);
    }
  }, [gameCode, myTeamId, userTeam, currentPlayer, currentAuction?.status, currentAuction?.currentBidderId]);

  const handleFinalize = useCallback(async () => {
    if (!gameCode || !isHost) return;
    playTone(220, 0.2, 0.08); // hammer
    await resolveAuction(gameCode);
  }, [gameCode, isHost, playTone]);

  useEffect(() => {
    if (!isHost || !gameCode || !currentPlayer) return;
    if (currentAuction?.status !== "RUNNING") return;

    const aiDecision = aiEngine.decideForAuction(
      teams.map((t) => ({
        id: t.id,
        isAI: Boolean(t.isAI),
        squadSize: Number(t.squadSize || 0),
        purseRemaining: Number(t.purseRemaining || 0),
        overseasCount: Number(t.overseasCount || 0),
        roleNeeds: (t as any).teamNeeds || {},
      })),
      {
        id: (currentPlayer as any).id,
        role: (currentPlayer as any).role,
        rating: Number((currentPlayer as any).rating ?? (currentPlayer as any).starRating ?? 0),
        overseas: Boolean((currentPlayer as any).overseas ?? (currentPlayer as any).isOverseas),
      },
      Number(currentAuction.currentBid || 0),
      currentAuction.currentBidderId,
    );

    if (!aiDecision) return;

    setAiThinkingTeamId(aiDecision.teamId);
    const thinkingTeam = teams.find((t) => t.id === aiDecision.teamId);
    setCommentary((prev) => [`${thinkingTeam?.shortName || "AI"} is thinking...`, ...prev].slice(0, 12));
    const thinkingDelay = Math.max(1000, Math.min(2000, Number(aiDecision.delayMs || 1200)));

    const timer = setTimeout(() => {
      placeBid(gameCode, aiDecision.teamId, aiDecision.bid)
        .catch(() => undefined)
        .finally(() => setAiThinkingTeamId(null));
    }, thinkingDelay);

    return () => {
      clearTimeout(timer);
      setAiThinkingTeamId(null);
    };
  }, [isHost, gameCode, teams, currentPlayer, currentAuction?.status, currentAuction?.currentBid, currentAuction?.currentBidderId, aiEngine]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) window.clearInterval(autoAdvanceTimerRef.current);
      if (autoAdvanceHostTimeoutRef.current) window.clearTimeout(autoAdvanceHostTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!currentAuction?.currentBidderId) return;
    if (Number(currentAuction.currentBid || 0) === prevBidRef.current) return;

    setGlowingTeamId(currentAuction.currentBidderId);
    const timeout = window.setTimeout(() => setGlowingTeamId(null), 900);
    return () => window.clearTimeout(timeout);
  }, [currentAuction?.currentBid, currentAuction?.currentBidderId]);

  useEffect(() => {
    if (!currentAuction) return;

    if (currentAuction.currentBidderId && Number(currentAuction.currentBid || 0) !== prevBidRef.current) {
      const team = teams.find((t) => t.id === currentAuction.currentBidderId);
      const previousTeam = teams.find((t) => t.id === prevBidderRef.current);
      const amount = formatCrPrice(Number(currentAuction.currentBid || 0));

      if (prevBidderRef.current && prevBidderRef.current !== currentAuction.currentBidderId) {
        setCommentary((prev) => [`${previousTeam?.shortName || "Team"} backs out at ${amount}!`, ...prev].slice(0, 12));
      }

      const line = prevBidderRef.current
        ? `${team?.shortName || "Team"} raises bid to ${amount}!`
        : `${team?.shortName || "Team"} enters the bidding war!`;
      setCommentary((prev) => [line, ...prev].slice(0, 12));
      playTone(880, 0.08, 0.05);
    }

    if (currentAuction.status === "SOLD" && prevStatusRef.current !== "SOLD") {
      const team = teams.find((t) => t.id === currentAuction.currentBidderId);
      setBanner({ kind: 'SOLD', price: Number(currentAuction.currentBid || 0), team: team?.shortName || 'TEAM' });
      setShowHammer(true);
      setCommentary((prev) => [`${currentPlayer?.name || 'Player'} SOLD to ${team?.shortName || 'TEAM'} for ${formatCrPrice(Number(currentAuction.currentBid || 0))}!`, ...prev].slice(0, 12));
      setTimeout(() => setShowHammer(false), 1400);
      setTimeout(() => setBanner(null), 2000);
      playTone(260, 0.2, 0.08);
      speakLine('Sold!');
    }

    if (currentAuction.status === "UNSOLD" && prevStatusRef.current !== "UNSOLD") {
      setBanner({ kind: 'UNSOLD' });
      setCommentary((prev) => [`${currentPlayer?.name || "Player"} goes UNSOLD.`, ...prev].slice(0, 12));
      setTimeout(() => setBanner(null), 2000);
      playTone(180, 0.22, 0.07);
    }

    prevBidRef.current = Number(currentAuction.currentBid || 0);
    prevBidderRef.current = currentAuction.currentBidderId || null;
    prevStatusRef.current = currentAuction.status || "IDLE";
  }, [currentAuction, teams, currentPlayer, playTone, speakLine]);

  useEffect(() => {
    if (!currentAuction) return;
    if (!['SOLD', 'UNSOLD'].includes(currentAuction.status || '') || pendingRtm) {
      setAutoNextCountdown(null);
      return;
    }

    const key = `${currentAuction.activePlayerId}-${currentAuction.status}`;
    if (autoAdvanceKeyRef.current === key) return;
    autoAdvanceKeyRef.current = key;

    if (autoAdvanceTimerRef.current) window.clearInterval(autoAdvanceTimerRef.current);

    let counter = 3;
    setAutoNextCountdown(counter);

    autoAdvanceTimerRef.current = window.setInterval(() => {
      counter -= 1;

      if (counter <= 0) {
        setAutoNextCountdown(null);
        if (autoAdvanceTimerRef.current) {
          window.clearInterval(autoAdvanceTimerRef.current);
          autoAdvanceTimerRef.current = null;
        }
        return;
      }

      setAutoNextCountdown(counter);
    }, 1000);
  }, [currentAuction, pendingRtm]);

  useEffect(() => {
    if (!isHost || !gameCode || !currentAuction) return;
    if (!['SOLD', 'UNSOLD'].includes(currentAuction.status || '') || pendingRtm) return;

    const key = `${currentAuction.activePlayerId}-${currentAuction.status}`;
    if (autoAdvanceHostTimeoutRef.current) window.clearTimeout(autoAdvanceHostTimeoutRef.current);

    autoAdvanceHostTimeoutRef.current = window.setTimeout(() => {
      if (autoAdvanceKeyRef.current !== key) return;
      loadNextPlayer(gameCode).catch(() => undefined);
    }, 3000);
  }, [isHost, gameCode, currentAuction, pendingRtm]);

  useEffect(() => {
    if (!currentAuction?.activePlayerId || currentAuction?.status !== "RUNNING") return;
    const playerKey = currentAuction.activePlayerId;

    if (timerSeconds === 3 && spokenMarksRef.current.three !== playerKey) {
      playTone(900, 0.08, 0.05);
      speakLine('Going once');
      spokenMarksRef.current.three = playerKey;
    }

    if (timerSeconds === 1 && spokenMarksRef.current.one !== playerKey) {
      playTone(780, 0.09, 0.05);
      speakLine('Going twice');
      spokenMarksRef.current.one = playerKey;
    }

    if (timerSeconds === 0) playTone(220, 0.2, 0.08);
  }, [timerSeconds, currentAuction?.status, currentAuction?.activePlayerId, playTone, speakLine]);

  useEffect(() => {
    if (!isHost || !gameCode) return;
    if (timerSeconds !== 0) return;
    if (currentAuction?.status !== 'RUNNING') return;

    resolveAuction(gameCode).catch(() => undefined);
  }, [isHost, gameCode, timerSeconds, currentAuction?.status]);


  useEffect(() => {
    if (!gameCode || !pendingRtm?.expiresAt?.toMillis) return;

    const ms = Math.max(0, pendingRtm.expiresAt.toMillis() - Date.now());
    const timeout = window.setTimeout(() => {
      resolveRtmTimeout(gameCode).catch(() => undefined);
    }, ms + 100);

    return () => window.clearTimeout(timeout);
  }, [gameCode, pendingRtm?.status, pendingRtm?.expiresAt]);

  const rtmPlayer = masterPlayerList.find((p: any) => p.id === pendingRtm?.playerId) || null;
  const rtmOriginalTeam = teams.find((t) => t.id === pendingRtm?.originalTeamId);
  const rtmWinningTeam = teams.find((t) => t.id === pendingRtm?.winningTeamId);
  const rtmControllerTeamId = pendingRtm?.status === "AWAIT_WINNER_COUNTER" ? pendingRtm?.winningTeamId : pendingRtm?.originalTeamId;
  const rtmControllerTeam = teams.find((t) => t.id === rtmControllerTeamId);
  const canUseRtm = pendingRtm?.originalTeamId === myTeamId;
  const rtmNeedsMyDecision = Boolean(pendingRtm && rtmControllerTeamId === myTeamId && !rtmControllerTeam?.isAI);

  useEffect(() => {
    if (!gameCode || !pendingRtm || !rtmControllerTeam?.isAI || !rtmControllerTeamId) return;

    const key = `${pendingRtm.playerId}-${pendingRtm.status}-${pendingRtm.finalBid}-${pendingRtm.counterBid}`;
    if (rtmAiDecisionKeyRef.current === key) return;
    rtmAiDecisionKeyRef.current = key;

    const timer = window.setTimeout(() => {
      if (pendingRtm.status === "AWAIT_ORIGINAL") {
        const shouldUse = Math.random() > 0.35;
        resolveRtmDecision(gameCode, { action: shouldUse ? "USE" : "DECLINE", actingTeamId: pendingRtm.originalTeamId! }).catch(() => undefined);
        return;
      }

      if (pendingRtm.status === "AWAIT_WINNER_COUNTER") {
        const shouldCounter = Math.random() > 0.45;
        resolveRtmDecision(gameCode, {
          action: shouldCounter ? "COUNTER" : "DECLINE",
          actingTeamId: pendingRtm.winningTeamId!,
          counterBid: Number(pendingRtm.counterBid || pendingRtm.finalBid || 0),
        }).catch(() => undefined);
        return;
      }

      if (pendingRtm.status === "AWAIT_ORIGINAL_MATCH") {
        const shouldMatch = Math.random() > 0.5;
        resolveRtmDecision(gameCode, { action: shouldMatch ? "MATCH" : "DECLINE", actingTeamId: pendingRtm.originalTeamId! }).catch(() => undefined);
      }
    }, 1200 + Math.floor(Math.random() * 1200));

    return () => window.clearTimeout(timer);
  }, [gameCode, pendingRtm, rtmControllerTeam?.isAI, rtmControllerTeamId]);

  const recentPurchases = useMemo(() => {
    const purchases = (session?.recentPurchases || []) as Array<{ playerId: string; price: number; teamId: string }>;
    return purchases.slice(0, 5);
  }, [session?.recentPurchases]);

  const commentaryTicker = useMemo(() => {
    const saleLines = recentPurchases.map((p) => {
      const pl = masterPlayerList.find((x: any) => x.id === p.playerId);
      const team = teams.find((t) => t.id === p.teamId);
      return `${pl?.name || p.playerId} SOLD to ${team?.shortName || p.teamId} for ${formatCrPrice(p.price)}`;
    });

    const rtmLine = pendingRtm
      ? `${rtmOriginalTeam?.shortName || 'Original Team'} uses RTM rights against ${rtmWinningTeam?.shortName || 'Bid Team'}!`
      : '';

    const lines = [...commentary, rtmLine, ...saleLines].filter(Boolean).slice(0, 14);
    return lines.length ? lines.join(' • ') : 'Auction is live • Waiting for next bid •';
  }, [recentPurchases, masterPlayerList, teams, commentary, pendingRtm, rtmOriginalTeam?.shortName, rtmWinningTeam?.shortName]);

  const showAcceleratedButton = useMemo(() => {
    if (!isHost) return false;
    const queueIndex = Number(session?.queueIndex ?? -1);
    const endedQueue = queueLength > 0 && queueIndex >= queueLength;
    return endedQueue && Number((session?.unsoldPlayers || []).length) > 0 && !session?.isAcceleratedRound;
  }, [isHost, session?.queueIndex, session?.unsoldPlayers, session?.isAcceleratedRound, queueLength]);

  const leaderboard = useMemo(() => buildLeaderboard(teams, teamPlayersResolved), [teams, teamPlayersResolved]);

  const showAcceleratedDecision = useMemo(() => {
    const queueIndex = Number(session?.queueIndex ?? -1);
    const endedQueue = queueLength > 0 && queueIndex >= queueLength;
    return endedQueue && Number((session?.unsoldPlayers || []).length) > 0 && !session?.isAcceleratedRound && !session?.acceleratedRoundSkipped;
  }, [queueLength, session?.queueIndex, session?.unsoldPlayers, session?.isAcceleratedRound, session?.acceleratedRoundSkipped]);

  const auctionEnded = (session?.phase === "AUCTION_COMPLETE" || session?.phase === "ENDED") || (queueLength > 0 && Number(session?.queueIndex ?? -1) >= queueLength);

  if (!session || !userTeam) return <p className="p-6">Loading auction…</p>;

  return (
    <div className="h-screen broadcast-container flex flex-col overflow-hidden">
      <Header
        gameCode={gameCode!}
        timerSeconds={Math.max(0, Math.floor(timerSeconds))}
        currentPool={(currentPlayer as any)?.pool}
        playersRemaining={Math.max(queueLength - ((session?.queueIndex ?? -1) + 1), 0)}
        totalPlayers={queueLength}
        onLeaveGame={async () => {
          if (!gameCode) return;
          await leaveGame(gameCode, userId);
          navigate(`/`);
        }}
      />

      <HammerSoldEffect open={showHammer} text={banner?.kind === "SOLD" ? `SOLD TO ${banner.team || "TEAM"}` : ""} />

      {banner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className={`min-w-[240px] rounded-2xl border px-6 py-5 text-center shadow-2xl animate-[resultPop_0.35s_ease-out] ${banner.kind === 'SOLD' ? 'border-green-500 text-green-400 bg-green-900/30 shadow-[0_0_30px_rgba(34,197,94,0.35)]' : 'border-red-500 text-red-400 bg-red-900/30 shadow-[0_0_25px_rgba(239,68,68,0.35)]'}`}
          >
            <p className="text-3xl md:text-4xl font-display">{banner.kind}</p>
            {banner.kind === 'SOLD' && (
              <>
                <p className="text-lg md:text-2xl font-semibold mt-2">{formatCrPrice(Number(banner.price || 0))}</p>
                <p className="text-xl md:text-3xl font-display mt-1">{banner.team}</p>
              </>
            )}
          </div>
        </div>
      )}

      {autoNextCountdown !== null && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-black/70 text-white text-center border border-white/20">
          <p className="text-xs uppercase tracking-wide text-white/70">Next player in</p>
          <p className="text-3xl font-display leading-none">{autoNextCountdown}</p>
        </div>
      )}

      {auctionEnded && showAcceleratedDecision && (
        <div className="p-6 mx-auto max-w-3xl w-full">
          <div className="border rounded-xl p-6 bg-card/60 space-y-4 text-center">
            <h2 className="text-2xl font-display">Main Auction Complete</h2>
            <p className="text-muted-foreground">{(session?.unsoldPlayers || []).length} players are unsold. Start the accelerated round (10s timer) or skip to leaderboard.</p>
            {isHost ? (
              <div className="flex gap-3 justify-center">
                <Button onClick={() => startAcceleratedRound(gameCode!)}>Start Accelerated Round</Button>
                <Button variant="outline" onClick={() => skipAcceleratedRound(gameCode!)}>Skip to Leaderboard</Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for host decision…</p>
            )}
          </div>
        </div>
      )}

      {auctionEnded && !showAcceleratedDecision && !pendingRtm && (
        <div className="p-6 mx-auto max-w-3xl w-full">
          <div className="border rounded-xl p-6 bg-card/60 space-y-3">
            <h2 className="text-2xl font-display">Final Leaderboard</h2>
            <div className="space-y-2">
              {leaderboard.map((team, index) => (
                <div key={team.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <TeamLogo teamId={team.id} logo={team.logo} shortName={team.shortName} size="sm" />
                    <p className="font-semibold">{index + 1}. {team.shortName}{team.eliminated ? ' (Eliminated)' : ''}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Score {team.teamScore.toFixed(2)} • Squad {team.squadSize}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!auctionEnded && (
        <>
          <div className="border-y border-yellow-500/40 bg-[#061734] overflow-hidden py-2">
            <div className="whitespace-nowrap animate-[marquee_28s_linear_infinite] text-sm text-yellow-100 px-4">
              {commentaryTicker} &nbsp; • &nbsp; {commentaryTicker}
            </div>
          </div>

          <main className="flex-1 overflow-hidden p-3 md:p-5">
            <div className="grid h-full grid-cols-1 lg:grid-cols-[3fr_5fr_2fr] gap-4">
              <div className="order-3 lg:order-none h-full overflow-y-auto"><TeamGrid
                teams={teams.map((team) => ({
                  id: team.id,
                  shortName: team.shortName,
                  name: team.name,
                  logo: team.logo,
                  purseRemaining: Number(team.purseRemaining || 0),
                  squadSize: Number(team.squadSize || 0),
                  rtmCards: Number(team.rtmCards || 0),
                }))}
                myTeamId={myTeamId}
                currentBidderId={currentAuction?.currentBidderId}
                glowingTeamId={glowingTeamId}
                onSelectTeam={(teamId) => setSelectedTeamId(teamId)}
              /></div>

              <div className="h-full overflow-hidden order-1 lg:order-none">
                <div className="h-full rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3 overflow-hidden">
                  {currentPlayer && currentAuction?.status === 'RUNNING' && (
                    <div key={currentAuction?.activePlayerId || "player-card"} className="animate-[playerEntry_0.45s_ease-out] h-full">
                      <PlayerCard
                      player={currentPlayer as any}
                      currentBid={displayedCurrentBid}
                      currentBidderId={currentBidderTeam?.id || null}
                      currentBidderName={currentBidderTeam?.shortName || 'BID'}
                    />
                    </div>
                  )}

                  {currentAuction?.status === 'PAUSED' && <p className="text-lg font-semibold text-yellow-400 mt-6">Auction Paused by Host</p>}

                  {(!currentPlayer || !['RUNNING', 'PAUSED'].includes(currentAuction?.status)) && !['SOLD', 'UNSOLD'].includes(currentAuction?.status || '') && (
                    <div className="mt-8 text-center">
                      {isHost ? <Button onClick={() => loadNextPlayer(gameCode!)}>Start Auction</Button> : <p className="text-muted-foreground">Waiting for host to start auction.</p>}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-full order-2 lg:order-none [&_button]:transition [&_button]:duration-200 [&_button:hover]:scale-[1.03]">
                <BidControls
                  currentBid={displayedCurrentBid}
                  purseRemaining={Number(userTeam.purseRemaining || 0)}
                  canBid={canTeamBid(userTeam, currentPlayer, nextBid)}
                  onBid={handleBid}
                  isHost={isHost}
                  onSkip={() => skipCurrentPlayer(gameCode!)}
                  onPauseToggle={() => togglePauseAuction(gameCode!)}
                  isPaused={currentAuction?.status === 'PAUSED'}
                  recentPurchases={recentPurchases.map((p) => {
                    const pl = masterPlayerList.find((x: any) => x.id === p.playerId);
                    const team = teams.find((t) => t.id === p.teamId);
                    return {
                      playerName: pl?.name || p.playerId,
                      teamShortName: team?.shortName || p.teamId,
                      price: p.price,
                    };
                  })}
                />
              </div>
            </div>
          </main>

          {aiThinkingTeamId && (
            <div className="fixed bottom-24 right-4 z-40 rounded-lg border border-yellow-400/40 bg-[#071a3a]/95 px-4 py-2 text-sm text-yellow-200 shadow-lg">
              {(teams.find((t) => t.id === aiThinkingTeamId)?.shortName || 'AI')} thinking...
            </div>
          )}

          <style>{`
            @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
            @keyframes teamBidGlow { 0% { box-shadow: 0 0 0 rgba(250,204,21,0); } 35% { box-shadow: 0 0 28px rgba(250,204,21,0.8); } 100% { box-shadow: 0 0 0 rgba(250,204,21,0); } }
            @keyframes bidPop { 0% { transform: scale(0.75); opacity: .6; } 100% { transform: scale(1); opacity: 1; } }
            @keyframes starGlow { 0%,100% { box-shadow: 0 0 10px rgba(250,204,21,0.2);} 50% { box-shadow: 0 0 20px rgba(250,204,21,0.6);} }
            @keyframes timerShake { 0%,100% { transform: translateX(0);} 50% { transform: translateX(-1px);} }
            @keyframes soldPop { 0% { transform: scale(0.75);} 100% { transform: scale(1);} }
            @keyframes resultPop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
            @keyframes playerEntry { 0% { transform: translateY(40px) scale(0.97); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
            @keyframes rtmFade { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
          `}</style>
        </>
      )}

      {!!pendingRtm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none px-4">
          <div className="w-full max-w-xl rounded-2xl border border-yellow-400/70 bg-[#071a3a]/95 p-5 text-yellow-100 shadow-2xl animate-[rtmFade_0.3s_ease-out]">
            <p className="text-xs tracking-[0.25em] text-yellow-300">RIGHT TO MATCH</p>
            <h3 className="text-xl md:text-2xl font-display mt-2">{rtmPlayer?.name || 'Player'}</h3>
            <p className="text-sm text-slate-200 mt-1">Previously played for {rtmOriginalTeam?.shortName || '—'}</p>
            <div className="mt-4 space-y-2 text-sm md:text-base">
              <p>{rtmWinningTeam?.shortName || 'Bid Team'} Final Bid: <span className="text-yellow-300 font-semibold">{formatCrPrice(Number(pendingRtm.finalBid || 0))}</span></p>
              {pendingRtm.status === 'AWAIT_ORIGINAL' && <p>{rtmOriginalTeam?.shortName || 'Original Team'} is deciding...</p>}
              {pendingRtm.status === 'AWAIT_WINNER_COUNTER' && <p>{rtmOriginalTeam?.shortName || 'Original Team'} uses RTM. {rtmWinningTeam?.shortName || 'Bid Team'} can counter now.</p>}
              {pendingRtm.status === 'AWAIT_ORIGINAL_MATCH' && <p>{rtmWinningTeam?.shortName || 'Bid Team'} increased bid. {rtmOriginalTeam?.shortName || 'Original Team'} must match {formatCrPrice(Number(pendingRtm.counterBid || pendingRtm.finalBid || 0))}.</p>}
            </div>
          </div>
        </div>
      )}

      <TeamDetailsPanel
        open={!!selectedTeamId}
        onOpenChange={(open) => !open && setSelectedTeamId(null)}
        team={teams.find((t) => t.id === selectedTeamId) || null}
        retainedPlayers={selectedTeamId ? teamPlayersResolved[selectedTeamId]?.retained || [] : []}
        boughtPlayers={selectedTeamId ? teamPlayersResolved[selectedTeamId]?.bought || [] : []}
        playerPrices={selectedTeamId ? teams.find((t) => t.id === selectedTeamId)?.playerPurchasePrices || {} : {}}
      />

      {!!pendingRtm && rtmNeedsMyDecision && (canUseRtm || pendingRtm.status === "AWAIT_WINNER_COUNTER") && (
        <RTMModal
          open={true}
          stage={pendingRtm.status}
          player={rtmPlayer as any}
          originalTeamName={rtmOriginalTeam?.name}
          winningTeamName={rtmWinningTeam?.name}
          finalBid={Number(pendingRtm.finalBid || 0)}
          countdownSeconds={Math.max(0, Math.ceil(((pendingRtm?.expiresAt?.toMillis?.() || 0) - nowMs) / 1000))}
          onPrimary={() => {
            const actionByStage: Record<string, any> = {
              AWAIT_ORIGINAL: "USE",
              AWAIT_WINNER_COUNTER: "COUNTER",
              AWAIT_ORIGINAL_MATCH: "MATCH",
            };
            if (pendingRtm.status === "AWAIT_WINNER_COUNTER") {
              const defaultValue = Number(pendingRtm.counterBid || 0);
              const input = window.prompt("Enter counter bid", String(defaultValue));
              if (!input) return;
              const parsed = Number(input);
              if (!Number.isFinite(parsed) || parsed < defaultValue) return;
              resolveRtmDecision(gameCode!, { action: actionByStage[pendingRtm.status], actingTeamId: myTeamId!, counterBid: parsed });
              return;
            }
            resolveRtmDecision(gameCode!, { action: actionByStage[pendingRtm.status], actingTeamId: myTeamId! });
          }}
          onSecondary={() => {
            const actionByStage: Record<string, any> = {
              AWAIT_ORIGINAL: "DECLINE",
              AWAIT_WINNER_COUNTER: "DECLINE",
              AWAIT_ORIGINAL_MATCH: "DECLINE",
            };
            resolveRtmDecision(gameCode!, { action: actionByStage[pendingRtm.status], actingTeamId: myTeamId! });
          }}
        />
      )}
    </div>
  );
};

export default Auction;
