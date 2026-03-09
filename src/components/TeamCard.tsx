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
  shortName,
  color,
  logo,
  purseRemaining,
  playersCount,
  overseasCount,
  rtmCards = 0,
  isCurrentBidder,
  isBidding,
  isUserTeam,
  onClick,
}: TeamCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-xl border-2 transition-all duration-300 w-full text-left",
        "card-gradient",
        isCurrentBidder && "glow-gold",
        isBidding && "flag-raised",
        !isBidding && isCurrentBidder && "flag-lowered",
        isUserTeam && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      style={{
        borderColor: isCurrentBidder ? `hsl(var(--${color}))` : undefined,
        boxShadow: isCurrentBidder ? `0 0 30px hsl(var(--${color}) / 0.5)` : undefined,
      }}
    >
      <div
        className={cn(
          "absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-8 rounded-sm transition-all duration-300",
          isBidding ? "opacity-100 -translate-y-2" : "opacity-0 translate-y-0"
        )}
        style={{ backgroundColor: `hsl(var(--${color}))` }}
      />

      <TeamLogo teamId={id} logo={logo} shortName={shortName} size="lg" className="mx-auto mb-2 rounded-full" />

      <h3 className="font-display text-base text-center mb-2" style={{ color: `hsl(var(--${color}))` }}>
        {shortName}
      </h3>

      <p className="text-center text-sm font-semibold text-foreground mb-2">{formatPrice(purseRemaining)}</p>

      <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground text-center">
        <span>{playersCount}/{SQUAD_CONSTRAINTS.MAX_SQUAD}</span>
        <span>{overseasCount}/{SQUAD_CONSTRAINTS.MAX_OVERSEAS} OS</span>
        <span className="col-span-2">RTM: {rtmCards}</span>
      </div>

      {isUserTeam && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full">
          YOU
        </div>
      )}
    </button>
  );
};
