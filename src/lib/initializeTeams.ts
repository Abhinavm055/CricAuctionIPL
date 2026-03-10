import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { IPL_TEAMS, TEAM_LOGOS } from '@/lib/constants';

export const ensureTeamDocument = async (teamId: string) => {
  const team = IPL_TEAMS.find((item) => item.id === teamId);
  if (!team) return;

  await setDoc(
    doc(db, 'teams', teamId),
    {
      id: teamId,
      name: team.name,
      shortName: team.shortName,
      logo: TEAM_LOGOS[teamId as keyof typeof TEAM_LOGOS],
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const initializeTeamsCollection = async () => {
  const existing = await getDocs(collection(db, 'teams'));
  const existingIds = new Set(existing.docs.map((teamDoc) => teamDoc.id));

  await Promise.all(
    IPL_TEAMS.map(async (team) => {
      if (!existingIds.has(team.id)) {
        await setDoc(doc(db, 'teams', team.id), {
          id: team.id,
          name: team.name,
          shortName: team.shortName,
          logo: TEAM_LOGOS[team.id as keyof typeof TEAM_LOGOS],
          createdAt: serverTimestamp(),
        });
      }
    }),
  );
};
