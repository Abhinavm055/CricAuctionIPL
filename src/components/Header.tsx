import { Moon, Sun, FastForward, ChevronRight, PauseCircle, PlayCircle, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';

interface HeaderProps {
  gameCode: string;
  currentSetLabel?: string;
  onNextSet?: () => void;
  onSkipSet?: () => void;
  onPauseToggle?: () => void;
  isPaused?: boolean;
  canControl?: boolean;
  canNextSet?: boolean;
  canSkipSet?: boolean;
  onLeaveGame?: () => void;
  onMenuClick?: () => void;
}

const controlButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 text-[hsl(var(--foreground))]/85 transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 hover:bg-[hsl(var(--accent))]/20 disabled:cursor-not-allowed disabled:opacity-40';

export const Header = ({
  gameCode,
  currentSetLabel,
  onNextSet,
  onSkipSet,
  onPauseToggle,
  isPaused,
  canControl,
  canNextSet = false,
  canSkipSet = false,
  onLeaveGame,
  onMenuClick,
}: HeaderProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  return (
    <header className="h-12 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 px-2 text-[hsl(var(--foreground))] backdrop-blur md:px-4">
      <div className="flex h-full items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2 text-[10px] md:text-xs uppercase tracking-wide text-[hsl(var(--foreground))]/80">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="h-7 w-7 rounded-md border border-[hsl(var(--border))] text-sm hover:bg-[hsl(var(--accent))] md:hidden"
              aria-label="Open teams menu"
            >
              ☰
            </button>
          )}
          <p className="font-display whitespace-nowrap text-xs text-[hsl(var(--foreground))] md:text-sm normal-case">CricAuctionIPL</p>
          <span className="text-[hsl(var(--foreground))]/35">|</span>
          <span className="rounded-full bg-[hsl(var(--primary))]/12 px-2 py-0.5 font-bold text-[hsl(var(--primary))] whitespace-nowrap normal-case">{gameCode}</span>
          <span className="text-[hsl(var(--foreground))]/35">|</span>
          <span className="truncate normal-case">{currentSetLabel || 'General Set'}</span>
        </div>

        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          {onNextSet && (
            <button title="Next Player" onClick={onNextSet} disabled={!canControl || !canNextSet} className={controlButtonClass}>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {onSkipSet && (
            <button title="Skip Set" onClick={onSkipSet} disabled={!canControl || !canSkipSet} className={controlButtonClass}>
              <FastForward className="h-4 w-4" />
            </button>
          )}
          <button title={isPaused ? 'Resume Auction' : 'Pause Auction'} onClick={onPauseToggle} disabled={!canControl || !onPauseToggle} className={controlButtonClass}>
            {isPaused ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
          </button>
          <button title="Leave Game" onClick={onLeaveGame} className={`${controlButtonClass} text-red-400 hover:text-red-300`}>
            <LogOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-[hsl(var(--border))] text-[hsl(var(--foreground))]/80 hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
