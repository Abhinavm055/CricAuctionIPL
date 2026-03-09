import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EditablePlayer } from '@/components/PlayerForm';
import { PlayersManager } from '@/components/PlayersManager';
import { IPL_TEAMS } from '@/lib/constants';

interface TeamRecord {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  players?: string[];
}

const AdminPlayersPage = () => {
  const [players, setPlayers] = useState<EditablePlayer[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);

  useEffect(() => {
    const unsubPlayers = onSnapshot(collection(db, 'players'), (snap) => {
      setPlayers(
        snap.docs.map((d) => {
          const raw = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            name: String(raw.name || ''),
            role: String(raw.role || 'Batsman'),
            rating: Number(raw.rating ?? raw.starRating ?? 3),
            basePrice: Number(raw.basePrice ?? 0),
            overseas: Boolean(raw.overseas ?? raw.isOverseas),
            pool: String(raw.pool || 'Batters'),
            previousTeamId: String(raw.previousTeamId || ''),
            image: String(raw.image || raw.imageUrl || ''),
          };
        }),
      );
    });

    const unsubTeams = onSnapshot(collection(db, 'teams'), (snap) => {
      const byId = new Map(snap.docs.map((d) => [d.id, d.data()]));
      setTeams(
        IPL_TEAMS.map((team) => ({
          id: team.id,
          name: String((byId.get(team.id) as any)?.name || team.name),
          shortName: String((byId.get(team.id) as any)?.shortName || team.shortName),
          logo: String((byId.get(team.id) as any)?.logo || team.logo || ''),
          players: (((byId.get(team.id) as any)?.players || []) as string[]),
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
      <p className="text-sm text-muted-foreground">Add, edit, delete players and manage image URLs synced to Firestore.</p>
      <PlayersManager players={players} teams={teams} />
    </div>
  );
};

export default AdminPlayersPage;
