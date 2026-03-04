import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatPrice, SQUAD_CONSTRAINTS } from "@/lib/constants";
import { Player } from "@/lib/samplePlayers";
import { User } from "lucide-react";

interface TeamDetailsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: any | null;
  retainedPlayers: Player[];
  boughtPlayers: Player[];
  playerPrices: Record<string, number>;
}

const PlayerRow = ({ player, price, type }: { player: Player; price: number; type: "Retained" | "Bought" }) => (
  <div className="flex items-center gap-3 p-2 border rounded-md">
    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
      {player.imageUrl ? <img src={player.imageUrl} className="w-full h-full object-cover" /> : <User className="w-5 h-5" />}
    </div>
    <div className="flex-1">
      <p className="font-medium text-sm">{player.name}</p>
      <p className="text-xs text-muted-foreground">{player.role} • {type}</p>
    </div>
    <p className="text-xs font-semibold">{formatPrice(price || player.basePrice)}</p>
  </div>
);

export const TeamDetailsPanel = ({ open, onOpenChange, team, retainedPlayers, boughtPlayers, playerPrices }: TeamDetailsPanelProps) => {
  if (!team) return null;

  const squadCount = retainedPlayers.length + boughtPlayers.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{team.name}</SheetTitle>
        </SheetHeader>

        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p>Purse: <strong>{formatPrice(team.purseRemaining || 0)}</strong></p>
            <p>Slots: <strong>{Math.max(SQUAD_CONSTRAINTS.MAX_SQUAD - squadCount, 0)}</strong></p>
            <p>RTM: <strong>{team.rtmCards || 0}</strong></p>
            <p>Squad: <strong>{squadCount}/{SQUAD_CONSTRAINTS.MAX_SQUAD}</strong></p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Retained Players</h4>
            <div className="space-y-2">
              {retainedPlayers.length ? retainedPlayers.map((p) => (
                <PlayerRow key={p.id} player={p} price={playerPrices[p.id]} type="Retained" />
              )) : <p className="text-xs text-muted-foreground">No retained players.</p>}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Auction Bought Players</h4>
            <div className="space-y-2">
              {boughtPlayers.length ? boughtPlayers.map((p) => (
                <PlayerRow key={p.id} player={p} price={playerPrices[p.id]} type="Bought" />
              )) : <p className="text-xs text-muted-foreground">No auction purchases yet.</p>}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
