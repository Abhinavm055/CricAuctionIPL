import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPrice } from '@/lib/constants';
import { EditablePlayer } from './PlayerForm';
import { TeamLogo } from './TeamLogo';
import { PlayerInitialsAvatar } from './PlayerInitialsAvatar';
import { Globe2, Edit3, Trash2 } from 'lucide-react';

interface PlayerTableProps {
  players: EditablePlayer[];
  teamNameByPlayerId: Record<string, string>;
  teamIdByPlayerId?: Record<string, string>;
  onEdit: (player: EditablePlayer) => void;
  onDelete: (playerId: string) => Promise<void>;
}

export const PlayerTable = ({ players, teamNameByPlayerId, teamIdByPlayerId = {}, onEdit, onDelete }: PlayerTableProps) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-white/[0.08] hover:bg-transparent">
            <TableHead className="text-slate-400 text-xs uppercase font-bold">Image</TableHead>
            <TableHead className="text-slate-400 text-xs uppercase font-bold">Player Name</TableHead>
            <TableHead className="text-slate-400 text-xs uppercase font-bold">Role</TableHead>
            <TableHead className="text-slate-400 text-xs uppercase font-bold">Franchise</TableHead>
            <TableHead className="text-slate-400 text-xs uppercase font-bold text-center">Rating</TableHead>
            <TableHead className="text-slate-400 text-xs uppercase font-bold">Base Price</TableHead>
            <TableHead className="text-slate-400 text-xs uppercase font-bold text-center">Category</TableHead>
            <TableHead className="text-slate-400 text-xs uppercase font-bold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => {
            const playerId = player.id || '';
            const teamName = teamNameByPlayerId[playerId] || 'Unassigned';
            const teamId = teamIdByPlayerId[playerId] || '';

            return (
              <TableRow key={player.id} className="border-b border-white/[0.04] hover:bg-slate-800/30 transition-colors">
                <TableCell className="py-2.5">
                  <PlayerInitialsAvatar
                    name={player.name}
                    role={player.role}
                    isOverseas={player.overseas}
                    image={player.image || (player as any).imageUrl}
                    size="sm"
                    className="w-9 h-9"
                  />
                </TableCell>
                <TableCell className="font-semibold text-white text-sm">{player.name}</TableCell>
                <TableCell className="text-slate-300 text-xs">{player.role}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <TeamLogo teamId={teamId || null} shortName={teamName} size="sm" />
                    <span className="text-xs text-slate-300 font-medium">{teamName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center font-mono font-bold text-[#F5B82E] text-xs">
                  {'★'.repeat(Math.round(player.rating))}
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-200">
                  {formatPrice(Number(player.basePrice || 0))}
                </TableCell>
                <TableCell className="text-center">
                  {player.overseas ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      <Globe2 className="w-3 h-3" />
                      Overseas
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                      Domestic
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs border-white/[0.12] hover:border-yellow-500/40 text-slate-300"
                    onClick={() => onEdit(player)}
                  >
                    <Edit3 className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 px-2.5 text-xs bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                    onClick={() => player.id && onDelete(player.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
