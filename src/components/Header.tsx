interface HeaderProps {
  gameCode: string;
  currentSetLabel?: string;
  onSkip?: () => void;
  onPauseToggle?: () => void;
  isPaused?: boolean;
  canControl?: boolean;
  canSkip?: boolean;
  onLeaveGame?: () => void;
  onMenuClick?: () => void;
}

export const Header = ({ gameCode, currentSetLabel, onSkip, onPauseToggle, isPaused, canControl, canSkip = true, onLeaveGame, onMenuClick }: HeaderProps) => {
  return (
    <header className="h-12 border-b border-yellow-500/40 bg-[#061734] px-2 md:px-4 text-yellow-100">
      <div className="h-full flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2 text-[10px] md:text-xs uppercase tracking-wide">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="h-7 w-7 rounded-md border border-yellow-500/60 text-sm hover:bg-yellow-400/10 md:hidden"
              aria-label="Open teams menu"
            >
              ☰
            </button>
          )}
          <p className="font-display text-yellow-300 whitespace-nowrap text-xs md:text-sm normal-case">CricAuctionIPL</p>
          <span className="text-yellow-500/70">|</span>
          <span className="rounded-full bg-yellow-400 text-black px-2 py-0.5 font-bold whitespace-nowrap normal-case">{gameCode}</span>
          <span className="text-yellow-500/70">|</span>
          <span className="truncate normal-case">{currentSetLabel || 'General Set'}</span>
          <span className="hidden md:inline text-yellow-500/70">|</span>
          <span className="hidden md:inline text-yellow-400/90">TIMER</span>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <button
            onClick={onSkip}
            disabled={!canControl || !onSkip || !canSkip}
            className="h-7 w-7 rounded-md border border-yellow-500/60 text-xs disabled:opacity-40 hover:bg-yellow-400/10"
            aria-label="Skip player"
            title="Skip"
          >
            ⏭
          </button>
          <button
            onClick={onPauseToggle}
            disabled={!canControl || !onPauseToggle}
            className="h-7 w-7 rounded-md border border-yellow-500/60 text-xs disabled:opacity-40 hover:bg-yellow-400/10"
            aria-label="Pause or resume auction"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            ⏸
          </button>
          <button
            onClick={onLeaveGame}
            className="h-7 w-7 rounded-md border border-red-400/60 text-xs hover:bg-red-500/10"
            aria-label="Leave game"
            title="Leave"
          >
            🚪
          </button>
        </div>
      </div>
    </header>
  );
};
