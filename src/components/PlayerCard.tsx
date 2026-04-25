import { useEffect, useState } from 'react';
import { Player } from '@/lib/samplePlayers';
import { formatPrice } from '@/lib/constants';
import { TeamLogo } from './TeamLogo';
import { StarRating } from './StarRating';

interface PlayerCardProps {
  player: Player;
  currentBid: number;
  currentBidderId?: string | null;
  currentBidderName?: string | null;
}

const normalizeRoleLabel = (role: string) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized.includes('wicket')) return 'WK';
  if (normalized.includes('all')) return 'AR';
  if (normalized.includes('bowl')) return 'BOWL';
  return 'BAT';
};

export const PlayerCard = ({ player, currentBid, currentBidderId, currentBidderName }: PlayerCardProps) => {
  const playerImage = (player as any).image || player.imageUrl;
  const [imageFailed, setImageFailed] = useState(false);
  const rating = Number((player as any).starRating ?? player.rating ?? 3) as 1 | 2 | 3 | 4 | 5;

  useEffect(() => {
    setImageFailed(false);
  }, [player.id, playerImage]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-[hsl(var(--border))] text-[hsl(var(--foreground))]">
      {playerImage && !imageFailed ? (
        <img
          src={playerImage}
          alt={player.name}
          className="absolute inset-0 h-full w-full object-cover object-top"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--background))_100%)]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/80 dark:from-black/20 dark:via-black/20 dark:to-black/85" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />

      <div className="relative flex h-full flex-col px-4 py-4">
        <div className="flex items-start justify-between">
          <div className="rounded-xl bg-black/30 p-1.5 backdrop-blur-sm">
            <TeamLogo teamId={currentBidderId || null} shortName={currentBidderName || 'TEAM'} size="sm" className="h-8 w-8 rounded-lg border-white/15 bg-white/10" />
          </div>
          <span className="rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-semibold tracking-[0.24em] text-white backdrop-blur-sm">
            {normalizeRoleLabel(player.role)}
          </span>
        </div>

        <div className="mt-auto space-y-3 text-center">
          <div className="space-y-1">
            <h2 className="text-2xl font-display uppercase tracking-wide md:text-4xl">{player.name}</h2>
            <div className="flex justify-center">
              <StarRating rating={rating} size="sm" />
            </div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/80">{String((player as any).nationality || player.nationality || 'Unknown')}</p>
          </div>

          <div className="grid gap-2 text-xs">
            <div className="rounded-xl bg-black/35 px-3 py-2 backdrop-blur-sm">
              <span className="text-white/70">Base Price:</span> <span className="font-semibold text-white">{formatPrice(player.basePrice)}</span>
            </div>
            <div className="rounded-xl border border-[#FFD70055] bg-[#261d05aa] px-3 py-2 backdrop-blur-sm">
              <span className="text-white/70">Current Bid:</span>{" "}
              <span className="bid-value-pulse text-lg font-bold text-[#FFD700] md:text-xl">{formatPrice(currentBid)}</span>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-xl bg-black/35 px-3 py-2 backdrop-blur-sm">
              <span className="text-white/70">Leading:</span>
              <TeamLogo teamId={currentBidderId || null} shortName={currentBidderName || 'BID'} size="sm" className="h-7 w-7 rounded-full border-white/20 bg-white/10" />
              <span className="font-semibold text-white">{currentBidderName || 'OPEN'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
