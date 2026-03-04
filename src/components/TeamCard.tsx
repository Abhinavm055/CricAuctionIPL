import { formatPrice } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface TeamCardProps {
  id: string;
  name: string;
  shortName: string;
  color: string;
  purseRemaining: number;
  playersCount: number;
  overseasCount: number;
  isCurrentBidder: boolean;
  isBidding: boolean;
  isUserTeam: boolean;
  onClick?: () => void;
}

export const TeamCard = ({
  shortName,
  color,
  purseRemaining,
  playersCount,
  overseasCount,
  isCurrentBidder,
  isBidding,
  isUserTeam,
  onClick,
}: TeamCardProps) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer",
        "card-gradient",
        isCurrentBidder && "glow-gold",
        isBidding && "flag-raised",
        !isBidding && isCurrentBidder && "flag-lowered",
        isUserTeam && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        `border-${color}/50 hover:border-${color}`
      )}
      style={{
        borderColor: isCurrentBidder ? `hsl(var(--${color}))` : undefined,
        boxShadow: isCurrentBidder ? `0 0 30px hsl(var(--${color}) / 0.5)` : undefined,
      }}
    >
      {/* Flag indicator */}
      <div
        className={cn(
          "absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-8 rounded-sm transition-all duration-300",
          isBidding ? "opacity-100 -translate-y-2" : "opacity-0 translate-y-0"
        )}
        style={{ backgroundColor: `hsl(var(--${color}))` }}
      />

      {/* Team badge */}
      <div
        className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-display text-xl"
        style={{ 
          backgroundColor: `hsl(var(--${color}) / 0.2)`,
          color: `hsl(var(--${color}))`,
          border: `2px solid hsl(var(--${color}))`,
        }}
      >
        {shortName.charAt(0)}
      </div>

      {/* Team name */}
      <h3 
        className="font-display text-lg text-center mb-2"
        style={{ color: `hsl(var(--${color}))` }}
      >
        {shortName}
      </h3>

      {/* Purse */}
      <p className="text-center text-sm font-semibold text-foreground mb-1">
        {formatPrice(purseRemaining)}
      </p>

      {/* Squad info */}
      <div className="flex justify-center gap-2 text-xs text-muted-foreground">
        <span>{playersCount}/25</span>
        <span>•</span>
        <span>{overseasCount}/8 OS</span>
      </div>

      {/* User indicator */}
      {isUserTeam && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full">
          YOU
        </div>
      )}
    </div>
  );
};
