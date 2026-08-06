import { memo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CircularAuctionTimerProps {
  timerEndsAtMs: number;
  status: string;
  maxSeconds?: number;
  isSetIntroActive?: boolean;
}

export const CircularAuctionTimer = memo(({
  timerEndsAtMs,
  status,
  maxSeconds = 30,
  isSetIntroActive = false,
}: CircularAuctionTimerProps) => {
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    if (status !== 'RUNNING') return;
    setNowMs(Date.now());

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 200); // 200ms tick for ultra smooth circular progress sweep

    return () => clearInterval(timer);
  }, [status, timerEndsAtMs]);

  if (isSetIntroActive) return null;

  const isRunning = status === 'RUNNING' && timerEndsAtMs > 0;
  const diffMs = isRunning ? Math.max(0, timerEndsAtMs - nowMs) : 0;
  const remainingSec = isRunning ? Math.max(0, Math.ceil(diffMs / 1000)) : 0;

  let timerColor = "#10B981"; // Emerald
  let labelText = `${remainingSec}`;
  let timerPulseClass = "";

  if (status === 'SOLD') {
    timerColor = "#FFD700"; // Gold
    labelText = "SOLD";
  } else if (status === 'UNSOLD') {
    timerColor = "#EF4444"; // Red
    labelText = "UNSOLD";
  } else if (status === 'RTM') {
    timerColor = "#A855F7"; // Purple
    labelText = "RTM";
    timerPulseClass = "animate-pulse";
  } else if (status === 'PAUSED') {
    timerColor = "#F59E0B"; // Amber
    labelText = "PAUSED";
  } else if (remainingSec <= 5) {
    timerColor = "#EF4444";
    timerPulseClass = "animate-[timerUrgent_0.6s_infinite_alternate]";
    if (remainingSec === 0) labelText = "0";
  } else if (remainingSec <= 10) {
    timerColor = "#F59E0B";
  }

  const strokeDasharray = 2 * Math.PI * 50;
  const progressRatio = isRunning ? Math.min(1, Math.max(0, remainingSec / maxSeconds)) : 1;
  const strokeDashoffset = strokeDasharray - (progressRatio * strokeDasharray);

  return (
    <div className="pointer-events-none absolute left-1/2 -top-12 -translate-x-1/2 z-20">
      <div
        className={cn(
          "relative h-[100px] w-[100px] md:h-[120px] md:w-[120px] rounded-full bg-slate-950/95 border-2 grid place-items-center transition-all duration-300 shadow-2xl",
          timerPulseClass
        )}
        style={{
          borderColor: `${timerColor}aa`,
          boxShadow: `0 0 30px ${timerColor}40, inset 0 0 15px ${timerColor}10`,
        }}
      >
        <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={timerColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        <span
          className={cn(
            "font-display font-black leading-none transition-colors duration-300 select-none font-mono",
            labelText.length > 3 ? "text-xl md:text-2xl" : "text-3xl md:text-5xl"
          )}
          style={{ color: timerColor }}
        >
          {labelText}
        </span>
      </div>
    </div>
  );
});
