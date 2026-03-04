import { useMemo, useState } from 'react';
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { PLAYER_ROLES } from '@/lib/constants';
import { EditablePlayer, PlayerForm } from './PlayerForm';
import { PlayerTable } from './PlayerTable';

interface TeamRecord {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  players?: string[];
}

const emptyPlayer: EditablePlayer = {
  name: '',
  role: 'Batsman',
  rating: 3,
  basePrice: 2000000,
  overseas: false,
  pool: 'Batters',
  previousTeamId: '',
  image: '',
};

interface PlayersManagerProps {
  players: EditablePlayer[];
  teams: TeamRecord[];
  globalSearch?: string;
}

export const PlayersManager = ({ players, teams, globalSearch = "" }: PlayersManagerProps) => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [overseasFilter, setOverseasFilter] = useState('all');
  const [ratingRange, setRatingRange] = useState<number[]>([1, 5]);
  const [editing, setEditing] = useState<EditablePlayer | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const teamNameById = useMemo(() => {
    const map: Record<string, string> = {};
    teams.forEach((team) => {
      map[team.id] = team.name;
    });
    return map;
  }, [teams]);

  const teamNameByPlayerId = useMemo(() => {
    const map: Record<string, string> = {};
    teams.forEach((team) => {
      (team.players || []).forEach((playerId) => {
        map[playerId] = team.name;
      });
    });
    return map;
  }, [teams]);

  const filteredPlayers = useMemo(() => {
    const q = search.toLowerCase().trim();
    const globalQ = globalSearch.toLowerCase().trim();

    return [...players]
      .filter((player) => {
        const nameMatch = player.name.toLowerCase().includes(q);
        const globalMatch = !globalQ
          || player.name.toLowerCase().includes(globalQ)
          || player.role.toLowerCase().includes(globalQ)
          || (teamNameById[player.previousTeamId] || '').toLowerCase().includes(globalQ);
        const roleMatch = roleFilter === 'all' ? true : player.role === roleFilter;
        const playerTeam = player.previousTeamId || '';
        const teamMatch = teamFilter === 'all' ? true : playerTeam === teamFilter;
        const ratingMatch = Number(player.rating) >= ratingRange[0] && Number(player.rating) <= ratingRange[1];
        const overseasMatch =
          overseasFilter === 'all'
            ? true
            : overseasFilter === 'overseas'
              ? !!player.overseas
              : !player.overseas;

        return globalMatch && nameMatch && roleMatch && teamMatch && ratingMatch && overseasMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, ratingRange, roleFilter, search, teamFilter, overseasFilter, globalSearch, teamNameById]);

  const syncTeamMembership = async (playerId: string, newTeamId: string, previousTeamId: string) => {
    if (previousTeamId && previousTeamId !== newTeamId) {
      await updateDoc(doc(db, 'teams', previousTeamId), { players: arrayRemove(playerId) });
    }

    if (newTeamId) {
      await updateDoc(doc(db, 'teams', newTeamId), { players: arrayUnion(playerId) });
    }
  };

  const savePlayer = async (player: EditablePlayer) => {
    const payload = {
      name: player.name,
      role: player.role,
      rating: Number(player.rating),
      basePrice: Number(player.basePrice),
      overseas: !!player.overseas,
      pool: player.pool,
      previousTeamId: player.previousTeamId,
      image: player.image,
    };

    if (player.id) {
      const existing = players.find((p) => p.id === player.id);
      await setDoc(doc(db, 'players', player.id), payload, { merge: true });
      await syncTeamMembership(player.id, player.previousTeamId, existing?.previousTeamId || '');
      toast({ title: 'Player updated', description: `${player.name} saved.` });
    } else {
      const created = await addDoc(collection(db, 'players'), payload);
      if (player.previousTeamId) {
        await updateDoc(doc(db, 'teams', player.previousTeamId), { players: arrayUnion(created.id) });
      }
      toast({ title: 'Player created', description: `${player.name} added to players collection.` });
      setCreateOpen(false);
    }

    setEditing(null);
  };

  const handleDeletePlayer = async (playerId: string) => {
    const player = players.find((p) => p.id === playerId);
    await deleteDoc(doc(db, 'players', playerId));
    if (player?.previousTeamId) {
      await updateDoc(doc(db, 'teams', player.previousTeamId), { players: arrayRemove(playerId) });
    }
    toast({ title: 'Player deleted' });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Players (Firestore)</h2>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>Add Player</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create New Player</DialogTitle>
            </DialogHeader>
            <PlayerForm
              initial={emptyPlayer}
              teams={teams.map((team) => ({ id: team.id, name: team.name }))}
              onSave={savePlayer}
              onCancel={() => setCreateOpen(false)}
              submitLabel="Create Player"
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3 border rounded-lg p-3">
        <div className="space-y-2">
          <Label>Search</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Player name" />
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {PLAYER_ROLES.map((role) => (
                <SelectItem key={role} value={role}>{role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Team</Label>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Overseas</Label>
          <Select value={overseasFilter} onValueChange={setOverseasFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="overseas">Overseas</SelectItem>
              <SelectItem value="local">Local</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Rating Range: {ratingRange[0]} - {ratingRange[1]}</Label>
          <Slider defaultValue={[1, 5]} min={1} max={5} step={1} value={ratingRange} onValueChange={setRatingRange} />
        </div>
      </div>

      {editing && (
        <PlayerForm
          initial={editing}
          teams={teams.map((team) => ({ id: team.id, name: team.name }))}
          onSave={savePlayer}
          onCancel={() => setEditing(null)}
          submitLabel="Update Player"
        />
      )}

      <div className="border rounded-lg p-2">
        <PlayerTable
          players={filteredPlayers}
          teamNameByPlayerId={Object.fromEntries(
            players.map((player) => [player.id || '', teamNameByPlayerId[player.id || ''] || teamNameById[player.previousTeamId] || 'Unassigned']),
          )}
          onEdit={setEditing}
          onDelete={handleDeletePlayer}
        />
      </div>
    </div>
  );
};
