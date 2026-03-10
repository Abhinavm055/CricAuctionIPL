import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IPL_TEAMS } from '@/lib/constants';
import { EditablePlayer } from '@/components/PlayerForm';
import { PlayersManager } from '@/components/PlayersManager';
import AdminTeamsPage from './AdminTeamsPage';

interface TeamRecord {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  players?: string[];
}

const teamIdByShortName = IPL_TEAMS.reduce<Record<string, string>>((acc, team) => {
  acc[team.shortName.toLowerCase()] = team.id;
  return acc;
}, {});

const normalizeTeamId = (value?: string) => {
  if (!value) return '';
  const raw = value.trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (IPL_TEAMS.some((team) => team.id === lower)) return lower;
  return teamIdByShortName[lower] || '';
};

const AdminPage = () => {
  const [tab, setTab] = useState<'players' | 'teams'>('teams');
  const [globalSearch, setGlobalSearch] = useState('');
  const [players, setPlayers] = useState<EditablePlayer[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);

  useEffect(() => {
    const unsubPlayers = onSnapshot(collection(db, 'players'), (snap) => {
      const mapped = snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        const name = String(raw.name || '').trim();
        const teamId = normalizeTeamId(raw.previousTeamId || raw.previousTeam || '');
        const rating = Number(raw.rating ?? raw.starRating ?? 3);
        const overseas = Boolean(raw.overseas ?? raw.isOverseas ?? false);

        return {
          id: d.id,
          name,
          role: String(raw.role || 'Batsman'),
          rating: Number.isFinite(rating) ? rating : 3,
          basePrice: Number(raw.basePrice ?? 0),
          overseas,
          image: String(raw.image || raw.imageUrl || ''),
          pool: String(raw.pool || 'Batters'),
          previousTeamId: teamId,
          nationality: String(raw.nationality || ''),
          isCapped: Boolean(raw.isCapped ?? false),
        } as EditablePlayer;
      }).filter((player) => player.name);

      setPlayers(mapped);
    });

    const unsubTeams = onSnapshot(collection(db, 'teams'), (snap) => {
      const firestoreMap = new Map(
        snap.docs.map((d) => [
          d.id,
          {
            id: d.id,
            ...(d.data() as Omit<TeamRecord, 'id'>),
          },
        ]),
      );

      const merged = IPL_TEAMS.map((baseTeam) => {
        const fromFirestore = firestoreMap.get(baseTeam.id);
        return {
          id: baseTeam.id,
          name: fromFirestore?.name || baseTeam.name,
          shortName: fromFirestore?.shortName || baseTeam.shortName,
          logo: fromFirestore?.logo || baseTeam.logo,
          players: fromFirestore?.players || [],
        };
      });

      setTeams(merged);
    });

    return () => {
      unsubPlayers();
      unsubTeams();
    };
  }, []);

  return (
    <div className="min-h-screen p-6 bg-background">
      <h1 className="text-3xl font-display mb-6">Super Admin Panel</h1>

      <div className="mb-4 max-w-xl">
        <Input
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Search players, teams or roles..."
        />
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        <aside className="border rounded-xl p-3 h-fit bg-card">
          <p className="text-xs text-muted-foreground px-2 pb-2">Navigation</p>
          <Button
            variant={tab === 'teams' ? 'default' : 'ghost'}
            className="w-full justify-start mb-2"
            onClick={() => setTab('teams')}
          >
            Teams
          </Button>
          <Button
            variant={tab === 'players' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setTab('players')}
          >
            Players
          </Button>
        </aside>

        <section className="border rounded-xl p-4 bg-card">
          {tab === 'players' && <PlayersManager players={players} teams={teams} globalSearch={globalSearch} />}
          {tab === 'teams' && <AdminTeamsPage players={players} teams={teams} />}
        </section>
      </div>
    </div>
  );
};

export default AdminPage;
