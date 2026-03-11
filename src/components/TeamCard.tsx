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
  isUserTeam?: boolean;
  logoSize?: 'normal' | 'large';
  onClick?: () => void;
}

export const TeamCard = ({
  id,
  shortName,
  name,
  logo,
  purseRemaining,
  squadSize,
  rtmCards,
  isCurrentBidder,
  isUserTeam = false,
  logoSize = 'normal',
  onClick,
}: TeamCardProps) => {
  const slots = Math.max(0, SQUAD_CONSTRAINTS.MAX_SQUAD - Number(squadSize || 0));

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-full rounded-xl border p-2.5 text-left transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5',
        'bg-[#0B1C3D] border-yellow-500/60',
        isCurrentBidder && 'shadow-[0_0_24px_rgba(234,179,8,0.65)] animate-pulse ring-2 ring-yellow-300/60',
        isUserTeam && 'bg-[#10254f] border-yellow-400 shadow-[0_0_16px_rgba(234,179,8,0.45)]',
      )}
    >
      {isCurrentBidder && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm animate-bounce">🔨</div>}

      <div className="flex items-center gap-2 mb-2">
        <TeamLogo
          teamId={id}
          logo={logo}
          shortName={shortName}
          className={cn(
            'rounded-full border border-yellow-500/60 bg-[#06122b] shrink-0',
            logoSize === 'large' ? 'w-[85px] h-[85px]' : 'w-[60px] h-[60px]',
          )}
        />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-yellow-100 truncate">{name}</p>
          <p className="text-[10px] font-bold tracking-wide text-yellow-300">{shortName}</p>
        </div>
      </div>

      <div className="text-[10px] leading-4 text-slate-200 space-y-0.5">
        <p>Purse: {formatPrice(Number(purseRemaining || 0))}</p>
        <p>Slots: {slots}</p>
        <p>RTM: {Number(rtmCards || 0)}</p>
        <p>Squad: {Number(squadSize || 0)}/{SQUAD_CONSTRAINTS.MAX_SQUAD}</p>
      </div>
    </button>
  );
};
