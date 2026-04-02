import { Player } from '@/lib/samplePlayers';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/constants';

type AuctionListPlayer = Player & {
  pool?: string;
  overseas?: boolean;
};

interface RemainingPlayersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  upcomingPlayers: Player[];
  unsoldPlayers: Player[];
}

const PlayerList = ({ players, emptyText }: { players: Player[]; emptyText: string }) => {
  if (!players.length) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {players.map((player) => (
        <div key={player.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/10 px-3 py-2">
          <div>
            <p className="font-medium text-sm text-white">{player.name}</p>
            <p className="text-xs text-slate-300">
              {player.role} • {String((player as AuctionListPlayer).pool || 'Pool')}
            </p>
          </div>
          <div className="text-right">
            <Badge variant="secondary" className="mb-1 bg-yellow-500/15 text-yellow-200">
              {formatPrice(Number(player.basePrice || 0))}
            </Badge>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {(((player as AuctionListPlayer).overseas) || player.isOverseas) ? 'Overseas' : 'Indian'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

const RemainingPlayersContent = ({ upcomingPlayers, unsoldPlayers }: Omit<RemainingPlayersPanelProps, 'open' | 'onOpenChange'>) => (
  <div className="space-y-5">
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-white">Upcoming Queue</h3>
        <Badge variant="outline">{upcomingPlayers.length}</Badge>
      </div>
      <PlayerList players={upcomingPlayers} emptyText="No upcoming players left in the queue." />
    </section>

    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-white">Unsold Pool</h3>
        <Badge variant="outline">{unsoldPlayers.length}</Badge>
      </div>
      <PlayerList players={unsoldPlayers} emptyText="No unsold players yet." />
    </section>
  </div>
);

export const RemainingPlayersPanel = ({ open, onOpenChange, upcomingPlayers, unsoldPlayers }: RemainingPlayersPanelProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] border-yellow-500/30 bg-[#071a3a] text-white">
          <DrawerHeader>
            <DrawerTitle>Remaining Players</DrawerTitle>
            <DrawerDescription>
              Track the live queue and the unsold pool without leaving the auction screen.
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <RemainingPlayersContent upcomingPlayers={upcomingPlayers} unsoldPlayers={unsoldPlayers} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-yellow-500/30 bg-[#071a3a] text-white">
        <DialogHeader>
          <DialogTitle>Remaining Players</DialogTitle>
          <DialogDescription>
            Track the live queue and the unsold pool without leaving the auction screen.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <RemainingPlayersContent upcomingPlayers={upcomingPlayers} unsoldPlayers={unsoldPlayers} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
