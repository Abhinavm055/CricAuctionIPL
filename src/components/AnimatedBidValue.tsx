import { memo, useEffect, useState, useRef } from 'react';
import { formatPrice } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface AnimatedBidValueProps {
  value: number;
  className?: string;
  durationMs?: number;
}

export const AnimatedBidValue = memo(({ value, className, durationMs = 300 }: AnimatedBidValueProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isGlowing, setIsGlowing] = useState(false);
  const prevValueRef = useRef(value);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;
    prevValueRef.current = value;

    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    setIsGlowing(true);
    const startTime = performance.now();

    const updateCounter = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * easeProgress);

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(updateCounter);
      } else {
        setDisplayValue(endValue);
        setTimeout(() => setIsGlowing(false), 200);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateCounter);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [value, durationMs]);

  return (
    <span
      className={cn(
        'transition-all duration-300 inline-block',
        isGlowing && 'scale-105 drop-shadow-[0_0_10px_rgba(234,179,8,0.7)] text-yellow-200',
        className
      )}
    >
      {formatPrice(displayValue)}
    </span>
  );
});
