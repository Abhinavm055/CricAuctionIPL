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
import { IPL_TEAMS, AUCTION_TIMER, getNextBid, SQUAD_CONSTRAINTS } from "@/lib/constants";
import { createAuctionQueueFrom, Player } from "@/lib/samplePlayers";

export const generateGameCode = () => {
  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  return `CAIPL${randomNumber}`;
};

export const listenPlayers = (callback: (players: any[]) => void) => {
  const playersRef = collection(db, "players");
  return onSnapshot(query(playersRef), (snapshot) => {
    const playersData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(playersData);
  });
};

export const listenTeams = (gameCode: string, callback: (teams: any[]) => void) => {
  const teamsRef = collection(db, "sessions", gameCode, "teams");
  return onSnapshot(query(teamsRef), (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

export const fillAITeams = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await updateDoc(sessionRef, { aisAI: true, updatedAt: serverTimestamp() });
};

export const createSession = async (gameCode: string, hostId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const batch = writeBatch(db);

  const initialTeams = IPL_TEAMS.map((t) => ({ id: t.id, name: t.name, isAI: true }));

  batch.set(sessionRef, {
    phase: "LOBBY",
    hostId,
    createdAt: serverTimestamp(),
    selectedTeams: {},
    retentions: {},
    playersJoined: [hostId],
    allTeams: initialTeams,
    auctionQueue: [],
    queueIndex: -1,
    currentAuction: {
      activePlayerId: null,
      currentBid: 0,
      currentBidderId: null,
      timerEndsAt: null,
      status: "IDLE",
    },
    pendingRtm: null,
  });

  IPL_TEAMS.forEach((team) => {
    const teamRef = doc(collection(sessionRef, "teams"), team.id);
    batch.set(teamRef, {
      ...team,
      purseRemaining: team.purse,
      players: [],
      retainedPlayers: [],
      rtmCards: 0,
      playerPurchasePrices: {},
      isAI: true,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
};

export const joinSession = async (gameCode: string, userId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await updateDoc(sessionRef, { playersJoined: arrayUnion(userId) });
};

export const selectTeam = async (gameCode: string, teamId: string, userId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const allTeams = data.allTeams.map((t: any) => (t.id === teamId ? { ...t, isAI: false } : t));

  await updateDoc(sessionRef, {
    [`selectedTeams.${teamId}`]: userId,
    allTeams,
  });

  await updateDoc(doc(db, "sessions", gameCode, "teams", teamId), { isAI: false });
};

export const startRetention = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const initialRetentions: any = {};

  data.allTeams.forEach((team: any) => {
    if (team.isAI) {
      initialRetentions[team.id] = {
        players: [],
        capped: 0,
        uncapped: 0,
        rtm: 2,
        locked: true,
      };
    }
  });

  await updateDoc(sessionRef, {
    phase: "RETENTION",
    retentionStartedAt: serverTimestamp(),
    retentions: initialRetentions,
  });
};

export const lockRetention = async (
  gameCode: string,
  teamId: string,
  playerIds: string[],
  cappedCount: number,
  uncappedCount: number
) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const players = await getDocs(query(collection(db, "players")));
  const byId = new Map(players.docs.map((d) => [d.id, d.data()]));

  const retainedSpend = playerIds.reduce((sum, pid) => sum + Number(byId.get(pid)?.basePrice || 0), 0);
  const team = IPL_TEAMS.find((t) => t.id === teamId);
  const rtmCards = Math.max(0, 6 - playerIds.length);

  await updateDoc(sessionRef, {
    [`retentions.${teamId}`]: {
      players: playerIds,
      capped: cappedCount,
      uncapped: uncappedCount,
      rtm: rtmCards,
      locked: true,
      lockedAt: serverTimestamp(),
    },
  });

  const retainedPriceMap = playerIds.reduce((acc: Record<string, number>, pid) => {
    acc[pid] = Number(byId.get(pid)?.basePrice || 0);
    return acc;
  }, {});

  await updateDoc(doc(db, "sessions", gameCode, "teams", teamId), {
    retainedPlayers: playerIds,
    rtmCards,
    purseRemaining: Math.max(0, Number(team?.purse || 0) - retainedSpend),
    playerPurchasePrices: retainedPriceMap,
  });
};

export const listenSession = (gameCode: string, callback: (data: any) => void) => {
  const sessionRef = doc(db, "sessions", gameCode);
  return onSnapshot(sessionRef, (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
};

export const startAuction = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const playersSnapshot = await getDocs(query(collection(db, "players")));
  const playerList = playersSnapshot.docs.map((playerDoc) => ({ id: playerDoc.id, ...playerDoc.data() })) as Player[];
  const queue = createAuctionQueueFrom(playerList).map((player) => player.id);

  await updateDoc(sessionRef, {
    phase: "AUCTION",
    auctionStartedAt: serverTimestamp(),
    auctionQueue: queue,
    queueIndex: -1,
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

  await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const sessionData = sessionSnap.data();
    const auctionQueue = (sessionData.auctionQueue || []) as string[];
    const nextIndex = ((sessionData.queueIndex as number) ?? -1) + 1;

    if (!auctionQueue[nextIndex]) {
      transaction.update(sessionRef, {
        pendingRtm: null,
        currentAuction: { activePlayerId: null, currentBid: 0, currentBidderId: null, timerEndsAt: null, status: "IDLE" },
      });
      return;
    }

    const activePlayerId = auctionQueue[nextIndex];
    const playerRef = doc(db, "players", activePlayerId);
    const playerSnap = await transaction.get(playerRef);
    const basePrice = Number(playerSnap.data()?.basePrice || 0);

    transaction.update(sessionRef, {
      queueIndex: nextIndex,
      pendingRtm: null,
      currentAuction: {
        activePlayerId,
        currentBid: basePrice,
        currentBidderId: null,
        timerEndsAt: Timestamp.fromMillis(Date.now() + AUCTION_TIMER * 1000),
        status: "RUNNING",
      },
    });
  });
};

export const placeBid = async (gameCode: string, teamId: string, amount: number) => {
  const sessionRef = doc(db, "sessions", gameCode);

  await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const currentAuction = sessionSnap.data().currentAuction;
    if (!currentAuction || currentAuction.status !== "RUNNING") throw new Error("No active auction");

    const currentBid = Number(currentAuction.currentBid || 0);
    const expectedNextBid = getNextBid(currentBid);

    if (amount !== expectedNextBid) throw new Error("Bid must match the next valid increment");
    if (currentAuction.currentBidderId === teamId) throw new Error("Team cannot bid twice consecutively");

    const teamRef = doc(db, "sessions", gameCode, "teams", teamId);
    const teamSnap = await transaction.get(teamRef);
    if (!teamSnap.exists()) throw new Error("Team not found");

    const purseRemaining = Number(teamSnap.data().purseRemaining || 0);
    const players = (teamSnap.data().players || []) as string[];
    const retainedPlayers = (teamSnap.data().retainedPlayers || []) as string[];

    if (purseRemaining < amount) throw new Error("Insufficient purse");
    if (players.length + retainedPlayers.length >= SQUAD_CONSTRAINTS.MAX_SQUAD) throw new Error("Squad is full");

    transaction.update(sessionRef, {
      "currentAuction.currentBid": amount,
      "currentAuction.currentBidderId": teamId,
      "currentAuction.timerEndsAt": Timestamp.fromMillis(Date.now() + AUCTION_TIMER * 1000),
    });
  });
};

export const finalizePlayerSale = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);

  await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const sessionData = sessionSnap.data();
    const currentAuction = sessionData.currentAuction;
    if (!currentAuction?.activePlayerId) throw new Error("No active player");

    const { activePlayerId, currentBid, currentBidderId } = currentAuction;

    if (!currentBidderId) {
      transaction.update(sessionRef, {
        pendingRtm: null,
        currentAuction: {
          activePlayerId,
          currentBid: Number(currentBid || 0),
          currentBidderId: null,
          timerEndsAt: null,
          status: "UNSOLD",
        },
      });
      return;
    }

    const playerSnap = await transaction.get(doc(db, "players", activePlayerId));
    const previousTeamId = String(playerSnap.data()?.previousTeam || "").toLowerCase();

    if (previousTeamId && previousTeamId !== currentBidderId) {
      const prevTeamRef = doc(db, "sessions", gameCode, "teams", previousTeamId);
      const prevTeamSnap = await transaction.get(prevTeamRef);
      if (prevTeamSnap.exists() && Number(prevTeamSnap.data().rtmCards || 0) > 0) {
        transaction.update(sessionRef, {
          pendingRtm: {
            playerId: activePlayerId,
            finalBid: Number(currentBid || 0),
            winningTeamId: currentBidderId,
            originalTeamId: previousTeamId,
          },
          "currentAuction.timerEndsAt": null,
          "currentAuction.status": "SOLD",
        });
        return;
      }
    }

    const winnerTeamRef = doc(db, "sessions", gameCode, "teams", currentBidderId);
    const winnerTeamSnap = await transaction.get(winnerTeamRef);
    if (!winnerTeamSnap.exists()) throw new Error("Winner team not found");

    const winnerData = winnerTeamSnap.data();
    const currentPlayers = (winnerData.players || []) as string[];

    transaction.update(winnerTeamRef, {
      purseRemaining: Number(winnerData.purseRemaining || 0) - Number(currentBid || 0),
      players: [...currentPlayers, activePlayerId],
      [`playerPurchasePrices.${activePlayerId}`]: Number(currentBid || 0),
    });

    transaction.update(sessionRef, {
      pendingRtm: null,
      currentAuction: {
        activePlayerId,
        currentBid: Number(currentBid || 0),
        currentBidderId,
        timerEndsAt: null,
        status: "SOLD",
      },
    });
  });
};

export const resolveRtmDecision = async (gameCode: string, useRtm: boolean) => {
  const sessionRef = doc(db, "sessions", gameCode);

  await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error("Session not found");

    const pendingRtm = sessionSnap.data().pendingRtm;
    if (!pendingRtm) return;

    const { playerId, finalBid, winningTeamId, originalTeamId } = pendingRtm;
    const awardedTeamId = useRtm ? originalTeamId : winningTeamId;
    const awardedRef = doc(db, "sessions", gameCode, "teams", awardedTeamId);
    const awardedSnap = await transaction.get(awardedRef);
    if (!awardedSnap.exists()) throw new Error("Awarded team not found");

    const awardedData = awardedSnap.data();
    const awardedPlayers = (awardedData.players || []) as string[];

    transaction.update(awardedRef, {
      purseRemaining: Number(awardedData.purseRemaining || 0) - Number(finalBid || 0),
      players: [...awardedPlayers, playerId],
      [`playerPurchasePrices.${playerId}`]: Number(finalBid || 0),
      ...(useRtm ? { rtmCards: Math.max(0, Number(awardedData.rtmCards || 0) - 1) } : {}),
    });

    transaction.update(sessionRef, {
      pendingRtm: null,
      currentAuction: {
        activePlayerId: playerId,
        currentBid: Number(finalBid || 0),
        currentBidderId: awardedTeamId,
        timerEndsAt: null,
        status: "SOLD",
      },
    });
  });
};
