import { Player } from '@/lib/samplePlayers';
import { formatPrice } from '@/lib/constants';
import { User } from 'lucide-react';
import { TeamLogo } from './TeamLogo';

interface PlayerCardProps {
  player: Player;
  currentBid: number;
  currentBidder: string | null;
  currentBidderId?: string | null;
  teamColor?: string;
}

const getRoleIcon = (role: string) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized.includes('wicket')) return '🧤';
  if (normalized.includes('all')) return '🏏⚾';
  if (normalized.includes('bowl')) return '⚾';
  return '🏏';
};

const renderRatingStars = (rating: number) => {
  const filled = Math.max(0, Math.min(5, Math.floor(rating)));
  return (
    <div className="flex items-center gap-1" aria-label={`rating-${filled}-of-5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={index < filled ? 'text-yellow-400 text-lg leading-none' : 'text-gray-500/50 text-lg leading-none'}
        >
          ★
        </span>
      ))}
    </div>
  );
};

export const PlayerCard = ({ player, currentBid, currentBidder, currentBidderId, teamColor }: PlayerCardProps) => {
  const playerImage = (player as any).image || player.imageUrl;
  const playerRating = Number((player as any).rating ?? player.starRating ?? 0);
  const isOverseas = Boolean((player as any).overseas ?? player.isOverseas);
  const previousTeamId = String((player as any).previousTeamId || '').toLowerCase() || null;
  const nationality = String((player as any).nationality || player.nationality || '').trim();

  return (
    <div className="relative card-gradient rounded-2xl border border-border/50 overflow-hidden scale-in">
      <div className="absolute inset-0 broadcast-overlay pointer-events-none opacity-30" />

      <div className="absolute top-4 left-4 z-10">
        <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-primary/20 text-primary rounded-full border border-primary/30">
          {player.pool}
        </span>
      </div>

      <div className="p-8 flex flex-col items-center text-center">
        <div className="text-3xl text-yellow-400 opacity-90 mb-3">{getRoleIcon(player.role)}</div>

        <div className="w-48 h-48 rounded-xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center border-4 border-primary/30 shadow-lg overflow-hidden mb-5">
          {playerImage ? (
            <img
              src={playerImage}
              alt={player.name}
              className="w-48 h-48 rounded-xl object-cover"
              onError={(event) => { event.currentTarget.src = 'https://ui-avatars.com/api/?name=IPL+Player&background=0f172a&color=ffffff&size=256'; }}
            />
          ) : (
            <User className="w-16 h-16 text-muted-foreground" />
          )}
        </div>

        <h2 className="font-display text-4xl text-foreground mb-2 tracking-wide uppercase flex items-center gap-2">
          {player.name}
          {isOverseas && <span className="text-yellow-400 opacity-70 text-lg">✈</span>}
        </h2>

        <div className="mb-3">{renderRatingStars(playerRating)}</div>

        <p className="text-muted-foreground text-sm mb-4">{nationality || 'Unknown'}</p>

        {previousTeamId && (
          <div className="mb-6">
            <TeamLogo teamId={previousTeamId} shortName={(player as any).previousTeam || 'Prev'} className="w-14 h-14" />
          </div>
        )}

        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Base Price</p>
          <p className="text-2xl font-bold text-foreground">{formatPrice(player.basePrice)}</p>
        </div>

        <div className="w-full p-4 rounded-xl bg-secondary/50 border border-border">
          <div className="text-center flex flex-col items-center">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Current Bid</p>
            <p className="font-display text-5xl text-primary text-shadow-glow mb-3">{formatPrice(currentBid)}</p>
            {currentBidder && (
              <div
                className="inline-flex items-center justify-center w-10 h-10 rounded-full pulse-bid"
                style={{ backgroundColor: teamColor ? `hsl(var(--${teamColor}))` : 'hsl(var(--secondary))' }}
                title={currentBidder}
              >
                <TeamLogo teamId={currentBidderId || null} shortName={currentBidder} className="w-10 h-10 border-0 bg-transparent" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
