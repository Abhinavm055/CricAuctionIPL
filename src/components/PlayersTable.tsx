import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EditablePlayer } from './PlayerEditor';

interface PlayersTableProps {
  players: EditablePlayer[];
  onEdit: (player: EditablePlayer) => void;
  onDelete: (playerId: string) => Promise<void>;
}

export const PlayersTable = ({ players, onEdit, onDelete }: PlayersTableProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Rating</TableHead>
          <TableHead>Base Price</TableHead>
          <TableHead>Pool</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {players.map((player) => (
          <TableRow key={player.id}>
            <TableCell>{player.name}</TableCell>
            <TableCell>{player.role}</TableCell>
            <TableCell>{player.rating}</TableCell>
            <TableCell>{player.basePrice}</TableCell>
            <TableCell>{player.pool}</TableCell>
            <TableCell className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(player)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => player.id && onDelete(player.id)}>Delete</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
