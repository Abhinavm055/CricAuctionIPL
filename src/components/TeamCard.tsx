import { memo } from 'react';
import { formatPrice, SQUAD_CONSTRAINTS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { TeamLogo } from './TeamLogo';

interface TeamCardProps {
  id: string;
  shortName: string;
  name: string;
  logo?: string;
  purseRemaining: number;
  squadSize: number;
  rtmCards: number;
  isCurrentBidder: boolean;
  shouldGlow?: boolean;
  isUserTeam?: boolean;
  onClick?: () => void;
}

const TeamCardComponent = ({
  id,
  shortName,
  name,
  logo,
  purseRemaining,
  squadSize,
  rtmCards,
  isCurrentBidder,
  shouldGlow = false,
  isUserTeam = false,
  onClick,
}: TeamCardProps) => {
  const slots = Math.max(0, SQUAD_CONSTRAINTS.MAX_SQUAD - Number(squadSize || 0));

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-full rounded-xl border p-2 text-left transition-all',
        'bg-[#0B1C3D] border-yellow-500/60 hover:scale-[1.03] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(251,191,36,0.5)] hover:border-yellow-400/80',
        isCurrentBidder && 'shadow-[0_0_24px_rgba(234,179,8,0.65)] animate-pulse',
        shouldGlow && 'animate-[teamBidGlow_0.9s_ease-out]',
        isUserTeam && 'bg-[#10254f] border-yellow-400 shadow-[0_0_16px_rgba(234,179,8,0.45)]',
      )}
    >
      {isCurrentBidder && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm">🔨</div>}

      <div className="flex items-center gap-2 mb-2">
        <TeamLogo
          teamId={id}
          logo={logo}
          shortName={shortName}
          className={cn(
            'rounded-full border border-yellow-500/60 bg-[#06122b] shrink-0',
            'w-[44px] h-[44px] md:w-[52px] md:h-[52px]',
          )}
        />
        <div className="min-w-0">
          <p className="text-[9px] md:text-[10px] font-semibold text-yellow-100 truncate">{name}</p>
          <p className="text-[10px] font-bold tracking-wide text-yellow-300">{shortName}</p>
        </div>
      </div>

      <div className="text-[9px] md:text-[10px] leading-4 text-slate-200 space-y-0.5">
        <p>Purse: {formatPrice(Number(purseRemaining || 0))}</p>
        <p>Slots: {slots}</p>
        <p>RTM: {Number(rtmCards || 0)}</p>
        <p>Squad: {Number(squadSize || 0)}/{SQUAD_CONSTRAINTS.MAX_SQUAD}</p>
      </div>
    </button>
  );
};

export const TeamCard = memo(TeamCardComponent);
