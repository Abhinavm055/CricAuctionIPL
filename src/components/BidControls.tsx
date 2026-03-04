import { Button } from './ui/button';
import { formatPrice, getNextBid } from '@/lib/constants';
import { Gavel, Hand, SkipForward, Pause, Play, FastForward, RotateCcw } from 'lucide-react';

interface BidControlsProps {
  currentBid: number;
  purseRemaining: number;
  isYourTurn: boolean;
  canBid: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
  isHost?: boolean;
  onSkip?: () => void;
  skipDisabled?: boolean;
  onPauseToggle?: () => void;
  isPaused?: boolean;
  onStartAccelerated?: () => void;
  onBringBackUnsold?: () => void;
}

export const BidControls = ({
  currentBid,
  purseRemaining,
  isYourTurn,
  canBid,
  onBid,
  onPass,
  isHost,
  onSkip,
  skipDisabled,
  onPauseToggle,
  isPaused,
  onStartAccelerated,
  onBringBackUnsold,
}: BidControlsProps) => {
  const nextBid = getNextBid(currentBid);
  const canAfford = purseRemaining >= nextBid;

  return (
    <div className="flex flex-col gap-4 p-6 card-gradient rounded-2xl border border-border/50">
      <div className="text-center mb-2">
        <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Your Purse</p>
        <p className="font-display text-3xl text-foreground">{formatPrice(purseRemaining)}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Button variant="bid" size="xl" onClick={() => onBid(nextBid)} disabled={!canBid || !canAfford} className="w-full">
          <Gavel className="w-5 h-5" />
          Bid {formatPrice(nextBid)}
        </Button>

        <Button variant="danger" size="lg" onClick={onPass} disabled={!isYourTurn} className="w-full">
          <Hand className="w-5 h-5" />
          Pass
        </Button>

        {isHost && onSkip && (
          <Button variant="broadcast" size="lg" onClick={onSkip} disabled={skipDisabled} className="w-full">
            <SkipForward className="w-5 h-5" />
            Skip Player (Unsold)
          </Button>
        )}

        {isHost && onPauseToggle && (
          <Button variant="outline" size="lg" onClick={onPauseToggle} className="w-full">
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            {isPaused ? 'Resume Auction' : 'Pause Auction'}
          </Button>
        )}

        {isHost && onStartAccelerated && (
          <Button variant="outline" size="lg" onClick={onStartAccelerated} className="w-full">
            <FastForward className="w-5 h-5" />
            Start Accelerated Round
          </Button>
        )}

        {isHost && onBringBackUnsold && (
          <Button variant="outline" size="lg" onClick={onBringBackUnsold} className="w-full">
            <RotateCcw className="w-5 h-5" />
            Bring Back Unsold
          </Button>
        )}
      </div>

      {!canAfford && <p className="text-sm text-destructive text-center">Insufficient funds for next bid</p>}
    </div>
  );
};
