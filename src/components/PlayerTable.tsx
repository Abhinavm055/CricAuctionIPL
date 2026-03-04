import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EditablePlayer } from "./PlayerForm";

interface TeamRef {
  id: string;
  shortName?: string;
  name: string;
}

interface PlayerTableProps {
  players: EditablePlayer[];
  teams: TeamRef[];
  onEdit: (player: EditablePlayer) => void;
  onDelete: (playerId: string) => Promise<void>;
}

export const PlayerTable = ({ players, teams, onEdit, onDelete }: PlayerTableProps) => {
  const teamNameById = new Map(teams.map((t) => [t.id, t.shortName || t.name]));

  return (
    <div className="border rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Image</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Base Price</TableHead>
            <TableHead>Overseas</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow key={player.id}>
              <TableCell>
                {player.image ? <img src={player.image} alt={player.name} className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-muted" />}
              </TableCell>
              <TableCell>{player.name}</TableCell>
              <TableCell>{player.role}</TableCell>
              <TableCell>{teamNameById.get(player.previousTeamId || "") || "—"}</TableCell>
              <TableCell>{Number(player.rating).toFixed(1)}</TableCell>
              <TableCell>₹{Number(player.basePrice).toLocaleString("en-IN")}</TableCell>
              <TableCell>
                <Badge variant={player.overseas ? "default" : "secondary"}>{player.overseas ? "Overseas" : "Local"}</Badge>
              </TableCell>
              <TableCell className="space-x-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(player)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => player.id && onDelete(player.id)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
