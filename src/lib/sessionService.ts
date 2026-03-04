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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { IPL_TEAMS } from "@/lib/constants";

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
  await updateDoc(sessionRef, {
    phase: "AUCTION",
    auctionStartedAt: serverTimestamp(),
  });
};