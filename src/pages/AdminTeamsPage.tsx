import { useMemo, useState } from 'react';
import { arrayRemove, arrayUnion, doc, setDoc } from 'firebase/firestore';
import { TeamLogo } from '@/components/TeamLogo';
import { EditablePlayer, PlayerForm } from '@/components/PlayerForm';
import { formatPrice } from '@/lib/constants';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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

const resolveRoleBucket = (role: string) => {
  const value = role.toLowerCase();
  if (value.includes('wicket')) return 'WICKETKEEPERS';
  if (value.includes('all')) return 'ALLROUNDERS';
  if (value.includes('bowl')) return 'BOWLERS';
  return 'BATTERS';
};

const buckets = ['BATTERS', 'WICKETKEEPERS', 'ALLROUNDERS', 'BOWLERS'] as const;

const AdminTeamsPage = ({ teams, players }: AdminTeamsPageProps) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');
  const [editingPlayer, setEditingPlayer] = useState<EditablePlayer | null>(null);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || teams[0],
    [teams, selectedTeamId],
  );

  const selectedTeamPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    const ids = new Set(selectedTeam.players || []);
    return players.filter((player) => ids.has(player.id || '') || player.previousTeamId === selectedTeam.id);
  }, [players, selectedTeam]);

  const groupedPlayers = useMemo(() => {
    return buckets.reduce<Record<string, EditablePlayer[]>>((acc, bucket) => {
      acc[bucket] = selectedTeamPlayers
        .filter((player) => resolveRoleBucket(String(player.role || '')) === bucket)
        .sort((a, b) => a.name.localeCompare(b.name));
      return acc;
    }, {});
  }, [selectedTeamPlayers]);

  const handleSaveEditedPlayer = async (player: EditablePlayer) => {
    if (!player.id) return;
    const existing = players.find((p) => p.id === player.id);

    await setDoc(
      doc(db, 'players', player.id),
      {
        name: player.name,
        role: player.role,
        rating: Number(player.rating),
        starRating: Number(player.rating),
        basePrice: Number(player.basePrice),
        overseas: !!player.overseas,
        isOverseas: !!player.overseas,
        pool: player.pool,
        image: player.image,
        nationality: player.nationality || '',
        previousTeamId: player.previousTeamId || '',
      },
      { merge: true },
    );

    if ((existing?.previousTeamId || '') !== (player.previousTeamId || '')) {
      if (existing?.previousTeamId) {
        await setDoc(doc(db, 'teams', existing.previousTeamId), { players: arrayRemove(player.id) }, { merge: true });
      }
      if (player.previousTeamId) {
        await setDoc(doc(db, 'teams', player.previousTeamId), { players: arrayUnion(player.id) }, { merge: true });
      }
    }

    setEditingPlayer(null);
  };

  if (!teams.length) return <p className="text-muted-foreground">No teams available.</p>;

  return (
    <div className="space-y-4 h-full">
      <h2 className="text-xl font-semibold">Teams • Admin: <span className="text-primary">Abhinav</span></h2>
      <p className="text-sm text-muted-foreground">Select a team to open the Team Detail View.</p>

      <div className="flex overflow-x-auto gap-3 pb-2">
        {teams.map((team) => (
          <button
            key={team.id}
            type="button"
            className={`shrink-0 p-2 rounded-xl border transition ${selectedTeam?.id === team.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
            onClick={() => setSelectedTeamId(team.id)}
            title={team.name}
          >
            <TeamLogo teamId={team.id} logo={team.logo} shortName={team.shortName} size="lg" className="w-14 h-14" />
          </button>
        ))}
      </div>

      {selectedTeam && (
        <div className="h-[calc(100vh-270px)] min-h-[520px] border rounded-xl p-3 md:p-4 flex flex-col gap-4 overflow-hidden bg-card/50">
          <div className="flex flex-col items-center gap-2">
            <TeamLogo
              teamId={selectedTeam.id}
              logo={selectedTeam.logo}
              shortName={selectedTeam.shortName}
              size="xl"
              className="w-28 h-28 md:w-32 md:h-32 border-2 border-primary/60 rounded-full"
            />
            <p className="font-semibold text-lg">{selectedTeam.name}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_240px] gap-4 h-full overflow-hidden">
            <aside className="border rounded-lg p-3 overflow-y-auto">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Teams</p>
              <div className="space-y-2">
                {teams.map((team) => (
                  <button
                    key={`side-${team.id}`}
                    className={`w-full flex items-center gap-2 rounded-md border px-2 py-2 text-left transition ${selectedTeam.id === team.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    <TeamLogo teamId={team.id} logo={team.logo} shortName={team.shortName} size="sm" className="w-9 h-9" />
                    <span className="text-sm font-medium truncate">{team.shortName}</span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="border rounded-lg p-3 overflow-hidden">
              <p className="text-sm font-semibold mb-3">Players</p>
              <div className="space-y-4 h-full overflow-auto pr-1">
                {buckets.map((bucket) => (
                  <div key={bucket}>
                    <h3 className="text-xs tracking-[0.2em] text-muted-foreground mb-2">{bucket}</h3>
                    {groupedPlayers[bucket].length ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                        {groupedPlayers[bucket].map((player) => (
                          <div key={player.id} className="rounded-lg border p-2 bg-background/40">
                            <button
                              className="w-full mb-2"
                              onClick={() => setEditingPlayer(player)}
                              title={`Edit ${player.name}`}
                              type="button"
                            >
                              {player.image ? (
                                <img src={player.image} alt={player.name} className="w-full h-24 object-cover rounded-md border border-primary/20 hover:border-primary/60 transition" />
                              ) : (
                                <div className="w-full h-24 rounded-md border border-dashed border-primary/40 grid place-items-center text-xs text-muted-foreground">No image</div>
                              )}
                            </button>
                            <p className="text-sm font-semibold truncate">{player.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{player.nationality || 'Unknown'}</p>
                            <p className="text-xs mt-1">{formatPrice(Number(player.basePrice || 0))}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No players in this category.</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="border rounded-lg p-3 bg-background/30">
              <p className="text-sm font-semibold mb-3">Add Player</p>
              <div className="space-y-2 text-sm">
                <p>Team: <strong>{selectedTeam.shortName}</strong></p>
                <p>Total Players: <strong>{selectedTeamPlayers.length}</strong></p>
                <p className="text-muted-foreground text-xs">Click any player image to edit player profile and re-assign team.</p>
              </div>
            </section>
          </div>
        </div>
      )}

      <Dialog open={!!editingPlayer} onOpenChange={(open) => !open && setEditingPlayer(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
          </DialogHeader>
          {editingPlayer && (
            <PlayerForm
              initial={editingPlayer}
              teams={teams.map((team) => ({ id: team.id, name: team.name }))}
              onSave={handleSaveEditedPlayer}
              onCancel={() => setEditingPlayer(null)}
              submitLabel="Update Player"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTeamsPage;
