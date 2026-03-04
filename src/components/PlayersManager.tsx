import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditablePlayer, PlayerForm } from "./PlayerForm";
import { PlayerTable } from "./PlayerTable";

interface TeamDoc {
  id: string;
  name: string;
  shortName: string;
}

interface PlayersManagerProps {
  players: EditablePlayer[];
  teams: TeamDoc[];
}

const emptyPlayer: EditablePlayer = {
  name: "",
  role: "Batsman",
  rating: 3,
  basePrice: 2000000,
  overseas: false,
  image: "",
  previousTeamId: "",
  pool: "Batters",
};

export const PlayersManager = ({ players, teams }: PlayersManagerProps) => {
  const [editing, setEditing] = useState<EditablePlayer | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [overseasFilter, setOverseasFilter] = useState("all");
  const [ratingMin, setRatingMin] = useState(0);
  const [ratingMax, setRatingMax] = useState(5);

  const filteredPlayers = useMemo(() => {
    return [...players]
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      .filter((p) => roleFilter === "all" ? true : p.role === roleFilter)
      .filter((p) => teamFilter === "all" ? true : (p.previousTeamId || "") === teamFilter)
      .filter((p) => overseasFilter === "all" ? true : overseasFilter === "overseas" ? !!p.overseas : !p.overseas)
      .filter((p) => Number(p.rating) >= ratingMin && Number(p.rating) <= ratingMax)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, search, roleFilter, teamFilter, overseasFilter, ratingMin, ratingMax]);

  const handleSave = async (player: EditablePlayer) => {
    const payload = {
      name: player.name.trim(),
      role: player.role,
      rating: Number(player.rating),
      basePrice: Number(player.basePrice),
      overseas: !!player.overseas,
      image: player.image || "",
      previousTeamId: player.previousTeamId || "",
      pool: player.pool,
    };

    if (player.id) await setDoc(doc(db, "players", player.id), payload, { merge: true });
    else await addDoc(collection(db, "players"), payload);

    setEditing(null);
    setOpenForm(false);
  };

  const handleDelete = async (playerId: string) => {
    await deleteDoc(doc(db, "players", playerId));
  };

  const openCreate = () => {
    setEditing({ ...emptyPlayer });
    setOpenForm(true);
  };

  const openEdit = (player: EditablePlayer) => {
    setEditing(player);
    setOpenForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Players Manager</h2>
          <p className="text-sm text-muted-foreground">Create, edit and filter all players in Firestore.</p>
        </div>
        <Dialog open={openForm} onOpenChange={setOpenForm}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>Add Player</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Edit Player" : "Create Player"}</DialogTitle>
            </DialogHeader>
            {editing && <PlayerForm initial={editing} teams={teams} onSave={handleSave} onCancel={() => setOpenForm(false)} />}
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
        <div className="space-y-1 xl:col-span-2">
          <Label>Search</Label>
          <Input placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label>Role</Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="Batsman">Batsman</SelectItem>
              <SelectItem value="Bowler">Bowler</SelectItem>
              <SelectItem value="All-Rounder">All-Rounder</SelectItem>
              <SelectItem value="Wicket-Keeper">Wicket-Keeper</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Team</Label>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.shortName || team.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Type</Label>
          <Select value={overseasFilter} onValueChange={setOverseasFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="overseas">Overseas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Rating Range</Label>
          <div className="flex gap-2">
            <Input type="number" min={0} max={5} step={0.1} value={ratingMin} onChange={(e) => setRatingMin(Number(e.target.value))} />
            <Input type="number" min={0} max={5} step={0.1} value={ratingMax} onChange={(e) => setRatingMax(Number(e.target.value))} />
          </div>
        </div>
      </div>

      <PlayerTable players={filteredPlayers} teams={teams} onEdit={openEdit} onDelete={handleDelete} />
    </div>
  );
};
