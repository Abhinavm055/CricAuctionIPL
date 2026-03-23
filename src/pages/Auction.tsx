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
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());

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
  const spokenMarksRef = useRef<Record<string, Set<number>>>({});
  const prevTimerEndsAtRef = useRef<number>(0);
  const prevPendingRtmStatusRef = useRef<string | null>(null);

  const hasSyncedStatsRef = useRef(false);

  const playSound = useCallback((type: 'bid' | 'hammer' | 'tick' | 'cheer' | 'ooh') => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'tick') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
      } else if (type === 'bid') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        osc.start(t);
        osc.stop(t + 0.05);
      } else if (type === 'hammer') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
      } else if (type === 'cheer') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.linearRampToValueAtTime(520, t + 0.35);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
        osc.start(t);
        osc.stop(t + 0.45);
      } else if (type === 'ooh') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.5);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.5);
      }
    } catch {
      // no-op
    }
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
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

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
  const isSpectator = !myTeamId;
  const auctionModeLabel = session?.mode === "VS_AI" ? "VS AI" : "Multiplayer";

  useEffect(() => {
    if (!gameCode || !session?.disconnectedPlayers?.[userId]) return;
    rejoinGame(gameCode, userId).catch(() => undefined);
  }, [gameCode, userId, session?.disconnectedPlayers]);

  const currentAuction = session?.currentAuction;
  const pendingRtm = session?.pendingRtm;

  const aiEngine = useMemo(() => new AIEngine(), []);

  const playerById = useMemo(() => new Map(masterPlayerList.map((p: any) => [p.id, p])), [masterPlayerList]);

  const currentPlayer = useMemo(() => masterPlayerList.find((p: any) => p.id === currentAuction?.activePlayerId) || null, [masterPlayerList, currentAuction?.activePlayerId]);
  const displayedCurrentBid = optimisticBid ?? Number(currentAuction?.currentBid || 0);
  const displayedCurrentBidderId = optimisticBidderId ?? (currentAuction?.currentBidderId || null);
  const currentBidderTeam = teams.find((team) => team.id === displayedCurrentBidderId);

  const nextBid = getNextBid(displayedCurrentBid || 0);
  const timerEndsAtMs = currentAuction?.timerEndsAt?.toMillis?.() || 0;
  const timerSeconds = Math.max(0, Math.floor((timerEndsAtMs - nowMs) / 1000));

  const nextBid = getNextBid(currentAuction?.currentBid || 0);
  const timerSeconds = Math.max(0, Math.floor(((currentAuction?.timerEndsAt?.toMillis?.() || nowMs) - nowMs) / 1000));

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

  const canTeamBid = useCallback((team: TeamState | undefined, player: Player | null, amount: number) => {
    if (!team || !player) return false;
    if (currentAuction?.status !== "RUNNING") return false;
    if (displayedCurrentBidderId === team.id) return false;
    if (Number(team.purseRemaining || 0) < amount) return false;
    if (Number(team.squadSize || 0) >= SQUAD_CONSTRAINTS.MAX_SQUAD) return false;
    if (isOverseasPlayer(player) && Number(team.overseasCount || 0) >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) return false;
    return true;
  }, [currentAuction?.status, currentAuction?.currentBidderId]);

  const skipDisabled = useMemo(() => {
    if (isAIMode) return false;
    if (!currentPlayer || !currentAuction) return true;
    return Number(currentAuction.currentBid || 0) > Number((currentPlayer as any).basePrice || 0);
  }, [currentPlayer, currentAuction, isAIMode]);

  const handleSkip = useCallback(async () => {
    if (!gameCode || !isHost) return;

    if (isAIMode && currentPlayer && currentAuction?.status === "RUNNING") {
      const result = aiEngine.simulateSkipOutcome(
        {
          id: (currentPlayer as any).id,
          name: (currentPlayer as any).name,
          role: (currentPlayer as any).role,
          rating: Number((currentPlayer as any).rating ?? (currentPlayer as any).starRating ?? 50),
          basePrice: Number((currentPlayer as any).basePrice || 0),
          overseas: Boolean((currentPlayer as any).overseas ?? (currentPlayer as any).isOverseas),
          demandLevel: (currentPlayer as any).demandLevel,
          interestedTeams: (currentPlayer as any).interestedTeams || [],
        },
        teams.map((team) => ({
          id: team.id,
          isAI: Boolean(team.isAI),
          squadSize: Number(team.squadSize || 0),
          purseRemaining: Number(team.purseRemaining || 0),
          overseasCount: Number(team.overseasCount || 0),
        })),
      );

      if (result.sold && result.teamId && Number.isFinite(result.price)) {
        await placeBid(gameCode, result.teamId, result.price);
        await resolveAuction(gameCode);
        return;
      }
    }

    await skipCurrentPlayer(gameCode);
  }, [gameCode, isHost, isAIMode, currentPlayer, currentAuction?.status, teams, aiEngine]);

  const handleBid = useCallback(async (amount: number) => {
    if (!gameCode || !myTeamId || !userTeam || !currentPlayer) return;
    if (!canTeamBid(userTeam, currentPlayer, amount)) return;
    await placeBid(gameCode, myTeamId, amount);
  }, [gameCode, myTeamId, userTeam, currentPlayer, canTeamBid]);

  const handleFinalize = useCallback(async () => {
    if (!gameCode || !isHost) return;
    playTone(220, 0.2, 0.08); // hammer
    await resolveAuction(gameCode);
  }, [gameCode, isHost, playTone]);

  const handleSimulateAiAuction = useCallback(async () => {
    if (!gameCode || !isHost || session?.mode !== "VS_AI" || !currentPlayer || currentAuction?.status !== "RUNNING") return;

    let simulatedBid = Number(currentAuction.currentBid || 0);
    let simulatedBidderId = currentAuction.currentBidderId || null;

    for (let i = 0; i < 50; i += 1) {
      const decision = aiEngine.decideForAuction(
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
        simulatedBid,
        simulatedBidderId,
      );

      if (!decision) break;
      await placeBid(gameCode, decision.teamId, decision.bid);
      simulatedBid = decision.bid;
      simulatedBidderId = decision.teamId;
    }

    await resolveAuction(gameCode);
  }, [gameCode, isHost, session?.mode, currentPlayer, currentAuction?.status, currentAuction?.currentBid, currentAuction?.currentBidderId, aiEngine, teams]);

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
    const timer = setTimeout(() => placeBid(gameCode, aiDecision.teamId, aiDecision.bid).catch(() => undefined), aiDecision.delayMs);
    return () => clearTimeout(timer);
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
      playSound('cheer');
      speakLine(`Sold to ${team?.shortName || 'Team'}`);
    }

    if (currentAuction.status === "UNSOLD" && prevStatusRef.current !== "UNSOLD") {
      setBanner({ kind: 'UNSOLD' });
      setCommentary((prev) => [`${currentPlayer?.name || "Player"} goes UNSOLD.`, ...prev].slice(0, 14));
      setTimeout(() => setBanner(null), 2000);
      playSound('hammer');
      playSound('ooh');
      speakLine('Unsold');
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
  }, [currentAuction, session?.pendingRtm]);

  useEffect(() => {
    if (!isHost || !gameCode || !currentAuction) return;
    if (!['SOLD', 'UNSOLD'].includes(currentAuction.status || '') || pendingRtm) return;

    const key = `${currentAuction.activePlayerId}-${currentAuction.status}`;
    if (autoAdvanceHostTimeoutRef.current) window.clearTimeout(autoAdvanceHostTimeoutRef.current);

    autoAdvanceHostTimeoutRef.current = window.setTimeout(() => {
      if (autoAdvanceKeyRef.current !== key) return;
      loadNextPlayer(gameCode).catch(() => undefined);
    }, 3000);
  }, [isHost, gameCode, currentAuction, session?.pendingRtm]);

  useEffect(() => {
    if (!isHost || !gameCode || !session?.pendingRtm?.expiresAt) return;

    const ms = Math.max(0, session.pendingRtm.expiresAt.toMillis() - Date.now());
    const timeout = window.setTimeout(() => {
      resolveRtmTimeout(gameCode).catch(() => undefined);
    }, ms + 100);

    return () => window.clearTimeout(timeout);
  }, [isHost, gameCode, session?.pendingRtm?.status, session?.pendingRtm?.expiresAt]);

  useEffect(() => {
    if (!isHost || !gameCode) return;
    if (timerSeconds !== 0) return;
    if (currentAuction?.status !== 'RUNNING') return;

    resolveAuction(gameCode).catch(() => undefined);
  }, [isHost, gameCode, timerSeconds, currentAuction?.status]);


  useEffect(() => {
    if (!isHost || !gameCode || !session?.pendingRtm?.expiresAt) return;

    const ms = Math.max(0, session.pendingRtm.expiresAt.toMillis() - Date.now());
    const timeout = window.setTimeout(() => {
      resolveRtmTimeout(gameCode).catch(() => undefined);
    }, ms + 100);

    return () => window.clearTimeout(timeout);
  }, [isHost, gameCode, session?.pendingRtm?.status, session?.pendingRtm?.expiresAt]);

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
      return `${pl?.name || p.playerId} sold to ${team?.shortName || p.teamId} for ₹${(p.price / 10000000).toFixed(2)}Cr`;
    });
    return saleLines.length ? saleLines.join(' • ') : 'Auction is live • Waiting for next bid •';
  }, [recentPurchases, masterPlayerList, teams]);

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

  const auctionEnded = (session?.phase === "AUCTION_COMPLETE") || (queueLength > 0 && Number(session?.queueIndex ?? -1) >= queueLength);

  if (!session || (myTeamId && !userTeam)) return <p className="p-6">Loading auction…</p>;

  return (
    <div className="h-screen broadcast-container flex flex-col overflow-hidden">
      <Header
        gameCode={gameCode!}
        timerSeconds={Math.max(0, Math.floor(timerSeconds))}
        currentPool={(currentPlayer as any)?.pool}
        playersRemaining={Math.max(queueLength - ((session?.queueIndex ?? -1) + 1), 0)}
        totalPlayers={queueLength}
      />

      <Sheet open={teamDrawerOpen} onOpenChange={setTeamDrawerOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm bg-[#071a3a] border-yellow-500/40 p-3">
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
            onSelectTeam={(teamId) => {
              setSelectedTeamId(teamId);
              setTeamDrawerOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

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
        </div>
      )}

          <main className="flex-1 overflow-hidden p-4 md:p-5">
            <div className="grid h-full grid-cols-[3fr_5fr_2fr] gap-4">
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
                onSelectTeam={(teamId) => setSelectedTeamId(teamId)}
              />

              <div className="h-full overflow-hidden">
                <div className="h-full rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3 overflow-hidden">
                  {currentPlayer && currentAuction?.status === 'RUNNING' && (
                    <PlayerCard
                      player={currentPlayer as any}
                      currentBid={Number(currentAuction.currentBid || 0)}
                      currentBidderId={currentBidderTeam?.id || null}
                      currentBidderName={currentBidderTeam?.shortName || 'BID'}
                    />
                  )}

                  {currentAuction?.status === 'PAUSED' && <p className="text-lg font-semibold text-yellow-400 mt-6">Auction Paused by Host</p>}

                  {(!currentPlayer || !['RUNNING', 'PAUSED'].includes(currentAuction?.status)) && !['SOLD', 'UNSOLD'].includes(currentAuction?.status || '') && (
                    <div className="mt-8 text-center">
                      {isHost ? <Button onClick={() => loadNextPlayer(gameCode!)}>Start Auction</Button> : <p className="text-muted-foreground">Waiting for host to start auction.</p>}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-full">
                <BidControls
                  currentBid={currentAuction?.currentBid || 0}
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

          <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
        </>
      )}

      <TeamDetailsPanel
        open={!!selectedTeamId}
        onOpenChange={(open) => !open && setSelectedTeamId(null)}
        team={teams.find((t) => t.id === selectedTeamId) || null}
        retainedPlayers={selectedTeamId ? teamPlayersResolved[selectedTeamId]?.retained || [] : []}
        boughtPlayers={selectedTeamId ? teamPlayersResolved[selectedTeamId]?.bought || [] : []}
        playerPrices={selectedTeamId ? teams.find((t) => t.id === selectedTeamId)?.playerPurchasePrices || {} : {}}
      />

      <RemainingPlayersPanel
        open={showRemainingPlayers}
        onOpenChange={setShowRemainingPlayers}
        upcomingPlayers={upcomingPlayers}
        unsoldPlayers={unsoldPlayersResolved}
      />

      {!!pendingRtm && isHost && (
        <RTMModal
          open={true}
          stage={pendingRtm.status}
          player={rtmPlayer as any}
          originalTeamName={rtmOriginalTeam?.name}
          winningTeamName={rtmWinningTeam?.name}
          finalBid={Number(pendingRtm.finalBid || 0)}
          countdownSeconds={Math.max(0, Math.ceil(((pendingRtm?.expiresAt?.toMillis?.() || nowMs) - nowMs) / 1000))}
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
