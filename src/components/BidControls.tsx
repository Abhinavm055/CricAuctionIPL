import { Button } from './ui/button';
import { formatPrice, getNextBid } from '@/lib/constants';
import { Gavel, Hand, SkipForward } from 'lucide-react';

interface BidControlsProps {
  currentBid: number;
  purseRemaining: number;
  isYourTurn: boolean;
  canBid: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
  isHost?: boolean;
  onSkip?: () => void;
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
}: BidControlsProps) => {
  const nextBid = getNextBid(currentBid);
  const canAfford = purseRemaining >= nextBid;

  return (
    <div className="flex flex-col gap-4 p-6 card-gradient rounded-2xl border border-border/50">
      {/* Your purse */}
      <div className="text-center mb-2">
        <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Your Purse</p>
        <p className="font-display text-3xl text-foreground">{formatPrice(purseRemaining)}</p>
      </div>

      {/* Bid controls */}
      <div className="flex flex-col gap-3">
        <Button
          variant="bid"
          size="xl"
          onClick={() => onBid(nextBid)}
          disabled={!canBid || !canAfford}
          className="w-full"
        >
          <Gavel className="w-5 h-5" />
          Bid {formatPrice(nextBid)}
        </Button>

        <Button
          variant="danger"
          size="lg"
          onClick={onPass}
          disabled={!isYourTurn}
          className="w-full"
        >
          <Hand className="w-5 h-5" />
          Pass
        </Button>

        {isHost && onSkip && (
          <Button
            variant="broadcast"
            size="lg"
            onClick={onSkip}
            className="w-full"
          >
            <SkipForward className="w-5 h-5" />
            Skip Player (Unsold)
          </Button>
        )}
      </div>

      {/* Status message */}
      {!canAfford && (
        <p className="text-sm text-destructive text-center">
          Insufficient funds for next bid
        </p>
      )}
    </div>
  );
};
