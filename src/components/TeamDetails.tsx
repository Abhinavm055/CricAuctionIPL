import { useMemo, useState } from "react";
import { doc, runTransaction, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeamLogo } from "./TeamLogo";
import { EditablePlayer, PlayerForm } from "./PlayerForm";

interface TeamData {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  players?: string[];
}

interface TeamDetailsProps {
  team: TeamData;
  allPlayers: EditablePlayer[];
}

export const TeamDetails = ({ team, allPlayers }: TeamDetailsProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editing, setEditing] = useState<EditablePlayer | null>(null);

  const teamPlayers = useMemo(() => {
    const ids = new Set(team.players || []);
    return allPlayers.filter((p) => p.id && ids.has(p.id));
  }, [team.players, allPlayers]);

  const addablePlayers = useMemo(() => {
    const ids = new Set(team.players || []);
    return allPlayers
      .filter((p) => p.id && !ids.has(p.id))
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      .filter((p) => roleFilter === "all" ? true : p.role === roleFilter);
  }, [allPlayers, team.players, search, roleFilter]);

  const addPlayerToTeam = async (playerId: string) => {
    await runTransaction(db, async (tx) => {
      const teamRef = doc(db, "teams", team.id);
      const snap = await tx.get(teamRef);
      if (!snap.exists()) throw new Error("Team not found");
      const players = (snap.data().players || []) as string[];
      if (players.includes(playerId)) return;
      tx.update(teamRef, { players: [...players, playerId] });
    });

    await setDoc(doc(db, "players", playerId), { previousTeamId: team.id }, { merge: true });
  };

  const removePlayerFromTeam = async (playerId: string) => {
    await runTransaction(db, async (tx) => {
      const teamRef = doc(db, "teams", team.id);
      const snap = await tx.get(teamRef);
      if (!snap.exists()) throw new Error("Team not found");
      const players = (snap.data().players || []) as string[];
      tx.update(teamRef, { players: players.filter((id) => id !== playerId) });
    });

    await setDoc(doc(db, "players", playerId), { previousTeamId: "" }, { merge: true });
  };

  const saveEditedPlayer = async (player: EditablePlayer) => {
    if (!player.id) return;
    await setDoc(
      doc(db, "players", player.id),
      {
        name: player.name,
        role: player.role,
        rating: Number(player.rating),
        basePrice: Number(player.basePrice),
        overseas: !!player.overseas,
        image: player.image || "",
        previousTeamId: player.previousTeamId || team.id,
        pool: player.pool,
      },
      { merge: true }
    );
    setEditing(null);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Manage Team</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <TeamLogo logo={team.logo} shortName={team.shortName} size="lg" />
            <span>{team.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Players: {teamPlayers.length}</p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Add Player</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Player to {team.shortName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Search by player name" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger><SelectValue placeholder="Filter by role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="Batsman">Batsman</SelectItem>
                    <SelectItem value="Bowler">Bowler</SelectItem>
                    <SelectItem value="All-Rounder">All-Rounder</SelectItem>
                    <SelectItem value="Wicket-Keeper">Wicket-Keeper</SelectItem>
                  </SelectContent>
                </Select>

                <div className="max-h-72 overflow-auto space-y-2">
                  {addablePlayers.map((player) => (
                    <div key={player.id} className="border rounded p-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {player.image ? <img src={player.image} alt={player.name} className="w-9 h-9 rounded object-cover" /> : <div className="w-9 h-9 rounded bg-muted" />}
                        <div>
                          <p className="text-sm font-medium">{player.name}</p>
                          <p className="text-xs text-muted-foreground">{player.role}</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => player.id && addPlayerToTeam(player.id)}>Add</Button>
                    </div>
                  ))}
                  {!addablePlayers.length && <p className="text-sm text-muted-foreground">No matching players.</p>}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="border rounded-xl overflow-hidden">
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
                  <TableCell>{player.image ? <img src={player.image} alt={player.name} className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-muted" />}</TableCell>
                  <TableCell>{player.name}</TableCell>
                  <TableCell>{player.role}</TableCell>
                  <TableCell>{Number(player.rating).toFixed(1)}</TableCell>
                  <TableCell>₹{Number(player.basePrice).toLocaleString("en-IN")}</TableCell>
                  <TableCell>{player.overseas ? "Overseas" : "Local"}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(player)}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => player.id && removePlayerFromTeam(player.id)}>Remove</Button>
                  </TableCell>
                </TableRow>
              ))}
              {!teamPlayers.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">No players assigned to this team.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {editing && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Edit Player</h4>
            <PlayerForm
              initial={editing}
              teams={[{ id: team.id, name: team.name, shortName: team.shortName }]}
              onSave={saveEditedPlayer}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
