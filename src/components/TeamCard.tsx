import { memo, useEffect, useRef, useState } from 'react';
import { formatPrice, SQUAD_CONSTRAINTS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { TeamLogo } from './TeamLogo';

interface TeamCardProps {
  id: string;
  shortName: string;
  name: string;
  logo?: string;
  purseRemaining: number;
  squadSize: number;
  rtmCards: number;
  isCurrentBidder: boolean;
  shouldGlow?: boolean;
  isUserTeam?: boolean;
  onClick?: () => void;
  retainedCount?: number;
}

const AnimatedPurse = ({ purse }: { purse: number }) => {
  const [pulse, setPulse] = useState(false);
  const prevPurseRef = useRef(purse);

  useEffect(() => {
    if (purse !== prevPurseRef.current) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 600);
      prevPurseRef.current = purse;
      return () => clearTimeout(timer);
    }
  }, [purse]);

  return (
    <span
      className={cn(
        'font-mono font-bold transition-all duration-200 text-amber-400',
        pulse && 'text-amber-300 scale-105 inline-block'
      )}
    >
      {formatPrice(purse)}
    </span>
  );
};

const TeamCardComponent = ({
  id,
  shortName,
  name,
  logo,
  purseRemaining,
  squadSize,
  rtmCards,
  isCurrentBidder,
  shouldGlow = false,
  isUserTeam = false,
  onClick,
  retainedCount = 0,
}: TeamCardProps) => {
  const isFull = squadSize >= SQUAD_CONSTRAINTS.MAX_SQUAD;

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full rounded-2xl border p-3.5 text-left transition-all duration-200 select-none outline-none',
        'bg-[#09152A]/90 border-white/[0.08] shadow-lg backdrop-blur-md',
        'hover:border-amber-400/40 hover:bg-[#0B1930] hover:-translate-y-0.5',
        isUserTeam && 'border-cyan-500/40 bg-[#0B1C33]/90 hover:border-cyan-400',
        isCurrentBidder && !shouldGlow && 'border-amber-400/70 bg-[#0B1930] shadow-[0_0_20px_rgba(245,184,46,0.2)]',
        shouldGlow && 'border-amber-400 bg-[#0D1E3A] shadow-[0_0_25px_rgba(245,184,46,0.35)] z-10 animate-pulse',
        isFull && 'opacity-50 cursor-not-allowed border-white/[0.04] bg-[#050B16] hover:translate-y-0 shadow-none'
      )}
    >
      {/* Top Status Badges */}
      {isFull ? (
        <div className="absolute -top-2.5 -right-1.5 z-20 flex h-5 items-center rounded-full bg-red-500/20 border border-red-500/40 px-2 text-[8px] font-black tracking-widest text-red-400 uppercase">
          SQUAD FULL
        </div>
      ) : shouldGlow ? (
        <div className="absolute -top-2.5 -right-1.5 z-20 flex h-5 items-center rounded-full bg-amber-400 text-slate-950 px-2.5 text-[8px] font-black tracking-widest shadow-[0_0_12px_rgba(245,184,46,0.5)] uppercase">
          BIDDING
        </div>
      ) : isCurrentBidder ? (
        <div className="absolute -top-2.5 -right-1.5 z-20 flex h-5 items-center rounded-full bg-[#050B16] border border-amber-400 px-2 text-[8px] font-black tracking-widest text-amber-400 shadow-[0_0_10px_rgba(245,184,46,0.3)] uppercase">
          LEADING
        </div>
      ) : null}

      <div className="flex items-center gap-3 mb-3">
        <TeamLogo
          teamId={id}
          logo={logo}
          shortName={shortName}
          className={cn(
            'rounded-full border border-white/10 bg-[#050B16] shrink-0 p-0.5',
            'w-11 h-11',
            isUserTeam && 'border-cyan-400/50',
            isCurrentBidder && 'border-amber-400/60'
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
            {name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm font-black tracking-wide text-white group-hover:text-amber-300 transition-colors">
              {shortName}
            </span>
            {isUserTeam && (
              <span className="rounded bg-cyan-500/15 border border-cyan-400/40 px-1.5 py-0.5 text-[8px] font-black text-cyan-300 uppercase tracking-widest">
                YOU
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-slate-200 border-t border-white/[0.06] pt-2.5">
        <div className="flex flex-col">
          <span className="text-slate-400 text-[8px] uppercase tracking-wider font-bold">Purse</span>
          <div className="mt-0.5">
            <AnimatedPurse purse={purseRemaining} />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-400 text-[8px] uppercase tracking-wider font-bold">Squad</span>
          <span className="font-mono font-bold text-white mt-0.5">
            {squadSize}/{SQUAD_CONSTRAINTS.MAX_SQUAD}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-400 text-[8px] uppercase tracking-wider font-bold">Retained</span>
          <span className="font-mono font-bold text-white mt-0.5">{retainedCount}/6</span>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-400 text-[8px] uppercase tracking-wider font-bold">RTM Cards</span>
          <span className="font-mono font-bold text-emerald-400 mt-0.5">{rtmCards}</span>
        </div>
      </div>
    </button>
  );
};

export const TeamCard = memo(TeamCardComponent);
