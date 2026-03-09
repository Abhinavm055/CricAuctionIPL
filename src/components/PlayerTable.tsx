import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPrice } from '@/lib/constants';
import { EditablePlayer } from './PlayerForm';
import { TeamLogo } from './TeamLogo';

interface PlayerTableProps {
  players: EditablePlayer[];
  teamNameByPlayerId: Record<string, string>;
  teamIdByPlayerId?: Record<string, string>;
  onEdit: (player: EditablePlayer) => void;
  onDelete: (playerId: string) => Promise<void>;
}

export const PlayerTable = ({ players, teamNameByPlayerId, teamIdByPlayerId = {}, onEdit, onDelete }: PlayerTableProps) => {
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
        {players.map((player) => {
          const playerId = player.id || '';
          const teamName = teamNameByPlayerId[playerId] || 'Unassigned';
          const teamId = teamIdByPlayerId[playerId] || '';

          return (
            <TableRow key={player.id}>
              <TableCell>
                {player.image ? (
                  <img src={player.image || "https://ui-avatars.com/api/?name=IPL+Player&background=0f172a&color=ffffff&size=128"} alt={player.name} className="w-9 h-9 rounded object-cover border" onError={(event) => { event.currentTarget.src = "https://ui-avatars.com/api/?name=IPL+Player&background=0f172a&color=ffffff&size=128"; }} />
                ) : (
                  <div className="w-9 h-9 rounded bg-muted" />
                )}
              </TableCell>
              <TableCell className="font-medium">{player.name}</TableCell>
              <TableCell>{player.role}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <TeamLogo teamId={teamId || null} shortName={teamName} size="sm" />
                  <span>{teamName}</span>
                </div>
              </TableCell>
              <TableCell>{player.rating}</TableCell>
              <TableCell>{formatPrice(Number(player.basePrice || 0))}</TableCell>
              <TableCell>{player.overseas ? <span className="text-yellow-400 text-lg" title="Overseas">✈️</span> : <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="space-x-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(player)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => player.id && onDelete(player.id)}>Delete</Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
