import { useEffect, useState } from 'react';
import { Player } from '@/lib/samplePlayers';
import { formatPrice } from '@/lib/constants';
import { User } from 'lucide-react';
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
  const nationality = String((player as any).nationality || player.nationality || 'Unknown');

  return (
    <div className="w-full h-full rounded-2xl border border-yellow-500/40 bg-[#071a3a] text-white shadow-[0_0_28px_rgba(234,179,8,0.2)] overflow-hidden">
      <div className="h-full grid grid-rows-[auto_1fr_auto]">
        <div className="flex items-center justify-between border-b border-yellow-500/30 px-5 py-3">
          <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-black">
            {normalizeRoleLabel(player.role)}
          </span>
          <div className="flex items-center gap-2">
            {isOverseas && <span className="text-yellow-400">✈</span>}
            <TeamLogo teamId={previousTeamId} shortName={(player as any).previousTeam || 'PREV'} className="w-12 h-12 rounded-full" />
          </div>
        </div>

        <div className="grid grid-cols-[190px_1fr] gap-5 p-5 items-start min-h-0">
          <div className="w-[180px] h-[220px] rounded-xl overflow-hidden border border-yellow-500/30 bg-slate-900 flex items-center justify-center">
            {playerImage ? (
              <img
                src={playerImage}
                alt={player.name}
                className="w-[180px] h-[220px] object-cover"
                onError={(event) => {
                  event.currentTarget.src = 'https://ui-avatars.com/api/?name=IPL+Player&background=0f172a&color=ffffff&size=256';
                }}
              />
            ) : (
              <User className="w-14 h-14 text-slate-400" />
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-3xl font-display uppercase tracking-wide">{player.name}</h2>
              <TeamLogo teamId={currentBidderId || null} shortName={currentBidderName || 'BID'} className="w-16 h-16 rounded-full border-2 border-yellow-400/70" />
            </div>
            <p className="text-xl leading-none">{renderStars(playerRating)}</p>
            <p className="text-sm text-slate-200">{nationality}</p>
            <p className="text-base font-semibold text-yellow-200">BASE PRICE: {formatPrice(player.basePrice)}</p>
          </div>
        </div>

        <div className="border-t border-yellow-500/30 px-5 py-4">
          <p className="text-xs text-slate-300 tracking-wide">CURRENT BID</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[32px] font-bold text-yellow-300 drop-shadow-[0_0_12px_rgba(250,204,21,0.75)] animate-pulse">
              {formatPrice(currentBid)}
            </p>
            <TeamLogo teamId={currentBidderId || null} shortName={currentBidderName || 'BID'} className="w-[50px] h-[50px] rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
