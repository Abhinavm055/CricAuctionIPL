import { formatPrice, SQUAD_CONSTRAINTS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { TeamLogo } from './TeamLogo';

interface TeamCardProps {
  id: string;
  name: string;
  shortName: string;
  color: string;
  logo?: string;
  purseRemaining: number;
  playersCount: number;
  overseasCount: number;
  rtmCards?: number;
  isCurrentBidder: boolean;
  isBidding: boolean;
  isUserTeam: boolean;
  onClick?: () => void;
}

export const TeamCard = ({
  id,
  shortName,
  color,
  logo,
  purseRemaining,
  playersCount,
  overseasCount,
  rtmCards = 0,
  isCurrentBidder,
  isUserTeam,
  onClick,
}: TeamCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative p-3 rounded-xl border transition-all duration-300 w-full text-left bg-card/60',
        isCurrentBidder && 'ring-2 ring-yellow-400/70 border-yellow-400/60',
        isUserTeam && 'ring-2 ring-primary border-primary/70',
      )}
      style={{ boxShadow: isCurrentBidder ? `0 0 20px hsl(var(--${color}) / 0.35)` : undefined }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <TeamLogo teamId={id} logo={logo} shortName={shortName} size="sm" className="rounded-full" />
        <p className="font-display text-sm" style={{ color: `hsl(var(--${color}))` }}>{shortName}</p>
      </div>

      <p className="text-xs font-semibold mb-1">{formatPrice(purseRemaining)}</p>
      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <p>Squad {playersCount}/{SQUAD_CONSTRAINTS.MAX_SQUAD}</p>
        <p>OS {overseasCount}/{SQUAD_CONSTRAINTS.MAX_OVERSEAS} • RTM {rtmCards}</p>
      </div>

      {isUserTeam && (
        <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-bold">YOU</span>
      )}
    </button>
  );
};
