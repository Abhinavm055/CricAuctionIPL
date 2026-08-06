import { memo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface BidTimerProps {
  timerEndsAtMs: number;
  status: string;
  pausedRemainingSec?: number;
  className?: string;
  isAccelerated?: boolean;
}

export const BidTimer = memo(({
  timerEndsAtMs,
  status,
  pausedRemainingSec = 0,
  className,
}: BidTimerProps) => {
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    if (status !== 'RUNNING') return;

    // Immediately sync nowMs on status change to RUNNING
    setNowMs(Date.now());

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 250); // 250ms tick for ultra smooth timer response

    return () => clearInterval(timer);
  }, [status, timerEndsAtMs]);

  if (status === 'PAUSED') {
    return (
      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider", className)}>
        <Clock className="w-3.5 h-3.5 animate-pulse" />
        <span>PAUSED ({pausedRemainingSec}s)</span>
      </div>
    );
  }

  if (status === 'SOLD') {
    return (
      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-400/40 text-yellow-300 text-xs font-black uppercase tracking-wider", className)}>
        <span>SOLD</span>
      </div>
    );
  }

  if (status === 'UNSOLD') {
    return (
      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black uppercase tracking-wider", className)}>
        <span>UNSOLD</span>
      </div>
    );
  }

  if (status === 'RTM') {
    return (
      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-300 text-xs font-black uppercase tracking-wider animate-pulse", className)}>
        <span>RTM DECISION</span>
      </div>
    );
  }

  if (status !== 'RUNNING' || !timerEndsAtMs) {
    return (
      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/60 border border-white/10 text-slate-400 text-xs font-bold uppercase tracking-wider", className)}>
        <span>STANDBY</span>
      </div>
    );
  }

  const diffMs = Math.max(0, timerEndsAtMs - nowMs);
  const seconds = Math.max(0, Math.ceil(diffMs / 1000));

  const isLowTime = seconds <= 5;
  const isCriticalTime = seconds <= 3;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border backdrop-blur-md transition-all duration-300 font-mono font-black text-sm",
        isCriticalTime
          ? "bg-rose-500/20 border-rose-500/60 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse"
          : isLowTime
          ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
          : "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
        className
      )}
    >
      <Clock className={cn("w-3.5 h-3.5", isLowTime && "animate-spin")} />
      <span>{seconds > 0 ? `${seconds}s` : '0s'}</span>
    </div>
  );
});
