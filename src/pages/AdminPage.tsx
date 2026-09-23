import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IPL_TEAMS } from '@/lib/constants';
import { EditablePlayer } from '@/components/PlayerForm';
import { PlayersManager } from '@/components/PlayersManager';
import { useAdmin } from '@/contexts/AdminContext';
import AdminTeamsPage from './AdminTeamsPage';
import AdminAccountsPage from './AdminAccountsPage';
import { Shield, ArrowLeft, Search, Users, Database, UserCheck } from 'lucide-react';

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
  const { isAdmin, isLoading, user } = useAdmin();
  const [tab, setTab] = useState<'players' | 'teams' | 'accounts'>('teams');
  const [globalSearch, setGlobalSearch] = useState('');
  const [players, setPlayers] = useState<EditablePlayer[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubPlayers = onSnapshot(collection(db, 'players'), (snap) => {
      const mapped = snap.docs
        .map((d) => {
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
        })
        .filter((player) => player.name);

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
  }, [isAdmin]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020817] flex flex-col items-center justify-center text-primary font-display text-2xl gap-3">
        <div className="w-10 h-10 border-2 border-[#F5B82E] border-t-transparent rounded-full animate-spin" />
        <span className="animate-pulse tracking-widest text-xs text-[#F5B82E]/80 uppercase">
          Verifying Clearance Credentials...
        </span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[#020817] text-white flex flex-col selection:bg-yellow-500/20 selection:text-yellow-300">
      {/* Top Console Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#020817]/90 backdrop-blur-xl px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#F5B82E]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-display uppercase tracking-wider text-white">
                  Admin Control Center
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-yellow-500/20 text-[#F5B82E] border border-yellow-500/30">
                  Super Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Logged in as <span className="text-slate-300 font-medium">{user?.email || 'Administrator'}</span>
              </p>
            </div>
          </div>

          <Button asChild variant="outline" size="sm" className="border-white/[0.12] hover:border-yellow-500/40 text-slate-300">
            <Link to="/" className="flex items-center gap-1.5 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
              Exit Console
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Search Bar */}
        <div className="max-w-md relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder={
              tab === 'accounts'
                ? 'Search logged-in users by name, email, or user ID...'
                : 'Search players, franchises, or tactical roles...'
            }
            className="pl-10 h-10 bg-[#09152A] border-white/[0.08] text-white placeholder:text-slate-500 focus:border-[#F5B82E] rounded-xl text-sm"
          />
        </div>

        <div className="grid md:grid-cols-[220px_1fr] gap-6">
          {/* Sidebar Navigation */}
          <aside className="rounded-2xl border border-white/[0.08] p-3 h-fit bg-[#09152A] md:sticky md:top-20 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-3 py-2">
              Database Sectors
            </p>
            <button
              type="button"
              onClick={() => setTab('teams')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                tab === 'teams'
                  ? 'bg-[#F5B82E]/15 text-[#F5B82E] border border-[#F5B82E]/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Users className="w-4 h-4" />
              Franchise Rosters
            </button>
            <button
              type="button"
              onClick={() => setTab('players')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                tab === 'players'
                  ? 'bg-[#F5B82E]/15 text-[#F5B82E] border border-[#F5B82E]/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Database className="w-4 h-4" />
              Auction Player Pool
            </button>

            <div className="pt-3 mt-3 border-t border-white/[0.08] space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-3 py-1">
                User / Account Management
              </p>
              <button
                type="button"
                onClick={() => setTab('accounts')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                  tab === 'accounts'
                    ? 'bg-[#F5B82E]/15 text-[#F5B82E] border border-[#F5B82E]/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                Logged-In Accounts
              </button>
            </div>
          </aside>

          {/* Panel Content */}
          <section className="rounded-2xl border border-white/[0.08] p-5 sm:p-6 bg-[#09152A] shadow-xl shadow-black/40 overflow-hidden">
            {tab === 'players' && <PlayersManager players={players} teams={teams} globalSearch={globalSearch} />}
            {tab === 'teams' && <AdminTeamsPage players={players} teams={teams} />}
            {tab === 'accounts' && <AdminAccountsPage searchQuery={globalSearch} />}
          </section>
        </div>
      </main>
    </div>
  );
};

export default AdminPage;

