import {
  doc,
  collection,
  updateDoc,
  onSnapshot,
  getDoc,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
  deleteField,
  query,
  runTransaction as firestoreRunTransaction,
  Timestamp,
  getDocs,
  setDoc,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  IPL_TEAMS,
  AUCTION_TIMER,
  BID_RESET_TIMER,
  RTM_TIMER,
  RETENTION_COSTS,
  SQUAD_CONSTRAINTS,
  AI_STRATEGIES,
  TEAM_NEEDS_TEMPLATE,
  MIN_PLAYER_BASE_PRICE,
} from "@/lib/constants";
import { RetentionEngine } from "@/engine/retentionEngine";
import { AuctionEngine } from "@/engine/auctionEngine";
import { RtmEngine } from "@/engine/rtmEngine";

const runTransaction = async <T>(
  db: any,
  updateFunction: (transaction: any) => Promise<T>,
  options?: { maxAttempts?: number }
): Promise<T> => {
  const maxAttempts = options?.maxAttempts || 5;
  let attempt = 0;
  const delay = 100;

  while (true) {
    attempt++;
    try {
      return await firestoreRunTransaction(db, updateFunction);
    } catch (error: any) {
      const errorCode = error?.code || "";
      const errorMessage = error?.message || "";
      console.warn(`[Transaction Attempt ${attempt}/${maxAttempts}] Failed:`, errorCode, errorMessage);

      if (errorCode === "failed-precondition" || errorCode === "aborted") {
        console.warn(`[Conflict Details] Error Code: ${errorCode}. Message: ${errorMessage}`);
        if (error.details) {
          console.warn(`[Conflict Metadata]: ${error.details}`);
        }
      }

      const isRetryable =
        errorCode === "aborted" ||
        errorCode === "failed-precondition" ||
        errorCode === "unavailable" ||
        errorMessage.includes("contention") ||
        errorMessage.includes("concurrency");

      if (attempt >= maxAttempts || !isRetryable) {
        console.error(`[Transaction] Max attempts reached or non-retryable error:`, error);
        throw error;
      }

      const backoffDelay = delay * Math.pow(1.5, attempt) + Math.random() * 50;
      console.log(`[Transaction] Retrying in ${backoffDelay.toFixed(0)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }
};

const SET_SEQUENCE = [
  "marquee-1",
  "marquee-2",
  "batters-1",
  "batters-2",
  "batters-3",
  "batters-4",
  "bowlers-1",
  "bowlers-2",
  "bowlers-3",
  "bowlers-4",
  "wicketkeepers-1",
  "wicketkeepers-2",
  "wicketkeepers-3",
  "wicketkeepers-4",
  "all-rounders-1",
  "all-rounders-2",
  "all-rounders-3",
  "all-rounders-4",
];

const SET_LABELS: Record<string, string> = {
  "marquee-1": "Marquee Set 1",
  "marquee-2": "Marquee Set 2",
  "batters-1": "Batsmen - Set 1",
  "batters-2": "Batsmen - Set 2",
  "batters-3": "Batsmen - Set 3",
  "batters-4": "Batsmen - Set 4",
  "bowlers-1": "Bowlers - Set 1",
  "bowlers-2": "Bowlers - Set 2",
  "bowlers-3": "Bowlers - Set 3",
  "bowlers-4": "Bowlers - Set 4",
  "wicketkeepers-1": "Wicket Keepers - Set 1",
  "wicketkeepers-2": "Wicket Keepers - Set 2",
  "wicketkeepers-3": "Wicket Keepers - Set 3",
  "wicketkeepers-4": "Wicket Keepers - Set 4",
  "all-rounders-1": "All-Rounders - Set 1",
  "all-rounders-2": "All-Rounders - Set 2",
  "all-rounders-3": "All-Rounders - Set 3",
  "all-rounders-4": "All-Rounders - Set 4",
};

const normalizeCategory = (playerData: any) => {
  const categoryText = String(playerData?.category || playerData?.pool || "").toLowerCase().replace(/[\s_-]+/g, "");
  const roleText = String(playerData?.role || "").toLowerCase().replace(/[\s_-]+/g, "");
  const raw = `${categoryText} ${roleText}`;

  if (categoryText.includes("marquee")) return "marquee";
  if (roleText.includes("wicket") || categoryText.includes("wicketkeeper")) return "wicketkeepers";
  if (roleText.includes("allround") || categoryText.includes("allround")) return "all-rounders";
  if (roleText.includes("bowl") || categoryText.includes("bowler")) return "bowlers";
  if (["batters", "batsmen", "batter", "batsman"].some((v) => raw.includes(v))) return "batters";
  return "batters";
};



const shuffleArray = <T,>(items: T[]) => {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const buildAuctionSets = (players: Array<Record<string, any>>) => {
  const grouped = SET_SEQUENCE.reduce((acc, key) => ({ ...acc, [key]: [] as Array<Record<string, any>> }), {} as Record<string, Array<Record<string, any>>>);

  // Group players by category
  const playersByCategory: Record<string, Array<Record<string, any>>> = {};
  players.forEach((player) => {
    const category = normalizeCategory(player);
    if (!playersByCategory[category]) {
      playersByCategory[category] = [];
    }
    playersByCategory[category].push(player);
  });

  // For each category, sort/distribute players who don't have a set assigned
  Object.entries(playersByCategory).forEach(([category, catPlayers]) => {
    // Sort players so higher rated/priced players are distributed first
    const sortedPlayers = [...catPlayers].sort((a, b) => {
      const rA = Number(a.rating ?? a.starRating ?? 3);
      const rB = Number(b.rating ?? b.starRating ?? 3);
      if (rA !== rB) return rB - rA; // Higher rating first
      const pA = Number(a.basePrice ?? 0);
      const pB = Number(b.basePrice ?? 0);
      return pB - pA; // Higher price first
    });

    const maxSets = category === "marquee" ? 2 : 4;
    
    sortedPlayers.forEach((player, index) => {
      const explicit = Number(player?.setNumber ?? player?.set ?? player?.setNo);
      const marquee = Number(player?.marqueeSet);
      let setNo = 0;
      if (category === "marquee") {
        setNo = Number.isFinite(marquee) && marquee > 0 ? marquee : (Number.isFinite(explicit) && explicit > 0 ? explicit : 0);
      } else {
        setNo = Number.isFinite(explicit) && explicit > 0 ? explicit : 0;
      }

      // If no set number is explicitly provided, distribute them evenly
      if (setNo === 0) {
        setNo = (index % maxSets) + 1;
      }

      const key = `${category}-${Math.max(1, Math.min(maxSets, Math.floor(setNo)))}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(player);
    });
  });

  console.log("[buildAuctionSets] Generated sets:", Object.entries(grouped).map(([k, v]) => `${k}: ${v.length} players`));

  return shuffleArray(
    SET_SEQUENCE
      .filter((key) => grouped[key]?.length)
      .map((key) => ({
        key,
        label: SET_LABELS[key] || key,
        playerIds: shuffleArray(grouped[key]).map((player) => player.id),
      })),
  );
};

const buildAuctionQueue = (players: Array<Record<string, any>>) => {
  const auctionSets = buildAuctionSets(players);
  return {
    auctionSets,
    queue: auctionSets.flatMap((set) => set.playerIds),
  };
};

const getPlayerOverseasFlag = (playerData: any) => Boolean(playerData?.overseas ?? playerData?.isOverseas);
const getPlayerPreviousTeamId = (playerData: any) => String(playerData?.previousTeamId ?? playerData?.previousTeam ?? "").toLowerCase();
const getPlayerRating = (playerData: any) => Number(playerData?.rating ?? playerData?.starRating ?? 0);

const getSquadSize = (teamData: any) => Number(teamData?.squadSize ?? ((teamData?.players || []).length + (teamData?.retainedPlayers || []).length));

const getProtectedAuctionBudget = (teamData: any) => {
  const squadSize = getSquadSize(teamData);
  const remainingSlots = Math.max(0, SQUAD_CONSTRAINTS.MAX_SQUAD - squadSize);
  const reserveNeeded = remainingSlots * MIN_PLAYER_BASE_PRICE;
  return Math.max(0, Number(teamData?.purseRemaining || 0) - reserveNeeded);
};

const canProtectPurseAfterBid = (teamData: any, bidAmount: number) => {
  const squadSize = getSquadSize(teamData);
  const remainingSlots = Math.max(0, SQUAD_CONSTRAINTS.MAX_SQUAD - squadSize);
  const reserveNeeded = remainingSlots * MIN_PLAYER_BASE_PRICE;
  return Number(teamData?.purseRemaining || 0) - bidAmount >= reserveNeeded;
};

const isAiControlledTeam = (teamId: string, teamData: any, sessionData: any) => {
  const assignedController = String(sessionData?.selectedTeams?.[teamId] || '');
  return assignedController.startsWith('AI-') || Boolean(teamData?.isAI);
};

const buildRecentPurchases = (
  existing: Array<{ playerId: string; price: number; teamId: string; timestamp?: number }>,
  purchase: { playerId: string; price: number; teamId: string; timestamp?: number }
) => {
  const newPurchase = { ...purchase, timestamp: purchase.timestamp || Date.now() };
  return [newPurchase, ...(existing || [])];
};

const normalizeRoleKey = (role: string | undefined) => {
  const key = String(role || '').toLowerCase();
  if (key.includes('wicket')) return 'wicketkeeper';
  if (key.includes('all')) return 'allRounder';
  if (key.includes('bowl')) return 'bowler';
  return 'batter';
};

const deriveTeamNeeds = (currentNeeds: Record<string, number> | undefined, playerRole: string | undefined) => {
  const roleKey = normalizeRoleKey(playerRole);
  const nextNeeds = { ...TEAM_NEEDS_TEMPLATE, ...(currentNeeds || {}) } as Record<string, number>;
  nextNeeds[roleKey] = Math.max(0, Number(nextNeeds[roleKey] || 0) - 1);
  return nextNeeds;
};


const roundToBidIncrement = (amount: number) => {
  const increment = amount >= 50000000 ? 2500000 : amount >= 20000000 ? 2000000 : amount >= 10000000 ? 1000000 : 500000;
  return Math.max(increment, Math.round(amount / increment) * increment);
};

const getRoleNeedScore = (teamData: any, playerRole: string | undefined) => {
  const roleKey = normalizeRoleKey(playerRole);
  const needs = { ...TEAM_NEEDS_TEMPLATE, ...(teamData?.teamNeeds || {}) } as Record<string, number>;
  return Number(needs[roleKey] || 0);
};

const pickRealisticSkipOutcome = (
  playerData: any,
  teams: Array<{ id: string; data: any }>,
  sessionData: any
) => {
  const playerId = String(playerData?.id || '');
  const basePrice = Number(playerData?.basePrice || 0);
  const rating = Math.max(0, Math.min(5, getPlayerRating(playerData)));
  const isOverseas = getPlayerOverseasFlag(playerData);
  const role = String(playerData?.role || '');
  const previousTeamId = getPlayerPreviousTeamId(playerData);

  const eligibleTeams = teams
    .filter(({ id, data }) => isAiControlledTeam(id, data, sessionData))
    .filter(({ data }) => Number(data?.purseRemaining || 0) >= basePrice)
    .filter(({ data }) => canProtectPurseAfterBid(data, basePrice))
    .filter(({ data }) => getSquadSize(data) < SQUAD_CONSTRAINTS.MAX_SQUAD)
    .filter(({ data }) => !isOverseas || Number(data?.overseasCount || 0) < SQUAD_CONSTRAINTS.MAX_OVERSEAS)
    .map((team) => {
      const needScore = getRoleNeedScore(team.data, role);
      const squadSize = getSquadSize(team.data);
      const purseCr = getProtectedAuctionBudget(team.data) / 10000000;
      const formerTeamBoost = previousTeamId && team.id === previousTeamId ? 1.2 : 0;
      const randomDemand = Math.random() * 1.8;
      return {
        ...team,
        demandScore: rating * 1.7 + needScore * 1.15 + Math.min(4, purseCr / 12) + Math.max(0, 22 - squadSize) * 0.18 + formerTeamBoost + randomDemand,
      };
    })
    .sort((a, b) => b.demandScore - a.demandScore);

  if (!eligibleTeams.length || basePrice <= 0) return { sold: false as const, playerId };

  const scarcityBoost = eligibleTeams[0]?.demandScore || 0;
  const completionNeedBoost = Math.max(0, 22 - getSquadSize(eligibleTeams[0]?.data)) * 0.025;
  const sellChance = Math.max(0.18, Math.min(0.96, 0.22 + rating * 0.13 + scarcityBoost * 0.045 + completionNeedBoost));
  if (Math.random() > sellChance) return { sold: false as const, playerId };

  const topSlice = eligibleTeams.slice(0, Math.min(4, eligibleTeams.length));
  const winningTeam = topSlice[Math.floor(Math.random() * topSlice.length)];
  const starMultiplier = rating >= 4.5 ? 4.5 + Math.random() * 5.5 : rating >= 3.5 ? 2.2 + Math.random() * 3.6 : rating >= 2.5 ? 1.2 + Math.random() * 2.2 : 1 + Math.random() * 1.2;
  const demandMultiplier = 1 + Math.min(1.8, winningTeam.demandScore / 9);
  const ceiling = getProtectedAuctionBudget(winningTeam.data);
  const realisticCap = rating >= 4.5 ? 240000000 : rating >= 4 ? 160000000 : rating >= 3 ? 90000000 : 45000000;
  const price = Math.min(ceiling, realisticCap, roundToBidIncrement(basePrice * starMultiplier * demandMultiplier));

  if (price < basePrice || !canProtectPurseAfterBid(winningTeam.data, price)) return { sold: false as const, playerId };

  return {
    sold: true as const,
    playerId,
    teamId: winningTeam.id,
    price: Math.max(basePrice, price),
    isOverseas,
    role,
  };
};

const applySilentSkipSaleToLocalTeam = (
  teamData: any,
  playerId: string,
  price: number,
  isOverseas: boolean,
  role: string,
) => {
  const players = (teamData.players || []) as string[];
  return {
    ...teamData,
    players: [...players, playerId],
    purseRemaining: Math.max(0, Number(teamData.purseRemaining || 0) - price),
    squadSize: Number(teamData.squadSize ?? ((teamData.retainedPlayers || []).length + players.length)) + 1,
    overseasCount: Number(teamData.overseasCount || 0) + (isOverseas ? 1 : 0),
    teamNeeds: deriveTeamNeeds(teamData.teamNeeds, role),
    playerPurchasePrices: { ...(teamData.playerPurchasePrices || {}), [playerId]: price },
  };
};

const buildSilentSkipHistoryRecord = (outcome: any, source = 'AI_SKIP') => ({
  playerId: outcome.playerId,
  teamId: outcome.sold ? outcome.teamId : null,
  price: outcome.sold ? outcome.price : 0,
  status: outcome.sold ? 'SOLD' : 'UNSOLD',
  source,
  createdAt: Timestamp.fromMillis(Date.now()),
});

const DEFAULT_AUCTION_STATE = {
  activePlayerId: null,
  currentBid: 0,
  currentBidderId: null,
  timerEndsAt: null,
  status: "IDLE",
  auctionState: "NEXT_READY",
  isAuctionLocked: false,
  timerMode: "NONE",
  rtmStage: "NONE",
  rtmTeamId: null,
  rtmWinningTeamId: null,
  rtmPlayerId: null,
  rtmFinalBid: 0,
  rtmCounterBid: 0,
  rtmExpiresAt: null,
  soldToTeamId: null,
  soldPrice: 0,
  soldAt: null,
  soldPlayerId: null,
  rtmResultMessage: null,
  lastEvent: null,
};

const HOST_RECONNECT_GRACE_MS = 30_000;

const retentionEngine = new RetentionEngine();
const auctionEngine = new AuctionEngine();
const rtmEngine = new RtmEngine();

export const generateGameCode = () => `CAIPL${Math.floor(1000 + Math.random() * 9000)}`;

export const listenPlayers = (callback: (players: any[]) => void) => {
  const playersRef = collection(db, "players");
  return onSnapshot(query(playersRef), (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))));
};

export const listenTeams = (gameCode: string, callback: (teams: any[]) => void) => {
  const teamsRef = collection(db, "sessions", gameCode, "teams");
  return onSnapshot(query(teamsRef), (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))));
};

export const fillAITeams = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) return;

  const sessionData = snap.data() as any;
  const selectedTeams = { ...(sessionData.selectedTeams || {}) } as Record<string, string>;

  IPL_TEAMS.forEach((team) => {
    if (!selectedTeams[team.id]) selectedTeams[team.id] = `AI-${team.id}`;
  });

  const allTeams = IPL_TEAMS.map((team) => ({
    id: team.id,
    name: team.name,
    isAI: String(selectedTeams[team.id] || '').startsWith('AI-'),
  }));

  const batch = writeBatch(db);
  batch.update(sessionRef, { selectedTeams, allTeams, isAIFilled: true, updatedAt: serverTimestamp() });

  IPL_TEAMS.forEach((team) => {
    batch.update(doc(db, "sessions", gameCode, "teams", team.id), {
      isAI: String(selectedTeams[team.id] || '').startsWith('AI-'),
    });
  });

  await batch.commit();
};

export const createSession = async (gameCode: string, hostId: string, mode: "MULTIPLAYER" | "VS_AI" = "MULTIPLAYER") => {
  const sessionRef = doc(db, "sessions", gameCode);
  const batch = writeBatch(db);

  batch.set(sessionRef, {
    phase: "LOBBY",
    hostId,
    createdAt: serverTimestamp(),
    selectedTeams: {},
    retentions: {},
    playersJoined: [hostId],
    disconnectedPlayers: {},
    mode,
    allTeams: IPL_TEAMS.map((t) => ({ id: t.id, name: t.name, isAI: true })),
    auctionQueue: [],
    queueIndex: -1,
    unsoldPlayers: [],
    recentPurchases: [],
    isAcceleratedRound: false,
    acceleratedRoundSkipped: false,
    pendingRtm: null,
    currentAuction: DEFAULT_AUCTION_STATE,
  });

  IPL_TEAMS.forEach((team, index) => {
    batch.set(doc(collection(sessionRef, "teams"), team.id), {
      ...team,
      purseRemaining: team.purse,
      players: [],
      retainedPlayers: [],
      playerPurchasePrices: {},
      squadSize: 0,
      overseasCount: 0,
      rtmCards: 0,
      isAI: mode === "VS_AI",
      ownerId: null,
      aiStrategy: AI_STRATEGIES[index % AI_STRATEGIES.length],
      teamNeeds: { ...TEAM_NEEDS_TEMPLATE },
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
};

/** Phases where no new participants are allowed to enter. */
const LOCKED_PHASES = new Set(["RETENTION", "AUCTION", "AUCTION_COMPLETE", "ENDED"]);

export const joinSession = async (gameCode: string, userId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) throw new Error("Room not found");
  const phase = String(snap.data()?.phase || "");
  if (LOCKED_PHASES.has(phase)) {
    throw new Error("AUCTION_ALREADY_STARTED");
  }
  await updateDoc(sessionRef, { playersJoined: arrayUnion(userId) });
};


export const leaveGame = async (gameCode: string, userId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const session = sessionSnap.data() as any;

    const selectedTeams = (session.selectedTeams || {}) as Record<string, string>;
    const teamId = Object.entries(selectedTeams).find(([, uid]) => uid === userId)?.[0] || null;

    if (session.hostId === userId) {
      const reconnectDeadline = Timestamp.fromMillis(Date.now() + HOST_RECONNECT_GRACE_MS);
      tx.update(sessionRef, {
        hostReconnect: {
          hostId: userId,
          startedAt: Timestamp.fromMillis(Date.now()),
          deadlineAt: reconnectDeadline,
          status: "PENDING",
        },
        [`disconnectedPlayers.${userId}`]: true,
        playersJoined: arrayRemove(userId),
      });
      return;
    }

    tx.update(sessionRef, {
      [`disconnectedPlayers.${userId}`]: true,
      playersJoined: arrayRemove(userId),
    });

    if (!teamId) return;

    tx.update(doc(db, "sessions", gameCode, "teams", teamId), {
      isAI: true,
      ownerId: null,
    });

    if (session.currentAuction?.status === "RUNNING" && session.currentAuction?.currentBidderId === teamId && session.currentAuction?.activePlayerId) {
      const playerSnap = await tx.get(doc(db, "players", session.currentAuction.activePlayerId));
      const basePrice = Number(playerSnap.data()?.basePrice || 0);
      tx.update(sessionRef, {
        "currentAuction.currentBid": basePrice,
        "currentAuction.currentBidderId": null,
        "currentAuction.timerEndsAt": Timestamp.fromMillis(Date.now() + AUCTION_TIMER * 1000),
        "currentAuction.timerMode": "AUCTION",
      });
    }
  });
};

export const resolveHostReconnectTimeout = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) return;

    const session = sessionSnap.data() as any;
    const hostReconnect = session?.hostReconnect as any;
    if (!hostReconnect || hostReconnect.status !== "PENDING") return;

    const deadlineMs = typeof hostReconnect?.deadlineAt?.toMillis === "function" ? hostReconnect.deadlineAt.toMillis() : 0;
    if (!deadlineMs || Date.now() < deadlineMs) return;

    const disconnectedPlayers = (session?.disconnectedPlayers || {}) as Record<string, boolean>;
    const previousHostId = String(session?.hostId || "");
    const stillDisconnected = Boolean(disconnectedPlayers?.[previousHostId]);
    if (!stillDisconnected) {
      tx.update(sessionRef, { hostReconnect: deleteField() });
      return;
    }

    const joinedPlayers = (session?.playersJoined || []) as string[];
    const nextHostId = joinedPlayers.find((id) => id && id !== previousHostId && !disconnectedPlayers[id]) || null;

    if (nextHostId) {
      tx.update(sessionRef, {
        hostId: nextHostId,
        hostReconnect: {
          ...hostReconnect,
          status: "TRANSFERRED",
          resolvedAt: Timestamp.fromMillis(Date.now()),
          newHostId: nextHostId,
        },
      });
      return;
    }

    tx.update(sessionRef, {
      phase: "AUCTION_COMPLETE",
      currentAuction: DEFAULT_AUCTION_STATE,
      hostReconnect: {
        ...hostReconnect,
        status: "NO_HOST_AVAILABLE",
        resolvedAt: Timestamp.fromMillis(Date.now()),
      },
    });
  });
};

export const rejoinGame = async (gameCode: string, userId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) return;

    const session = sessionSnap.data() as any;
    const disconnected = Boolean(session?.disconnectedPlayers?.[userId]);
    const selectedTeams = (session.selectedTeams || {}) as Record<string, string>;
    const teamId = Object.entries(selectedTeams).find(([, uid]) => uid === userId)?.[0] || null;

    if (!disconnected || !teamId) return;

    tx.update(sessionRef, {
      [`disconnectedPlayers.${userId}`]: deleteField(),
      playersJoined: arrayUnion(userId),
      ...(session.hostId === userId ? { hostReconnect: deleteField() } : {}),
    });

    tx.update(doc(db, "sessions", gameCode, "teams", teamId), {
      isAI: false,
      ownerId: userId,
    });
  });
};

export const selectTeam = async (gameCode: string, teamId: string, userId: string, managerName?: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) throw new Error("Room not found");
  const phase = String(snap.data()?.phase || "");
  if (LOCKED_PHASES.has(phase)) {
    throw new Error("AUCTION_ALREADY_STARTED");
  }
  await updateDoc(sessionRef, {
    [`selectedTeams.${teamId}`]: userId,
    ...(managerName ? { [`managerNames.${teamId}`]: managerName } : {}),
  });
};

export const startRetention = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) return;

  const sessionData = snap.data() as any;
  const selectedTeams = (sessionData.selectedTeams || {}) as Record<string, string>;

  const playersSnap = await getDocs(query(collection(db, "players")));
  const players = playersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  const retentions: Record<string, { players: string[]; capped: number; uncapped: number; rtm: number; locked: boolean; lockedAt?: any }> = {
    ...(sessionData.retentions || {}),
  };

  const batch = writeBatch(db);

  const humanSelectedTeams = selectedTeams as Record<string, string>;
  const allTeams = IPL_TEAMS.map((team) => {
    const assignedId = humanSelectedTeams[team.id] || null;
    const ownerId = assignedId && !String(assignedId).startsWith("AI-") ? assignedId : null;
    const isAI = !ownerId;
    batch.update(doc(db, "sessions", gameCode, "teams", team.id), { isAI, ownerId });
    return { id: team.id, name: team.name, isAI, ownerId };
  });

  IPL_TEAMS.forEach((team) => {
    const assignedId = humanSelectedTeams[team.id] || null;
    const ownerId = assignedId && !String(assignedId).startsWith("AI-") ? assignedId : null;
    const isAI = !ownerId;

    if (!isAI) {
      if (!retentions[team.id]) {
        retentions[team.id] = { players: [], capped: 0, uncapped: 0, rtm: 6, locked: false };
      }
      return;
    }

    const aiResult = retentionEngine.decideRetentions(team.id, players as any[]);
    retentions[team.id] = {
      players: aiResult.retainedIds,
      capped: aiResult.cappedCount,
      uncapped: aiResult.uncappedCount,
      rtm: Math.max(0, 6 - aiResult.retainedIds.length),
      locked: true,
      lockedAt: serverTimestamp(),
    };

    batch.update(doc(db, "sessions", gameCode, "teams", team.id), {
      retainedPlayers: aiResult.retainedIds,
      rtmCards: Math.max(0, 6 - aiResult.retainedIds.length),
      purseRemaining: Math.max(0, team.purse - aiResult.spend),
      playerPurchasePrices: aiResult.priceMap,
      squadSize: aiResult.retainedIds.length,
      overseasCount: aiResult.overseasCount,
    });
  });

  batch.update(sessionRef, {
    phase: "RETENTION",
    retentionStartedAt: serverTimestamp(),
    retentions,
    allTeams,
    "currentAuction.timerMode": "RETENTION",
    "currentAuction.timerEndsAt": Timestamp.fromMillis(Date.now() + RTM_TIMER * 1000),
  });

  await batch.commit();
};

export const lockRetention = async (
  gameCode: string,
  teamId: string,
  playerIds: string[],
  cappedCount: number,
  uncappedCount: number
) => {
  if (playerIds.length > 6) throw new Error("Max 6 retentions allowed");
  if (cappedCount > 5) throw new Error("Max 5 capped retentions allowed");
  if (uncappedCount > 2) throw new Error("Max 2 uncapped retentions allowed");

  const playersSnap = await getDocs(query(collection(db, "players")));
  const byId = new Map(playersSnap.docs.map((d) => [d.id, d.data()]));

  let cappedSlot = 0;
  let retainedSpend = 0;
  let overseasCount = 0;
  const retainedPriceMap: Record<string, number> = {};

  playerIds.forEach((pid) => {
    const p = byId.get(pid) || {};
    const isCapped = Boolean(p.isCapped);
    const cost = isCapped
      ? (RETENTION_COSTS.CAPPED_SLOTS[Math.min(cappedSlot, RETENTION_COSTS.CAPPED_SLOTS.length - 1)] || RETENTION_COSTS.CAPPED_SLOTS[RETENTION_COSTS.CAPPED_SLOTS.length - 1])
      : RETENTION_COSTS.UNCAPPED;

    if (isCapped) cappedSlot += 1;
    retainedSpend += cost;
    retainedPriceMap[pid] = cost;
    if (getPlayerOverseasFlag(p)) overseasCount += 1;
  });

  const computedCapped = playerIds.filter((pid) => Boolean((byId.get(pid) as any)?.isCapped)).length;
  const computedUncapped = playerIds.length - computedCapped;
  if (computedCapped !== cappedCount || computedUncapped !== uncappedCount) {
    throw new Error("Retention counts mismatch");
  }

  const teamBasePurse = IPL_TEAMS.find((t) => t.id === teamId)?.purse || 0;
  const rtmCards = Math.max(0, 6 - playerIds.length);

  await updateDoc(doc(db, "sessions", gameCode), {
    [`retentions.${teamId}`]: {
      players: playerIds,
      capped: cappedCount,
      uncapped: uncappedCount,
      rtm: rtmCards,
      locked: true,
      lockedAt: serverTimestamp(),
    },
  });

  await updateDoc(doc(db, "sessions", gameCode, "teams", teamId), {
    retainedPlayers: playerIds,
    rtmCards,
    purseRemaining: Math.max(0, teamBasePurse - retainedSpend),
    playerPurchasePrices: retainedPriceMap,
    squadSize: playerIds.length,
    overseasCount,
  });
};

export const listenSession = (gameCode: string, callback: (data: any) => void) => {
  return onSnapshot(doc(db, "sessions", gameCode), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
};

export const startAuction = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) throw new Error("Session not found");

  const sessionData = sessionSnap.data() as any;
  if (sessionData.auctionShuffleLocked && Array.isArray(sessionData.auctionQueue) && sessionData.auctionQueue.length) {
    await updateDoc(sessionRef, {
      phase: "AUCTION",
      pendingRtm: null,
      currentAuction: sessionData.currentAuction || { ...DEFAULT_AUCTION_STATE, timerMode: "AUCTION" },
    });
    return;
  }

  const retainedIds = new Set<string>();
  const retentions = (sessionData.retentions || {}) as Record<string, any>;
  Object.values(retentions).forEach((ret: any) => {
    (ret?.players || []).forEach((pid: string) => retainedIds.add(pid));
  });

  const playersSnapshot = await getDocs(query(collection(db, "players")));
  const players = playersSnapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p: any) => !retainedIds.has(p.id));
  const { queue, auctionSets } = buildAuctionQueue(players);

  await updateDoc(sessionRef, {
    phase: "AUCTION",
    auctionStartedAt: serverTimestamp(),
    auctionQueue: queue,
    auctionSets,
    auctionSetOrder: auctionSets.map((set) => set.key),
    auctionShuffleLocked: true,
    queueIndex: -1,
    unsoldPlayers: [],
    recentPurchases: [],
    isAcceleratedRound: false,
    acceleratedRoundSkipped: false,
    pendingRtm: null,
    currentAuction: { ...DEFAULT_AUCTION_STATE, timerMode: "AUCTION" },
  });
};

const logSetsAndUnsoldCount = (sessionData: any, queueIndex: number) => {
  const queue = (sessionData.auctionQueue || []) as string[];
  const auctionSets = (sessionData.auctionSets || []) as Array<{ key: string; label: string; playerIds?: string[] }>;
  const unsoldPlayers = (sessionData.unsoldPlayers || []) as string[];

  const completedSets = auctionSets.filter(set => {
    return (set.playerIds || []).every(id => {
      const idx = queue.indexOf(id);
      return idx !== -1 && idx < queueIndex;
    });
  });

  console.log(`[AUCTION PROGRESS PROGRESS] Sets completed: ${completedSets.length}/${auctionSets.length}. Unsold players count: ${unsoldPlayers.length}.`);
};

export const loadNextPlayer = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const sessionData = sessionSnap.data();
    const auctionQueue = (sessionData.auctionQueue || []) as string[];

    const teamSnaps = await Promise.all(IPL_TEAMS.map((t) => tx.get(doc(db, "sessions", gameCode, "teams", t.id))));
    const teamSquadSizes = teamSnaps.map((snap) => Number(snap.data()?.squadSize || 0));
    const nextIndex = Number(sessionData.queueIndex ?? -1) + 1;
    logSetsAndUnsoldCount(sessionData, nextIndex);
    const queueProcessed = nextIndex >= auctionQueue.length;
    const allTeamsFull = teamSquadSizes.every((size) => size >= SQUAD_CONSTRAINTS.MAX_SQUAD);

    if (queueProcessed || allTeamsFull) {
      const hasUnsold = Number((sessionData.unsoldPlayers || []).length) > 0;
      const isAccelerated = Boolean(sessionData.isAcceleratedRound);

      if (queueProcessed && !allTeamsFull && !isAccelerated && hasUnsold) {
        console.log(`[ACCELERATED ROUND] Normal sets complete via loadNextPlayer. Unsold players count: ${(sessionData.unsoldPlayers || []).length}. Moving to Accelerated Round selection.`);
        tx.update(sessionRef, {
          queueIndex: auctionQueue.length,
          currentAuction: DEFAULT_AUCTION_STATE,
        });
      } else {
        if (isAccelerated) {
          console.log(`[ACCELERATED ROUND] Accelerated round complete via loadNextPlayer. Phase transitioning to AUCTION_COMPLETE.`);
        }
        tx.update(sessionRef, {
          phase: "AUCTION_COMPLETE",
          queueIndex: auctionQueue.length,
          currentAuction: DEFAULT_AUCTION_STATE,
        });
      }
      return;
    }

    const activePlayerId = auctionQueue[nextIndex];
    const playerSnap = await tx.get(doc(db, "players", activePlayerId));

    const auctionSets = (sessionData.auctionSets || []) as Array<{ key: string; playerIds?: string[] }>;
    const activeSet = auctionSets.find((set) => (set.playerIds || []).includes(activePlayerId));
    const isFirstInSet = activeSet && activeSet.playerIds?.[0] === activePlayerId;

    const transitionDelay = (isFirstInSet && !sessionData.isAcceleratedRound) ? 8 : 0;
    const timerDuration = (sessionData.isAcceleratedRound ? BID_RESET_TIMER : AUCTION_TIMER) + transitionDelay;

    tx.update(sessionRef, {
      queueIndex: nextIndex,
      pendingRtm: null,
      currentAuction: {
        activePlayerId: activePlayerId,
        currentBid: Number(playerSnap.data()?.basePrice || 0),
        currentBidderId: null,
        timerEndsAt: Timestamp.fromMillis(Date.now() + timerDuration * 1000),
        status: "RUNNING",
        auctionState: "BIDDING",
        isAuctionLocked: false,
        timerMode: "AUCTION",
        rtmStage: "NONE",
        rtmTeamId: null,
        rtmWinningTeamId: null,
        rtmPlayerId: null,
        rtmFinalBid: 0,
        rtmCounterBid: 0,
        rtmExpiresAt: null,
        soldToTeamId: null,
        soldPrice: 0,
        soldAt: null,
        soldPlayerId: null,
        rtmResultMessage: null,
        lastEvent: {
          type: "next-player",
          playerId: activePlayerId,
          createdAt: Timestamp.fromMillis(Date.now()),
        },
      },
    });
  });
};

export const startNextPlayer = loadNextPlayer;

export const placeBid = async (gameCode: string, teamId: string, amount: number) => {
  const sessionRef = doc(db, "sessions", gameCode);

  console.log(`[BID ATTEMPT] Requesting bid: Game=${gameCode}, Team=${teamId}, ProposedAmount=₹${(amount/10000000).toFixed(2)} Cr`);

  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) {
      console.error(`[BID VALIDATION FAILED] Session document ${gameCode} not found in Firestore`);
      throw new Error("Session not found");
    }

    const sessionData = sessionSnap.data();
    const currentAuction = sessionData.currentAuction;
    const phase = sessionData.phase;

    if (phase !== "AUCTION") {
      console.error(`[BID VALIDATION FAILED] Invalid session phase: ${phase}`);
      throw new Error("Auction phase is not active");
    }

    if (!currentAuction || currentAuction.status !== "RUNNING") {
      console.error(`[BID VALIDATION FAILED] Auction status is not RUNNING. Current status: ${currentAuction?.status}`);
      throw new Error("Auction is not running");
    }

    if (currentAuction.isAuctionLocked) {
      console.error(`[BID VALIDATION FAILED] Auction is currently locked`);
      throw new Error("Auction is currently locked");
    }

    const activePlayerId = currentAuction.activePlayerId;
    if (!activePlayerId) {
      console.error(`[BID VALIDATION FAILED] No active player in auction`);
      throw new Error("No active player found");
    }

    // Check timer expiration
    const timerEndsAtMs = currentAuction.timerEndsAt?.toMillis?.() || 0;
    if (timerEndsAtMs && Date.now() >= timerEndsAtMs) {
      console.error(`[BID VALIDATION FAILED] Auction timer has expired for player ${activePlayerId}`);
      throw new Error("Auction timer has expired");
    }

    const [teamSnap, playerSnap] = await Promise.all([
      tx.get(doc(db, "sessions", gameCode, "teams", teamId)),
      tx.get(doc(db, "players", activePlayerId)),
    ]);

    if (!teamSnap.exists()) {
      console.error(`[BID VALIDATION FAILED] Team document ${teamId} not found`);
      throw new Error("Team not found");
    }

    if (!playerSnap.exists()) {
      console.error(`[BID VALIDATION FAILED] Player document ${activePlayerId} not found`);
      throw new Error("Current player not found");
    }

    const team = teamSnap.data();
    const playerData = playerSnap.data();

    const squadSize = Number(team.squadSize ?? ((team.players || []).length + (team.retainedPlayers || []).length));
    const overseasCount = Number(team.overseasCount || 0);
    const isOverseas = getPlayerOverseasFlag(playerData);
    const currentBid = Number(currentAuction.currentBid || 0);
    const currentBidderId = currentAuction.currentBidderId || null;
    const purseRemaining = Number(team.purseRemaining || 0);

    console.log(`[BID AUDIT] Player=${playerData.name} (${activePlayerId}), CurrentBid=₹${(currentBid/10000000).toFixed(2)} Cr (held by ${currentBidderId || 'None'}), ProposedBid=₹${(amount/10000000).toFixed(2)} Cr, Team=${team.shortName || teamId}, Purse=₹${(purseRemaining/10000000).toFixed(2)} Cr, SquadSize=${squadSize}/${SQUAD_CONSTRAINTS.MAX_SQUAD}, Overseas=${overseasCount}/${isOverseas ? SQUAD_CONSTRAINTS.MAX_OVERSEAS : 'N/A'}`);

    try {
      auctionEngine.validateBid({
        amount,
        currentBid,
        currentBidderId,
        teamId,
        purseRemaining,
        squadSize,
        overseasCount,
        isPlayerOverseas: isOverseas,
      });
    } catch (valErr: any) {
      console.error(`[BID VALIDATION FAILED] ${valErr.message}`);
      throw valErr;
    }

    tx.update(sessionRef, {
      "currentAuction.currentBid": amount,
      "currentAuction.currentBidderId": teamId,
      "currentAuction.timerEndsAt": Timestamp.fromMillis(Date.now() + BID_RESET_TIMER * 1000),
      "currentAuction.timerMode": "AUCTION",
    });

    console.log(`[BID SUCCESS] Bid successfully placed: Team ${team.shortName || teamId} on ${playerData.name} for ₹${(amount/10000000).toFixed(2)} Cr`);
  });
};

const applySaleToTeam = (
  tx: any,
  gameCode: string,
  teamId: string,
  playerId: string,
  price: number,
  isOverseas: boolean,
  decrementRtm: boolean,
  playerRole?: string
) => {
  const teamRef = doc(db, "sessions", gameCode, "teams", teamId);
  return tx.get(teamRef).then((teamSnap: any) => {
    if (!teamSnap.exists()) throw new Error("Team not found for sale");
    const teamData = teamSnap.data();
    const players = (teamData.players || []) as string[];
    const squadSize = Number(teamData.squadSize ?? ((teamData.retainedPlayers || []).length + players.length));
    const overseasCount = Number(teamData.overseasCount || 0);

    tx.update(teamRef, {
      players: [...players, playerId],
      purseRemaining: Number(teamData.purseRemaining || 0) - price,
      squadSize: squadSize + 1,
      overseasCount: overseasCount + (isOverseas ? 1 : 0),
      teamNeeds: deriveTeamNeeds(teamData.teamNeeds, playerRole),
      [`playerPurchasePrices.${playerId}`]: price,
      ...(decrementRtm ? { rtmCards: Math.max(0, Number(teamData.rtmCards || 0) - 1) } : {}),
    });
  });
};

export const resolveAuction = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const sessionData = sessionSnap.data();
    const auction = sessionData.currentAuction;
    if (!auction?.activePlayerId) throw new Error("No active player");

    const now = Date.now();
    const timerEndsAtMs = auction.timerEndsAt?.toMillis?.() || 0;
    if (timerEndsAtMs && timerEndsAtMs > now + 1500) {
      console.log(`[resolveAuction] Aborting resolution: timer has not expired yet in DB (ends at ${timerEndsAtMs}, now is ${now})`);
      return;
    }

    const playerSnap = await tx.get(doc(db, "players", auction.activePlayerId));
    if (!playerSnap.exists()) throw new Error("Player not found");

    const playerId = auction.activePlayerId;
    const playerName = String(playerSnap.data().name || playerId);
    const winningTeamId = auction.currentBidderId as string | null;
    const finalBid = Number(auction.currentBid || 0);
    const isOverseas = getPlayerOverseasFlag(playerSnap.data());

    if (!winningTeamId) {
      const unsold = [...((sessionData.unsoldPlayers || []) as string[]), playerId];
      tx.update(sessionRef, {
        unsoldPlayers: unsold,
        pendingRtm: null,
        currentAuction: {
          activePlayerId: playerId,
          currentBid: finalBid,
          currentBidderId: null,
          timerEndsAt: null,
          status: "UNSOLD",
          auctionState: "NEXT_READY",
          isAuctionLocked: false,
          timerMode: "NONE",
          rtmStage: "NONE",
          rtmTeamId: null,
          rtmWinningTeamId: null,
          rtmPlayerId: null,
          rtmFinalBid: 0,
          rtmCounterBid: 0,
          rtmExpiresAt: null,
          soldToTeamId: null,
          soldPrice: 0,
          soldAt: null,
          soldPlayerId: null,
          rtmResultMessage: null,
          lastEvent: {
            type: "player-unsold",
            playerId,
            createdAt: Timestamp.fromMillis(Date.now()),
          },
        },
      });
      return;
    }

    const soldBasePayload = {
      soldToTeamId: winningTeamId,
      soldPrice: finalBid,
      soldAt: Timestamp.fromMillis(Date.now()),
      soldPlayerId: playerId,
    };

    const previousTeamId = getPlayerPreviousTeamId(playerSnap.data());
    const playerRating = getPlayerRating(playerSnap.data());
    const winningTeamSnap = await tx.get(doc(db, "sessions", gameCode, "teams", winningTeamId));
    const previousTeamSnap = previousTeamId ? await tx.get(doc(db, "sessions", gameCode, "teams", previousTeamId)) : null;
    const rtmCards = Number(previousTeamSnap?.data()?.rtmCards || 0);

    if (previousTeamSnap?.exists() && rtmEngine.shouldTrigger({ previousTeamId, winningTeamId, playerRating, rtmCards })) {
      const rtmState = rtmEngine.createInitialState({
        playerId,
        playerName,
        winningTeamId,
        winningTeamName: String(winningTeamSnap.data()?.shortName || winningTeamId),
        originalTeamId: previousTeamId,
        originalTeamName: String(previousTeamSnap.data()?.shortName || previousTeamId),
        finalBid,
      });

      tx.update(sessionRef, {
        pendingRtm: {
          playerId,
          winningTeamId,
          originalTeamId: previousTeamId,
          finalBid,
          status: "AWAIT_ORIGINAL",
          counterBid: Number(finalBid) + 1,
          expiresAt: Timestamp.fromMillis(Date.now() + RTM_TIMER * 1000),
          lastDecision: null,
        },
        "currentAuction.status": "RTM",
        "currentAuction.auctionState": "RTM_STEP_1",
        "currentAuction.isAuctionLocked": true,
        "currentAuction.timerMode": "RTM",
        "currentAuction.timerEndsAt": Timestamp.fromMillis(Date.now() + RTM_TIMER * 1000),
        "currentAuction.rtmStage": "PROMPT",
        "currentAuction.rtmTeamId": rtmState.rtmTeamId,
        "currentAuction.rtmWinningTeamId": rtmState.rtmWinningTeamId,
        "currentAuction.rtmPlayerId": rtmState.rtmPlayerId,
        "currentAuction.rtmFinalBid": rtmState.rtmFinalBid,
        "currentAuction.rtmCounterBid": rtmState.rtmCounterBid,
        "currentAuction.rtmExpiresAt": Timestamp.fromMillis(Date.now() + RTM_TIMER * 1000),
        "currentAuction.soldToTeamId": null,
        "currentAuction.soldPrice": 0,
        "currentAuction.soldAt": null,
        "currentAuction.soldPlayerId": null,
        "currentAuction.rtmResultMessage": null,
        "currentAuction.lastEvent": {
          type: "rtm-start",
          stage: "RTM_STEP_1",
          playerId,
          originalTeamId: previousTeamId,
          winningTeamId,
          price: finalBid,
          createdAt: Timestamp.fromMillis(Date.now()),
        },
      });
      return;
    }

    await applySaleToTeam(tx, gameCode, winningTeamId, playerId, finalBid, isOverseas, false, String(playerSnap.data()?.role || ''));
    tx.update(sessionRef, {
      pendingRtm: null,
      recentPurchases: buildRecentPurchases((sessionData.recentPurchases || []) as any[], { playerId, price: finalBid, teamId: winningTeamId }),
      currentAuction: {
        activePlayerId: playerId,
        currentBid: finalBid,
        currentBidderId: winningTeamId,
        timerEndsAt: null,
        status: "SOLD",
        auctionState: "SOLD",
        isAuctionLocked: true,
        timerMode: "NONE",
        rtmStage: "NONE",
        rtmTeamId: null,
        rtmWinningTeamId: null,
        rtmPlayerId: null,
        rtmFinalBid: 0,
        rtmCounterBid: 0,
        rtmExpiresAt: null,
        rtmResultMessage: null,
        ...soldBasePayload,
        lastEvent: {
          type: "player-sold",
          playerId,
          teamId: winningTeamId,
          price: finalBid,
          createdAt: Timestamp.fromMillis(Date.now()),
        },
      },
    });
  });
};

export const finalizePlayerSale = resolveAuction;

export const resolveRtmDecision = async (
  gameCode: string,
  payload: { action: "USE" | "DECLINE" | "COUNTER" | "MATCH"; actingTeamId: string; counterBid?: number }
) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const sessionData = sessionSnap.data();
    const pending = sessionData.pendingRtm;
    if (!pending) return;

    const originalTeamSnap = pending.originalTeamId
      ? await tx.get(doc(db, "sessions", gameCode, "teams", pending.originalTeamId))
      : null;

    const playerSnap = await tx.get(doc(db, "players", pending.playerId));
    const isOverseas = getPlayerOverseasFlag(playerSnap.data());
    const playerName = String(playerSnap.data()?.name || pending.playerId);
    const originalTeamShortName = String(originalTeamSnap?.data()?.shortName || pending.originalTeamId || "Original Team").toUpperCase();

    const stageMap: Record<string, "NONE" | "AVAILABLE" | "COUNTER_BID" | "FINAL"> = {
      AWAIT_ORIGINAL: "AVAILABLE",
      AWAIT_WINNER_COUNTER: "COUNTER_BID",
      AWAIT_ORIGINAL_MATCH: "FINAL",
    };

    const transition = rtmEngine.transition({
      stage: stageMap[pending.status] || "NONE",
      action: payload.action,
      actingTeamId: payload.actingTeamId,
      rtmTeamId: pending.originalTeamId,
      winningTeamId: pending.winningTeamId,
      finalBid: Number(pending.finalBid),
      counterBid: Number(payload.counterBid || pending.counterBid),
      playerName,
    });

    if ((transition as any).done) {
      const result = transition as any;
      const rtmResultMessage =
        payload.action === "USE" || payload.action === "MATCH" || (payload.action === "DECLINE" && pending.status === "AWAIT_WINNER_COUNTER")
          ? `${originalTeamShortName} used RTM`
          : `${originalTeamShortName} declined RTM`;
      await applySaleToTeam(tx, gameCode, result.winnerTeamId, pending.playerId, Number(result.finalBid), isOverseas, Boolean(result.rtmUsed && result.winnerTeamId === pending.originalTeamId), String(playerSnap.data()?.role || ''));
      tx.update(sessionRef, {
        pendingRtm: null,
        recentPurchases: buildRecentPurchases((sessionData.recentPurchases || []) as any[], { playerId: pending.playerId, price: Number(result.finalBid), teamId: result.winnerTeamId }),
        currentAuction: {
          activePlayerId: pending.playerId,
          currentBid: Number(result.finalBid),
          currentBidderId: result.winnerTeamId,
          timerEndsAt: null,
          status: "SOLD",
          auctionState: "SOLD",
          isAuctionLocked: true,
          timerMode: "NONE",
          rtmStage: "NONE",
          rtmTeamId: null,
          rtmWinningTeamId: null,
          rtmPlayerId: null,
          rtmFinalBid: 0,
          rtmCounterBid: 0,
          rtmExpiresAt: null,
          rtmResultMessage,
          soldToTeamId: result.winnerTeamId,
          soldPrice: Number(result.finalBid),
          soldAt: Timestamp.fromMillis(Date.now()),
          soldPlayerId: pending.playerId,
          lastEvent: {
            type: "player-sold",
            playerId: pending.playerId,
            teamId: result.winnerTeamId,
            price: Number(result.finalBid),
            createdAt: Timestamp.fromMillis(Date.now()),
          },
        },
      });
      return;
    }

    const next = transition as any;
    const statusMap: Record<string, string> = {
      COUNTER_BID: "AWAIT_WINNER_COUNTER",
      FINAL: "AWAIT_ORIGINAL_MATCH",
    };

    tx.update(sessionRef, {
      "pendingRtm.status": statusMap[next.nextStage],
      "pendingRtm.finalBid": Number(next.finalBid),
      "pendingRtm.counterBid": Number(next.counterBid),
      "pendingRtm.expiresAt": Timestamp.fromMillis(Date.now() + RTM_TIMER * 1000),
      "pendingRtm.lastDecision": {
        action: payload.action,
        actingTeamId: payload.actingTeamId,
        amount: Number(payload.counterBid || next.finalBid || 0),
        createdAt: Timestamp.fromMillis(Date.now()),
      },
      "currentAuction.status": "RTM",
      "currentAuction.auctionState": next.nextStage === "COUNTER_BID" ? "RTM_STEP_2" : "RTM_FINAL",
      "currentAuction.isAuctionLocked": true,
      "currentAuction.timerMode": "RTM",
      "currentAuction.timerEndsAt": Timestamp.fromMillis(Date.now() + RTM_TIMER * 1000),
      "currentAuction.rtmStage": next.nextStage === "COUNTER_BID" ? "COUNTER" : "PROMPT",
      "currentAuction.rtmFinalBid": Number(next.finalBid),
      "currentAuction.rtmCounterBid": Number(next.counterBid),
      "currentAuction.rtmExpiresAt": Timestamp.fromMillis(Date.now() + RTM_TIMER * 1000),
      "currentAuction.rtmResultMessage": next.nextStage === "COUNTER_BID" ? `${originalTeamShortName} used RTM` : null,
      "currentAuction.lastEvent": {
        type: next.nextStage === "COUNTER_BID" ? "rtm-bid-input" : "rtm-final-decision",
        stage: next.nextStage === "COUNTER_BID" ? "RTM_STEP_2" : "RTM_FINAL",
        playerId: pending.playerId,
        originalTeamId: pending.originalTeamId,
        winningTeamId: pending.winningTeamId,
        actingTeamId: payload.actingTeamId,
        price: Number(next.finalBid),
        counterBid: Number(next.counterBid),
        createdAt: Timestamp.fromMillis(Date.now()),
      },
    });
  });
};

export const resolveRtmTimeout = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) return;

  const pending = sessionSnap.data().pendingRtm;
  if (!pending) return;

  const actionMap: Record<string, "USE" | "DECLINE" | "COUNTER" | "MATCH"> = {
    AWAIT_ORIGINAL: "DECLINE",
    AWAIT_WINNER_COUNTER: "COUNTER",
    AWAIT_ORIGINAL_MATCH: "DECLINE",
  };

  const actingTeamMap: Record<string, string> = {
    AWAIT_ORIGINAL: pending.originalTeamId,
    AWAIT_WINNER_COUNTER: pending.winningTeamId,
    AWAIT_ORIGINAL_MATCH: pending.originalTeamId,
  };

  await resolveRtmDecision(gameCode, {
    action: actionMap[pending.status],
    actingTeamId: actingTeamMap[pending.status],
    counterBid: pending.status === "AWAIT_WINNER_COUNTER" ? Number(pending.finalBid || 0) + 1 : undefined,
  });
};



export const skipCurrentPlayer = async (gameCode: string, options: { aiResolve?: boolean; restrictedTeamIds?: string[] } = {}) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const sessionData = sessionSnap.data();
    const auction = sessionData.currentAuction;
    if (!auction?.activePlayerId) throw new Error("No active player");

    const queueIndex = Number(sessionData.queueIndex ?? -1);
    const nextIndex = queueIndex + 1;
    logSetsAndUnsoldCount(sessionData, nextIndex);
    const playerRef = doc(db, "players", auction.activePlayerId);
    const playerSnap = await tx.get(playerRef);
    const teamRefs = IPL_TEAMS.map((t) => doc(db, "sessions", gameCode, "teams", t.id));
    const teamSnaps = await Promise.all(teamRefs.map((ref) => tx.get(ref)));

    if (!options.aiResolve) {
      const basePrice = Number(playerSnap.data()?.basePrice || 0);
      if (auction.currentBidderId || Number(auction.currentBid || 0) > basePrice) {
        throw new Error("Cannot skip after bidding starts");
      }

      const unsold = [...((sessionData.unsoldPlayers || []) as string[]), auction.activePlayerId];
      tx.update(sessionRef, {
        unsoldPlayers: unsold,
        currentAuction: {
          activePlayerId: auction.activePlayerId,
          currentBid: Number(auction.currentBid || 0),
          currentBidderId: null,
          timerEndsAt: null,
          status: "UNSOLD",
          auctionState: "NEXT_READY",
          isAuctionLocked: false,
          timerMode: "NONE",
          rtmStage: "NONE",
          rtmTeamId: null,
          rtmWinningTeamId: null,
          rtmPlayerId: null,
          rtmFinalBid: 0,
          rtmCounterBid: 0,
          rtmExpiresAt: null,
          soldToTeamId: null,
          soldPrice: 0,
          soldAt: null,
          soldPlayerId: null,
          rtmResultMessage: null,
          lastEvent: {
            type: "player-unsold",
            playerId: auction.activePlayerId,
            createdAt: Timestamp.fromMillis(Date.now()),
          },
        },
      });
      return;
    }

    const allTeamState = teamSnaps.map((snap, index) => ({ id: IPL_TEAMS[index].id, ref: teamRefs[index], data: snap.data() || {} }));
    const restrictedIds = new Set((options.restrictedTeamIds || []).map((id) => String(id)));
    const eligibleTeamState = restrictedIds.size
      ? allTeamState.filter((team) => restrictedIds.has(team.id))
      : allTeamState;
    const outcome = pickRealisticSkipOutcome({ id: auction.activePlayerId, ...(playerSnap.data() || {}) }, eligibleTeamState, sessionData);
    const historyRecord = buildSilentSkipHistoryRecord(outcome);
    const unsoldPlayers = [...((sessionData.unsoldPlayers || []) as string[])];
    let recentPurchases = [...((sessionData.recentPurchases || []) as any[])];

    if (outcome.sold) {
      const target = allTeamState.find((team) => team.id === outcome.teamId);
      if (target) {
        target.data = applySilentSkipSaleToLocalTeam(target.data, outcome.playerId, outcome.price, outcome.isOverseas, outcome.role);
        tx.update(target.ref, {
          players: target.data.players,
          purseRemaining: target.data.purseRemaining,
          squadSize: target.data.squadSize,
          overseasCount: target.data.overseasCount,
          teamNeeds: target.data.teamNeeds,
          [`playerPurchasePrices.${outcome.playerId}`]: outcome.price,
        });
        recentPurchases = buildRecentPurchases(recentPurchases, { playerId: outcome.playerId, price: outcome.price, teamId: outcome.teamId });
      }
    } else {
      unsoldPlayers.push(outcome.playerId);
    }

    tx.update(sessionRef, {
      unsoldPlayers,
      recentPurchases,
      auctionHistory: arrayUnion(historyRecord),
      pendingRtm: null,
      currentAuction: {
        activePlayerId: auction.activePlayerId,
        currentBid: outcome.sold ? outcome.price : Number(playerSnap.data()?.basePrice || 0),
        currentBidderId: outcome.sold ? outcome.teamId : null,
        timerEndsAt: null,
        status: outcome.sold ? "SOLD" : "UNSOLD",
        auctionState: outcome.sold ? "SOLD" : "NEXT_READY",
        isAuctionLocked: outcome.sold,
        timerMode: "NONE",
        rtmStage: "NONE",
        rtmTeamId: null,
        rtmWinningTeamId: null,
        rtmPlayerId: null,
        rtmFinalBid: 0,
        rtmCounterBid: 0,
        rtmExpiresAt: null,
        soldToTeamId: outcome.sold ? outcome.teamId : null,
        soldPrice: outcome.sold ? outcome.price : 0,
        soldAt: Timestamp.fromMillis(Date.now()),
        soldPlayerId: outcome.sold ? outcome.playerId : null,
        rtmResultMessage: null,
        lastEvent: {
          type: outcome.sold ? "player-sold" : "player-unsold",
          playerId: auction.activePlayerId,
          createdAt: Timestamp.fromMillis(Date.now()),
        },
      },
    });
  });
};

export const skipRemainingSet = async (gameCode: string, options: { aiResolve?: boolean; restrictedTeamIds?: string[] } = { aiResolve: true }) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const sessionData = sessionSnap.data();
    const auction = sessionData.currentAuction;
    const queue = (sessionData.auctionQueue || []) as string[];
    const queueIndex = Number(sessionData.queueIndex ?? -1);
    if (!auction?.activePlayerId || queueIndex < 0) throw new Error("No active set");

    const auctionSets = (sessionData.auctionSets || []) as Array<{ key: string; playerIds?: string[] }>;
    const activeSet = auctionSets.find((set) => (set.playerIds || []).includes(auction.activePlayerId));
    const activeSetIds = new Set(activeSet?.playerIds || [auction.activePlayerId]);
    const shouldAiResolve = options.aiResolve !== false && String(sessionData.mode || '').toUpperCase() === 'VS_AI';
    const startIndex = !shouldAiResolve && ['SOLD', 'UNSOLD'].includes(String(auction.status || '')) ? queueIndex + 1 : queueIndex;
    let endIndex = queueIndex;
    while (endIndex + 1 < queue.length && activeSetIds.has(queue[endIndex + 1])) endIndex += 1;
    const idsToProcess = queue.slice(startIndex, endIndex + 1);
    if (idsToProcess.length === 0) {
      console.log(`[sessionService - skipRemainingSet] No remaining players to process`);
      return;
    }
    const lastPlayerId = idsToProcess[idsToProcess.length - 1];
    const nextIndex = endIndex + 1;
    logSetsAndUnsoldCount(sessionData, nextIndex);

    const currentSetKey = activeSet?.key || "Unknown";
    const nextSetKey = nextIndex < queue.length 
      ? (auctionSets.find((s) => (s.playerIds || []).includes(queue[nextIndex]))?.key || "None")
      : "None";
    console.log(`[sessionService - skipRemainingSet]
      - Current set: ${currentSetKey}
      - Next set: ${nextSetKey}
      - Remaining players skipped: ${idsToProcess.length}
      - Transition triggered: true`);

    const playerSnaps = await Promise.all(idsToProcess.map((id) => tx.get(doc(db, "players", id))));
    const teamRefs = IPL_TEAMS.map((t) => doc(db, "sessions", gameCode, "teams", t.id));
    const teamSnaps = await Promise.all(teamRefs.map((ref) => tx.get(ref)));
    const teamState = teamSnaps.map((snap, index) => ({ id: IPL_TEAMS[index].id, ref: teamRefs[index], data: snap.data() || {} }));
    const restrictedIds = new Set((options.restrictedTeamIds || []).map((id) => String(id)));
    const eligibleTeamState = restrictedIds.size
      ? teamState.filter((team) => restrictedIds.has(team.id))
      : teamState;

    let unsoldPlayers = [...((sessionData.unsoldPlayers || []) as string[])];
    let recentPurchases = [...((sessionData.recentPurchases || []) as any[])];
    const historyRecords: any[] = [];
    let lastPlayerOutcome: any = null;

    idsToProcess.forEach((playerId, index) => {
      const outcome = options.aiResolve === false
        ? { sold: false as const, playerId }
        : pickRealisticSkipOutcome({ id: playerId, ...(playerSnaps[index].data() || {}) }, eligibleTeamState, sessionData);
      historyRecords.push(buildSilentSkipHistoryRecord(outcome));

      if (outcome.sold) {
        const target = teamState.find((team) => team.id === outcome.teamId);
        if (target) {
          target.data = applySilentSkipSaleToLocalTeam(target.data, outcome.playerId, outcome.price, outcome.isOverseas, outcome.role);
          recentPurchases = buildRecentPurchases(recentPurchases, { playerId: outcome.playerId, price: outcome.price, teamId: outcome.teamId });
        }
      } else {
        unsoldPlayers.push(outcome.playerId);
      }
      if (playerId === lastPlayerId) {
        lastPlayerOutcome = outcome;
      }
    });

    teamState.forEach((team) => {
      tx.update(team.ref, {
        players: team.data.players || [],
        purseRemaining: Number(team.data.purseRemaining || 0),
        squadSize: Number(team.data.squadSize ?? ((team.data.retainedPlayers || []).length + (team.data.players || []).length)),
        overseasCount: Number(team.data.overseasCount || 0),
        teamNeeds: team.data.teamNeeds || TEAM_NEEDS_TEMPLATE,
        playerPurchasePrices: team.data.playerPurchasePrices || {},
      });
    });

    const lastPlayerSnap = playerSnaps[playerSnaps.length - 1];
    if (!lastPlayerSnap.exists()) throw new Error("Last player of skipped set not found in DB");
    const lastPlayerBasePrice = Number(lastPlayerSnap.data()?.basePrice || 0);

    const currentAuctionState = lastPlayerOutcome.sold
      ? {
          activePlayerId: lastPlayerId,
          currentBid: lastPlayerOutcome.price,
          currentBidderId: lastPlayerOutcome.teamId,
          timerEndsAt: null,
          status: "SOLD" as const,
          auctionState: "SOLD" as const,
          isAuctionLocked: true,
          timerMode: "NONE" as const,
          rtmStage: "NONE" as const,
          rtmTeamId: null,
          rtmWinningTeamId: null,
          rtmPlayerId: null,
          rtmFinalBid: 0,
          rtmCounterBid: 0,
          rtmExpiresAt: null,
          soldToTeamId: lastPlayerOutcome.teamId,
          soldPrice: lastPlayerOutcome.price,
          soldAt: Timestamp.fromMillis(Date.now()),
          soldPlayerId: lastPlayerId,
          rtmResultMessage: null,
          lastEvent: {
            type: "player-sold" as const,
            playerId: lastPlayerId,
            teamId: lastPlayerOutcome.teamId,
            price: lastPlayerOutcome.price,
            createdAt: Timestamp.fromMillis(Date.now()),
          },
        }
      : {
          activePlayerId: lastPlayerId,
          currentBid: lastPlayerBasePrice,
          currentBidderId: null,
          timerEndsAt: null,
          status: "UNSOLD" as const,
          auctionState: "NEXT_READY" as const,
          isAuctionLocked: false,
          timerMode: "NONE" as const,
          rtmStage: "NONE" as const,
          rtmTeamId: null,
          rtmWinningTeamId: null,
          rtmPlayerId: null,
          rtmFinalBid: 0,
          rtmCounterBid: 0,
          rtmExpiresAt: null,
          soldToTeamId: null,
          soldPrice: 0,
          soldAt: null,
          soldPlayerId: null,
          rtmResultMessage: null,
          lastEvent: {
            type: "player-unsold" as const,
            playerId: lastPlayerId,
            createdAt: Timestamp.fromMillis(Date.now()),
          },
        };

    tx.update(sessionRef, {
      queueIndex: endIndex,
      unsoldPlayers,
      recentPurchases,
      auctionHistory: arrayUnion(...historyRecords),
      pendingRtm: null,
      currentAuction: currentAuctionState,
    });
  });
};

export const markPlayerReadyForNext = async (gameCode: string, playerId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const auction = sessionSnap.data().currentAuction;
    if (!auction?.activePlayerId || auction.activePlayerId !== playerId) return;
    if (auction.status !== "SOLD") return;

    tx.update(sessionRef, {
      "currentAuction.auctionState": "NEXT_READY",
      "currentAuction.isAuctionLocked": false,
      "currentAuction.rtmResultMessage": null,
      "currentAuction.lastEvent": {
        type: "next-player",
        playerId,
        createdAt: Timestamp.fromMillis(Date.now()),
      },
    });
  });
};

export const togglePauseAuction = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const auction = sessionSnap.data().currentAuction;
    if (!auction?.activePlayerId) return;

    if (auction.status === "RUNNING") {
      const remaining = Math.max(1, Math.ceil(((auction.timerEndsAt?.toMillis?.() || Date.now()) - Date.now()) / 1000));
      tx.update(sessionRef, {
        "currentAuction.status": "PAUSED",
        "currentAuction.pausedRemainingSec": remaining,
        "currentAuction.timerEndsAt": null,
        "currentAuction.timerMode": "NONE",
      });
    } else if (auction.status === "PAUSED") {
      const remaining = Number(auction.pausedRemainingSec || AUCTION_TIMER);
      tx.update(sessionRef, {
        "currentAuction.status": "RUNNING",
        "currentAuction.timerEndsAt": Timestamp.fromMillis(Date.now() + remaining * 1000),
        "currentAuction.timerMode": "AUCTION",
      });
    }
  });
};

export const startAcceleratedRound = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const sessionData = sessionSnap.data();
    const hasFinishedNormalQueue = Number(sessionData.queueIndex ?? -1) >= Number((sessionData.auctionQueue || []).length);
    if (!hasFinishedNormalQueue) throw new Error("Accelerated round can start only after normal queue ends");

    const unsold = shuffleArray((sessionData.unsoldPlayers || []) as string[]);
    console.log(`[ACCELERATED ROUND] Starting Accelerated Round. Unsold players count: ${unsold.length}`);
    tx.update(sessionRef, {
      phase: "AUCTION",
      auctionQueue: unsold,
      queueIndex: -1,
      unsoldPlayers: [],
      isAcceleratedRound: true,
      acceleratedRoundSkipped: false,
      currentAuction: DEFAULT_AUCTION_STATE,
    });
  });
};


export const skipAcceleratedRound = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await updateDoc(sessionRef, {
    phase: "AUCTION_COMPLETE",
    acceleratedRoundSkipped: true,
    currentAuction: DEFAULT_AUCTION_STATE,
  });
};

export const endGameByHost = async (gameCode: string, userId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists()) throw new Error("Session not found");
    const session = snap.data() as any;
    if (session.hostId !== userId) throw new Error("Only host can end game");

    tx.update(sessionRef, {
      phase: "AUCTION_COMPLETE",
      currentAuction: DEFAULT_AUCTION_STATE,
      hostReconnect: deleteField(),
      queueIndex: (session.auctionQueue || []).length,
      acceleratedRoundSkipped: true,
    });
  });
};

export const updateAuctionStats = async (
  gameCode: string,
  winnerTeamId: string,
  selectedTeams: Record<string, string>,
  managerNames: Record<string, string> = {}
) => {
  const updates = Object.entries(selectedTeams).filter(([, uid]) => !String(uid).startsWith('AI-'));
  const winnerName = managerNames[winnerTeamId] || winnerTeamId.toUpperCase();

  await Promise.all(
    updates.map(async ([teamId, uid]) => {
      const isWinner = teamId === winnerTeamId;
      const managerName = managerNames[teamId] || String(uid).slice(0, 8);
      const userRef = doc(db, 'users', uid);
      const leaderboardRef = doc(db, 'leaderboard', uid);
      const historyRecord = {
        code: gameCode,
        winner: winnerName,
        teamId,
        managerName,
        result: isWinner ? 'WON' : 'PARTICIPATED',
        createdAt: Timestamp.fromMillis(Date.now()),
      };

      await setDoc(
        userRef,
        {
          uid,
          name: managerName,
          managerName,
          auctionsPlayed: increment(1),
          auctionsWon: increment(isWinner ? 1 : 0),
          auctionHistory: arrayUnion(historyRecord),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await setDoc(
        leaderboardRef,
        {
          uid,
          name: managerName,
          auctionsPlayed: increment(1),
          auctionsWon: increment(isWinner ? 1 : 0),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }),
  );
};


export const getPlayerMetaForAI = {
  getPlayerRating,
};

export const restartAuction = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) throw new Error("Session not found");
  
  const batch = writeBatch(db);

  batch.update(sessionRef, {
    phase: "LOBBY",
    retentions: {},
    auctionQueue: [],
    queueIndex: -1,
    unsoldPlayers: [],
    recentPurchases: [],
    isAcceleratedRound: false,
    acceleratedRoundSkipped: false,
    pendingRtm: null,
    auctionShuffleLocked: deleteField(),
    auctionStartedAt: deleteField(),
    retentionStartedAt: deleteField(),
    currentAuction: DEFAULT_AUCTION_STATE,
    updatedAt: serverTimestamp(),
  });

  for (const team of IPL_TEAMS) {
    const teamRef = doc(db, "sessions", gameCode, "teams", team.id);
    batch.update(teamRef, {
      purseRemaining: team.purse,
      players: [],
      retainedPlayers: [],
      playerPurchasePrices: {},
      squadSize: 0,
      overseasCount: 0,
      rtmCards: 0,
      teamNeeds: { ...TEAM_NEEDS_TEMPLATE },
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
};

