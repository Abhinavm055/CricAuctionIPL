import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPrice } from '@/lib/constants';
import { EditablePlayer } from './PlayerForm';

interface PlayerTableProps {
  players: EditablePlayer[];
  teamNameByPlayerId: Record<string, string>;
  onEdit: (player: EditablePlayer) => void;
  onDelete: (playerId: string) => Promise<void>;
}

export const PlayerTable = ({ players, teamNameByPlayerId, onEdit, onDelete }: PlayerTableProps) => {
  return (
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
              {player.image ? (
                <img src={player.image} alt={player.name} className="w-9 h-9 rounded object-cover border" />
              ) : (
                <div className="w-9 h-9 rounded bg-muted" />
              )}
            </TableCell>
            <TableCell className="font-medium">{player.name}</TableCell>
            <TableCell>{player.role}</TableCell>
            <TableCell>{teamNameByPlayerId[player.id || ''] || 'Unassigned'}</TableCell>
            <TableCell>{player.rating}</TableCell>
            <TableCell>{formatPrice(Number(player.basePrice || 0))}</TableCell>
            <TableCell>{player.overseas ? 'Overseas' : 'Local'}</TableCell>
            <TableCell className="space-x-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(player)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => player.id && onDelete(player.id)}>Delete</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
