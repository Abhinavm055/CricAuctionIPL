import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useUserId } from "@/hooks/useUserId";
import { PlayerCard } from "@/components/PlayerCard";
import { Player } from "@/lib/samplePlayers";
import { useGameData } from "@/contexts/GameDataContext";
import { cn } from "@/lib/utils";
import { getNextBid, IPL_TEAMS, SQUAD_CONSTRAINTS, AUCTION_TIMER, BID_RESET_TIMER, preloadImage, isImagePreloaded, COMMENTARY_VOICE_CONFIG } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Sparkles, Award } from "lucide-react";
import {
  resolveAuction,
  listenSession,
  listenTeams,
  placeBid,
  resolveRtmDecision,
  resolveRtmTimeout,
  loadNextPlayer,
  markPlayerReadyForNext,
  skipCurrentPlayer,
  skipRemainingSet,
  togglePauseAuction,
  startAcceleratedRound,
  skipAcceleratedRound,
  leaveGame,
  rejoinGame,
  updateAuctionStats,
  resolveHostReconnectTimeout,
  endGameByHost,
} from "@/lib/sessionService";
import { AIEngine } from "@/engine/aiEngine";
import { TeamDetailsPanel } from "@/components/TeamDetailsPanel";
import { RTMModal } from "@/components/RTMModal";
import { BidInputModal } from "@/components/BidInputModal";
import { SoldModal } from "@/components/SoldModal";
import { TeamLogo } from "@/components/TeamLogo";
import { Header } from "@/components/Header";
import { PoolTransition } from "@/components/PoolTransition";
import { TeamGrid } from "@/components/TeamGrid";
import { BidControls } from "@/components/BidControls";
import { CircularAuctionTimer } from "@/components/CircularAuctionTimer";
import { BidTimer } from "@/components/BidTimer";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { enrichPlayersWithDynamicValue } from "@/lib/playerValue";

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
  lastDecision?: { action?: string; actingTeamId?: string; amount?: number; createdAt?: { toMillis?: () => number } };
  expiresAt?: { toMillis?: () => number };
}

const isOverseasPlayer = (player: any) => Boolean(player?.overseas ?? player?.isOverseas);

const formatCrPrice = (amount: number) => `₹${(Number(amount || 0) / 10000000).toFixed(2)} Cr`;

const preloadCache = new Map<string, boolean>();
let totalLoadTimesSum = 0;
let loadedImagesCount = 0;

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

const SET_ORDER = [
  'marquee-1', 'marquee-2',
  'batters-1', 'batters-2', 'batters-3', 'batters-4',
  'bowlers-1', 'bowlers-2', 'bowlers-3', 'bowlers-4',
  'wicketkeepers-1', 'wicketkeepers-2', 'wicketkeepers-3', 'wicketkeepers-4',
  'all-rounders-1', 'all-rounders-2', 'all-rounders-3', 'all-rounders-4',
];

const SET_LABELS: Record<string, string> = {
  'marquee-1': 'Marquee Set 1',
  'marquee-2': 'Marquee Set 2',
  'batters-1': 'Batsmen - Set 1',
  'batters-2': 'Batsmen - Set 2',
  'batters-3': 'Batsmen - Set 3',
  'batters-4': 'Batsmen - Set 4',
  'bowlers-1': 'Bowlers - Set 1',
  'bowlers-2': 'Bowlers - Set 2',
  'bowlers-3': 'Bowlers - Set 3',
  'bowlers-4': 'Bowlers - Set 4',
  'wicketkeepers-1': 'Wicket Keepers - Set 1',
  'wicketkeepers-2': 'Wicket Keepers - Set 2',
  'wicketkeepers-3': 'Wicket Keepers - Set 3',
  'wicketkeepers-4': 'Wicket Keepers - Set 4',
  'all-rounders-1': 'All-Rounders - Set 1',
  'all-rounders-2': 'All-Rounders - Set 2',
  'all-rounders-3': 'All-Rounders - Set 3',
  'all-rounders-4': 'All-Rounders - Set 4',
};

const normalizeCategoryKey = (raw: string | undefined) => {
  const key = String(raw || '').toLowerCase().replace(/\s+/g, '').replace('wicket-keepers', 'wicketkeepers');
  if (key.includes('marquee')) return 'marquee';
  if (['batters', 'batsmen', 'batter', 'batsman'].some((v) => key.includes(v))) return 'batters';
  if (['allrounders', 'all-rounders', 'all-rounder'].some((v) => key.includes(v))) return 'all-rounders';
  if (['wicketkeepers', 'wicketkeeper', 'wicket-keeper'].some((v) => key.includes(v))) return 'wicketkeepers';
  if (['bowlers', 'bowler'].some((v) => key.includes(v))) return 'bowlers';
  return 'batters';
};

const resolveSetKey = (player: any) => {
  const category = normalizeCategoryKey(String(player?.category || player?.pool || player?.role || ''));
  const rawSet = Number(player?.setNumber ?? player?.set ?? player?.setNo);
  const rawMarqueeSet = Number(player?.marqueeSet);
  if (category === 'marquee') {
    const setNo = Number.isFinite(rawMarqueeSet) && rawMarqueeSet > 0
      ? rawMarqueeSet
      : (Number.isFinite(rawSet) && rawSet > 0 ? rawSet : 1);
    return `marquee-${Math.max(1, Math.min(2, Math.floor(setNo)))}`;
  }
  const setNo = Number.isFinite(rawSet) && rawSet > 0 ? rawSet : 1;
  return `${category}-${Math.max(1, Math.min(4, Math.floor(setNo)))}`;
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
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<TeamState[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pendingRtm, setPendingRtm] = useState<PendingRtmState | null>(null);
  const [banner, setBanner] = useState<{ kind: 'SOLD' | 'UNSOLD'; price?: number; team?: string } | null>(null);
  const [optimisticBid, setOptimisticBid] = useState<number | null>(null);
  const [optimisticBidderId, setOptimisticBidderId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [glowingTeamId, setGlowingTeamId] = useState<string | null>(null);
  const [teamDrawerOpen, setTeamDrawerOpen] = useState(false);
  const [rtmSubmissionLocked, setRtmSubmissionLocked] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [showAcceleratedConfirm, setShowAcceleratedConfirm] = useState(false);
  const [activeBidOverlay, setActiveBidOverlay] = useState<{ teamShortName: string; amountStr: string } | null>(null);
  const overlayTimerRef = useRef<number | null>(null);
  const suppressSoldBannerRef = useRef(false);
  const transitionStartRef = useRef<number>(0);
  const lastPlayerIdRef = useRef<string | null>(null);

  const userId = useUserId();
  const { masterPlayerList } = useGameData();

  const prevBidRef = useRef<number>(0);
  const prevBidderRef = useRef<string | null>(null);
  const prevStatusRef = useRef<string>("IDLE");
  const autoAdvanceKeyRef = useRef<string | null>(null);
  const autoAdvanceHostTimeoutRef = useRef<number | null>(null);
  const rtmAiDecisionKeyRef = useRef<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const spokenMarksRef = useRef<Record<string, Set<number>>>({});
  const prevTimerEndsAtRef = useRef<number>(0);
  const prevPendingRtmStatusRef = useRef<string | null>(null);
  const autoStartKeyRef = useRef<string | null>(null);

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
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1500, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.15);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.005, t + 0.15);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(950, t);
        osc2.frequency.exponentialRampToValueAtTime(500, t + 0.15);
        gain2.gain.setValueAtTime(0.18, t);
        gain2.gain.exponentialRampToValueAtTime(0.005, t + 0.15);

        osc.start(t);
        osc.stop(t + 0.15);
        osc2.start(t);
        osc2.stop(t + 0.15);
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

  const speakLine = useCallback((line: string) => {
    try {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.rate = COMMENTARY_VOICE_CONFIG.rate;
      utterance.pitch = COMMENTARY_VOICE_CONFIG.pitch;

      const voices = window.speechSynthesis.getVoices();
      let matchedVoice = null;
      for (const name of COMMENTARY_VOICE_CONFIG.preferredNames) {
        const v = voices.find(voice => voice.name.toLowerCase().includes(name));
        if (v) {
          matchedVoice = v;
          break;
        }
      }

      if (!matchedVoice && voices.length) {
        matchedVoice = voices.find(voice => voice.name.toLowerCase().includes('female')) || voices[0];
      }

      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("[Announcer] TTS failed to play:", err);
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

  useEffect(() => {
    if (session && gameCode) {
      const isComplete =
        (session.phase === "AUCTION_COMPLETE" || session.phase === "ENDED") &&
        (session.queueIndex ?? -1) >= (session.auctionQueue || []).length &&
        (session.isAcceleratedRound || session.acceleratedRoundSkipped);

      if (isComplete) {
        navigate(`/summary/${gameCode}`);
      }
    }
  }, [session, gameCode, navigate]);

  const isHost = session?.hostId === userId;
  const queueLength = (session?.auctionQueue || []).length;
  const myTeamId = Object.entries(session?.selectedTeams || {}).find(([, uid]) => uid === userId)?.[0] as string | undefined;
  const userTeam = teams.find((team) => team.id === myTeamId);

  useEffect(() => {
    if (!gameCode || !session?.disconnectedPlayers?.[userId]) return;
    rejoinGame(gameCode, userId).catch(() => undefined);
  }, [gameCode, userId, session?.disconnectedPlayers]);

  useEffect(() => {
    if (!gameCode || session?.hostReconnect?.status !== "PENDING") return;
    resolveHostReconnectTimeout(gameCode).catch(() => undefined);
    const timer = window.setInterval(() => {
      resolveHostReconnectTimeout(gameCode).catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [gameCode, session?.hostReconnect?.status, session?.hostReconnect?.deadlineAt]);

  const currentAuction = session?.currentAuction;

  useEffect(() => {
    if (!isHost || !gameCode || session?.phase !== "AUCTION") return;
    if (currentAuction?.activePlayerId || ["RUNNING", "PAUSED", "RTM", "SOLD", "UNSOLD"].includes(String(currentAuction?.status || ""))) return;

    const key = `${session?.phase}-${session?.queueIndex ?? -1}`;
    if (autoStartKeyRef.current === key) return;
    autoStartKeyRef.current = key;

    loadNextPlayer(gameCode).catch(() => undefined);
  }, [isHost, gameCode, session?.phase, session?.queueIndex, currentAuction?.activePlayerId, currentAuction?.status]);

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
  const enrichedPlayers = useMemo(() => enrichPlayersWithDynamicValue(masterPlayerList as any[]), [masterPlayerList]);
  const playerById = useMemo(() => new Map(enrichedPlayers.map((p: any) => [p.id, p])), [enrichedPlayers]);

  const currentPlayer = useMemo(() => playerById.get(currentAuction?.activePlayerId) || null, [playerById, currentAuction?.activePlayerId]);
  
  // Preload next player image while current player is active
  const queueList = (session?.auctionQueue || []) as string[];
  const qIndex = Number(session?.queueIndex ?? -1);
  const nextPlayerId = qIndex >= 0 && qIndex + 1 < queueList.length ? queueList[qIndex + 1] : null;
  const nextPlayer = useMemo(() => nextPlayerId ? playerById.get(nextPlayerId) || null : null, [playerById, nextPlayerId]);

  useEffect(() => {
    if (nextPlayer) {
      const imgUrl = (nextPlayer as any).image || (nextPlayer as any).imageUrl;
      if (imgUrl) {
        preloadImage(imgUrl).catch(() => undefined);
      }
    }
  }, [nextPlayer]);

  const displayedCurrentBid = optimisticBid ?? Number(currentAuction?.currentBid || 0);
  const displayedCurrentBidderId = optimisticBidderId ?? (currentAuction?.currentBidderId || null);
  const currentBidderTeam = teams.find((team) => team.id === displayedCurrentBidderId);

  const [displayedPlayer, setDisplayedPlayer] = useState<Player | null>(null);
  const [displayedPlayerBid, setDisplayedPlayerBid] = useState<number>(0);
  const [displayedPlayerBidderId, setDisplayedPlayerBidderId] = useState<string | null>(null);
  const [displayedPlayerBidderName, setDisplayedPlayerBidderName] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);


  const nextBid = getNextBid(displayedCurrentBid || 0);
  const timerEndsAtMs = currentAuction?.timerEndsAt?.toMillis?.() || 0;

  useEffect(() => {
    if (!currentAuction || currentAuction.status !== 'RUNNING') return;
    if (!prevTimerEndsAtRef.current) {
      prevTimerEndsAtRef.current = timerEndsAtMs;
      return;
    }



    prevTimerEndsAtRef.current = timerEndsAtMs;
  }, [timerEndsAtMs, currentAuction?.status, currentAuction?.activePlayerId]);

  const teamPlayersResolved = useMemo(() => {
    const lookup = new Map(enrichedPlayers.map((p: any) => [p.id, p]));
    return teams.reduce<Record<string, { retained: Player[]; bought: Player[] }>>((acc, team) => {
      acc[team.id] = {
        retained: (team.retainedPlayers || []).map((id) => lookup.get(id)).filter(Boolean) as Player[],
        bought: (team.players || []).map((id) => lookup.get(id)).filter(Boolean) as Player[],
      };
      return acc;
    }, {});
  }, [teams, enrichedPlayers]);


  const isAIMode = String(session?.mode || "").toUpperCase() === "VS_AI";
  const aiOnlyTeamIds = useMemo(() => {
    const selectedTeams = (session?.selectedTeams || {}) as Record<string, string>;
    return Object.entries(selectedTeams)
      .filter(([, uid]) => String(uid || "").startsWith("AI-"))
      .map(([teamId]) => teamId);
  }, [session?.selectedTeams]);
  const hasBidActivity = useMemo(() => {
    if (!currentAuction || !currentPlayer) return false;
    const base = Number((currentPlayer as any).basePrice || 0);
    return Boolean(currentAuction.currentBidderId) || Number(currentAuction.currentBid || 0) > base;
  }, [currentAuction, currentPlayer]);

  const canAdvancePlayer = useMemo(() => {
    if (!isHost || !gameCode || !currentAuction?.activePlayerId) return false;
    if (pendingRtm || currentAuction?.isAuctionLocked) return false;
    if (currentAuction?.status !== "RUNNING") return false;
    if (isAIMode) return true;
    return !hasBidActivity;
  }, [isHost, gameCode, currentAuction?.activePlayerId, currentAuction?.isAuctionLocked, currentAuction?.status, pendingRtm, isAIMode, hasBidActivity]);

  const canSkipSet = useMemo(() => {
    if (!isHost || !gameCode || !currentAuction?.activePlayerId) return false;
    if (pendingRtm) return false;
    return ['RUNNING', 'SOLD', 'UNSOLD'].includes(String(currentAuction?.status || ''));
  }, [isHost, gameCode, currentAuction?.activePlayerId, currentAuction?.status, pendingRtm]);

  const lockedAuctionSets = useMemo(() => {
    const storedSets = (session?.auctionSets || []) as Array<{ key: string; label?: string; playerIds?: string[] }>;
    if (storedSets.length) {
      return storedSets.map((set) => ({
        key: set.key,
        label: set.label || SET_LABELS[set.key] || set.key,
        playerIds: (set.playerIds || []) as string[],
      }));
    }

    const queue = (session?.auctionQueue || []) as string[];
    return SET_ORDER
      .map((key) => ({
        key,
        label: SET_LABELS[key] || key,
        playerIds: queue.filter((id) => resolveSetKey(playerById.get(id)) === key),
      }))
      .filter((set) => set.playerIds.length);
  }, [session?.auctionSets, session?.auctionQueue, playerById]);

  const activeLockedSet = useMemo(() => {
    const activePlayerId = currentAuction?.activePlayerId;
    if (!activePlayerId) return null;
    return lockedAuctionSets.find((set) => set.playerIds.includes(activePlayerId)) || null;
  }, [lockedAuctionSets, currentAuction?.activePlayerId]);

  const timerSeconds = useMemo(() => {
    if (currentAuction?.status === "PAUSED") {
      return Number(currentAuction?.pausedRemainingSec || 0);
    }
    return Math.max(0, Math.floor((timerEndsAtMs - nowMs) / 1000));
  }, [currentAuction?.status, currentAuction?.pausedRemainingSec, timerEndsAtMs, nowMs]);

  const activePlayerId = currentAuction?.activePlayerId;
  const isNewSetFirstPlayer = useMemo(() => {
    if (!activePlayerId || !activeLockedSet) return false;
    return activeLockedSet.playerIds[0] === activePlayerId;
  }, [activePlayerId, activeLockedSet]);

  const hasIntro = isNewSetFirstPlayer && !session?.isAcceleratedRound;

  const isSetIntroActive = useMemo(() => {
    return hasIntro && currentAuction?.status === "RUNNING" && timerSeconds > (session?.isAcceleratedRound ? BID_RESET_TIMER : AUCTION_TIMER);
  }, [hasIntro, currentAuction?.status, timerSeconds, session?.isAcceleratedRound]);

  const showPoolTransition = useMemo(() => {
    return isSetIntroActive && (timerSeconds > (session?.isAcceleratedRound ? BID_RESET_TIMER : AUCTION_TIMER) + 5);
  }, [isSetIntroActive, timerSeconds, session?.isAcceleratedRound]);

  const isSetIntroDelayActive = useMemo(() => {
    return isSetIntroActive && !showPoolTransition;
  }, [isSetIntroActive, showPoolTransition]);

  const effectiveTimerSeconds = useMemo(() => {
    return isSetIntroActive
      ? (session?.isAcceleratedRound ? BID_RESET_TIMER : AUCTION_TIMER)
      : timerSeconds;
  }, [isSetIntroActive, timerSeconds, session?.isAcceleratedRound]);

  // Effect 1: Handle player transitions (Instant swap with preloaded image - zero blank screen)
  useEffect(() => {
    if (showPoolTransition) {
      setIsTransitioning(false);
      return;
    }

    if (!currentPlayer) {
      setIsTransitioning(false);
      return;
    }

    if (displayedPlayer && displayedPlayer.id === currentPlayer.id) {
      return;
    }

    // Instant swap to new player — NO BLANK SCREEN
    setIsTransitioning(false);
    setDisplayedPlayer(currentPlayer as any);
    setDisplayedPlayerBid(displayedCurrentBid);
    setDisplayedPlayerBidderId(currentBidderTeam?.id || null);
    setDisplayedPlayerBidderName(currentBidderTeam?.shortName || 'BID');
  }, [currentPlayer?.id, showPoolTransition, displayedCurrentBid, currentBidderTeam]);

  // Effect 2: Synchronize bid & bidder data for the displayed player
  useEffect(() => {
    if (displayedPlayer && currentPlayer && displayedPlayer.id === currentPlayer.id) {
      setDisplayedPlayerBid(displayedCurrentBid);
      setDisplayedPlayerBidderId(currentBidderTeam?.id || null);
      setDisplayedPlayerBidderName(currentBidderTeam?.shortName || 'BID');
    }
  }, [displayedPlayer?.id, currentPlayer?.id, displayedCurrentBid, currentBidderTeam]);

  const nextPlayers = useMemo(() => {
    const queue = (session?.auctionQueue || []) as string[];
    const queueIndex = Number(session?.queueIndex ?? -1);
    const nextIds = queue.slice(queueIndex + 1, queueIndex + 4);
    return nextIds.map((id) => playerById.get(id)).filter(Boolean) as Player[];
  }, [session?.auctionQueue, session?.queueIndex, playerById]);

  useEffect(() => {
    nextPlayers.forEach((player) => {
      const url = (player as any).image || player.imageUrl;
      if (!url) return;

      if (preloadCache.has(url)) {
        console.log(`[Preload] Cache HIT for player ${player.name} (${url})`);
        return;
      }

      console.log(`[Preload] Cache MISS for player ${player.name} (${url})`);
      preloadCache.set(url, true);

      const img = new Image();
      const startTime = performance.now();
      img.onload = () => {
        const duration = performance.now() - startTime;
        console.log(`[Preload] Prefetch complete for ${player.name} in ${duration.toFixed(2)}ms`);
      };
      img.onerror = () => {
        console.warn(`[Preload] Failed to prefetch image for ${player.name}`);
      };
      img.src = url;
    });
  }, [nextPlayers]);

  useEffect(() => {
    if (activePlayerId && activePlayerId !== lastPlayerIdRef.current) {
      lastPlayerIdRef.current = activePlayerId;
      transitionStartRef.current = performance.now();
      console.log(`[Transition] Starting transition to player: ${activePlayerId}`);
    }
  }, [activePlayerId]);

  const handlePlayerImageLoad = useCallback(() => {
    if (transitionStartRef.current) {
      const duration = performance.now() - transitionStartRef.current;
      totalLoadTimesSum += duration;
      loadedImagesCount += 1;
      const average = totalLoadTimesSum / loadedImagesCount;
      console.log(`[Transition] Player image loaded in ${duration.toFixed(2)}ms (Average: ${average.toFixed(2)}ms)`);
      transitionStartRef.current = 0; // reset
    }
  }, []);

  const canTeamBid = useCallback((team: TeamState | undefined, player: Player | null, amount: number) => {
    if (!team || !player) return false;
    if (isTransitioning) return false;
    if (currentAuction?.status !== "RUNNING") return false;
    if (currentAuction?.isAuctionLocked) return false;
    if (isSetIntroActive) return false;
    if (displayedCurrentBidderId === team.id) return false;
    if (Number(team.purseRemaining || 0) < amount) return false;
    const resolvedSquad = teamPlayersResolved[team.id];
    const squadSize = (resolvedSquad?.retained?.length || 0) + (resolvedSquad?.bought?.length || 0);
    const overseasCount = (resolvedSquad?.retained?.filter(p => p.isOverseas)?.length || 0) + (resolvedSquad?.bought?.filter(p => p.isOverseas)?.length || 0);
    if (squadSize >= SQUAD_CONSTRAINTS.MAX_SQUAD) return false;
    if (isOverseasPlayer(player) && overseasCount >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) return false;
    return true;
  }, [currentAuction?.status, currentAuction?.isAuctionLocked, isSetIntroActive, displayedCurrentBidderId, teamPlayersResolved, isTransitioning]);


  const setProgress = useMemo(() => {
    const queue = (session?.auctionQueue || []) as string[];
    const queueIndex = Number(session?.queueIndex ?? -1);
    const targetPlayer = displayedPlayer || currentPlayer;
    const activeSetLabel = activeLockedSet?.label || SET_LABELS[resolveSetKey(targetPlayer)] || 'General';
    const currentSetIndex = activeLockedSet ? lockedAuctionSets.findIndex((set) => set.key === activeLockedSet.key) : SET_ORDER.indexOf(resolveSetKey(targetPlayer));

    const completedSetsCount = lockedAuctionSets.filter(set => {
      return set.playerIds.every(id => {
        const idx = queue.indexOf(id);
        return idx !== -1 && idx < queueIndex;
      });
    }).length;

    if (!queue.length || !activeLockedSet) return { activeSetLabel, playersRemainingInSet: 0, currentSetIndex, completedSetsCount };

    const startIndex = Math.max(0, queueIndex);
    const remainingQueueIds = new Set(queue.slice(startIndex));
    const remainingInSet = activeLockedSet.playerIds.filter((id) => remainingQueueIds.has(id)).length;

    return { activeSetLabel, playersRemainingInSet: Math.max(0, remainingInSet), currentSetIndex, completedSetsCount };
  }, [session?.auctionQueue, session?.queueIndex, displayedPlayer, currentPlayer, activeLockedSet, lockedAuctionSets]);



  const remainingPlayersList = useMemo(() => {
    const queue = (session?.auctionQueue || []) as string[];
    const queueIndex = Number(session?.queueIndex ?? -1);
    const activePlayerId = currentAuction?.activePlayerId;
    const startIndex = Math.max(0, queueIndex + 1);
    const activeSetIds = activeLockedSet ? new Set(activeLockedSet.playerIds) : new Set<string>();
    return queue.slice(startIndex)
      .filter((id) => activeSetIds.has(id))
      .map((id) => playerById.get(id))
      .filter((p): p is Player => p !== undefined && p.id !== undefined && p.id !== activePlayerId);
  }, [session?.auctionQueue, session?.queueIndex, currentAuction?.activePlayerId, activeLockedSet, playerById]);

  // Effect: Preload images for upcoming players in active queue and current set
  useEffect(() => {
    if (remainingPlayersList && remainingPlayersList.length > 0) {
      // Preload next 10 players
      remainingPlayersList.slice(0, 10).forEach((player) => {
        const imageUrl = (player as any).image || player.imageUrl;
        if (imageUrl) {
          preloadImage(imageUrl).catch(() => {});
        }
      });
    }
  }, [remainingPlayersList]);

  useEffect(() => {
    if (activeLockedSet && activeLockedSet.playerIds && playerById) {
      // Preload all players in active set
      activeLockedSet.playerIds.forEach((id) => {
        const player = playerById.get(id);
        if (player) {
          const imageUrl = (player as any).image || player.imageUrl;
          if (imageUrl) {
            preloadImage(imageUrl).catch(() => {});
          }
        }
      });
    }
  }, [activeLockedSet, playerById]);

  const unsoldPlayersList = useMemo(() => {
    const unsoldIds = (session?.unsoldPlayers || []) as string[];
    return unsoldIds
      .map((id) => playerById.get(id))
      .filter((p): p is Player => p !== undefined && p.id !== undefined);
  }, [session?.unsoldPlayers, playerById]);

  const soldPlayersList = useMemo(() => {
    const list: Array<Player & { soldPrice?: number; soldTeamShortName?: string; soldTeamId?: string; isRetained?: boolean }> = [];
    teams.forEach((t) => {
      (t.players || []).forEach((pid) => {
        const p = playerById.get(pid);
        if (p) {
          list.push({
            ...p,
            soldPrice: t.playerPurchasePrices?.[pid] || p.basePrice || 0,
            soldTeamShortName: t.shortName,
            soldTeamId: t.id,
            isRetained: false,
          });
        }
      });
      (t.retainedPlayers || []).forEach((pid) => {
        const p = playerById.get(pid);
        if (p) {
          list.push({
            ...p,
            soldPrice: t.playerPurchasePrices?.[pid] || 0,
            soldTeamShortName: t.shortName,
            soldTeamId: t.id,
            isRetained: true,
          });
        }
      });
    });
    return list;
  }, [teams, playerById]);

  const isLastInSet = useMemo(() => {
    if (!activeLockedSet || !currentAuction?.activePlayerId) return false;
    const playerIds = activeLockedSet.playerIds;
    return playerIds[playerIds.length - 1] === currentAuction.activePlayerId;
  }, [activeLockedSet, currentAuction?.activePlayerId]);

  const showSetCompletedOverlay = useMemo(() => {
    if (!isLastInSet) return false;
    if (!['SOLD', 'UNSOLD'].includes(currentAuction?.status || '')) return false;
    const resolvedTimeMs = currentAuction?.soldAt?.toMillis?.() || currentAuction?.lastEvent?.createdAt?.toMillis?.() || 0;
    const elapsedMs = resolvedTimeMs ? Math.max(0, nowMs - resolvedTimeMs) : 0;
    return elapsedMs < 10000;
  }, [isLastInSet, currentAuction?.status, currentAuction?.soldAt, currentAuction?.lastEvent, nowMs]);

  const setSummaryPlayers = useMemo(() => {
    if (!activeLockedSet) return [];
    return activeLockedSet.playerIds.map(id => {
      const player = playerById.get(id);
      const sold = soldPlayersList.find(p => p.id === id);
      const unsold = unsoldPlayersList.find(p => p.id === id);
      return {
        id,
        name: player?.name || 'Unknown',
        role: player?.role || 'Batsman',
        basePrice: player?.basePrice || 0,
        soldPrice: sold?.soldPrice,
        soldTeamShortName: sold?.soldTeamShortName,
        soldTeamId: sold?.soldTeamId,
        isUnsold: !!unsold,
      };
    });
  }, [activeLockedSet, playerById, soldPlayersList, unsoldPlayersList]);

  const handleAdvancePlayer = useCallback(async () => {
    if (!gameCode || !isHost || !currentPlayer || !currentAuction?.activePlayerId) return;

    suppressSoldBannerRef.current = true;
    try {
      if (isAIMode) {
        await skipCurrentPlayer(gameCode, { aiResolve: true, restrictedTeamIds: aiOnlyTeamIds });
        return;
      }

      if (hasBidActivity || currentAuction?.status !== 'RUNNING') return;
      await skipCurrentPlayer(gameCode);
    } finally {
      suppressSoldBannerRef.current = false;
    }
  }, [gameCode, isHost, currentPlayer, currentAuction?.activePlayerId, currentAuction?.status, isAIMode, hasBidActivity, aiOnlyTeamIds]);

  const handleSkipSet = useCallback(async () => {
    if (!gameCode || !isHost || !session?.auctionQueue || !currentAuction?.activePlayerId) return;
    const currentQueueIndex = Number(session?.queueIndex ?? -1);
    if (currentQueueIndex < 0) return;

    const currentSet = activeLockedSet?.label || "Unknown";
    const currentSetIndex = activeLockedSet ? lockedAuctionSets.findIndex((s) => s.key === activeLockedSet.key) : -1;
    const nextSet = currentSetIndex !== -1 && currentSetIndex + 1 < lockedAuctionSets.length 
      ? lockedAuctionSets[currentSetIndex + 1].label 
      : "None";
    const remainingInSet = activeLockedSet ? activeLockedSet.playerIds.filter(id => {
      const idx = session.auctionQueue.indexOf(id);
      return idx !== -1 && idx >= currentQueueIndex;
    }).length : 0;

    console.log(`[SKIP SET TRIGGERED]
      - Current set: ${currentSet}
      - Next set: ${nextSet}
      - Remaining players: ${remainingInSet}
      - Transition triggered: true`);

    if (isAIMode) {
      suppressSoldBannerRef.current = true;
      try {
        await skipRemainingSet(gameCode, { aiResolve: true, restrictedTeamIds: aiOnlyTeamIds });
      } finally {
        suppressSoldBannerRef.current = false;
      }
      return;
    }

    if (!['RUNNING', 'SOLD', 'UNSOLD'].includes(String(currentAuction?.status || ''))) return;

    suppressSoldBannerRef.current = true;
    try {
      await skipRemainingSet(gameCode, { aiResolve: false });
    } finally {
      suppressSoldBannerRef.current = false;
    }
  }, [gameCode, isHost, session?.auctionQueue, session?.queueIndex, currentAuction?.activePlayerId, currentAuction?.status, isAIMode, aiOnlyTeamIds, activeLockedSet, lockedAuctionSets]);

  const handleBid = useCallback((amount: number) => {
    if (!gameCode || !myTeamId || !userTeam || !currentPlayer) return;
    if (currentAuction?.isAuctionLocked) return;
    if (!canTeamBid(userTeam, currentPlayer, amount)) return;

    const bidBefore = Number(currentAuction?.currentBid || 0);
    console.log(`[BID UI LOG] Before placeBid click (optimistic): currentBid in UI = ${bidBefore}, new bid requested = ${amount}`);

    setOptimisticBid(amount);
    setOptimisticBidderId(myTeamId);

    // Sync Firestore in background, rollback only on failure
    placeBid(gameCode, myTeamId, amount).then(() => {
      console.log(`[BID UI LOG] After placeBid SUCCESS in background: bid updated in Firestore to ${amount}`);
    }).catch((error: any) => {
      setOptimisticBid(null);
      setOptimisticBidderId(null);
      console.warn(`[BID UI LOG] placeBid rejected for amount ${amount}:`, error);

      const msg = String(error?.message || "");

      // If user is already highest bidder, ignore silently
      if (msg.includes("already the highest bidder")) {
        return;
      }

      // If bid was outpaced by another team (AI or player) placing a bid a millisecond earlier
      if (msg.includes("must be higher") || msg.includes("below the required next increment") || msg.includes("Outbid")) {
        toast({
          title: "Outbid!",
          description: "Another team placed a bid right before yours. Click to place the next bid.",
          variant: "default",
        });
        return;
      }

      toast({
        title: "Bid Cannot Be Placed",
        description: msg || "Could not place your bid. Please try again.",
        variant: "destructive",
      });
    });
  }, [gameCode, myTeamId, userTeam, currentPlayer, currentAuction?.isAuctionLocked, currentAuction?.currentBid, canTeamBid, toast]);



  useEffect(() => {
    if (!isHost || !gameCode || !currentPlayer) return;
    if (currentAuction?.status !== "RUNNING" || currentAuction?.isAuctionLocked) return;

    // Do not attempt AI bidding if timer is expired or less than 1 second remains
    const timerEndsAtMs = currentAuction?.timerEndsAt?.toMillis?.() || 0;
    if (timerEndsAtMs && timerEndsAtMs - Date.now() < 1000) return;

    const currentBidVal = Number(currentAuction.currentBid || 0);

    const aiDecision = aiEngine.decideForAuction(
      teams.map((t) => ({
        id: t.id,
        isAI: Boolean(t.isAI),
        squadSize: Number(t.squadSize || 0),
        purseRemaining: Number(t.purseRemaining || 0),
        overseasCount: Number(t.overseasCount || 0),
        roleNeeds: (t as any).teamNeeds || {},
        aggressionLevel: STRATEGY_AGGRESSION[String((t as any).aiStrategy || 'balanced')] || 1,
        aiStrategy: String((t as any).aiStrategy || 'balanced'),
        shortName: t.shortName,
      })),
      {
        id: (currentPlayer as any).id,
        name: (currentPlayer as any).name,
        role: (currentPlayer as any).role,
        rating: Number((currentPlayer as any).rating ?? (currentPlayer as any).starRating ?? 3),
        starRating: Number((currentPlayer as any).starRating ?? 3),
        basePrice: Number((currentPlayer as any).basePrice || 0),
        overseas: Boolean((currentPlayer as any).overseas ?? (currentPlayer as any).isOverseas),
        demandLevel: (currentPlayer as any).demandLevel,
        interestedTeams: (currentPlayer as any).interestedTeams || [],
        dynamicValue: Number((currentPlayer as any).dynamicValue || (currentPlayer as any).basePrice || 0),
      },
      currentBidVal,
      currentAuction.currentBidderId,
    );

    if (!aiDecision) return;

    // Skip if proposed AI bid is not strictly greater than current bid
    if (aiDecision.bid <= currentBidVal) {
      console.log(`[AI BID LOG] Proposed AI bid ₹${aiDecision.bid} <= current bid ₹${currentBidVal}. Skipping.`);
      return;
    }

    const thinkingDelay = Math.max(800, Math.min(1800, Number(aiDecision.delayMs || 1000)));

    const timer = setTimeout(() => {
      placeBid(gameCode, aiDecision.teamId, aiDecision.bid)
        .catch((err) => console.log(`[AI BID LOG] AI bid rejected for team ${aiDecision.teamId}:`, err?.message));
    }, thinkingDelay);

    return () => {
      clearTimeout(timer);
    };
  }, [isHost, gameCode, teams, currentPlayer, currentAuction?.status, currentAuction?.currentBid, currentAuction?.currentBidderId, currentAuction?.isAuctionLocked, currentAuction?.timerEndsAt, aiEngine]);

  useEffect(() => {
    return () => {
      if (autoAdvanceHostTimeoutRef.current) window.clearTimeout(autoAdvanceHostTimeoutRef.current);
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!currentAuction?.currentBidderId) return;
    if (Number(currentAuction.currentBid || 0) === prevBidRef.current) return;

    setGlowingTeamId(currentAuction.currentBidderId);
    const timeout = window.setTimeout(() => setGlowingTeamId(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [currentAuction?.currentBid, currentAuction?.currentBidderId]);

  useEffect(() => {
    if (!currentAuction) return;

    if (currentAuction.currentBidderId && Number(currentAuction.currentBid || 0) !== prevBidRef.current) {
      const team = teams.find((t) => t.id === currentAuction.currentBidderId);
      const amount = formatCrPrice(Number(currentAuction.currentBid || 0));

      playSound('bid');

      // Set active bid flash overlay
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
      if (team) {
        setActiveBidOverlay({
          teamShortName: team.shortName,
          amountStr: amount,
        });
        overlayTimerRef.current = window.setTimeout(() => {
          setActiveBidOverlay(null);
        }, 1500);
      }
    }

    if (currentAuction.status === "SOLD" && prevStatusRef.current !== "SOLD") {
      const team = teams.find((t) => t.id === currentAuction.currentBidderId);
      setActiveBidOverlay(null); // Clear active bid overlay on sale
      if (!suppressSoldBannerRef.current) {
        setBanner({ kind: 'SOLD', price: Number(currentAuction.currentBid || 0), team: team?.shortName || 'TEAM' });
        setTimeout(() => setBanner(null), 2000);
      }
      playSound('hammer');
      playSound('cheer');
      speakLine(`Sold to ${team?.shortName || 'Team'}`);
    }

    if (currentAuction.status === "UNSOLD" && prevStatusRef.current !== "UNSOLD") {
      setActiveBidOverlay(null); // Clear active bid overlay if unsold
      setBanner({ kind: 'UNSOLD' });
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
    if (!isHost || !gameCode || !currentAuction) return;
    if (pendingRtm) return;

    const key = `${currentAuction.activePlayerId}-${currentAuction.status}`;
    if (!currentAuction.activePlayerId || autoAdvanceKeyRef.current === key) return;
    if (!['SOLD', 'UNSOLD'].includes(currentAuction.status || '')) return;

    autoAdvanceKeyRef.current = key;
    if (autoAdvanceHostTimeoutRef.current) window.clearTimeout(autoAdvanceHostTimeoutRef.current);

    const delayMs = isLastInSet
      ? 6000
      : currentAuction.status === 'SOLD'
      ? (currentAuction?.rtmResultMessage ? 2500 : 1800)
      : 1200;

    autoAdvanceHostTimeoutRef.current = window.setTimeout(async () => {
      if (autoAdvanceKeyRef.current !== key) return;

      if (currentAuction.status === 'SOLD') {
        await markPlayerReadyForNext(gameCode, currentAuction.activePlayerId).catch(() => undefined);
      }

      loadNextPlayer(gameCode).catch(() => undefined);
    }, delayMs);
  }, [isHost, gameCode, currentAuction, pendingRtm, isLastInSet]);


  useEffect(() => {
    if (!displayedPlayer?.name) return;
    speakLine(`Next player ${displayedPlayer.name}`);
  }, [displayedPlayer?.id, speakLine]);

  useEffect(() => {
    if (!currentAuction?.activePlayerId || currentAuction?.status !== "RUNNING" || isSetIntroDelayActive) return;
    const playerKey = currentAuction.activePlayerId;
    const marks = spokenMarksRef.current[playerKey] || new Set<number>();

    if (effectiveTimerSeconds <= 4 && effectiveTimerSeconds >= 1 && !marks.has(effectiveTimerSeconds)) {
      playSound('tick');
      marks.add(effectiveTimerSeconds);
    }

    if (effectiveTimerSeconds === 3 && !marks.has(103)) {
      speakLine('Going once');
      marks.add(103);
    }

    if (effectiveTimerSeconds === 1 && !marks.has(101)) {
      speakLine('Going twice');
      marks.add(101);
    }

    spokenMarksRef.current[playerKey] = marks;

    if (effectiveTimerSeconds === 0) playSound('hammer');
  }, [effectiveTimerSeconds, currentAuction?.status, currentAuction?.activePlayerId, playSound, speakLine, isSetIntroDelayActive]);

  useEffect(() => {
    if (!isHost || !gameCode || currentAuction?.status !== 'RUNNING' || !timerEndsAtMs) return;

    const msRemaining = Math.max(0, timerEndsAtMs - Date.now());

    const timer = window.setTimeout(() => {
      resolveAuction(gameCode).catch((err) => console.error('[resolveAuction error]', err));
    }, msRemaining);

    return () => window.clearTimeout(timer);
  }, [isHost, gameCode, currentAuction?.status, currentAuction?.activePlayerId, timerEndsAtMs]);


  useEffect(() => {
    if (!isHost || !gameCode || !pendingRtm?.expiresAt?.toMillis) return;

    const ms = Math.max(0, pendingRtm.expiresAt.toMillis() - Date.now());
    const timeout = window.setTimeout(() => {
      resolveRtmTimeout(gameCode).catch(() => undefined);
    }, ms + 100);

    return () => window.clearTimeout(timeout);
  }, [isHost, gameCode, pendingRtm?.status, pendingRtm?.expiresAt]);

  const rtmPlayer = playerById.get(pendingRtm?.playerId) || null;
  const rtmOriginalTeam = teams.find((t) => t.id === pendingRtm?.originalTeamId);
  const rtmWinningTeam = teams.find((t) => t.id === pendingRtm?.winningTeamId);
  const rtmControllerTeamId = pendingRtm?.status === "AWAIT_WINNER_COUNTER" ? pendingRtm?.winningTeamId : pendingRtm?.originalTeamId;
  const rtmControllerTeam = teams.find((t) => t.id === rtmControllerTeamId);
  const canUseRtm = pendingRtm?.originalTeamId === myTeamId;
  const rtmNeedsMyDecision = Boolean(pendingRtm && rtmControllerTeamId === myTeamId && !rtmControllerTeam?.isAI);
  const rtmCountdownSeconds = Math.max(0, Math.ceil(((pendingRtm?.expiresAt?.toMillis?.() || 0) - nowMs) / 1000));
  const soldTeam = teams.find((team) => team.id === currentAuction?.soldToTeamId);
  const soldAtMs = currentAuction?.soldAt?.toMillis?.() || 0;
  const soldElapsedMs = Math.max(0, nowMs - soldAtMs);
  const showRtmResultBanner = Boolean(currentAuction?.status === "SOLD" && currentAuction?.rtmResultMessage && soldElapsedMs < 2000);
  const showSoldModal = Boolean(
    currentAuction?.status === "SOLD"
      && soldAtMs
      && soldElapsedMs >= (currentAuction?.rtmResultMessage ? 2000 : 0)
      && soldElapsedMs < (currentAuction?.rtmResultMessage ? 2500 : 1800),
  );

  useEffect(() => {
    setRtmSubmissionLocked(false);
  }, [pendingRtm?.status, pendingRtm?.playerId]);

  useEffect(() => {
    if (!pendingRtm?.status) {
      prevPendingRtmStatusRef.current = null;
      return;
    }

    if (prevPendingRtmStatusRef.current === pendingRtm.status) return;



    prevPendingRtmStatusRef.current = pendingRtm.status;
  }, [pendingRtm?.status, pendingRtm?.counterBid, pendingRtm?.finalBid, rtmOriginalTeam?.shortName, rtmWinningTeam?.shortName]);

  useEffect(() => {
    if (!isHost || !gameCode || !pendingRtm || !rtmControllerTeam?.isAI || !rtmControllerTeamId) return;

    const key = `${pendingRtm.playerId}-${pendingRtm.status}-${pendingRtm.finalBid}-${pendingRtm.counterBid}`;
    if (rtmAiDecisionKeyRef.current === key) return;
    rtmAiDecisionKeyRef.current = key;

    const timer = window.setTimeout(() => {
      (async () => {
      if (pendingRtm.status === "AWAIT_ORIGINAL") {
        const shouldUse = aiEngine.aiUseRTM(
          {
            id: String(rtmPlayer?.id || pendingRtm.playerId),
            role: String((rtmPlayer as any)?.role || ''),
            rating: Number((rtmPlayer as any)?.rating ?? (rtmPlayer as any)?.starRating ?? 3),
            starRating: Number((rtmPlayer as any)?.starRating ?? 3),
            dynamicValue: Number((rtmPlayer as any)?.dynamicValue || (rtmPlayer as any)?.basePrice || 0),
            basePrice: Number((rtmPlayer as any)?.basePrice || 0),
          },
          Number(pendingRtm.finalBid || 0),
        ) && Number(rtmControllerTeam?.purseRemaining || 0) >= Number(pendingRtm.finalBid || 0);
        resolveRtmDecision(gameCode, { action: shouldUse ? "USE" : "DECLINE", actingTeamId: pendingRtm.originalTeamId! }).catch(() => undefined);
        return;
      }

      if (pendingRtm.status === "AWAIT_WINNER_COUNTER") {
        const aiBid = aiEngine.getAIBid(
          {
            id: pendingRtm.winningTeamId!,
            isAI: true,
            squadSize: Number(rtmWinningTeam?.squadSize || 0),
            purseRemaining: Number(rtmWinningTeam?.purseRemaining || 0),
            overseasCount: Number(rtmWinningTeam?.overseasCount || 0),
          },
          {
            id: String(rtmPlayer?.id || pendingRtm.playerId),
            role: String((rtmPlayer as any)?.role || ''),
            rating: Number((rtmPlayer as any)?.rating ?? (rtmPlayer as any)?.starRating ?? 3),
            starRating: Number((rtmPlayer as any)?.starRating ?? 3),
            dynamicValue: Number((rtmPlayer as any)?.dynamicValue || (rtmPlayer as any)?.basePrice || 0),
            basePrice: Number((rtmPlayer as any)?.basePrice || 0),
            overseas: Boolean((rtmPlayer as any)?.overseas ?? (rtmPlayer as any)?.isOverseas),
          },
          Number(pendingRtm.finalBid || 0),
        );
        resolveRtmDecision(gameCode, {
          action: "COUNTER",
          actingTeamId: pendingRtm.winningTeamId!,
          counterBid: Number((aiBid && aiBid > Number(pendingRtm.finalBid || 0) ? aiBid : Number(pendingRtm.finalBid || 0) + 1)),
        }).catch(() => undefined);
        return;
      }

      if (pendingRtm.status === "AWAIT_ORIGINAL_MATCH") {
        const shouldMatch = aiEngine.aiFinalRTMDecision(
          {
            id: String(rtmPlayer?.id || pendingRtm.playerId),
            role: String((rtmPlayer as any)?.role || ''),
            rating: Number((rtmPlayer as any)?.rating ?? (rtmPlayer as any)?.starRating ?? 3),
            starRating: Number((rtmPlayer as any)?.starRating ?? 3),
            dynamicValue: Number((rtmPlayer as any)?.dynamicValue || (rtmPlayer as any)?.basePrice || 0),
            basePrice: Number((rtmPlayer as any)?.basePrice || 0),
          },
          Number(pendingRtm.finalBid || 0),
        );
        resolveRtmDecision(gameCode, { action: shouldMatch ? "MATCH" : "DECLINE", actingTeamId: pendingRtm.originalTeamId! }).catch(() => undefined);
      }
      })().catch(() => undefined);
    }, 5000 + Math.floor(Math.random() * 3000));

    return () => window.clearTimeout(timer);
  }, [isHost, gameCode, pendingRtm, rtmControllerTeam?.isAI, rtmControllerTeamId, aiEngine, rtmPlayer, rtmControllerTeam?.purseRemaining, rtmWinningTeam?.squadSize, rtmWinningTeam?.purseRemaining, rtmWinningTeam?.overseasCount]);

  const rtmModalCopy = useMemo(() => {
    if (!pendingRtm) return null;

    if (pendingRtm.status === "AWAIT_ORIGINAL") {
      return {
        title: `Use RTM for ${rtmPlayer?.name || "this player"}?`,
        description: `${rtmOriginalTeam?.name || "Original team"} can bring the player back at ${formatCrPrice(Number(pendingRtm.finalBid || 0))}.`,
        amount: Number(pendingRtm.finalBid || 0),
      };
    }

    if (pendingRtm.status === "AWAIT_ORIGINAL_MATCH") {
      const amount = Number(pendingRtm.finalBid || pendingRtm.counterBid || 0);
      return {
        title: `Match ${formatCrPrice(amount)}?`,
        description: `${rtmOriginalTeam?.name || "Original team"} must decide whether to match ${rtmWinningTeam?.name || "the highest bidder"}'s final price.`,
        amount,
      };
    }

    return null;
  }, [pendingRtm, rtmPlayer?.name, rtmOriginalTeam?.name, rtmWinningTeam?.name]);

  const submitRtmDecision = useCallback(async (action: "USE" | "DECLINE" | "MATCH", counterBid?: number) => {
    if (!gameCode || !myTeamId || !pendingRtm || rtmSubmissionLocked) return;
    setRtmSubmissionLocked(true);
    try {
      await resolveRtmDecision(gameCode, { action, actingTeamId: myTeamId, counterBid });
    } finally {
      setTimeout(() => setRtmSubmissionLocked(false), 400);
    }
  }, [gameCode, myTeamId, pendingRtm, rtmSubmissionLocked]);

  const submitCounterBid = useCallback(async (amount: number) => {
    if (!gameCode || !myTeamId || !pendingRtm || rtmSubmissionLocked) return;
    const previousBid = Number(pendingRtm.finalBid || 0);
    if (!Number.isFinite(amount) || amount <= previousBid) return;
    setRtmSubmissionLocked(true);
    try {
      await resolveRtmDecision(gameCode, { action: "COUNTER", actingTeamId: myTeamId, counterBid: amount });
    } finally {
      setTimeout(() => setRtmSubmissionLocked(false), 400);
    }
  }, [gameCode, myTeamId, pendingRtm, rtmSubmissionLocked]);

  const recentPurchases = useMemo(() => {
    const purchases = (session?.recentPurchases || []) as Array<{ playerId: string; price: number; teamId: string }>;
    return purchases;
  }, [session?.recentPurchases]);

  const commentaryTickerItems = useMemo(() => {
    return recentPurchases.map((p) => {
      const pl = masterPlayerList.find((x: any) => x.id === p.playerId);
      const team = teams.find((t) => t.id === p.teamId);
      return {
        name: pl?.name || p.playerId,
        team: team?.shortName || p.teamId,
        price: formatCrPrice(p.price),
      };
    });
  }, [recentPurchases, masterPlayerList, teams]);



  const leaderboard = useMemo(() => buildLeaderboard(teams, teamPlayersResolved), [teams, teamPlayersResolved]);

  const showAcceleratedDecision = useMemo(() => {
    const queueIndex = Number(session?.queueIndex ?? -1);
    const endedQueue = queueLength > 0 && queueIndex >= queueLength;
    return endedQueue && !session?.isAcceleratedRound && !session?.acceleratedRoundSkipped;
  }, [queueLength, session?.queueIndex, session?.isAcceleratedRound, session?.acceleratedRoundSkipped]);



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
    <div className={cn("h-screen broadcast-container flex flex-col overflow-hidden", isAIMode ? "theme-ai" : "theme-multiplayer")}>
      <Header
        gameCode={gameCode!}
        hideGameCode={isAIMode}
        currentSetLabel={`${typeof setProgress.currentSetIndex === "number" && setProgress.currentSetIndex >= 0 ? `Set ${setProgress.currentSetIndex + 1}: ` : ""}${setProgress.activeSetLabel}`}
        onAdvancePlayer={gameCode && isHost ? handleAdvancePlayer : undefined}
        onSkipSet={gameCode && isHost ? handleSkipSet : undefined}
        onPauseToggle={gameCode && isHost ? () => togglePauseAuction(gameCode) : undefined}
        isPaused={currentAuction?.status === "PAUSED"}
        canControl={Boolean(isHost && !pendingRtm)}
        canAdvancePlayer={canAdvancePlayer}
        canSkipSet={canSkipSet}
        onMenuClick={() => setTeamDrawerOpen(true)}
        onLeaveGame={() => setLeaveConfirmOpen(true)}
        onEndGame={gameCode && isHost ? async () => {
          console.log("[End Game CTA] Clicked. gameCode:", gameCode, "userId:", userId);
          try {
            await endGameByHost(gameCode!, userId);
            console.log("[End Game CTA] Successfully updated DB. Navigating to summary...");
            navigate(`/summary/${gameCode}`);
          } catch (e: any) {
            console.error("[End Game CTA] Error in endGameByHost:", e.message || e);
          }
        } : undefined}
      />

      {showSetCompletedOverlay && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-6 animate-[fadeIn_0.3s_ease]">
          {/* Ambient glow backgrounds */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-yellow-500/5 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="w-full max-w-3xl border border-yellow-500/30 rounded-3xl bg-gradient-to-b from-[#071a3a]/90 via-[#05142c]/95 to-[#020b17]/98 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden p-6 md:p-8 flex flex-col items-center max-h-[85vh]">
            {/* Top gold glow bar */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 z-10" />
            
            {(() => {
              const resolvedTimeMs = currentAuction?.soldAt?.toMillis?.() || currentAuction?.lastEvent?.createdAt?.toMillis?.() || 0;
              const elapsedMs = resolvedTimeMs ? Math.max(0, nowMs - resolvedTimeMs) : 0;
              
              if (elapsedMs < 4000) {
                return (
                  /* Slide 1: Set Completed Title Screen (0-4s) */
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-8 animate-[resultPop_0.4s_ease-out] w-full">
                    <div className="h-24 w-24 rounded-full bg-yellow-500/10 border border-yellow-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                      <Award className="h-12 w-12 text-yellow-400 animate-[pulse_2s_infinite]" />
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs font-black tracking-[0.3em] uppercase text-yellow-400">STAGE COMPLETE</span>
                      <h1 className="text-4xl md:text-5xl font-display font-black uppercase text-white tracking-wider text-shadow-glow">
                        {activeLockedSet?.label}
                      </h1>
                      <p className="text-sm text-slate-400 max-w-md mx-auto">
                        All players in this category have been presented. Reviewing set outcomes...
                      </p>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <div className="h-1.5 w-12 rounded bg-yellow-400 animate-pulse" />
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                    </div>
                  </div>
                );
              }
              
              return (
                /* Slide 2: Set Summary Screen (4-10s) */
                <div className="flex-1 flex flex-col w-full min-h-0 space-y-6 animate-[resultPop_0.4s_ease-out] w-full">
                  {/* Header */}
                  <div className="text-center space-y-1">
                    <span className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-400">SET SUMMARY</span>
                    <h2 className="text-2xl font-display font-black uppercase text-yellow-400">
                      {activeLockedSet?.label}
                    </h2>
                  </div>
                  
                  {/* Player List Table */}
                  <div className="flex-1 overflow-y-auto pr-1.5 border border-white/5 rounded-2xl bg-slate-950/45 p-4 scrollbar-thin min-h-[200px]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                          <th className="pb-2">Player</th>
                          <th className="pb-2">Role</th>
                          <th className="pb-2 text-right">Base Price</th>
                          <th className="pb-2 text-right">Sold Price</th>
                          <th className="pb-2 text-right">Purchaser</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs text-slate-200">
                        {setSummaryPlayers.map((player) => (
                          <tr key={player.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 font-bold text-slate-100 uppercase">{player.name}</td>
                            <td className="py-2.5 text-slate-400 uppercase font-semibold text-[10px]">{player.role}</td>
                            <td className="py-2.5 text-right font-mono text-[11px] text-slate-400">{formatCrPrice(player.basePrice)}</td>
                            <td className="py-2.5 text-right font-mono text-[11px] font-black text-yellow-400">
                              {player.soldPrice ? formatCrPrice(player.soldPrice) : '—'}
                            </td>
                            <td className="py-2.5 text-right">
                              {player.soldTeamShortName ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black bg-[#0066cc]/10 text-cyan-400 border border-[#0066cc]/30">
                                  {player.soldTeamShortName}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  UNSOLD
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Progress indicator */}
                  <div className="flex justify-center gap-2 items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                    <div className="h-1.5 w-12 rounded bg-yellow-400 animate-pulse" />
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {showPoolTransition && activeLockedSet && activePlayerId && (
        <PoolTransition
          key={`${activeLockedSet.key}-${activeLockedSet.playerIds[0]}`}
          poolName={activeLockedSet.label}
          playersInPool={activeLockedSet.playerIds.length}
          setNumber={lockedAuctionSets.findIndex((set) => set.key === activeLockedSet.key) + 1}
          onComplete={() => {}}
        />
      )}

      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Auction?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to leave the auction?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!gameCode) return;
                await leaveGame(gameCode, userId);
                navigate(`/`);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showAcceleratedConfirm} onOpenChange={setShowAcceleratedConfirm}>
        <AlertDialogContent className="bg-slate-900 border border-yellow-500/30 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-wide text-yellow-400">
              Start Accelerated Round?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-350">
              Start Accelerated Round with {unsoldPlayersList.length} Unsold Players?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-750 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black uppercase tracking-wider"
              onClick={async () => {
                setShowAcceleratedConfirm(false);
                await startAcceleratedRound(gameCode!);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={teamDrawerOpen} onOpenChange={setTeamDrawerOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm bg-[#071a3a] border-yellow-500/40 p-3">
          <TeamGrid
            teams={teams.map((team) => {
              const resolvedSquad = teamPlayersResolved[team.id];
              const dynamicSquadSize = (resolvedSquad?.retained?.length || 0) + (resolvedSquad?.bought?.length || 0);
              return {
                id: team.id,
                shortName: team.shortName,
                name: team.name,
                logo: team.logo,
                purseRemaining: Number(team.purseRemaining || 0),
                squadSize: dynamicSquadSize,
                rtmCards: Number(team.rtmCards || 0),
                retainedCount: resolvedSquad?.retained?.length || 0,
              };
            })}
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
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 text-sm font-black tracking-widest text-yellow-400 uppercase bg-yellow-400/10 border border-yellow-400/30 px-3 py-1 rounded-full animate-[hammerDrop_0.45s_ease-out]">FINAL CALL</div>
            <div className="absolute inset-0 rounded-2xl border-2 border-white/20 animate-[hammerImpact_0.45s_ease-out]" />
            <div
              className={`status-fade min-w-[260px] rounded-2xl border px-7 py-5 text-center shadow-2xl animate-[resultPop_0.35s_ease-out] ${banner.kind === 'SOLD' ? 'border-[#FFD700] text-[#FFD700] bg-[#2f2500bb] shadow-[0_0_30px_rgba(255,215,0,0.42)]' : 'border-[#FF4D4D] text-[#FF4D4D] bg-[#2e0808bb] shadow-[0_0_30px_rgba(255,77,77,0.35)]'}`}
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

      {showRtmResultBanner && (
        <div className="fixed top-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald-400/30 bg-slate-950/90 px-6 py-3 text-sm font-semibold text-emerald-300 shadow-2xl backdrop-blur-xl">
          {currentAuction?.rtmResultMessage}
        </div>
      )}

      <SoldModal
        open={showSoldModal}
        player={displayedPlayer as any}
        teamId={soldTeam?.id || currentAuction?.soldToTeamId}
        teamName={soldTeam?.name}
        teamShortName={soldTeam?.shortName}
        teamLogo={soldTeam?.logo}
        price={Number(currentAuction?.soldPrice || currentAuction?.currentBid || 0)}
      />

      {auctionEnded && showAcceleratedDecision && (
        <div className="flex-1 flex flex-col items-center justify-center p-3 md:p-6 overflow-hidden h-[calc(100vh-60px)] min-h-0 w-full max-w-4xl mx-auto">
          <div className="border border-yellow-500/30 rounded-3xl bg-gradient-to-b from-[#071a3a]/90 via-[#05142c]/95 to-[#020b17]/98 shadow-[0_15px_50px_rgba(0,0,0,0.6)] animate-[resultPop_0.4s_ease-out] relative overflow-hidden flex flex-col h-full max-h-[calc(100vh-90px)] w-full">
            
            {/* Glowing top line */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 z-10" />
            
            {/* Scrollable Container (Except the footer) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 min-h-0 scrollbar-thin">
              {/* 1. Accelerated Round Title */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-xs font-black tracking-widest uppercase">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Normal sets complete
                </div>
                <h2 className="text-2xl md:text-3xl font-display font-black uppercase text-white tracking-wide">
                  Accelerated Round Entry
                </h2>
                <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
                  The draft stage is complete. You can now start an Accelerated Round to bid on unsold players with a fast-paced 10-second timer.
                </p>
              </div>

              {/* 2. Host Decision Panel (above player list) */}
              {isHost ? (
                <div className="border border-white/10 rounded-2xl bg-white/5 p-4 space-y-3 shrink-0">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest">
                      Accelerated Round Options
                    </h3>
                    <span className="text-[10px] text-yellow-400/80 font-mono font-bold">Host Controls</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Unsold Player Count */}
                    <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3 flex flex-col justify-center">
                      <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Unsold Players</span>
                      <span className="text-xl font-black text-yellow-400 font-mono mt-0.5">
                        {unsoldPlayersList.length}
                      </span>
                    </div>
                    {/* Estimated Duration */}
                    <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3 flex flex-col justify-center">
                      <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Estimated Duration</span>
                      <span className="text-sm font-bold text-slate-200 mt-0.5">
                        {unsoldPlayersList.length > 0 ? `${Math.ceil((unsoldPlayersList.length * 12) / 60)} - ${Math.ceil((unsoldPlayersList.length * 15) / 60)} Min` : '0 Min'}
                      </span>
                    </div>
                  </div>

                  {unsoldPlayersList.length > 0 ? (
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      {/* Start Accelerated Round */}
                      <Button
                        onClick={() => setShowAcceleratedConfirm(true)}
                        className="h-10 px-4 bg-gradient-to-r from-yellow-400 to-amber-500 hover:brightness-105 text-slate-950 font-black text-xs uppercase tracking-widest rounded-lg shadow-md border border-yellow-300/30 cursor-pointer flex-1"
                      >
                        🚀 Start Accelerated Round
                      </Button>
                      {/* Skip Option */}
                      <Button
                        variant="outline"
                        onClick={() => skipAcceleratedRound(gameCode!)}
                        className="h-10 px-4 border-slate-700 hover:bg-slate-800 hover:text-white text-slate-300 font-bold text-xs uppercase tracking-wider rounded-lg cursor-pointer flex-1"
                      >
                        Skip Accelerated Round
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-1 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-xs font-bold text-red-400 uppercase tracking-widest">
                        No Unsold Players Available
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-yellow-500/10 rounded-2xl bg-yellow-500/5 p-4 text-center space-y-3 shrink-0">
                  <div className="relative flex items-center justify-center mx-auto">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400" />
                    <div className="absolute h-4 w-4 rounded-full bg-yellow-400/20 animate-ping" />
                  </div>
                  <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest animate-pulse">
                    Waiting for Host Decision...
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    The host is choosing whether to start the Accelerated Round (with {unsoldPlayersList.length} unsold players) or proceed to the final results.
                  </p>
                </div>
              )}

              {/* 5. Player List or Empty State */}
              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between border-b border-white/5 pb-1.5 shrink-0">
                  <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                    📋 Unsold Players List ({unsoldPlayersList.length})
                  </h3>
                  {unsoldPlayersList.length > 0 && (
                    <span className="text-[9px] text-slate-500 font-mono">Scroll to view</span>
                  )}
                </div>

                {unsoldPlayersList.length > 0 ? (
                  <div className="flex-1 overflow-y-auto pr-1.5 space-y-2 border border-white/5 rounded-xl bg-slate-950/45 p-3 scrollbar-thin min-h-[150px]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {unsoldPlayersList.map((player) => {
                        const roleKey = normalizeRoleKey(player.role);
                        const roleLabel = roleKey.toUpperCase();
                        const roleBadgeColor = roleKey === 'wk' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                                               roleKey === 'ar' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                               roleKey === 'bowl' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                               'bg-amber-500/10 text-amber-400 border-amber-500/20';

                        return (
                          <div key={player.id} className="flex items-center justify-between p-2 rounded-lg bg-[#051126]/60 border border-slate-800 hover:border-slate-700/60 transition-all">
                            <div className="min-w-0 pr-2 space-y-1">
                              <p className="font-bold text-slate-200 text-xs truncate">{player.name}</p>
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.2 rounded text-[8px] font-black border uppercase ${roleBadgeColor}`}>
                                  {roleLabel}
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono">{player.nationality}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-black text-yellow-400">{formatCrPrice(player.basePrice)}</p>
                              <span className="text-[8px] text-slate-500 font-bold uppercase block">Base Price</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 border border-dashed border-white/10 rounded-xl bg-slate-950/20 flex flex-col items-center justify-center p-6 text-center space-y-2 min-h-[150px]">
                    <p className="text-xs font-bold text-slate-300">No Unsold Players Available</p>
                    <p className="text-[10px] text-slate-500 max-w-sm">
                      All players in the draft have been successfully sold or retained. There are no players remaining in the unsold pool.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Fixed Footer (always visible without scrolling) */}
            <div className="border-t border-white/10 bg-[#030d1e] p-4 flex items-center justify-center shrink-0 w-full z-10">
              {isHost ? (
                unsoldPlayersList.length > 0 ? (
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center max-w-2xl">
                    {/* Start Accelerated Round - Primary CTA */}
                    <Button
                      onClick={() => setShowAcceleratedConfirm(true)}
                      className="h-11 px-6 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:brightness-105 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(250,204,21,0.25)] border border-yellow-300/30 cursor-pointer animate-[pulseBid_1.5s_infinite] w-full sm:w-auto sm:flex-1"
                    >
                      🚀 Start Accelerated Round
                    </Button>
                    
                    {/* Skip Accelerated Round - Secondary Action */}
                    <Button
                      variant="outline"
                      onClick={() => skipAcceleratedRound(gameCode!)}
                      className="h-11 px-6 border-slate-700/80 hover:bg-slate-800/60 hover:text-white text-slate-350 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer w-full sm:w-auto sm:flex-1"
                    >
                      Skip Accelerated Round
                    </Button>
                    
                    {/* Back to Auction Summary - Secondary Action */}
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await skipAcceleratedRound(gameCode!);
                        navigate(`/summary/${gameCode}`);
                      }}
                      className="h-11 px-6 border-slate-700/80 hover:bg-slate-800/60 hover:text-white text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer w-full sm:w-auto sm:flex-1"
                    >
                      Back to Auction Summary
                    </Button>
                  </div>
                ) : (
                  <div className="w-full max-w-md">
                    {/* Proceed to Final Results */}
                    <Button
                      onClick={async () => {
                        await skipAcceleratedRound(gameCode!);
                        navigate(`/summary/${gameCode}`);
                      }}
                      className="h-11 px-8 bg-gradient-to-r from-green-500 to-emerald-600 hover:brightness-105 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.25)] border border-green-400/30 cursor-pointer w-full"
                    >
                      Proceed to Final Results
                    </Button>
                  </div>
                )
              ) : (
                <div className="text-center text-xs text-slate-500 font-bold uppercase tracking-wider py-1">
                  Waiting for host decision...
                </div>
              )}
            </div>

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
          <div className="relative shrink-0">
            <div className="border-y border-[#00CFFF66] bg-[#05142ccc]/90 backdrop-blur-md overflow-hidden py-2">
              <div className="whitespace-nowrap animate-[marquee_55s_linear_infinite] hover:[animation-play-state:paused] cursor-pointer text-xs md:text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-12 px-4 select-none">
                {commentaryTickerItems.length === 0 ? (
                  <div className="flex items-center gap-4">
                    <span className="text-yellow-400 font-bold">📢 Waiting for first sale...</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-300">Place your bids to start the auction</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-12 shrink-0">
                      {commentaryTickerItems.map((item, i) => (
                        <div key={`ticker-1-${i}`} className="flex items-center gap-3">
                          <span className="text-white font-bold">{item.name}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-yellow-400 font-extrabold uppercase bg-yellow-500/10 border border-yellow-500/25 px-1.5 py-0.5 rounded text-[10px] tracking-widest">{item.team}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-emerald-400 font-bold">{item.price}</span>
                          <span className="text-yellow-500/50 ml-4 font-mono">✦</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-12 shrink-0">
                      {commentaryTickerItems.map((item, i) => (
                        <div key={`ticker-2-${i}`} className="flex items-center gap-3">
                          <span className="text-white font-bold">{item.name}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-yellow-400 font-extrabold uppercase bg-yellow-500/10 border border-yellow-500/25 px-1.5 py-0.5 rounded text-[10px] tracking-widest">{item.team}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-emerald-400 font-bold">{item.price}</span>
                          <span className="text-yellow-500/50 ml-4 font-mono">✦</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
 
            <CircularAuctionTimer
              timerEndsAtMs={timerEndsAtMs}
              status={currentAuction?.status || 'IDLE'}
              maxSeconds={session?.isAcceleratedRound ? BID_RESET_TIMER : AUCTION_TIMER}
              isSetIntroActive={isSetIntroActive}
            />
          </div>

          <main className="flex-1 overflow-hidden p-3 md:p-5">
            <div className="hidden lg:grid grid-cols-[2.3fr_5.2fr_2.5fr] gap-4 h-full">
              <div className="h-full min-h-0 overflow-hidden">
                <TeamGrid
                  teams={teams.map((team) => {
                    const resolvedSquad = teamPlayersResolved[team.id];
                    const dynamicSquadSize = (resolvedSquad?.retained?.length || 0) + (resolvedSquad?.bought?.length || 0);
                    return {
                      id: team.id,
                      shortName: team.shortName,
                      name: team.name,
                      logo: team.logo,
                      purseRemaining: Number(team.purseRemaining || 0),
                      squadSize: dynamicSquadSize,
                      rtmCards: Number(team.rtmCards || 0),
                      retainedCount: resolvedSquad?.retained?.length || 0,
                    };
                  })}
                  myTeamId={myTeamId}
                  currentBidderId={currentAuction?.currentBidderId}
                  glowingTeamId={glowingTeamId}
                  onSelectTeam={(teamId) => setSelectedTeamId(teamId)}
                />
              </div>

              <div className="h-full min-h-0 overflow-hidden">
                <div className="h-full rounded-xl border border-yellow-500/35 bg-gradient-to-b from-[#071a3a] to-[#040e21] p-3 overflow-hidden flex flex-col justify-between">
                  {isSetIntroDelayActive && (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <p className="font-display text-3xl text-primary mb-2">Set Intro Complete</p>
                        <p className="text-muted-foreground">Auction starts in {timerSeconds - (session?.isAcceleratedRound ? BID_RESET_TIMER : AUCTION_TIMER)}s</p>
                      </div>
                    </div>
                  )}
                  {showPoolTransition && (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <p className="font-display text-3xl text-primary mb-2">Preparing Set</p>
                        <p className="text-muted-foreground">Please wait...</p>
                      </div>
                    </div>
                  )}
                  {/* Auction Progress Tracker */}
                  <div className="bg-slate-950/40 rounded-xl border border-white/5 p-3 flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-xs select-none shrink-0 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Set:</span>
                      <span className="font-bold text-yellow-400 uppercase font-display">{setProgress.activeSetLabel}</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Sets Completed:</span>
                      <span className="font-mono font-bold text-white">
                        {Math.max(0, setProgress.completedSetsCount)}/{lockedAuctionSets.length}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Auctioned:</span>
                      <span className="font-mono font-bold text-white">
                        {Math.max(0, Number(session?.queueIndex ?? -1))}/{queueLength}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Unsold:</span>
                      <span className="font-mono font-bold text-red-400">
                        {(session?.unsoldPlayers || []).length}
                      </span>
                    </div>
                  </div>

                  {/* Stable Card Wrapper */}
                  <div className="flex-1 min-h-0 w-full relative mt-2">
                    {displayedPlayer && !isSetIntroActive ? (
                      <div
                        key={displayedPlayer.id}
                        className={`h-full w-full relative isolate transition-all duration-300 ${
                          isTransitioning ? "scale-95 opacity-50 blur-[1.5px]" : "scale-100 opacity-100 blur-0"
                        }`}
                      >
                        <PlayerCard
                          player={displayedPlayer as any}
                          currentBid={displayedPlayerBid}
                          currentBidderId={displayedPlayerBidderId}
                          currentBidderName={displayedPlayerBidderName}
                          activeBidOverlay={activeBidOverlay}
                          onImageLoad={handlePlayerImageLoad}
                        />
                        
                        {/* Smooth loading overlay */}
                        {isTransitioning && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 rounded-2xl backdrop-blur-sm z-30">
                            <div className="relative flex items-center justify-center">
                              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400" />
                              <div className="absolute h-6 w-6 rounded-full bg-yellow-400/20 animate-ping" />
                            </div>
                            <p className="text-xs font-black tracking-widest text-yellow-400 mt-4 animate-pulse uppercase">REVEALING NEXT PLAYER...</p>
                          </div>
                        )}
                      </div>
                    ) : !isSetIntroActive && (
                      /* Card Placeholder / Skeleton to prevent layout jumps */
                      <div className="h-full w-full rounded-2xl bg-slate-950/40 border border-white/5 flex flex-col items-center justify-center p-6 text-center space-y-4">
                        <div className="animate-pulse flex flex-col items-center space-y-4 w-full">
                          <div className="rounded-full bg-slate-800/80 h-28 w-28 md:h-32 md:w-32 animate-pulse" />
                          <div className="h-4 bg-slate-800/80 rounded w-1/3 animate-pulse" />
                          <div className="h-3 bg-slate-800/80 rounded w-1/2 animate-pulse" />
                          <div className="h-8 bg-slate-800/80 rounded w-1/4 mt-4 animate-pulse" />
                        </div>
                      </div>
                    )}
                  </div>

                  {currentAuction?.status === 'PAUSED' && <p className="text-lg font-semibold text-yellow-400 mt-6 text-center">Auction Paused by Host</p>}

                  {(!currentPlayer || !['RUNNING', 'PAUSED'].includes(currentAuction?.status)) && !['SOLD', 'UNSOLD'].includes(currentAuction?.status || '') && (
                    <div className="mt-8 text-center">
                      {session?.phase === "RETENTION_REVIEW" && isHost ? <Button onClick={() => loadNextPlayer(gameCode!)}>Start Auction</Button> : <p className="text-muted-foreground">Waiting for next player.</p>}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-full min-h-0 overflow-hidden">
                <BidControls
                  currentBid={displayedCurrentBid}
                  canBid={canTeamBid(userTeam, displayedPlayer, nextBid)}
                  onBid={handleBid}
                  recentPurchases={recentPurchases.map((p) => {
                    const pl = masterPlayerList.find((x: any) => x.id === p.playerId);
                    const team = teams.find((t) => t.id === p.teamId);
                    return {
                      playerName: pl?.name || p.playerId,
                      teamShortName: team?.shortName || p.teamId,
                      price: p.price,
                      timestamp: p.timestamp,
                    };
                  })}
                  remainingPlayers={remainingPlayersList}
                  unsoldPlayers={unsoldPlayersList}
                  soldPlayers={soldPlayersList}
                  currentPlayer={displayedPlayer}
                  lockedAuctionSets={lockedAuctionSets}
                  activeSetKey={activeLockedSet?.key || undefined}
                  isSquadComplete={userTeam ? ((teamPlayersResolved[userTeam.id]?.retained?.length || 0) + (teamPlayersResolved[userTeam.id]?.bought?.length || 0) >= SQUAD_CONSTRAINTS.MAX_SQUAD) : false}
                />
              </div>
            </div>

            <div className="lg:hidden flex flex-col gap-3 h-full min-h-0 overflow-hidden">
              {/* Mobile Progress Tracker */}
              <div className="bg-slate-950/40 rounded-xl border border-white/5 p-2 flex flex-wrap items-center justify-between gap-1 text-[10px] select-none shrink-0">
                <div>
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[8px] mr-1">Set:</span>
                  <span className="font-bold text-yellow-400 uppercase">{setProgress.activeSetLabel}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[8px] mr-1">Completed:</span>
                  <span className="font-mono font-bold text-white">{setProgress.completedSetsCount}/{lockedAuctionSets.length}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[8px] mr-1">Auctioned:</span>
                  <span className="font-mono font-bold text-white">{Math.max(0, Number(session?.queueIndex ?? -1))}/{queueLength}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[8px] mr-1">Unsold:</span>
                  <span className="font-mono font-bold text-red-400">{(session?.unsoldPlayers || []).length}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
                <div className="rounded-xl border border-yellow-500/40 bg-[#071a3a] p-2 h-full min-h-0 relative overflow-hidden">
                  {displayedPlayer && !isSetIntroActive ? (
                    <div
                      className={`h-full w-full transition-all duration-300 ${
                        isTransitioning ? "scale-95 opacity-50 blur-[1.5px]" : "scale-100 opacity-100 blur-0"
                      }`}
                    >
                      <PlayerCard
                        player={displayedPlayer as any}
                        currentBid={displayedPlayerBid}
                        currentBidderId={displayedPlayerBidderId}
                        currentBidderName={displayedPlayerBidderName}
                        onImageLoad={handlePlayerImageLoad}
                      />
                      {isTransitioning && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 backdrop-blur-sm z-30">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400" />
                          <p className="text-[9px] font-black text-yellow-400 mt-2 tracking-widest animate-pulse uppercase">REVEALING...</p>
                        </div>
                      )}
                    </div>
                  ) : !isSetIntroActive ? (
                    /* Stable skeleton/loading placeholder for mobile */
                    <div className="h-full w-full rounded-xl bg-slate-950/40 border border-white/5 flex flex-col items-center justify-center p-3 text-center space-y-2">
                      <div className="animate-pulse flex flex-col items-center space-y-2 w-full animate-[pulse_2s_infinite]">
                        <div className="rounded-full bg-slate-800/80 h-16 w-16" />
                        <div className="h-3 bg-slate-800/80 rounded w-1/2" />
                        <div className="h-2 bg-slate-800/80 rounded w-2/3" />
                      </div>
                    </div>
                  ) : isSetIntroActive ? (
                    <div className="h-full grid place-items-center text-xs text-slate-300">
                      <div className="text-center p-4 space-y-1">
                        <p className="font-display text-lg text-primary">Set Intro Active</p>
                        <p className="text-slate-400">
                          {showPoolTransition 
                            ? "Preparing Set..." 
                            : `Auction starts in ${timerSeconds - (session?.isAcceleratedRound ? BID_RESET_TIMER : AUCTION_TIMER)}s`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full grid place-items-center text-xs text-slate-300">Waiting for player...</div>
                  )}
                </div>
                <div className="h-full min-h-0 overflow-hidden">
                  <BidControls
                    currentBid={displayedCurrentBid}
                    canBid={canTeamBid(userTeam, displayedPlayer, nextBid)}
                    onBid={handleBid}
                    recentPurchases={recentPurchases.map((p) => {
                      const pl = masterPlayerList.find((x: any) => x.id === p.playerId);
                      const team = teams.find((t) => t.id === p.teamId);
                      return {
                        playerName: pl?.name || p.playerId,
                        teamShortName: team?.shortName || p.teamId,
                        price: p.price,
                        timestamp: p.timestamp,
                      };
                    })}
                    remainingPlayers={remainingPlayersList}
                    unsoldPlayers={unsoldPlayersList}
                    soldPlayers={soldPlayersList}
                    currentPlayer={displayedPlayer}
                    lockedAuctionSets={lockedAuctionSets}
                    activeSetKey={activeLockedSet?.key || undefined}
                    isSquadComplete={userTeam ? ((teamPlayersResolved[userTeam.id]?.retained?.length || 0) + (teamPlayersResolved[userTeam.id]?.bought?.length || 0) >= SQUAD_CONSTRAINTS.MAX_SQUAD) : false}
                  />
                </div>
              </div>
            </div>
          </main>

          <style>{`
            @keyframes marquee { from { transform: translateX(-50%); } to { transform: translateX(0); } }
            @keyframes teamBidGlow { 0% { box-shadow: 0 0 0 rgba(250,204,21,0); } 35% { box-shadow: 0 0 28px rgba(250,204,21,0.8); } 100% { box-shadow: 0 0 0 rgba(250,204,21,0); } }
            @keyframes resultPop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
            @keyframes rtmFade { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
            @keyframes hammerDrop { 0% { transform: translate(-50%, -45px) rotate(-25deg); opacity: 0; } 70% { transform: translate(-50%, 0) rotate(10deg); opacity: 1; } 100% { transform: translate(-50%, -5px) rotate(0deg); opacity: 1; } }
            @keyframes hammerImpact { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1.12); opacity: 0; } }
            @keyframes bidFlash { 0% { transform: translate(-50%, -50%) scale(0.85); opacity: 0; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
            @keyframes timerPulse { 0%, 100% { transform: scale(1); filter: drop-shadow(0 0 15px rgba(239, 68, 68, 0.5)); } 50% { transform: scale(1.08); filter: drop-shadow(0 0 30px rgba(239, 68, 68, 0.95)); } }
            @keyframes pulseBid { 0%, 100% { box-shadow: 0 0 0 0 rgba(250,204,21,0.4); } 50% { box-shadow: 0 0 0 15px rgba(250,204,21,0); } }
          `}</style>
        </>
      )}

      {!!pendingRtm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none px-4">
          <div className="w-full max-w-xl rounded-3xl border border-emerald-400/20 bg-slate-950/80 p-5 text-white shadow-2xl backdrop-blur-xl animate-[rtmFade_0.3s_ease-out]">
            <p className="text-xs tracking-[0.25em] text-emerald-300">RIGHT TO MATCH</p>
            <h3 className="mt-2 text-xl md:text-2xl font-display">{rtmPlayer?.name || 'Player'}</h3>
            <p className="mt-1 text-sm text-slate-300">Original team: {rtmOriginalTeam?.shortName || '—'} • Highest bidder: {rtmWinningTeam?.shortName || '—'}</p>
            <div className="mt-4 space-y-2 text-sm md:text-base">
              <p>Current price: <span className="font-semibold text-emerald-300">{formatCrPrice(Number(pendingRtm.finalBid || 0))}</span></p>
              {pendingRtm.status === 'AWAIT_ORIGINAL' && <p>Waiting for {rtmOriginalTeam?.shortName || 'original team'} to decide whether to use RTM.</p>}
              {pendingRtm.status === 'AWAIT_WINNER_COUNTER' && <p>{rtmOriginalTeam?.shortName || 'Original team'} used RTM. Waiting for {rtmWinningTeam?.shortName || 'highest bidder'} to enter a new final bid.</p>}
              {pendingRtm.status === 'AWAIT_ORIGINAL_MATCH' && <p>{rtmWinningTeam?.shortName || 'Highest bidder'} raised the bid. Waiting for {rtmOriginalTeam?.shortName || 'original team'} to match {formatCrPrice(Number(pendingRtm.finalBid || pendingRtm.counterBid || 0))}.</p>}
              <p className="pt-2 text-xs uppercase tracking-[0.28em] text-slate-400">Auction locked • {rtmCountdownSeconds}s remaining</p>
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

      {!!pendingRtm && pendingRtm.status !== "AWAIT_WINNER_COUNTER" && rtmNeedsMyDecision && canUseRtm && rtmModalCopy && (
        <RTMModal
          open={true}
          player={rtmPlayer as any}
          title={rtmModalCopy.title}
          description={rtmModalCopy.description}
          amount={rtmModalCopy.amount}
          countdownSeconds={rtmCountdownSeconds}
          disabled={rtmSubmissionLocked}
          onPrimary={() => submitRtmDecision(pendingRtm.status === "AWAIT_ORIGINAL_MATCH" ? "MATCH" : "USE")}
          onSecondary={() => submitRtmDecision("DECLINE")}
        />
      )}

      {!!pendingRtm && pendingRtm.status === "AWAIT_WINNER_COUNTER" && rtmNeedsMyDecision && (
        <BidInputModal
          open={true}
          player={rtmPlayer as any}
          previousBid={Number(pendingRtm.finalBid || 0)}
          minBid={Math.max(Number(pendingRtm.counterBid || 0), Number(pendingRtm.finalBid || 0) + 1)}
          countdownSeconds={rtmCountdownSeconds}
          disabled={rtmSubmissionLocked}
          onSubmit={submitCounterBid}
          onCancel={() => submitCounterBid(Math.max(Number(pendingRtm.counterBid || 0), Number(pendingRtm.finalBid || 0) + 1))}
          cancelLabel="Use Min Raise"
        />
      )}
    </div>
  );
};

export default Auction;
