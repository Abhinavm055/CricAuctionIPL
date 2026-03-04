import {
  doc,
  collection,
  updateDoc,
  onSnapshot,
  getDoc,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  query,
  runTransaction,
  Timestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  IPL_TEAMS,
  AUCTION_TIMER,
  getNextBid,
  RETENTION_COSTS,
  SQUAD_CONSTRAINTS,
} from "@/lib/constants";

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

const buildAuctionQueue = (players: Array<Record<string, any>>) => {
  const grouped: Record<string, string[]> = OFFICIAL_POOL_ORDER.reduce((acc, key) => ({ ...acc, [key]: [] }), {} as Record<string, string[]>);
  players.forEach((p) => grouped[normalizePool(p.pool)].push(p.id));
  return OFFICIAL_POOL_ORDER.flatMap((pool) => grouped[pool] || []);
};

const getPlayerOverseasFlag = (playerData: any) => Boolean(playerData?.overseas ?? playerData?.isOverseas);
const getPlayerPreviousTeamId = (playerData: any) => String(playerData?.previousTeamId ?? playerData?.previousTeam ?? "").toLowerCase();
const getPlayerRating = (playerData: any) => Number(playerData?.rating ?? playerData?.starRating ?? 0);

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
  await updateDoc(doc(db, "sessions", gameCode), { aisAI: true, updatedAt: serverTimestamp() });
};

export const createSession = async (gameCode: string, hostId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const batch = writeBatch(db);

  batch.set(sessionRef, {
    phase: "LOBBY",
    hostId,
    createdAt: serverTimestamp(),
    selectedTeams: {},
    retentions: {},
    playersJoined: [hostId],
    allTeams: IPL_TEAMS.map((t) => ({ id: t.id, name: t.name, isAI: true })),
    auctionQueue: [],
    queueIndex: -1,
    unsoldPlayers: [],
    pendingRtm: null,
    currentAuction: {
      activePlayerId: null,
      currentBid: 0,
      currentBidderId: null,
      timerEndsAt: null,
      status: "IDLE",
    },
  });

  IPL_TEAMS.forEach((team) => {
    batch.set(doc(collection(sessionRef, "teams"), team.id), {
      ...team,
      purseRemaining: team.purse,
      players: [],
      retainedPlayers: [],
      playerPurchasePrices: {},
      squadSize: 0,
      overseasCount: 0,
      rtmCards: 0,
      isAI: true,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
};

export const joinSession = async (gameCode: string, userId: string) => {
  await updateDoc(doc(db, "sessions", gameCode), { playersJoined: arrayUnion(userId) });
};

export const selectTeam = async (gameCode: string, teamId: string, userId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) return;

  const allTeams = (snap.data().allTeams || []).map((t: any) => (t.id === teamId ? { ...t, isAI: false } : t));
  await updateDoc(sessionRef, { [`selectedTeams.${teamId}`]: userId, allTeams });
  await updateDoc(doc(db, "sessions", gameCode, "teams", teamId), { isAI: false });
};

export const startRetention = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) return;

  const initialRetentions: any = {};
  (snap.data().allTeams || []).forEach((team: any) => {
    if (team.isAI) initialRetentions[team.id] = { players: [], capped: 0, uncapped: 0, rtm: 6, locked: true };
  });

  await updateDoc(sessionRef, { phase: "RETENTION", retentionStartedAt: serverTimestamp(), retentions: initialRetentions });
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
    pendingRtm: null,
    currentAuction: {
      activePlayerId: null,
      currentBid: 0,
      currentBidderId: null,
      timerEndsAt: null,
      status: "IDLE",
    },
  });
};

export const startNextPlayer = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const sessionData = sessionSnap.data();

    const teamSnaps = await Promise.all(IPL_TEAMS.map((t) => tx.get(doc(db, "sessions", gameCode, "teams", t.id))));
    const allTeamsFull = teamSnaps.every((snap) => Number(snap.data()?.squadSize || 0) >= SQUAD_CONSTRAINTS.MAX_SQUAD);
    if (allTeamsFull) {
      tx.update(sessionRef, {
        phase: "AUCTION_COMPLETE",
        currentAuction: { activePlayerId: null, currentBid: 0, currentBidderId: null, timerEndsAt: null, status: "IDLE" },
      });
      return;
    }

    const auctionQueue = (sessionData.auctionQueue || []) as string[];
    const nextIndex = Number(sessionData.queueIndex ?? -1) + 1;

    if (!auctionQueue[nextIndex]) {
      tx.update(sessionRef, {
        phase: "AUCTION_COMPLETE",
        currentAuction: { activePlayerId: null, currentBid: 0, currentBidderId: null, timerEndsAt: null, status: "IDLE" },
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
        timerEndsAt: Timestamp.fromMillis(Date.now() + AUCTION_TIMER * 1000),
        status: "RUNNING",
      },
    });
  });
};

export const placeBid = async (gameCode: string, teamId: string, amount: number) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const currentAuction = sessionSnap.data().currentAuction;
    if (!currentAuction || currentAuction.status !== "RUNNING") throw new Error("No active auction");

    const expectedNext = getNextBid(Number(currentAuction.currentBid || 0));
    if (amount !== expectedNext) throw new Error("Bid must match next increment");
    if (currentAuction.currentBidderId === teamId) throw new Error("Consecutive bids not allowed");

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

    if (Number(team.purseRemaining || 0) < amount) throw new Error("Insufficient purse");
    if (squadSize >= SQUAD_CONSTRAINTS.MAX_SQUAD) throw new Error("Squad full");
    if (isOverseas && overseasCount >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) throw new Error("Overseas limit reached");

    tx.update(sessionRef, {
      "currentAuction.currentBid": amount,
      "currentAuction.currentBidderId": teamId,
      "currentAuction.timerEndsAt": Timestamp.fromMillis(Date.now() + AUCTION_TIMER * 1000),
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
  decrementRtm: boolean
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
      [`playerPurchasePrices.${playerId}`]: price,
      ...(decrementRtm ? { rtmCards: Math.max(0, Number(teamData.rtmCards || 0) - 1) } : {}),
    });
  });
};

export const finalizePlayerSale = async (gameCode: string) => {
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
    const winningTeamId = auction.currentBidderId as string | null;
    const finalBid = Number(auction.currentBid || 0);
    const isOverseas = getPlayerOverseasFlag(playerSnap.data());

    if (!winningTeamId) {
      const unsold = [...((sessionData.unsoldPlayers || []) as string[]), playerId];
      tx.update(sessionRef, {
        unsoldPlayers: unsold,
        pendingRtm: null,
        currentAuction: { activePlayerId: playerId, currentBid: finalBid, currentBidderId: null, timerEndsAt: null, status: "UNSOLD" },
      });
      return;
    }

    const previousTeamId = getPlayerPreviousTeamId(playerSnap.data());
    if (previousTeamId && previousTeamId !== winningTeamId) {
      const prevTeamSnap = await tx.get(doc(db, "sessions", gameCode, "teams", previousTeamId));
      if (prevTeamSnap.exists() && Number(prevTeamSnap.data().rtmCards || 0) > 0) {
        tx.update(sessionRef, {
          pendingRtm: {
            playerId,
            winningTeamId,
            originalTeamId: previousTeamId,
            finalBid,
            status: "AWAIT_ORIGINAL",
            counterBid: getNextBid(finalBid),
          },
          "currentAuction.status": "SOLD",
          "currentAuction.timerEndsAt": null,
        });
        return;
      }
    }

    await applySaleToTeam(tx, gameCode, winningTeamId, playerId, finalBid, isOverseas, false);
    tx.update(sessionRef, {
      pendingRtm: null,
      currentAuction: { activePlayerId: playerId, currentBid: finalBid, currentBidderId: winningTeamId, timerEndsAt: null, status: "SOLD" },
    });
  });
};

export const resolveRtmDecision = async (gameCode: string, action: "ORIGINAL_YES" | "ORIGINAL_NO" | "WINNER_COUNTER_YES" | "WINNER_COUNTER_NO" | "ORIGINAL_MATCH_YES" | "ORIGINAL_MATCH_NO") => {
  const sessionRef = doc(db, "sessions", gameCode);
  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const pending = sessionSnap.data().pendingRtm;
    if (!pending) return;

    const playerSnap = await tx.get(doc(db, "players", pending.playerId));
    const isOverseas = getPlayerOverseasFlag(playerSnap.data());

    if (pending.status === "AWAIT_ORIGINAL") {
      if (action === "ORIGINAL_NO") {
        await applySaleToTeam(tx, gameCode, pending.winningTeamId, pending.playerId, Number(pending.finalBid), isOverseas, false);
        tx.update(sessionRef, {
          pendingRtm: null,
          currentAuction: { activePlayerId: pending.playerId, currentBid: Number(pending.finalBid), currentBidderId: pending.winningTeamId, timerEndsAt: null, status: "SOLD" },
        });
        return;
      }
      if (action === "ORIGINAL_YES") {
        tx.update(sessionRef, { "pendingRtm.status": "AWAIT_WINNER_COUNTER" });
      }
      return;
    }

    if (pending.status === "AWAIT_WINNER_COUNTER") {
      if (action === "WINNER_COUNTER_NO") {
        await applySaleToTeam(tx, gameCode, pending.originalTeamId, pending.playerId, Number(pending.finalBid), isOverseas, true);
        tx.update(sessionRef, {
          pendingRtm: null,
          currentAuction: { activePlayerId: pending.playerId, currentBid: Number(pending.finalBid), currentBidderId: pending.originalTeamId, timerEndsAt: null, status: "SOLD" },
        });
        return;
      }
      if (action === "WINNER_COUNTER_YES") {
        tx.update(sessionRef, {
          "pendingRtm.status": "AWAIT_ORIGINAL_MATCH",
          "pendingRtm.finalBid": Number(pending.counterBid),
          "pendingRtm.counterBid": getNextBid(Number(pending.counterBid)),
        });
      }
      return;
    }

    if (pending.status === "AWAIT_ORIGINAL_MATCH") {
      if (action === "ORIGINAL_MATCH_YES") {
        await applySaleToTeam(tx, gameCode, pending.originalTeamId, pending.playerId, Number(pending.finalBid), isOverseas, true);
        tx.update(sessionRef, {
          pendingRtm: null,
          currentAuction: { activePlayerId: pending.playerId, currentBid: Number(pending.finalBid), currentBidderId: pending.originalTeamId, timerEndsAt: null, status: "SOLD" },
        });
        return;
      }
      if (action === "ORIGINAL_MATCH_NO") {
        await applySaleToTeam(tx, gameCode, pending.winningTeamId, pending.playerId, Number(pending.finalBid), isOverseas, false);
        tx.update(sessionRef, {
          pendingRtm: null,
          currentAuction: { activePlayerId: pending.playerId, currentBid: Number(pending.finalBid), currentBidderId: pending.winningTeamId, timerEndsAt: null, status: "SOLD" },
        });
      }
    }
  });
};

export const getPlayerMetaForAI = {
  getPlayerRating,
};
