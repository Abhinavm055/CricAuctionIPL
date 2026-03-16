import { memo, useCallback, useRef, useState } from 'react';
import { Button } from './ui/button';
import { formatPrice, getNextBid } from '@/lib/constants';

interface RecentPurchase {
  playerName: string;
  teamShortName: string;
  price: number;
}

interface BidControlsProps {
  currentBid: number;
  purseRemaining: number;
  canBid: boolean;
  onBid: (amount: number) => void;
  onPass?: () => void;
  isHost?: boolean;
  onSkip?: () => void;
  onPauseToggle?: () => void;
  isPaused?: boolean;
  recentPurchases?: RecentPurchase[];
}

const BID_COOLDOWN_MS = 350;

const BidControlsComponent = ({
  currentBid,
  purseRemaining,
  canBid,
  onBid,
  onPass,
  isHost,
  onSkip,
  onPauseToggle,
  isPaused,
  recentPurchases = [],
}: BidControlsProps) => {
  const nextBid = getNextBid(currentBid);
  const [isBidClicked, setIsBidClicked] = useState(false);
  const lastClickRef = useRef(0);

  const handleBidClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < BID_COOLDOWN_MS) return;

    lastClickRef.current = now;
    setIsBidClicked(true);
    onBid(nextBid);
    window.setTimeout(() => setIsBidClicked(false), BID_COOLDOWN_MS);
  }, [nextBid, onBid]);

  return (
    <div className="h-full rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3 space-y-3 sticky bottom-0 z-50 shadow-[0_-10px_20px_rgba(2,6,23,0.8)] md:static md:shadow-none bg-opacity-95 md:bg-opacity-100 backdrop-blur-sm md:backdrop-blur-none transition-all overflow-y-auto">
      <p className="text-xs uppercase tracking-widest text-yellow-300">Control Panel</p>

      <div className="space-y-1 text-sm text-slate-200">
        <p>YOUR PURSE</p>
        <p className="text-2xl font-bold text-yellow-300">{formatPrice(purseRemaining)}</p>
      </div>

      <Button
        className="w-full bg-yellow-400 text-black hover:bg-yellow-300 font-bold relative z-30"
        onClick={handleBidClick}
        disabled={!canBid}
      >
        {isBidClicked ? 'BIDDING...' : 'BID'}
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onPass} disabled={!onPass}>PASS</Button>
        <Button variant="outline" onClick={onSkip} disabled={!isHost || !onSkip}>SKIP PLAYER</Button>
      </div>

      <Button variant="outline" onClick={onPauseToggle} disabled={!isHost || !onPauseToggle} className="w-full">
        {isPaused ? 'RESUME' : 'PAUSE'}
      </Button>

      <div>
        <p className="text-xs uppercase tracking-widest text-yellow-300 mb-2">Recent Purchases</p>
        <div className="max-h-[240px] overflow-y-auto space-y-1 text-xs text-slate-200">
          {recentPurchases.length ? recentPurchases.map((p, idx) => (
            <p key={`${p.playerName}-${idx}`}>{p.playerName} → {p.teamShortName} → {formatPrice(p.price)}</p>
          )) : <p className="text-muted-foreground">No purchases yet.</p>}
        </div>
      </div>
    </div>
  );
};

export const BidControls = memo(BidControlsComponent);
