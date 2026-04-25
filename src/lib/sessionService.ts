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
  runTransaction,
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
  getNextBid,
  RETENTION_COSTS,
  SQUAD_CONSTRAINTS,
  AI_STRATEGIES,
  TEAM_NEEDS_TEMPLATE,
} from "@/lib/constants";
import { RetentionEngine } from "@/engine/retentionEngine";
import { AuctionEngine } from "@/engine/auctionEngine";
import { RtmEngine } from "@/engine/rtmEngine";

const OFFICIAL_POOL_ORDER = [
  "marquee",
  "batters",
  "all-rounders",
  "wicketkeepers",
  "bowlers",
  "uncapped",
  "accelerated",
];

const normalizePool = (pool: string | undefined) => {
  const key = String(pool || "").toLowerCase().replace(/\s+/g, "").replace("wicket-keepers", "wicketkeepers");
  if (["marquee"].includes(key)) return "marquee";
  if (["batters", "batsmen", "batter"].includes(key)) return "batters";
  if (["allrounders", "all-rounders", "all-rounder"].includes(key)) return "all-rounders";
  if (["wicketkeepers", "wicketkeeper", "wicket-keeper"].includes(key)) return "wicketkeepers";
  if (["bowlers", "bowler"].includes(key)) return "bowlers";
  if (["uncapped"].includes(key)) return "uncapped";
  if (["accelerated", "acceleratedround"].includes(key)) return "accelerated";
  return "accelerated";
};

const shuffleArray = <T,>(arr: T[]) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildAuctionQueue = (players: Array<Record<string, any>>) => {
  const roleOrder = ["batsman", "wicket-keeper", "all-rounder", "bowler"];
  const normalizeRole = (role: string | undefined) => {
    const key = String(role || "").toLowerCase();
    if (key.includes("wicket")) return "wicket-keeper";
    if (key.includes("all")) return "all-rounder";
    if (key.includes("bowl")) return "bowler";
    return "batsman";
  };
  const ratingOf = (p: Record<string, any>) => Number(p.starRating ?? p.rating ?? 0);
  const byRatingDesc = (a: Record<string, any>, b: Record<string, any>) => ratingOf(b) - ratingOf(a);

  const balancedChunk = (source: Array<Record<string, any>>, used: Set<string>, size = 15) => {
    const buckets: Record<string, Array<Record<string, any>>> = roleOrder.reduce((acc, key) => ({ ...acc, [key]: [] }), {} as Record<string, Array<Record<string, any>>>);
    source.forEach((p) => {
      if (!used.has(p.id)) buckets[normalizeRole(p.role)].push(p);
    });
    roleOrder.forEach((role) => buckets[role].sort(byRatingDesc));

    const targetByRole: Record<string, number> = {
      "batsman": 4,
      "wicket-keeper": 4,
      "all-rounder": 4,
      "bowler": 3,
    };

    const chunk: string[] = [];
    roleOrder.forEach((role) => {
      let count = 0;
      while (buckets[role].length && count < targetByRole[role] && chunk.length < size) {
        const player = buckets[role].shift()!;
        if (used.has(player.id)) continue;
        used.add(player.id);
        chunk.push(player.id);
        count += 1;
      }
    });

    const leftovers = roleOrder.flatMap((role) => buckets[role]).sort(byRatingDesc);
    for (const player of leftovers) {
      if (chunk.length >= size) break;
      if (used.has(player.id)) continue;
      used.add(player.id);
      chunk.push(player.id);
    }
    return chunk;
  };

  const used = new Set<string>();
  const queue: string[] = [];
  const themedPools = [
    players.filter((p) => Boolean(p.overseas ?? p.isOverseas)),
    players.filter((p) => !Boolean(p.isCapped)),
    players.filter((p) => Number(p.starRating ?? p.rating ?? 0) >= 4),
    players.filter((p) => Boolean(p.isCapped)),
  ];

  themedPools.forEach((pool) => {
    const chunk = balancedChunk(pool, used, 15);
    queue.push(...chunk);
  });

  while (used.size < players.length) {
    const chunk = balancedChunk(players, used, 15);
    if (!chunk.length) break;
    queue.push(...chunk);
  }

  return queue;
};

const getPlayerOverseasFlag = (playerData: any) => Boolean(playerData?.overseas ?? playerData?.isOverseas);
const getPlayerPreviousTeamId = (playerData: any) => String(playerData?.previousTeamId ?? playerData?.previousTeam ?? "").toLowerCase();
const getPlayerRating = (playerData: any) => Number(playerData?.rating ?? playerData?.starRating ?? 0);

const buildRecentPurchases = (existing: Array<{ playerId: string; price: number; teamId: string }>, purchase: { playerId: string; price: number; teamId: string }) => {
  return [purchase, ...(existing || [])];
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

export const joinSession = async (gameCode: string, userId: string) => {
  await updateDoc(doc(db, "sessions", gameCode), { playersJoined: arrayUnion(userId) });
};


export const leaveGame = async (gameCode: string, userId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const session = sessionSnap.data() as any;

    const selectedTeams = (session.selectedTeams || {}) as Record<string, string>;
    const teamId = Object.entries(selectedTeams).find(([_, uid]) => uid === userId)?.[0] || null;

    if (session.hostId === userId) {
      tx.update(sessionRef, {
        phase: "ENDED",
        [`disconnectedPlayers.${userId}`]: true,
        playersJoined: arrayRemove(userId),
        currentAuction: DEFAULT_AUCTION_STATE,
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

export const rejoinGame = async (gameCode: string, userId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) return;

    const session = sessionSnap.data() as any;
    const disconnected = Boolean(session?.disconnectedPlayers?.[userId]);
    const selectedTeams = (session.selectedTeams || {}) as Record<string, string>;
    const teamId = Object.entries(selectedTeams).find(([_, uid]) => uid === userId)?.[0] || null;

    if (!disconnected || !teamId) return;

    tx.update(sessionRef, {
      [`disconnectedPlayers.${userId}`]: deleteField(),
      playersJoined: arrayUnion(userId),
    });

    tx.update(doc(db, "sessions", gameCode, "teams", teamId), {
      isAI: false,
      ownerId: userId,
    });
  });
};

export const selectTeam = async (gameCode: string, teamId: string, userId: string, managerName?: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
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

  const retainedIds = new Set<string>();
  const retentions = (sessionSnap.data().retentions || {}) as Record<string, any>;
  Object.values(retentions).forEach((ret: any) => {
    (ret?.players || []).forEach((pid: string) => retainedIds.add(pid));
  });

  const playersSnapshot = await getDocs(query(collection(db, "players")));
  const players = playersSnapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p: any) => !retainedIds.has(p.id));
  const queue = buildAuctionQueue(players);

  await updateDoc(sessionRef, {
    phase: "AUCTION",
    auctionStartedAt: serverTimestamp(),
    auctionQueue: queue,
    queueIndex: -1,
    unsoldPlayers: [],
    recentPurchases: [],
    isAcceleratedRound: false,
    acceleratedRoundSkipped: false,
    pendingRtm: null,
    currentAuction: { ...DEFAULT_AUCTION_STATE, timerMode: "AUCTION" },
  });
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

    if (auctionEngine.shouldEndAuction({ queueIndex: nextIndex, queueLength: auctionQueue.length, teamSquadSizes })) {
      tx.update(sessionRef, {
        phase: "AUCTION_COMPLETE",
        queueIndex: auctionQueue.length,
        currentAuction: DEFAULT_AUCTION_STATE,
      });
      return;
    }

    const playerSnap = await tx.get(doc(db, "players", auctionQueue[nextIndex]));
    tx.update(sessionRef, {
      queueIndex: nextIndex,
      pendingRtm: null,
      currentAuction: {
        activePlayerId: auctionQueue[nextIndex],
        currentBid: Number(playerSnap.data()?.basePrice || 0),
        currentBidderId: null,
        timerEndsAt: Timestamp.fromMillis(Date.now() + (sessionData.isAcceleratedRound ? BID_RESET_TIMER : AUCTION_TIMER) * 1000),
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
          playerId: auctionQueue[nextIndex],
          createdAt: Timestamp.fromMillis(Date.now()),
        },
      },
    });
  });
};

export const startNextPlayer = loadNextPlayer;

export const placeBid = async (gameCode: string, teamId: string, amount: number) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const currentAuction = sessionSnap.data().currentAuction;
    if (!currentAuction || currentAuction.status !== "RUNNING" || currentAuction.isAuctionLocked) throw new Error("No active auction");

    const [teamSnap, playerSnap] = await Promise.all([
      tx.get(doc(db, "sessions", gameCode, "teams", teamId)),
      tx.get(doc(db, "players", currentAuction.activePlayerId)),
    ]);

    if (!teamSnap.exists()) throw new Error("Team not found");
    if (!playerSnap.exists()) throw new Error("Player not found");

    const team = teamSnap.data();
    const squadSize = Number(team.squadSize ?? ((team.players || []).length + (team.retainedPlayers || []).length));
    const overseasCount = Number(team.overseasCount || 0);
    const isOverseas = getPlayerOverseasFlag(playerSnap.data());

    auctionEngine.validateBid({
      amount,
      currentBid: Number(currentAuction.currentBid || 0),
      currentBidderId: currentAuction.currentBidderId || null,
      teamId,
      purseRemaining: Number(team.purseRemaining || 0),
      squadSize,
      overseasCount,
      isPlayerOverseas: isOverseas,
    });

    tx.update(sessionRef, {
      "currentAuction.currentBid": amount,
      "currentAuction.currentBidderId": teamId,
      "currentAuction.timerEndsAt": Timestamp.fromMillis(Date.now() + BID_RESET_TIMER * 1000),
      "currentAuction.timerMode": "AUCTION",
    });
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
          counterBid: getNextBid(finalBid),
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
    AWAIT_WINNER_COUNTER: "DECLINE",
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
  });
};



export const skipCurrentPlayer = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const auction = sessionSnap.data().currentAuction;
    if (!auction?.activePlayerId) throw new Error("No active player");

    const playerSnap = await tx.get(doc(db, "players", auction.activePlayerId));
    const basePrice = Number(playerSnap.data()?.basePrice || 0);
    if (auction.currentBidderId || Number(auction.currentBid || 0) > basePrice) {
      throw new Error("Cannot skip after bidding starts");
    }

    const unsold = [...((sessionSnap.data().unsoldPlayers || []) as string[]), auction.activePlayerId];
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
