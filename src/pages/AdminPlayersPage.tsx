import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EditablePlayer } from '@/components/PlayerForm';
import { PlayersManager } from '@/components/PlayersManager';
import { IPL_TEAMS } from '@/lib/constants';
import { initializeTeamsCollection } from '@/lib/initializeTeams';

interface TeamRecord {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
}

const AdminPlayersPage = () => {
  const [players, setPlayers] = useState<EditablePlayer[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);

  useEffect(() => {
    initializeTeamsCollection().catch(() => undefined);
    const unsubPlayers = onSnapshot(collection(db, 'players'), (snapshot) => {
      const data = snapshot.docs.map((playerDoc) => {
        const raw = playerDoc.data() as Record<string, unknown>;
        return {
          id: playerDoc.id,
          name: String(raw.name || ''),
          role: String(raw.role || 'Batsman'),
          rating: Number(raw.rating ?? 3),
          basePrice: Number(raw.basePrice ?? 0),
          pool: String(raw.pool || 'Batters'),
          previousTeamId: String(raw.previousTeamId || ''),
          overseas: Boolean(raw.overseas ?? false),
          nationality: String(raw.nationality || ''),
          image: String(raw.image || ''),
          isCapped: Boolean(raw.isCapped ?? false),
        } as EditablePlayer;
      });

      setPlayers(data);
    });

    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const byId = new Map(snapshot.docs.map((teamDoc) => [teamDoc.id, teamDoc.data()]));
      setTeams(
        IPL_TEAMS.map((team) => ({
          id: team.id,
          name: String((byId.get(team.id) as any)?.name || team.name),
          shortName: String((byId.get(team.id) as any)?.shortName || team.shortName),
          logo: String((byId.get(team.id) as any)?.logo || team.logo || ''),
        })),
      );
    });

    return () => {
      unsubPlayers();
      unsubTeams();
    };
  }, []);

  return (
    <div className="min-h-screen p-6 bg-background space-y-4">
      <h1 className="text-2xl font-display">Admin Players</h1>
      <p className="text-sm text-muted-foreground">
        Real-time Firestore player management with add/edit/delete, nationality, image URL and CSV import.
      </p>
      <PlayersManager players={players} teams={teams} />
    </div>
  );
};

export default AdminPlayersPage;
