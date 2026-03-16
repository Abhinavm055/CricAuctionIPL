import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  gameCode: string;
  timerSeconds: number;
  timerTotalSeconds?: number;
  currentSetLabel?: string;
  currentSetIndex?: number;
  onLeaveGame?: () => void;
  onMenuClick?: () => void;
}

export const Header = ({
  gameCode,
  timerSeconds,
  timerTotalSeconds = 30,
  currentSetLabel,
  currentSetIndex,
  onLeaveGame,
  onMenuClick,
}: HeaderProps) => {
  const normalizedTotal = Math.max(1, timerTotalSeconds);
  const clamped = Math.max(0, Math.min(timerSeconds, normalizedTotal));
  const progress = (clamped / normalizedTotal) * 100;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <header className="border-b border-yellow-500/40 bg-[#061734] px-3 md:px-5 py-3 text-yellow-100">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-6">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="md:hidden rounded-md border border-yellow-500/50 p-1.5 text-yellow-300"
            aria-label="Open teams drawer"
          >
            <Menu className="w-4 h-4" />
          </button>

          <p className="font-display text-base md:text-xl tracking-wider truncate">
            <span className="text-yellow-300">CricAuction</span>
            <span className="text-white">IPL</span>
          </p>
          <span className="rounded-full bg-yellow-400 text-black text-[10px] md:text-xs px-2.5 py-1 font-bold whitespace-nowrap">
            {gameCode}
          </span>
          <p className="hidden md:block text-xs text-yellow-200 truncate">
            Current Set : {typeof currentSetIndex === 'number' ? `Set ${currentSetIndex + 1}` : 'Set'} ({currentSetLabel || 'General'})
          </p>
        </div>

        <div className="flex justify-center">
          <div className="relative h-[84px] w-[84px] md:h-[118px] md:w-[118px]">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r={radius} stroke="rgba(251,191,36,0.22)" strokeWidth="8" fill="none" />
              <circle
                cx="60"
                cy="60"
                r={radius}
                stroke="rgba(251,191,36,0.95)"
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className={cn('transition-[stroke-dashoffset] duration-500', timerSeconds <= 5 && 'animate-pulse')}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <span className="font-display text-2xl md:text-4xl leading-none">{timerSeconds.toString().padStart(2, '0')}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center gap-2 md:gap-3">
          <p className="md:hidden text-[10px] text-yellow-200 text-right leading-tight">
            Set {typeof currentSetIndex === 'number' ? currentSetIndex + 1 : '-'}<br />{currentSetLabel || 'General'}
          </p>
          {onLeaveGame && (
            <button
              onClick={onLeaveGame}
              className="rounded-md border border-red-400/60 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10 transition"
            >
              Leave
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
