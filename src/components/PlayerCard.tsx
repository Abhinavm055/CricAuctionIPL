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

const normalizeRoleLabel = (role: string) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized.includes('wicket')) return 'WICKETKEEPER';
  if (normalized.includes('all')) return 'ALLROUNDER';
  if (normalized.includes('bowl')) return 'BOWLER';
  return 'BATTER';
};

const renderRatingStars = (rating: number) => {
  const filled = Math.max(0, Math.min(5, Math.floor(rating)));
  return (
    <div className="flex items-center gap-1" aria-label={`rating-${filled}-of-5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={index < filled ? 'text-yellow-400' : 'text-gray-500/50'}>
          ⭐
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
  const nationality = String((player as any).nationality || player.nationality || '').trim() || 'Unknown';

  return (
    <div className="relative w-full card-gradient rounded-2xl border border-border/50 overflow-hidden scale-in">
      <div className="absolute inset-0 broadcast-overlay pointer-events-none opacity-20" />

      <div className="relative p-5">
        <div className="flex items-center gap-2 mb-4">
          <TeamLogo teamId={previousTeamId} shortName={(player as any).previousTeam || 'TEAM'} size="sm" />
          <span className="px-3 py-1 text-xs font-bold tracking-wide rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-400/30">
            {normalizeRoleLabel(player.role)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5 items-start">
          <div className="space-y-4">
            <div className="w-48 h-48 rounded-xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center border border-primary/30 shadow-lg overflow-hidden mx-auto md:mx-0">
              {playerImage ? (
                <img
                  src={playerImage}
                  alt={player.name}
                  className="w-48 h-48 rounded-xl object-cover"
                  onError={(event) => {
                    event.currentTarget.src = 'https://ui-avatars.com/api/?name=IPL+Player&background=0f172a&color=ffffff&size=256';
                  }}
                />
              ) : (
                <User className="w-16 h-16 text-muted-foreground" />
              )}
            </div>

            <div className="rounded-xl border border-border/70 bg-secondary/40 p-3 space-y-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Base Price</p>
                <p className="text-lg font-semibold">{formatPrice(player.basePrice)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Current Bid</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(currentBid)}</p>
              </div>
              {currentBidder && (
                <div className="pt-1">
                  <div
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full"
                    style={{ backgroundColor: teamColor ? `hsl(var(--${teamColor}))` : 'hsl(var(--secondary))' }}
                    title={currentBidder}
                  >
                    <TeamLogo teamId={currentBidderId || null} shortName={currentBidder} className="w-10 h-10 border-0 bg-transparent" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h2 className="font-display text-3xl lg:text-4xl text-foreground tracking-wide uppercase flex items-center gap-2 flex-wrap">
              {player.name}
              {isOverseas && <span className="text-yellow-400/80 text-lg">✈</span>}
            </h2>
            {renderRatingStars(playerRating)}
            <p className="text-sm text-muted-foreground">{nationality}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
