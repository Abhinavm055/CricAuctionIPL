import { cn } from '@/lib/utils';
import { TeamLogo } from './TeamLogo';

interface TeamCardProps {
  id: string;
  shortName: string;
  logo?: string;
  isCurrentBidder: boolean;
  isUserTeam?: boolean;
  logoSize?: 'normal' | 'large';
  onClick?: () => void;
}

export const TeamCard = ({
  id,
  shortName,
  logo,
  isCurrentBidder,
  isUserTeam = false,
  logoSize = 'normal',
  onClick,
}: TeamCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-full rounded-xl border p-3 text-center transition-all',
        'bg-[#0B1C3D] border-yellow-500/60',
        isCurrentBidder && 'shadow-[0_0_24px_rgba(234,179,8,0.65)] animate-pulse',
        isUserTeam && 'bg-[#10254f] border-yellow-400 shadow-[0_0_16px_rgba(234,179,8,0.45)]',
      )}
    >
      {isCurrentBidder && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm">🔨</div>}

      <TeamLogo
        teamId={id}
        logo={logo}
        shortName={shortName}
        className={cn(
          'mx-auto rounded-full border border-yellow-500/60 bg-[#06122b]',
          logoSize === 'large' ? 'w-[85px] h-[85px]' : 'w-[60px] h-[60px]',
        )}
      />
      <p className="mt-2 text-xs font-bold tracking-wide text-yellow-200">{shortName}</p>
    </button>
  );
};
