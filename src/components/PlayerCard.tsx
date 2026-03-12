import { useEffect, useState } from 'react';
import { Player } from '@/lib/samplePlayers';
import { formatPrice } from '@/lib/constants';
import { TeamLogo } from './TeamLogo';
import { cn } from '@/lib/utils';

interface PlayerCardProps {
  player: Player;
  currentBid: number;
  currentBidderId?: string | null;
  currentBidderName?: string | null;
}

const normalizeRoleLabel = (role: string) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized.includes('wicket')) return 'WICKETKEEPER';
  if (normalized.includes('all')) return 'ALLROUNDER';
  if (normalized.includes('bowl')) return 'BOWLER';
  return 'BATTER';
};

const renderStars = (rating: number) => {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return Array.from({ length: 5 }).map((_, idx) => (
    <span key={idx} className={idx < filled ? 'text-yellow-400' : 'text-gray-500'}>★</span>
  ));
};

export const PlayerCard = ({ player, currentBid, currentBidderId, currentBidderName }: PlayerCardProps) => {
  const playerImage = (player as any).image || player.imageUrl;
  const playerRating = Number((player as any).rating ?? player.starRating ?? 0);
  const isOverseas = Boolean((player as any).overseas ?? player.isOverseas);
  const previousTeamId = String((player as any).previousTeamId || '').toLowerCase() || null;
  const previousTeamName = String((player as any).previousTeam || 'PREV');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [player.id, playerImage]);

  return (
    <div className="w-full h-full rounded-2xl border border-yellow-500/40 bg-[#071a3a] text-white shadow-[0_0_28px_rgba(234,179,8,0.2)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-yellow-500/30 px-4 md:px-5 py-3">
        <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-black">
          {normalizeRoleLabel(player.role)}
        </span>
        <div className="flex items-center gap-2">
          {isOverseas && <span className="text-yellow-400 text-xl leading-none">✈</span>}
          <TeamLogo teamId={previousTeamId} shortName={previousTeamName} className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-yellow-400/40" />
        </div>
      </div>

      <div className="p-4 md:p-5 h-[calc(100%-52px)]">
        <div className="h-full flex flex-col md:flex-row gap-4 md:gap-5 items-stretch">
          <div className="w-full md:w-[180px] h-[220px] rounded-xl overflow-hidden border border-yellow-500/30 bg-slate-900 flex items-center justify-center shrink-0 mx-auto md:mx-0">
            {playerImage && !imageFailed ? (
              <img
                src={playerImage}
                alt={player.name}
                className="w-full h-full object-cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <img src="/placeholder.svg" alt="Player placeholder" className="w-20 h-20 opacity-80" />
            )}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-display uppercase tracking-wide">{player.name}</h2>
            <p className="text-xl leading-none">{renderStars(playerRating)}</p>
            <p className="text-sm text-slate-200">{String((player as any).nationality || player.nationality || 'Unknown')}</p>
            <p className="text-base font-semibold text-yellow-200">Base Price {formatPrice(player.basePrice)}</p>

            <div className="pt-3">
              <p className="text-xs tracking-widest text-slate-300 uppercase">Current Bid</p>
              <p
                key={currentBid}
                className="text-3xl md:text-4xl font-bold text-yellow-400 text-center animate-pulse drop-shadow-[0_0_14px_rgba(250,204,21,0.75)]"
              >
                {formatPrice(currentBid)}
              </p>
            </div>
          </div>

          <div className="w-full md:w-[180px] h-[220px] flex items-center justify-center shrink-0">
            <TeamLogo
              teamId={currentBidderId || null}
              shortName={currentBidderName || 'BID'}
              className={cn(
                'w-[180px] h-[220px] rounded-xl border-2 border-yellow-400/70 p-4 bg-[#0b2045] object-contain transition',
                currentBidderId && 'shadow-[0_0_24px_rgba(250,204,21,0.55)] animate-pulse',
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
