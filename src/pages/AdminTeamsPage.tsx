import { useMemo, useState } from 'react';
import { arrayRemove, arrayUnion, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { TeamLogo } from '@/components/TeamLogo';
import { EditablePlayer } from '@/components/PlayerForm';
import { formatPrice } from '@/lib/constants';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';

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

  if (!teams.length) return <p className="text-muted-foreground">No teams available.</p>;

  return (
    <div className="space-y-4 h-full">
      <h2 className="text-xl font-semibold">Teams • Admin: <span className="text-primary">Abhinav</span></h2>

      <div className="flex overflow-x-auto gap-3 pb-2">
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
            className={`shrink-0 p-2 rounded-xl border transition ${selectedTeam?.id === team.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'} ${dragOverTeamId === team.id ? 'scale-105 shadow-[0_0_12px_gold]' : ''}`}
            title={team.name}
          >
            <TeamLogo teamId={team.id} logo={team.logo} shortName={team.shortName} size="lg" className="w-14 h-14" />
          </button>
        ))}
      </div>

      {selectedTeam && (
        <div className="border rounded-xl p-4 bg-card/50 space-y-4 h-[calc(100vh-250px)] overflow-y-auto">
          <div className="flex flex-col items-center gap-2">
            <TeamLogo
              teamId={selectedTeam.id}
              logo={selectedTeam.logo}
              shortName={selectedTeam.shortName}
              size="xl"
              className="w-28 h-28 md:w-32 md:h-32 border-2 border-primary/60 rounded-full"
            />
            <p className="font-semibold text-lg text-center">{selectedTeam.name}</p>
          </div>

          <div className="w-full grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-5">
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
                className={`rounded-xl border p-3 bg-background/40 transition ${draggingPlayerId === player.id ? 'opacity-60 scale-95' : 'hover:scale-[1.02]'}`}
              >
                {player.image ? (
                  <img src={player.image} alt={player.name} className="w-full h-[120px] object-contain bg-transparent rounded-md border border-primary/20" />
                ) : (
                  <div className="h-[120px] flex items-center justify-center bg-[#0b1c3d] text-[#aaa] rounded-md border border-dashed border-primary/30">
                    No Image
                  </div>
                )}

                <h3 className="mt-2 text-sm font-semibold truncate">{player.name}</h3>
                <p className="text-xs text-muted-foreground truncate">{player.nationality || 'Unknown'}</p>
                <p className="text-xs">{formatPrice(Number(player.basePrice || 0))}</p>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => player.id && deletePlayer(player.id)}
                >
                  🗑 DELETE
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
