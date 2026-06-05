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
      const timer = setTimeout(() => setPulse(false), 800);
      prevPurseRef.current = purse;
      return () => clearTimeout(timer);
    }
  }, [purse]);

  return (
    <span
      className={cn(
        'font-bold transition-all duration-300 text-yellow-300',
        pulse && 'text-yellow-400 scale-105 inline-block font-extrabold text-shadow-glow'
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
  const slots = Math.max(0, SQUAD_CONSTRAINTS.MAX_SQUAD - Number(squadSize || 0));

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full rounded-2xl border p-4 text-left transition-all duration-300 select-none outline-none',
        'bg-gradient-to-br from-[#061533]/90 to-[#030a1e]/95 border-slate-700/50',
        'hover:from-[#091f4d]/90 hover:to-[#050f29]/95 hover:border-yellow-500/50 hover:-translate-y-1 hover:scale-[1.03] hover:shadow-[0_12px_36px_rgba(0,0,0,0.5)]',
        isUserTeam && 'from-[#08214d]/90 to-[#041029]/95 border-sky-500/50 shadow-[0_0_20px_rgba(14,165,233,0.15)] hover:border-sky-400 hover:from-[#0d2a63]/90 hover:to-[#06173b]/95',
        isCurrentBidder && 'border-yellow-500/70 from-[#0c224a]/90 to-[#06122a]/95 shadow-[0_0_25px_rgba(234,179,8,0.22)]',
        shouldGlow && 'border-yellow-400 from-[#143269]/90 to-[#0a1b3b]/95 shadow-[0_0_35px_rgba(250,204,21,0.5)] scale-[1.04] z-10 animate-[pulseBid_1.5s_infinite]',
      )}
    >
      {/* Animated BIDDING badge */}
      {shouldGlow && (
        <div className="absolute -top-2.5 -right-1.5 z-20 flex h-5.5 items-center rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 px-3.5 text-[9px] font-black tracking-widest text-slate-950 shadow-[0_0_15px_rgba(234,179,8,0.8)] border border-yellow-300 animate-pulse">
          BIDDING
        </div>
      )}

      {/* Highest Bidder badge */}
      {isCurrentBidder && !shouldGlow && (
        <div className="absolute -top-2.5 -right-1.5 z-20 flex h-5.5 items-center rounded-full bg-slate-950 border border-yellow-500/80 px-2.5 text-[9px] font-bold tracking-wider text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.45)]">
          🔨 LEADING
        </div>
      )}

      <div className="flex items-center gap-3.5 mb-3.5">
        <TeamLogo
          teamId={id}
          logo={logo}
          shortName={shortName}
          className={cn(
            'rounded-full border border-slate-700/60 bg-[#020714] shrink-0 p-0.5 transition-transform duration-300 group-hover:scale-105',
            'w-12 h-12 md:w-13 md:h-13',
            isUserTeam && 'border-sky-500/40',
            isCurrentBidder && 'border-yellow-500/50',
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] md:text-xs font-semibold text-slate-400/80 uppercase tracking-wider truncate mb-0.5">{name}</p>
          <div className="flex items-center gap-2">
            <p className="text-sm md:text-base font-extrabold tracking-wide text-white group-hover:text-yellow-200 transition-colors">{shortName}</p>
            {isUserTeam && (
              <span className="rounded-full bg-sky-500/10 border border-sky-400/35 px-1.5 py-0.5 text-[8px] md:text-[9px] font-bold text-sky-400 uppercase tracking-widest leading-none">
                YOU
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5 text-[10px] md:text-xs text-slate-200 border-t border-white/5 pt-3">
        <div className="flex flex-col">
          <span className="text-slate-500 text-[8px] md:text-[9px] uppercase tracking-wider font-semibold">Purse</span>
          <div className="mt-0.5">
            <AnimatedPurse purse={purseRemaining} />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-500 text-[8px] md:text-[9px] uppercase tracking-wider font-semibold">Squad</span>
          <span className="font-bold text-white mt-0.5">
            {squadSize}/{SQUAD_CONSTRAINTS.MAX_SQUAD}
            <span className="text-slate-400 text-[9px] font-normal ml-1">({slots})</span>
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-500 text-[8px] md:text-[9px] uppercase tracking-wider font-semibold">Retained</span>
          <span className="font-bold text-white mt-0.5">{retainedCount}/6</span>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-500 text-[8px] md:text-[9px] uppercase tracking-wider font-semibold">RTM Cards</span>
          <span className="font-bold text-white mt-0.5">{rtmCards}</span>
        </div>
      </div>
    </button>
  );
};

export const TeamCard = memo(TeamCardComponent);
