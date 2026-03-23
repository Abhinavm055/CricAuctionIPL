import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/constants';

interface BidPanelProps {
  currentBid: number;
  nextBid: number;
  canBid: boolean;
  isHost: boolean;
  isPaused: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
  onSkip: () => void;
  onPauseToggle: () => void;
}

export const BidPanel = ({
  currentBid,
  nextBid,
  canBid,
  isHost,
  isPaused,
  onBid,
  onPass,
  onSkip,
  onPauseToggle,
}: BidPanelProps) => {
  const quickAmounts = [2500000, 5000000, 10000000].map((inc) => currentBid + inc);

  return (
    <div className="h-full rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3 space-y-3">
      <p className="text-xs uppercase tracking-widest text-yellow-300">Bid Controls</p>

      <div className="grid grid-cols-3 gap-2">
        {quickAmounts.map((amount, idx) => (
          <Button key={idx} variant="outline" className="border-yellow-500/60 text-yellow-200" onClick={() => onBid(amount)} disabled={!canBid}>
            {idx === 0 ? '+25L' : idx === 1 ? '+50L' : '+1Cr'}
          </Button>
        ))}
      </div>

      <Button className="w-full bg-yellow-400 text-black hover:bg-yellow-300 font-bold" onClick={() => onBid(nextBid)} disabled={!canBid}>
        BID ({formatPrice(nextBid)})
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onPass}>PASS</Button>
        <Button variant="outline" onClick={onSkip} disabled={!isHost}>SKIP PLAYER</Button>
      </div>

      <Button variant="outline" className="w-full" onClick={onPauseToggle} disabled={!isHost}>
        {isPaused ? 'RESUME' : 'PAUSE'}
      </Button>
    </div>
  );
};
