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
  const isDangerTimer = timerSeconds <= 5;

  return (
    <header className="border-b border-yellow-500/40 bg-[#061734] px-3 md:px-5 py-3 text-yellow-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs md:text-sm font-semibold">
        <p className="font-display text-lg md:text-xl tracking-wider"><span className="text-yellow-300">CricAuction</span><span className="text-white">IPL</span></p>

        <div className="flex items-center gap-3">
          <span>{gameCode}</span>
          <span className={cn('inline-flex items-center gap-2', isDangerTimer && 'text-red-300 animate-[timerShake_0.45s_ease-in-out_infinite]')}>
            <span
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px]',
                isDangerTimer ? 'border-red-300 text-red-100 bg-red-500/25 animate-pulse' : 'border-yellow-300 text-yellow-200',
              )}
            >
              {timerSeconds.toString().padStart(2, '0')}
            </span>
            <span>{timerSeconds.toString().padStart(2, '0')}s</span>
          </span>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <span>{String(currentPool || 'POOL').toUpperCase()}</span>
          <span>{playersRemaining}/{totalPlayers}</span>
          <span className="flex items-center gap-1 text-red-400"><span className="text-base">●</span> LIVE</span>
        </div>
      </div>

      <div className="mt-2 flex justify-end">
        {onLeaveGame && (
          <button
            onClick={onLeaveGame}
            className="rounded-md border border-red-400/60 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10 transition"
          >
            Leave Game
          </button>
        )}
      </div>
    </header>
  );
};
