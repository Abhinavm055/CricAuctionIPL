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
  updateAuctionStats,
} from "@/lib/sessionService";
import { AIEngine } from "@/engine/aiEngine";
import { TeamDetailsPanel } from "@/components/TeamDetailsPanel";
import { RTMModal } from "@/components/RTMModal";
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

const STRATEGY_AGGRESSION: Record<string, number> = {
  aggressive: 1.2,
  balanced: 1,
  budget: 0.9,
  starHunter: 1.15,
  roleFocused: 1.05,
};

const SET_LABELS: Record<string, string> = {
  batters: 'Batters',
  bowlers: 'Bowlers',
  'all-rounders': 'All-Rounders',
  wicketkeepers: 'Wicketkeepers',
  marquee: 'Marquee',
  uncapped: 'Uncapped',
  accelerated: 'Accelerated',
};

const SET_ORDER = ['marquee', 'batters', 'all-rounders', 'wicketkeepers', 'bowlers', 'uncapped', 'accelerated'];

const normalizePoolKey = (pool: string | undefined) => {
  const key = String(pool || '').toLowerCase().replace(/\s+/g, '').replace('wicket-keepers', 'wicketkeepers');
  if (['marquee'].includes(key)) return 'marquee';
  if (['batters', 'batsmen', 'batter'].includes(key)) return 'batters';
  if (['allrounders', 'all-rounders', 'all-rounder'].includes(key)) return 'all-rounders';
  if (['wicketkeepers', 'wicketkeeper', 'wicket-keeper'].includes(key)) return 'wicketkeepers';
  if (['bowlers', 'bowler'].includes(key)) return 'bowlers';
  if (['uncapped'].includes(key)) return 'uncapped';
  if (['accelerated', 'acceleratedround'].includes(key)) return 'accelerated';
  return 'uncapped';
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
  const prevTimerEndsAtRef = useRef<number>(0);
  const prevPendingRtmStatusRef = useRef<string | null>(null);

  const hasSyncedStatsRef = useRef(false);

  const playSound = useCallback((type: 'bid' | 'hammer' | 'tick') => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const t = ctx.currentTime;

      if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
      } else if (type === 'bid') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.05);
      } else if (type === 'hammer') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
      }
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

  useEffect(() => {
    if (!currentAuction || currentAuction.status !== 'RUNNING') return;
    if (!prevTimerEndsAtRef.current) {
      prevTimerEndsAtRef.current = timerEndsAtMs;
      return;
    }

    if (timerEndsAtMs > prevTimerEndsAtRef.current + 500) {
      setCommentary((prev) => ['Timer reset for fresh bid action.', ...prev].slice(0, 14));
    }

    prevTimerEndsAtRef.current = timerEndsAtMs;
  }, [timerEndsAtMs, currentAuction?.status, currentAuction?.activePlayerId]);

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
    playSound('hammer');
    await resolveAuction(gameCode);
  }, [gameCode, isHost, playSound]);

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
        aggressionLevel: STRATEGY_AGGRESSION[String((t as any).aiStrategy || 'balanced')] || 1,
      })),
      {
        id: (currentPlayer as any).id,
        name: (currentPlayer as any).name,
        role: (currentPlayer as any).role,
        rating: Number((currentPlayer as any).rating ?? (currentPlayer as any).starRating ?? 0),
        basePrice: Number((currentPlayer as any).basePrice || 0),
        overseas: Boolean((currentPlayer as any).overseas ?? (currentPlayer as any).isOverseas),
      },
      Number(currentAuction.currentBid || 0),
      currentAuction.currentBidderId,
    );

    if (!aiDecision) return;

    setAiThinkingTeamId(aiDecision.teamId);
    const thinkingTeam = teams.find((t) => t.id === aiDecision.teamId);
    setCommentary((prev) => [`${thinkingTeam?.shortName || "AI"} is thinking...`, ...prev].slice(0, 14));
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
        setCommentary((prev) => [`${previousTeam?.shortName || "Team"} backs out at ${amount}!`, ...prev].slice(0, 14));
      }

      const line = prevBidderRef.current
        ? `${team?.shortName || "Team"} raises bid to ${amount}!`
        : `${team?.shortName || "Team"} bids ${amount}`;
      setCommentary((prev) => [line, ...prev].slice(0, 14));
      playSound('bid');
    }

    if (currentAuction.status === "SOLD" && prevStatusRef.current !== "SOLD") {
      const team = teams.find((t) => t.id === currentAuction.currentBidderId);
      setBanner({ kind: 'SOLD', price: Number(currentAuction.currentBid || 0), team: team?.shortName || 'TEAM' });
      setCommentary((prev) => [`${currentPlayer?.name || 'Player'} SOLD to ${team?.shortName || 'TEAM'} for ${formatCrPrice(Number(currentAuction.currentBid || 0))}!`, ...prev].slice(0, 14));
      setTimeout(() => setBanner(null), 2000);
      playSound('hammer');
      speakLine('Sold!');
    }

    if (currentAuction.status === "UNSOLD" && prevStatusRef.current !== "UNSOLD") {
      setBanner({ kind: 'UNSOLD' });
      setCommentary((prev) => [`${currentPlayer?.name || "Player"} goes UNSOLD.`, ...prev].slice(0, 14));
      setTimeout(() => setBanner(null), 2000);
      playSound('hammer');
    }

    prevBidRef.current = Number(currentAuction.currentBid || 0);
    prevBidderRef.current = currentAuction.currentBidderId || null;
    prevStatusRef.current = currentAuction.status || "IDLE";
  }, [currentAuction, teams, currentPlayer, playSound, speakLine]);

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
      playSound('tick');
      speakLine('Going once');
      spokenMarksRef.current.three = playerKey;
    }

    if (timerSeconds === 1 && spokenMarksRef.current.one !== playerKey) {
      playSound('tick');
      speakLine('Going twice');
      spokenMarksRef.current.one = playerKey;
    }

    if (timerSeconds === 0) playSound('hammer');
  }, [timerSeconds, currentAuction?.status, currentAuction?.activePlayerId, playSound, speakLine]);

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
    if (!pendingRtm?.status) {
      prevPendingRtmStatusRef.current = null;
      return;
    }

    if (prevPendingRtmStatusRef.current === pendingRtm.status) return;

    if (pendingRtm.status === 'AWAIT_ORIGINAL') {
      setCommentary((prev) => [`${rtmOriginalTeam?.shortName || 'Original Team'} can use RTM now.`, ...prev].slice(0, 14));
    }

    if (pendingRtm.status === 'AWAIT_WINNER_COUNTER') {
      setCommentary((prev) => [`${rtmOriginalTeam?.shortName || 'Original Team'} uses RTM! ${rtmWinningTeam?.shortName || 'Bid Team'} can counter.`, ...prev].slice(0, 14));
    }

    if (pendingRtm.status === 'AWAIT_ORIGINAL_MATCH') {
      const counterAmount = formatCrPrice(Number(pendingRtm.counterBid || pendingRtm.finalBid || 0));
      setCommentary((prev) => [`${rtmWinningTeam?.shortName || 'Bid Team'} raises counter bid to ${counterAmount}.`, ...prev].slice(0, 14));
    }

    prevPendingRtmStatusRef.current = pendingRtm.status;
  }, [pendingRtm?.status, pendingRtm?.counterBid, pendingRtm?.finalBid, rtmOriginalTeam?.shortName, rtmWinningTeam?.shortName]);

  useEffect(() => {
    if (!gameCode || !pendingRtm || !rtmControllerTeam?.isAI || !rtmControllerTeamId) return;

    const key = `${pendingRtm.playerId}-${pendingRtm.status}-${pendingRtm.finalBid}-${pendingRtm.counterBid}`;
    if (rtmAiDecisionKeyRef.current === key) return;
    rtmAiDecisionKeyRef.current = key;

    const timer = window.setTimeout(() => {
      (async () => {
      if (pendingRtm.status === "AWAIT_ORIGINAL") {
        const pSnap = await getDoc(doc(db, "players", pendingRtm.playerId));
        const rating = Number(pSnap.data()?.rating ?? pSnap.data()?.starRating ?? 0);
        const tSnap = await getDoc(doc(db, "sessions", gameCode, "teams", pendingRtm.originalTeamId!));
        const tPurse = Number(tSnap.data()?.purseRemaining || 0);

        const shouldUse = rating >= 4 && tPurse >= Number(pendingRtm.finalBid || 0);
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
      })().catch(() => undefined);
    }, 1200 + Math.floor(Math.random() * 1200));

    return () => window.clearTimeout(timer);
  }, [gameCode, pendingRtm, rtmControllerTeam?.isAI, rtmControllerTeamId]);

  const recentPurchases = useMemo(() => {
    const purchases = (session?.recentPurchases || []) as Array<{ playerId: string; price: number; teamId: string }>;
    return purchases;
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

  const setProgress = useMemo(() => {
    const queue = (session?.auctionQueue || []) as string[];
    const queueIndex = Number(session?.queueIndex ?? -1);
    const currentPool = normalizePoolKey(String((currentPlayer as any)?.pool || ''));
    const activeSetLabel = SET_LABELS[currentPool] || 'General';
    const currentSetIndex = SET_ORDER.indexOf(currentPool);

    if (!queue.length) return { activeSetLabel, playersRemainingInSet: 0, currentSetIndex };

    const startIndex = Math.max(0, queueIndex);
    const remainingIds = queue.slice(startIndex);
    const remainingInSet = remainingIds.filter((id) => {
      const player = playerById.get(id);
      return normalizePoolKey(String((player as any)?.pool || '')) === currentPool;
    }).length;

    return { activeSetLabel, playersRemainingInSet: Math.max(0, remainingInSet), currentSetIndex };
  }, [session?.auctionQueue, session?.queueIndex, currentPlayer, playerById]);

  const remainingSetPlayers = useMemo(() => {
    const queue = (session?.auctionQueue || []) as string[];
    const queueIndex = Number(session?.queueIndex ?? -1);
    const currentPool = normalizePoolKey(String((currentPlayer as any)?.pool || ''));
    const startIndex = Math.max(0, queueIndex);

    return queue
      .slice(startIndex)
      .filter((id) => normalizePoolKey(String((playerById.get(id) as any)?.pool || '')) === currentPool)
      .map((id) => String((playerById.get(id) as any)?.name || id))
      .slice(0, 25);
  }, [session?.auctionQueue, session?.queueIndex, currentPlayer, playerById]);

  const auctionEnded = (session?.phase === "AUCTION_COMPLETE" || session?.phase === "ENDED") || (queueLength > 0 && Number(session?.queueIndex ?? -1) >= queueLength);
  useEffect(() => {
    if (!auctionEnded || !isHost || !session || !leaderboard.length || hasSyncedStatsRef.current) return;
    const winnerTeamId = leaderboard[0]?.id;
    if (!winnerTeamId) return;

    updateAuctionStats(gameCode!, winnerTeamId, session.selectedTeams || {}, session.managerNames || {})
      .then(() => {
        hasSyncedStatsRef.current = true;
      })
      .catch(() => undefined);
  }, [auctionEnded, isHost, session, leaderboard, gameCode]);

  const bestBuyStats = useMemo(() => {
    if (!auctionEnded) return null;
    let highestPrice = 0;
    let mostExpensivePlayer: any = null;
    let highestBiddingTeam: TeamState | null = null;

    teams.forEach(t => {
      Object.entries(t.playerPurchasePrices || {}).forEach(([playerId, price]) => {
        if (price > highestPrice) {
          highestPrice = price;
          highestBiddingTeam = t;
          mostExpensivePlayer = masterPlayerList.find((p: any) => p.id === playerId);
        }
      });
    });

    return { player: mostExpensivePlayer, team: highestBiddingTeam, price: highestPrice };
  }, [auctionEnded, teams, masterPlayerList]);

  if (!session || !userTeam) return <p className="p-6">Loading auction…</p>;

  return (
    <div className="h-screen broadcast-container flex flex-col overflow-hidden">
      <Header
        gameCode={gameCode!}
        currentSetLabel={`${typeof setProgress.currentSetIndex === "number" && setProgress.currentSetIndex >= 0 ? `Set ${setProgress.currentSetIndex + 1}: ` : ""}${setProgress.activeSetLabel}`}
        onSkip={gameCode && isHost ? () => skipCurrentPlayer(gameCode) : undefined}
        onPauseToggle={gameCode && isHost ? () => togglePauseAuction(gameCode) : undefined}
        isPaused={currentAuction?.status === "PAUSED"}
        canControl={Boolean(isHost)}
        onLeaveGame={async () => {
          if (!gameCode) return;
          await leaveGame(gameCode, userId);
          navigate(`/`);
        }}
      />

      {banner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4">
          <div className="relative">
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 text-4xl md:text-5xl animate-[hammerDrop_0.45s_ease-out]">🔨</div>
            <div className="absolute inset-0 rounded-2xl border-2 border-white/20 animate-[hammerImpact_0.45s_ease-out]" />
            <div
              className={`min-w-[260px] rounded-2xl border px-7 py-5 text-center shadow-2xl animate-[resultPop_0.35s_ease-out] ${banner.kind === 'SOLD' ? 'border-green-500 text-green-400 bg-green-900/30 shadow-[0_0_30px_rgba(34,197,94,0.35)]' : 'border-red-500 text-red-400 bg-red-900/30 shadow-[0_0_30px_rgba(248,113,113,0.35)]'}`}
            >
              <p className="text-3xl md:text-4xl font-display">{banner.kind}</p>
              {banner.kind === 'SOLD' ? (
                <>
                  <p className="text-lg md:text-2xl font-semibold mt-2">{formatCrPrice(Number(banner.price || 0))}</p>
                  <p className="text-xl md:text-3xl font-display mt-1">{banner.team}</p>
                </>
              ) : (
                <p className="text-base mt-2">Player UNSOLD</p>
              )}
            </div>
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
        <div className="p-6 mx-auto max-w-4xl w-full">
          <div className="border border-yellow-500/40 rounded-xl p-8 bg-card/60 shadow-[0_0_30px_rgba(250,204,21,0.15)] space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-4xl md:text-5xl font-display text-primary">Auction Complete</h2>
              {leaderboard[0] && (
                <p className="text-xl">
                  Winner: <span className="text-yellow-400 font-bold">{leaderboard[0].shortName}</span>
                </p>
              )}
            </div>

            {bestBuyStats && bestBuyStats.player && (
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-5 rounded-xl border border-white/10 bg-[#0f172a]/80">
                <div className="text-center md:text-left">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">BEST BUY</p>
                  <p className="text-2xl font-bold text-yellow-100">{bestBuyStats.player.name}</p>
                  <p className="text-sm text-yellow-400">Sold to {bestBuyStats.team?.shortName}</p>
                </div>
                <div className="text-center md:text-right">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">HIGHEST BID</p>
                  <p className="text-3xl font-display text-yellow-400">{formatCrPrice(bestBuyStats.price)}</p>
                </div>
              </div>
            )}

            <div className="space-y-2 mt-6">
              <h3 className="text-xl font-display mb-3">Final Leaderboard</h3>
              {leaderboard.map((team, index) => (
                <div key={team.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#111c34] px-4 py-3">
                  <div className="flex items-center gap-3">
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
          <div className="relative">
            <div className="border-y border-yellow-500/40 bg-[#061734] overflow-hidden py-1.5">
              <div className="whitespace-nowrap animate-[marquee_28s_linear_infinite] text-xs md:text-sm text-yellow-100 px-4">
                {commentaryTicker} &nbsp; • &nbsp; {commentaryTicker}
              </div>
            </div>

            <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 translate-y-[-35%] z-20">
              <div className="relative h-[96px] w-[96px] md:h-[120px] md:w-[120px] rounded-full bg-[#020617] border border-yellow-400/30 grid place-items-center shadow-[0_0_24px_rgba(251,191,36,0.35)]">
                <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(251,191,36,0.22)" strokeWidth="8" />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="rgba(251,191,36,0.95)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 50}
                    strokeDashoffset={(2 * Math.PI * 50) - (((Math.max(0, Math.floor(timerSeconds))) / (currentAuction?.status === 'RUNNING' ? (session?.isAcceleratedRound ? 10 : 30) : 30)) * (2 * Math.PI * 50))}
                    className="transition-[stroke-dashoffset] duration-500"
                  />
                </svg>
                <span className="font-display text-2xl md:text-4xl leading-none text-yellow-200">{Math.max(0, Math.floor(timerSeconds)).toString().padStart(2, '0')}</span>
              </div>
            </div>
          </div>

          <main className="flex-1 overflow-y-auto p-3 md:p-5">
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_5fr_3fr] gap-4 min-h-full">
              <div className="order-3 lg:order-1">
                <TeamGrid
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
                />
              </div>

              <div className="order-1 lg:order-2 h-full overflow-hidden">
                <div className="h-full rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3 overflow-hidden">
                  {currentPlayer && currentAuction?.status === 'RUNNING' && (
                    <div key={currentAuction?.activePlayerId || "player-card"} className="animate-[playerSpotlight_0.8s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards] h-full relative isolate">
                      <div className="absolute inset-0 bg-yellow-400/20 rounded-xl filter blur-xl animate-[pulseGlow_1.5s_ease-in-out_infinite_alternate] -z-10" />
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

              <div className="order-2 lg:order-3 h-full">
                <BidControls
                  currentBid={displayedCurrentBid}
                  canBid={canTeamBid(userTeam, currentPlayer, nextBid)}
                  onBid={handleBid}
                  onPass={() => setCommentary((prev) => ["GT passes.", ...prev].slice(0, 14))}
                  recentPurchases={recentPurchases.slice(0, 8).map((p) => {
                    const pl = masterPlayerList.find((x: any) => x.id === p.playerId);
                    const team = teams.find((t) => t.id === p.teamId);
                    return {
                      playerName: pl?.name || p.playerId,
                      teamShortName: team?.shortName || p.teamId,
                      price: p.price,
                    };
                  })}
                  upcomingPlayers={remainingSetPlayers}
                />
              </div>
            </div>
          </main>



          <style>{`
            @keyframes marquee { from { transform: translateX(-50%); } to { transform: translateX(0); } }
            @keyframes teamBidGlow { 0% { box-shadow: 0 0 0 rgba(250,204,21,0); } 35% { box-shadow: 0 0 28px rgba(250,204,21,0.8); } 100% { box-shadow: 0 0 0 rgba(250,204,21,0); } }
            @keyframes bidPop { 0% { transform: scale(0.75); opacity: .6; } 100% { transform: scale(1); opacity: 1; } }
            @keyframes starGlow { 0%,100% { box-shadow: 0 0 10px rgba(250,204,21,0.2);} 50% { box-shadow: 0 0 20px rgba(250,204,21,0.6);} }
            @keyframes timerShake { 0%,100% { transform: translateX(0);} 50% { transform: translateX(-1px);} }
            @keyframes soldPop { 0% { transform: scale(0.75);} 100% { transform: scale(1);} }
            @keyframes resultPop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
            @keyframes playerEntry { 0% { transform: translateY(40px) scale(0.97); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
            @keyframes rtmFade { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
            @keyframes hammerDrop { 0% { transform: translate(-50%, -45px) rotate(-25deg); opacity: 0; } 70% { transform: translate(-50%, 0) rotate(10deg); opacity: 1; } 100% { transform: translate(-50%, -5px) rotate(0deg); opacity: 1; } }
            @keyframes hammerImpact { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1.12); opacity: 0; } }
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
