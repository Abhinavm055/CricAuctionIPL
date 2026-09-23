import { useMemo, useState } from 'react';
import { arrayRemove, arrayUnion, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { TeamLogo } from '@/components/TeamLogo';
import { EditablePlayer } from '@/components/PlayerForm';
import { formatPrice } from '@/lib/constants';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { PlayerInitialsAvatar } from '@/components/PlayerInitialsAvatar';
import { Trash2, Users, ArrowDownUp } from 'lucide-react';

interface TeamRecord {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  players?: string[];
}

interface AdminTeamsPageProps {
  teams: TeamRecord[];
  players: EditablePlayer[];
}

const AdminTeamsPage = ({ teams, players }: AdminTeamsPageProps) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);
  const [dragOverTeamId, setDragOverTeamId] = useState<string | null>(null);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || teams[0],
    [teams, selectedTeamId],
  );

  const selectedTeamPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    const ids = new Set(selectedTeam.players || []);
    return players
      .filter((player) => ids.has(player.id || '') || player.previousTeamId === selectedTeam.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, selectedTeam]);

  const assignPlayerToTeam = async (playerId: string, targetTeamId: string) => {
    const player = players.find((p) => p.id === playerId);
    if (!player?.id) return;

    const previousTeamId = player.previousTeamId || '';

    if (previousTeamId && previousTeamId !== targetTeamId) {
      await setDoc(doc(db, 'teams', previousTeamId), { players: arrayRemove(player.id) }, { merge: true });
    }

    await setDoc(doc(db, 'teams', targetTeamId), { players: arrayUnion(player.id) }, { merge: true });
    await setDoc(doc(db, 'players', player.id), { previousTeamId: targetTeamId }, { merge: true });
    setSelectedTeamId(targetTeamId);
  };

  const deletePlayer = async (playerId: string) => {
    const player = players.find((p) => p.id === playerId);
    if (!player?.id) return;

    if (player.previousTeamId) {
      await setDoc(doc(db, 'teams', player.previousTeamId), { players: arrayRemove(player.id) }, { merge: true });
    }

    await deleteDoc(doc(db, 'players', player.id));
  };

  if (!teams.length) return <p className="text-slate-400">No franchises registered in database.</p>;

  return (
    <div className="space-y-6 h-full">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#F5B82E]" />
          <h2 className="text-lg font-display uppercase tracking-wider text-white">
            Franchise Roster Allocation
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          Drag and drop players onto any franchise logo to transfer squad rights.
        </p>
      </div>

      {/* Team Selection Ribbon */}
      <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-thin">
        {teams.map((team) => (
          <button
            key={team.id}
            type="button"
            onClick={() => setSelectedTeamId(team.id)}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverTeamId(team.id);
            }}
            onDragLeave={() => setDragOverTeamId((prev) => (prev === team.id ? null : prev))}
            onDrop={async (event) => {
              event.preventDefault();
              const playerId = event.dataTransfer.getData('text/plain');
              if (playerId) await assignPlayerToTeam(playerId, team.id);
              setDragOverTeamId(null);
              setDraggingPlayerId(null);
            }}
            className={`shrink-0 p-3 rounded-2xl border transition-all ${
              selectedTeam?.id === team.id
                ? 'border-[#F5B82E] bg-yellow-500/15 shadow-md shadow-yellow-500/20'
                : 'border-white/[0.08] bg-slate-950/40 hover:border-white/20'
            } ${dragOverTeamId === team.id ? 'scale-105 ring-2 ring-[#F5B82E] bg-yellow-500/25' : ''}`}
            title={team.name}
          >
            <TeamLogo teamId={team.id} logo={team.logo} shortName={team.shortName} size="lg" className="w-12 h-12" />
          </button>
        ))}
      </div>

      {selectedTeam && (
        <div className="rounded-2xl border border-white/[0.08] p-5 bg-slate-950/40 space-y-5 max-h-[calc(100vh-320px)] overflow-y-auto">
          <div className="flex items-center gap-4 pb-4 border-b border-white/[0.08]">
            <TeamLogo
              teamId={selectedTeam.id}
              logo={selectedTeam.logo}
              shortName={selectedTeam.shortName}
              size="lg"
              className="w-16 h-16 rounded-full border-2 border-[#F5B82E]/50"
            />
            <div>
              <h3 className="font-display text-xl uppercase tracking-wider text-white">{selectedTeam.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedTeamPlayers.length} Active Squad Members
              </p>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {selectedTeamPlayers.map((player) => (
              <div
                key={player.id}
                draggable
                onDragStart={(event) => {
                  if (!player.id) return;
                  event.dataTransfer.setData('text/plain', player.id);
                  setDraggingPlayerId(player.id);
                }}
                onDragEnd={() => setDraggingPlayerId(null)}
                className={`rounded-xl border border-white/[0.08] p-3 bg-[#09152A] transition-all cursor-grab active:cursor-grabbing ${
                  draggingPlayerId === player.id ? 'opacity-40 scale-95' : 'hover:border-white/20'
                }`}
              >
                <div className="w-full h-24 flex items-center justify-center bg-slate-950/50 rounded-lg border border-white/[0.04]">
                  <PlayerInitialsAvatar
                    name={player.name}
                    role={player.role}
                    isOverseas={player.overseas}
                    image={player.image || (player as any).imageUrl}
                    size="md"
                  />
                </div>

                <h4 className="mt-2 text-xs font-bold text-white truncate">{player.name}</h4>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span className="truncate">{player.role}</span>
                  <span className="font-mono text-[#F5B82E] font-semibold">{formatPrice(Number(player.basePrice || 0))}</span>
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="mt-2.5 w-full h-7 text-[11px] font-semibold flex items-center justify-center gap-1 bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                  onClick={() => player.id && deletePlayer(player.id)}
                >
                  <Trash2 className="w-3 h-3" />
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTeamsPage;
