import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface BidTimerProps {
  duration: number;
  isActive: boolean;
  onTimeout: () => void;
}

export const BidTimer = ({ duration, isActive, onTimeout }: BidTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.floor(duration)));

  useEffect(() => {
    if (!isActive) {
      setTimeLeft(Math.max(0, Math.floor(duration)));
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, duration]);

  // Handle timeout separately to avoid setState during render
  useEffect(() => {
    if (timeLeft === 0 && isActive) {
      onTimeout();
    }
  }, [timeLeft, isActive, onTimeout]);

  useEffect(() => {
    setTimeLeft(Math.max(0, Math.floor(duration)));
  }, [duration]);

  const safeDuration = Math.max(1, Math.floor(duration));
  const percentage = (timeLeft / safeDuration) * 100;
  const isUrgent = timeLeft <= 10;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg className="w-28 h-28 -rotate-90 transform">
        {/* Background circle */}
        <circle
          cx="56"
          cy="56"
          r="45"
          stroke="hsl(var(--secondary))"
          strokeWidth="8"
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx="56"
          cy="56"
          r="45"
          stroke={isUrgent ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      
      {/* Timer text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span 
          className={cn(
            "font-display text-4xl",
            isUrgent ? "timer-urgent" : "text-foreground"
          )}
        >
          {Math.max(0, Math.floor(timeLeft))}
        </span>
      </div>

      {/* Glow effect when urgent */}
      {isUrgent && (
        <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-destructive" />
      )}
    </div>
  );
};
