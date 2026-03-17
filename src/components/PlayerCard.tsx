import { useEffect, useState } from 'react';
import { Player } from '@/lib/samplePlayers';
import { formatPrice } from '@/lib/constants';
import { TeamLogo } from './TeamLogo';

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

const paddleShape = 'polygon(30% 0%, 70% 0%, 100% 34%, 80% 76%, 50% 100%, 20% 76%, 0% 34%)';

export const PlayerCard = ({ player, currentBid, currentBidderId, currentBidderName }: PlayerCardProps) => {
  const playerImage = (player as any).image || player.imageUrl;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [player.id, playerImage]);

  return (
    <div className="w-full h-full rounded-2xl border border-yellow-500/40 text-white shadow-[0_0_28px_rgba(234,179,8,0.2)] overflow-hidden relative">
      {playerImage && !imageFailed ? (
        <img
          src={playerImage}
          alt={player.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b234d] to-[#071a3a]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/45 to-black/75" />

      <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
        <p className="text-[10px] tracking-[0.28em] text-yellow-300">{normalizeRoleLabel(player.role)}</p>
        <h2 className="text-2xl md:text-4xl font-display uppercase tracking-wide">{player.name}</h2>
        <p className="text-sm md:text-base text-slate-100 mt-1">{player.role} / {String((player as any).nationality || player.nationality || 'Unknown')}</p>

        <div className="mt-5">
          <p className="text-[10px] tracking-[0.28em] text-yellow-200 uppercase">Current Bid</p>
          <p key={currentBid} className="text-4xl md:text-5xl font-extrabold text-yellow-300 animate-pulse drop-shadow-[0_0_16px_rgba(250,204,21,0.9)]">
            {formatPrice(currentBid)}
          </p>
        </div>

        <div className="mt-6 h-32 w-28 md:h-40 md:w-32 flex items-center justify-center border border-yellow-400/60 bg-[#0b2045]/90 shadow-[0_0_20px_rgba(250,204,21,0.45)]" style={{ clipPath: paddleShape }}>
          <TeamLogo
            teamId={currentBidderId || null}
            shortName={currentBidderName || 'BID'}
            className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-yellow-300/80 bg-[#06122b]"
          />
        </div>

        <p className="text-xs mt-3 text-yellow-100/85">Base Price {formatPrice(player.basePrice)}</p>
      </div>
    </div>
  );
};
