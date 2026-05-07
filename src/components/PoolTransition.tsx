import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface PoolTransitionProps {
  poolName: string;
  playersInPool: number;
  onComplete: () => void;
  setNumber?: number;
}

export const PoolTransition = ({ poolName, playersInPool, onComplete, setNumber }: PoolTransitionProps) => {
  const [phase, setPhase] = useState<'enter' | 'display' | 'exit'>('enter');
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Enter phase
    const enterTimer = setTimeout(() => setPhase('display'), 200);
    // Display phase
    const displayTimer = setTimeout(() => setPhase('exit'), 2500);
    // Exit and complete
    const exitTimer = setTimeout(() => onCompleteRef.current(), 3000);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(displayTimer);
      clearTimeout(exitTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#020617]/96 backdrop-blur-md">
      <div 
        className={cn(
          "text-center transition-all duration-500",
          phase === 'enter' && "opacity-0 scale-90 translate-y-10",
          phase === 'display' && "opacity-100 scale-100 translate-y-0",
          phase === 'exit' && "opacity-0 scale-110 -translate-y-10"
        )}
      >
        {/* Pool icon */}
        <div className="relative mx-auto mb-8 w-32 h-32">
          <div className="absolute inset-0 rounded-full gold-gradient animate-pulse opacity-30" />
          <div className="absolute inset-2 rounded-full bg-secondary flex items-center justify-center">
            <span className="font-display text-6xl text-primary">
              {poolName.charAt(0)}
            </span>
          </div>
        </div>

        {/* Pool name */}
        <p className="mb-3 font-display text-5xl text-primary tracking-[0.2em] text-shadow-glow md:text-7xl">
          SET {setNumber || getPoolNumber(poolName)}
        </p>

        <h1 className="font-display text-3xl text-foreground mb-4 tracking-wider text-shadow-glow md:text-6xl">
          {poolName}
        </h1>
        
        {/* Player count */}
        <p className="text-lg text-muted-foreground">
          {playersInPool} Players
        </p>

        {/* Decorative lines */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <div className="h-px w-20 bg-gradient-to-r from-transparent to-primary" />
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <div className="h-px w-20 bg-gradient-to-l from-transparent to-primary" />
        </div>
      </div>
    </div>
  );
};

const getPoolNumber = (pool: string): number => {
  const pools = ['Marquee', 'Batsmen', 'Bowlers', 'All-Rounders', 'Wicket-Keepers'];
  return pools.indexOf(pool) + 1;
};
