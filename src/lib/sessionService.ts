import {
  doc,
  setDoc,
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

/* ===============================
   🎟 CODE GENERATOR
================================ */
export const generateGameCode = () => {
  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  return `CAIPL${randomNumber}`;
};

/* ===============================
   🏃 MASTER PLAYER LISTENER
================================ */
export const listenPlayers = (callback: (players: any[]) => void) => {
  const playersRef = collection(db, "players");
  return onSnapshot(query(playersRef), (snapshot) => {
    const playersData = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(playersData);
  });
};

export const listenTeams = (gameCode: string, callback: (teams: any[]) => void) => {
  const teamsRef = collection(db, "sessions", gameCode, "teams");
  return onSnapshot(query(teamsRef), (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  });
};
/* ===============================
   🤖 FILL AI TEAMS (OPTIONAL)
   Manually marks the session as AI-filled
================================ */
export const fillAITeams = async (gameCode: string) => {
  try {
    const sessionRef = doc(db, "sessions", gameCode);
    await updateDoc(sessionRef, {
      aisAI: true,
      updatedAt: serverTimestamp(),
    });
    console.log("AI teams initialized");
  } catch (error) {
    console.error("Error filling AI teams:", error);
    throw error;
  }
};

/* ===============================
   🏗 CREATE SESSION
================================ */
export const createSession = async (gameCode: string, hostId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const batch = writeBatch(db);

  const initialTeams = IPL_TEAMS.map((t) => ({
    id: t.id,
    name: t.name,
    isAI: true, // Default all to AI
  }));

  batch.set(sessionRef, {
    phase: "LOBBY",
    hostId,
    createdAt: serverTimestamp(),
    selectedTeams: {}, // Maps teamId -> userId
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
  });

  // Create subcollection for team details
  IPL_TEAMS.forEach((team) => {
    const teamRef = doc(collection(sessionRef, "teams"), team.id);
    batch.set(teamRef, {
      ...team,
      purseRemaining: team.purse,
      players: [],
      isAI: true,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
};

/* ===============================
   🤝 JOIN & TEAM SELECTION
================================ */
export const joinSession = async (gameCode: string, userId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  await updateDoc(sessionRef, {
    playersJoined: arrayUnion(userId),
  });
};

export const selectTeam = async (gameCode: string, teamId: string, userId: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const allTeams = data.allTeams.map((t: any) =>
    t.id === teamId ? { ...t, isAI: false } : t
  );

  await updateDoc(sessionRef, {
    [`selectedTeams.${teamId}`]: userId,
    allTeams: allTeams
  });
};

/* ===============================
   🔒 RETENTION LOGIC
================================ */
export const startRetention = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const initialRetentions: any = {};

  // 🔥 Auto-lock AI teams so humans don't wait for them
  data.allTeams.forEach((team: any) => {
    if (team.isAI) {
      initialRetentions[team.id] = {
        players: [],
        capped: 0,
        uncapped: 0,
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
  await updateDoc(sessionRef, {
    [`retentions.${teamId}`]: {
      players: playerIds,
      capped: cappedCount,
      uncapped: uncappedCount,
      locked: true,
      lockedAt: serverTimestamp(),
    },
  });
};

/* ===============================
   🚀 REALTIME & PHASE TRANSITIONS
================================ */
export const listenSession = (gameCode: string, callback: (data: any) => void) => {
  const sessionRef = doc(db, "sessions", gameCode);
  return onSnapshot(sessionRef, (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
};

export const startAuction = async (gameCode: string) => {
  const sessionRef = doc(db, "sessions", gameCode);
  const playersSnapshot = await getDocs(query(collection(db, "players")));
  const playerList = playersSnapshot.docs.map((playerDoc) => ({
    id: playerDoc.id,
    ...playerDoc.data(),
  })) as Player[];

  const queue = createAuctionQueueFrom(playerList).map((player) => player.id);

  await updateDoc(sessionRef, {
    phase: "AUCTION",
    auctionStartedAt: serverTimestamp(),
    auctionQueue: queue,
    queueIndex: -1,
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
    if (!sessionSnap.exists()) {
      throw new Error("Session not found");
    }

    const sessionData = sessionSnap.data();
    const auctionQueue = (sessionData.auctionQueue || []) as string[];
    const nextIndex = ((sessionData.queueIndex as number) ?? -1) + 1;

    if (!auctionQueue[nextIndex]) {
      transaction.update(sessionRef, {
        currentAuction: {
          activePlayerId: null,
          currentBid: 0,
          currentBidderId: null,
          timerEndsAt: null,
          status: "IDLE",
        },
      });
      return;
    }

    const activePlayerId = auctionQueue[nextIndex];
    const playerRef = doc(db, "players", activePlayerId);
    const playerSnap = await transaction.get(playerRef);
    const basePrice = Number(playerSnap.data()?.basePrice || 0);

    transaction.update(sessionRef, {
      queueIndex: nextIndex,
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
    if (!currentAuction || currentAuction.status !== "RUNNING") {
      throw new Error("No active auction");
    }

    const currentBid = Number(currentAuction.currentBid || 0);
    const expectedNextBid = getNextBid(currentBid);

    if (amount !== expectedNextBid) {
      throw new Error("Bid must match the next valid increment");
    }

    if (currentAuction.currentBidderId === teamId) {
      throw new Error("Team cannot bid twice consecutively");
    }

    const teamRef = doc(db, "sessions", gameCode, "teams", teamId);
    const teamSnap = await transaction.get(teamRef);
    if (!teamSnap.exists()) throw new Error("Team not found");

    const purseRemaining = Number(teamSnap.data().purseRemaining || 0);
    const playerIds = (teamSnap.data().players || []) as string[];

    if (purseRemaining < amount) {
      throw new Error("Insufficient purse");
    }

    if (playerIds.length >= SQUAD_CONSTRAINTS.MAX_SQUAD) {
      throw new Error("Squad is full");
    }

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
    if (!currentAuction?.activePlayerId) {
      throw new Error("No active player");
    }

    const { activePlayerId, currentBid, currentBidderId } = currentAuction;

    if (currentBidderId) {
      const winnerTeamRef = doc(db, "sessions", gameCode, "teams", currentBidderId);
      const winnerTeamSnap = await transaction.get(winnerTeamRef);
      if (!winnerTeamSnap.exists()) throw new Error("Winner team not found");

      const winnerData = winnerTeamSnap.data();
      const currentPlayers = (winnerData.players || []) as string[];

      transaction.update(winnerTeamRef, {
        purseRemaining: Number(winnerData.purseRemaining || 0) - Number(currentBid || 0),
        players: [...currentPlayers, activePlayerId],
      });
    }

    transaction.update(sessionRef, {
      currentAuction: {
        activePlayerId,
        currentBid: Number(currentBid || 0),
        currentBidderId: currentBidderId || null,
        timerEndsAt: null,
        status: currentBidderId ? "SOLD" : "UNSOLD",
      },
    });
  });
};
