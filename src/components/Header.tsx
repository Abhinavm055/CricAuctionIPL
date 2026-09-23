import { Moon, Sun, FastForward, ChevronRight, PauseCircle, PlayCircle, LogOut, Square } from 'lucide-react';
import { useTheme } from 'next-themes';

interface HeaderProps {
  gameCode: string;
  currentSetLabel?: string;
  hideGameCode?: boolean;
  onAdvancePlayer?: () => void;
  onSkipSet?: () => void;
  onPauseToggle?: () => void;
  isPaused?: boolean;
  canControl?: boolean;
  canAdvancePlayer?: boolean;
  canSkipSet?: boolean;
  onLeaveGame?: () => void;
  onEndGame?: () => void;
  onMenuClick?: () => void;
}

const controlButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#09152A] text-slate-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/40 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-30';

export const Header = ({
  gameCode,
  currentSetLabel,
  hideGameCode = false,
  onAdvancePlayer,
  onSkipSet,
  onPauseToggle,
  isPaused,
  canControl,
  canAdvancePlayer = false,
  canSkipSet = false,
  onLeaveGame,
  onEndGame,
  onMenuClick,
}: HeaderProps) => {
  return (
    <header className="h-12 border-b border-white/[0.08] bg-[#020817]/95 px-3 text-slate-200 backdrop-blur-md md:px-5">
      <div className="flex h-full items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2.5 text-[10px] md:text-xs uppercase tracking-wider text-slate-400">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="h-7 w-7 rounded-lg border border-white/10 bg-[#09152A] text-slate-300 text-sm hover:border-amber-400/40 hover:text-amber-400 md:hidden flex items-center justify-center"
              aria-label="Open teams menu"
            >
              ☰
            </button>
          )}
          <span className="font-display font-black text-xs md:text-sm tracking-widest text-white uppercase">CricAuctionIPL</span>
          {!hideGameCode && (
            <>
              <span className="text-white/20">|</span>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 font-mono font-black text-[11px] text-amber-400 tracking-wider">
                {gameCode}
              </span>
            </>
          )}
          <span className="text-white/20">|</span>
          <span className="truncate font-semibold text-slate-300">{currentSetLabel || 'General Set'}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onAdvancePlayer && (
            <button title="Skip / Next Player" onClick={onAdvancePlayer} disabled={!canControl || !canAdvancePlayer} className={controlButtonClass}>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {onSkipSet && (
            <button title="Skip Set" onClick={onSkipSet} disabled={!canControl || !canSkipSet} className={controlButtonClass}>
              <FastForward className="h-4 w-4" />
            </button>
          )}
          <button title={isPaused ? 'Resume Auction' : 'Pause Auction'} onClick={onPauseToggle} disabled={!canControl || !onPauseToggle} className={controlButtonClass}>
            {isPaused ? <PlayCircle className="h-4 w-4 text-amber-400" /> : <PauseCircle className="h-4 w-4" />}
          </button>
          {onEndGame && (
            <button title="End Game" onClick={onEndGame} disabled={!canControl} className={`${controlButtonClass} text-amber-400 hover:text-amber-300 hover:border-amber-400/40`}>
              <Square className="h-3.5 w-3.5" />
            </button>
          )}
          <button title="Leave Game" onClick={onLeaveGame} className={`${controlButtonClass} text-red-400 hover:text-red-300 hover:border-red-500/40`}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
