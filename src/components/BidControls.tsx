import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { formatPrice, getNextBid } from '@/lib/constants';

interface RecentPurchase {
  playerName: string;
  teamShortName: string;
  price: number;
}

interface BidControlsProps {
  currentBid: number;
  canBid: boolean;
  onBid: (amount: number) => void;
  onPass?: () => void;
  recentPurchases?: RecentPurchase[];
  upcomingPlayers?: string[];
  onPauseToggle?: () => void;
  isPaused?: boolean;
  canControl?: boolean;
}

const BID_COOLDOWN_MS = 300;

const BidControlsComponent = ({
  currentBid,
  canBid,
  onBid,
  onPass,
  recentPurchases = [],
  upcomingPlayers = [],
  onPauseToggle,
  isPaused = false,
  canControl = false,
}: BidControlsProps) => {
  const [isBidClicked, setIsBidClicked] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const lastClickRef = useRef(0);
  const nextBid = getNextBid(currentBid);

  const quickBids = useMemo(() => [nextBid, getNextBid(nextBid), getNextBid(getNextBid(nextBid))], [nextBid]);

  const handleBidClick = useCallback((amount: number) => {
    const now = Date.now();
    if (now - lastClickRef.current < BID_COOLDOWN_MS) return;
    lastClickRef.current = now;
    setIsBidClicked(true);
    onBid(amount);
    window.setTimeout(() => setIsBidClicked(false), BID_COOLDOWN_MS);
  }, [onBid]);

  return (
    <div className="h-full rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3 space-y-4 overflow-y-auto">
      <div>
        <p className="text-xs uppercase tracking-widest text-yellow-300 mb-2">Bid Buttons</p>
        <div className="grid grid-cols-1 gap-2">
          {quickBids.map((amount, idx) => (
            <Button
              key={`${amount}-${idx}`}
              className="w-full bg-yellow-400 text-black hover:bg-yellow-300 font-bold"
              onClick={() => handleBidClick(amount)}
              disabled={!canBid}
            >
              {idx === 0 ? (isBidClicked ? 'BIDDING...' : `BID ${formatPrice(amount)}`) : `RAISE TO ${formatPrice(amount)}`}
            </Button>
          ))}
          <Button variant="secondary" onClick={onPass} disabled={!onPass}>PASS</Button>
        </div>
      </div>

      <Button variant="outline" onClick={onPauseToggle} disabled={!canControl || !onPauseToggle} className="w-full">
        {isPaused ? 'RESUME' : 'PAUSE'}
      </Button>

      <div>
        <p className="text-xs uppercase tracking-widest text-yellow-300 mb-2">Recent Purchases</p>
        <div className="max-h-[220px] overflow-y-auto space-y-1 text-xs text-slate-200">
          {recentPurchases.length ? recentPurchases.map((p, idx) => (
            <p key={`${p.playerName}-${idx}`}>{p.playerName} → {p.teamShortName} → {formatPrice(p.price)}</p>
          )) : <p className="text-muted-foreground">No purchases yet.</p>}
        </div>
      </div>

      <div>
        <Button
          variant="outline"
          className="w-full border-yellow-500/60 text-yellow-200"
          onClick={() => setShowUpcoming((prev) => !prev)}
        >
          View Remaining Players
        </Button>
        {showUpcoming && (
          <div className="mt-2 rounded-lg border border-white/10 bg-[#0f172a] p-2 max-h-[180px] overflow-y-auto">
            <p className="text-xs text-yellow-300 mb-1">Upcoming Players</p>
            {upcomingPlayers.length ? (
              <ul className="text-xs text-slate-200 space-y-1">
                {upcomingPlayers.map((name, idx) => <li key={`${name}-${idx}`}>{name}</li>)}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">No remaining players in this set.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const BidControls = memo(BidControlsComponent);
