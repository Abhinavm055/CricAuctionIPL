interface HeaderProps {
  gameCode: string;
  currentSetLabel?: string;
  onSkip?: () => void;
  onPauseToggle?: () => void;
  isPaused?: boolean;
  canControl?: boolean;
  onLeaveGame?: () => void;
  onMenuClick?: () => void;
}

export const Header = ({ gameCode, currentSetLabel, onSkip, onPauseToggle, isPaused, canControl, onLeaveGame }: HeaderProps) => {
  return (
    <header className="h-14 border-b border-yellow-500/40 bg-[#061734] px-3 md:px-5 text-yellow-100">
      <div className="h-full flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2 md:gap-3 text-xs md:text-sm">
          <p className="font-display text-yellow-300 whitespace-nowrap">CricAuctionIPL</p>
          <span className="text-yellow-500/70">|</span>
          <span className="rounded-full bg-yellow-400 text-black px-2 py-0.5 font-bold whitespace-nowrap">{gameCode}</span>
          <span className="text-yellow-500/70">|</span>
          <span className="truncate">{currentSetLabel || 'General Set'}</span>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <button
            onClick={onSkip}
            disabled={!canControl || !onSkip}
            className="h-8 w-8 rounded-md border border-yellow-500/60 text-sm disabled:opacity-40 hover:bg-yellow-400/10"
            aria-label="Skip player"
            title="Skip"
          >
            ⏭
          </button>
          <button
            onClick={onPauseToggle}
            disabled={!canControl || !onPauseToggle}
            className="h-8 w-8 rounded-md border border-yellow-500/60 text-sm disabled:opacity-40 hover:bg-yellow-400/10"
            aria-label="Pause or resume auction"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            ⏸
          </button>
          <button
            onClick={onLeaveGame}
            className="h-8 w-8 rounded-md border border-red-400/60 text-sm hover:bg-red-500/10"
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
