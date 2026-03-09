import { useMemo, useState } from 'react';
import { arrayRemove, arrayUnion, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { formatPrice, PLAYER_ROLES } from '@/lib/constants';
import { TeamLogo } from './TeamLogo';
import { EditablePlayer, PlayerForm } from './PlayerForm';

interface TeamRecord {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  players?: string[];
}

interface TeamDetailsProps {
  team: TeamRecord;
  players: EditablePlayer[];
  teams: TeamRecord[];
}

export const TeamDetails = ({ team, players, teams }: TeamDetailsProps) => {
  const { toast } = useToast();
  const [addPlayerModalOpen, setAddPlayerModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingPlayer, setEditingPlayer] = useState<EditablePlayer | null>(null);
  const shortNameById = useMemo(
    () => teams.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.shortName;
      return acc;
    }, {}),
    [teams],
  );


  const teamPlayerIds = useMemo(() => {
    const fromTeamArray = team.players || [];
    const fromPreviousTeam = players.filter((player) => player.previousTeamId === team.id).map((player) => player.id || '');
    return Array.from(new Set([...fromTeamArray, ...fromPreviousTeam].filter(Boolean)));
  }, [team.id, team.players, players]);

  const teamPlayers = useMemo(
    () => players.filter((player) => teamPlayerIds.includes(player.id || '')),
    [players, teamPlayerIds],
  );

  const availablePlayers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return players.filter((player) => {
      const inTeam = teamPlayerIds.includes(player.id || '');
      if (inTeam) return false;
      const nameMatches = player.name.toLowerCase().includes(q);
      const roleMatches = roleFilter === 'all' ? true : player.role === roleFilter;
      return nameMatches && roleMatches;
    });
  }, [players, roleFilter, search, teamPlayerIds]);

  const movePlayerToTeam = async (player: EditablePlayer, targetTeamId: string) => {
    if (!player.id) return;
    const previousTeamId = player.previousTeamId || '';

    if (previousTeamId && previousTeamId !== targetTeamId) {
      await setDoc(doc(db, 'teams', previousTeamId), { players: arrayRemove(player.id) }, { merge: true });
    }

    if (targetTeamId) {
      await setDoc(doc(db, 'teams', targetTeamId), { players: arrayUnion(player.id) }, { merge: true });
    }

    await setDoc(doc(db, 'players', player.id), { previousTeamId: targetTeamId, previousTeam: shortNameById[targetTeamId] || '' }, { merge: true });
  };

  const addPlayerToTeam = async (player: EditablePlayer) => {
    if (!player.id) return;
    if (teamPlayerIds.includes(player.id)) {
      toast({ title: 'Duplicate prevented', description: `${player.name} is already in ${team.shortName}.` });
      return;
    }

    await movePlayerToTeam(player, team.id);
    toast({ title: 'Player added', description: `${player.name} added to ${team.shortName}.` });
  };

  const removePlayerFromTeam = async (player: EditablePlayer) => {
    if (!player.id) return;
    await setDoc(doc(db, 'teams', team.id), { players: arrayRemove(player.id) }, { merge: true });
    await setDoc(doc(db, 'players', player.id), { previousTeamId: '', previousTeam: '' }, { merge: true });
    toast({ title: 'Player removed', description: `${player.name} removed from ${team.shortName}.` });
  };

  const deletePlayerFromTeam = async (player: EditablePlayer) => {
    if (!player.id) return;
    await setDoc(doc(db, 'teams', team.id), { players: arrayRemove(player.id) }, { merge: true });
    await deleteDoc(doc(db, 'players', player.id));
    toast({ title: 'Player deleted', description: `${player.name} deleted from players database.` });
  };

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
        previousTeamId: player.previousTeamId,
        previousTeam: shortNameById[player.previousTeamId] || '',
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
    toast({ title: 'Player updated', description: `${player.name} changes saved.` });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg bg-card flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TeamLogo logo={team.logo} shortName={team.shortName} size="lg" />
          <div>
            <h3 className="text-xl font-semibold">{team.name}</h3>
            <p className="text-sm text-muted-foreground">{teamPlayers.length} players in this squad</p>
          </div>
        </div>

        <Dialog open={addPlayerModalOpen} onOpenChange={setAddPlayerModalOpen}>
          <DialogTrigger asChild>
            <Button>Add Player</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add player to {team.shortName}</DialogTitle>
            </DialogHeader>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Search by name</Label>
                <Input placeholder="Search player" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Filter by role</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {PLAYER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="max-h-80 overflow-auto border rounded-md">
              {availablePlayers.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No players match search/filter.</p>
              ) : (
                <div className="divide-y">
                  {availablePlayers.map((player) => (
                    <div key={player.id} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {player.image ? <img src={player.image} alt={player.name} className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded bg-muted" />}
                        <div>
                          <p className="text-sm font-medium">{player.name}</p>
                          <p className="text-xs text-muted-foreground">{player.role}</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => addPlayerToTeam(player)}>Select</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {editingPlayer && (
        <PlayerForm
          initial={editingPlayer}
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          onSave={handleSaveEditedPlayer}
          onCancel={() => setEditingPlayer(null)}
          submitLabel="Update Player"
        />
      )}


      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {teamPlayers.map((player) => (
          <div key={`card-${player.id}`} className="border rounded-xl p-3 space-y-2 bg-card/60">
            <div className="flex items-center gap-2">
              {player.image ? <img src={player.image} alt={player.name} className="w-14 h-14 rounded object-cover" /> : <div className="w-14 h-14 rounded bg-muted" />}
              <div>
                <p className="font-semibold">{player.name}</p>
                <p className="text-xs text-muted-foreground">{player.role}</p>
              </div>
            </div>
            <p className="text-xs">Rating: <strong>{player.rating}</strong></p>
            <p className="text-xs">Nationality: <strong>{player.nationality || 'Unknown'}</strong></p>
            <p className="text-xs">Base Price: <strong>{formatPrice(Number(player.basePrice || 0))}</strong></p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Previous Team</span>
              <TeamLogo teamId={player.previousTeamId || null} shortName={player.previousTeamId || 'N/A'} size="sm" />
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditingPlayer(player)}>Edit</Button>
          </div>
        ))}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Base Price</TableHead>
              <TableHead>Overseas</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamPlayers.map((player) => (
              <TableRow key={player.id}>
                <TableCell>
                  {player.image ? <img src={player.image} alt={player.name} className="w-9 h-9 rounded object-cover border" /> : <div className="w-9 h-9 rounded bg-muted" />}
                </TableCell>
                <TableCell className="font-medium">{player.name}</TableCell>
                <TableCell>{player.role}</TableCell>
                <TableCell>{player.rating}</TableCell>
                <TableCell>{formatPrice(Number(player.basePrice || 0))}</TableCell>
                <TableCell>
                  {player.overseas ? <span className="text-yellow-400 text-lg" title="Overseas">✈️</span> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingPlayer(player)}>Edit</Button>
                  <Button size="sm" variant="secondary" onClick={() => removePlayerFromTeam(player)}>Remove</Button>
                  <Button size="sm" variant="destructive" onClick={() => deletePlayerFromTeam(player)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {teamPlayers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">No players in this team.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
