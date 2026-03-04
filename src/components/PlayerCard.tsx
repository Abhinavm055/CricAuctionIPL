import { Player } from '@/lib/samplePlayers';
import { StarRating } from './StarRating';
import { formatPrice } from '@/lib/constants';
import { User, Globe, MapPin } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  currentBid: number;
  currentBidder: string | null;
  teamColor?: string;
}

export const PlayerCard = ({ player, currentBid, currentBidder, teamColor }: PlayerCardProps) => {
  const roleColors: Record<string, string> = {
    'Batsman': 'from-blue-500 to-blue-600',
    'Bowler': 'from-green-500 to-green-600',
    'All-Rounder': 'from-purple-500 to-purple-600',
    'Wicket-Keeper': 'from-amber-500 to-amber-600',
  };

  return (
    <div className="relative card-gradient rounded-2xl border border-border/50 overflow-hidden scale-in">
      {/* Broadcast overlay effect */}
      <div className="absolute inset-0 broadcast-overlay pointer-events-none opacity-30" />
      
      {/* Pool badge */}
      <div className="absolute top-4 left-4 z-10">
        <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-primary/20 text-primary rounded-full border border-primary/30">
          {player.pool}
        </span>
      </div>

      {/* Overseas indicator */}
      {player.isOverseas && (
        <div className="absolute top-4 right-4 z-10">
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-secondary text-muted-foreground rounded-full flex items-center gap-1">
            <Globe className="w-3 h-3" />
            Overseas
          </span>
        </div>
      )}

      <div className="p-8 flex flex-col items-center">
        {/* Player image placeholder */}
        <div className="relative mb-6">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-secondary to-accent flex items-center justify-center border-4 border-primary/30 shadow-lg">
            <User className="w-16 h-16 text-muted-foreground" />
          </div>
          {/* Role badge */}
          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r ${roleColors[player.role]} text-white text-xs font-bold shadow-lg`}>
            {player.role}
          </div>
        </div>

        {/* Player name */}
        <h2 className="font-display text-4xl text-foreground mb-2 text-center tracking-wide">
          {player.name}
        </h2>

        {/* Star rating */}
        <div className="mb-4">
          <StarRating rating={player.starRating} size="lg" />
        </div>

        {/* Player info */}
        <div className="flex items-center gap-4 text-muted-foreground text-sm mb-6">
          <span className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {player.nationality}
          </span>
          {player.previousTeam && (
            <span className="px-2 py-0.5 bg-secondary rounded text-xs">
              Ex-{player.previousTeam}
            </span>
          )}
        </div>

        {/* Base price */}
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Base Price</p>
          <p className="text-2xl font-bold text-foreground">{formatPrice(player.basePrice)}</p>
        </div>

        {/* Current bid section */}
        <div className="w-full p-4 rounded-xl bg-secondary/50 border border-border">
          <div className="text-center">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Current Bid</p>
            <p className="font-display text-5xl text-primary text-shadow-glow mb-2">
              {formatPrice(currentBid)}
            </p>
            {currentBidder && (
              <div 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full pulse-bid"
                style={{ backgroundColor: teamColor ? `hsl(var(--${teamColor}))` : 'hsl(var(--secondary))' }}
              >
                <span className="text-sm font-bold text-white drop-shadow-md">
                  {currentBidder}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
