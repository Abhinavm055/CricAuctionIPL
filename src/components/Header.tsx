import { cn } from '@/lib/utils';

interface HeaderProps {
  gameCode: string;
  timerSeconds: number;
  currentPool?: string;
  playersRemaining: number;
  totalPlayers: number;
  onLeaveGame?: () => void;
}

export const Header = ({ gameCode, timerSeconds, currentPool, playersRemaining, totalPlayers, onLeaveGame }: HeaderProps) => {
  const timerState = timerSeconds <= 5 ? 'danger' : timerSeconds <= 10 ? 'warning' : 'normal';

  const timerClasses = timerState === 'danger'
    ? 'text-red-300 border-red-400 bg-red-900/40 shadow-[0_0_25px_rgba(248,113,113,0.45)] animate-pulse'
    : timerState === 'warning'
      ? 'text-orange-300 border-orange-400 bg-orange-900/30 shadow-[0_0_20px_rgba(251,146,60,0.35)]'
      : 'text-yellow-300 border-yellow-300 bg-yellow-900/20 shadow-[0_0_20px_rgba(250,204,21,0.35)]';

  return (
    <header className="border-b border-yellow-500/40 bg-[#061734] px-3 md:px-5 py-3 text-yellow-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between md:block">
          <p className="font-display text-lg md:text-xl tracking-wider"><span className="text-yellow-300">CricAuction</span><span className="text-white">IPL</span></p>
          <span className="md:hidden text-xs font-semibold">{gameCode}</span>
        </div>

        <div className="flex items-center justify-center gap-4 md:gap-6">
          <span className="hidden md:inline text-sm font-semibold">{gameCode}</span>
          <div className={cn('relative rounded-full border-4 grid place-items-center transition-all', timerClasses, 'h-[68px] w-[68px] md:h-[112px] md:w-[112px]')}>
            <span className="text-xl md:text-4xl font-display leading-none">{timerSeconds.toString().padStart(2, '0')}</span>
            <span className="text-[10px] md:text-xs uppercase tracking-widest">sec</span>
          </div>
          <div className="text-xs md:text-sm font-semibold space-y-1">
            <p>{String(currentPool || 'POOL').toUpperCase()}</p>
            <p>{playersRemaining}/{totalPlayers} remaining</p>
            <p className="flex items-center gap-1 text-red-400"><span className="text-base">●</span> LIVE</p>
          </div>
        </div>

        <div className="flex justify-end">
          {onLeaveGame && (
            <button
              onClick={onLeaveGame}
              className="rounded-md border border-red-400/60 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10 transition"
            >
              Leave Game
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
