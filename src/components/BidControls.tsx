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
  purseRemaining?: number;
  canBid: boolean;
  onBid: (amount: number) => void;
  recentPurchases?: RecentPurchase[];
  upcomingPlayers?: string[];
}

const BID_COOLDOWN_MS = 250;

const BidControlsComponent = ({
  currentBid,
  purseRemaining,
  canBid,
  onBid,
  recentPurchases = [],
  upcomingPlayers = [],
}: BidControlsProps) => {
  const [isBidClicked, setIsBidClicked] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const lastClickRef = useRef(0);
  const nextBid = getNextBid(currentBid);

  const handleBidClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < BID_COOLDOWN_MS) return;
    lastClickRef.current = now;
    setIsBidClicked(true);
    onBid(nextBid);
    window.setTimeout(() => setIsBidClicked(false), BID_COOLDOWN_MS);
  }, [onBid, nextBid]);

  return (
    <div className="h-full rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3 space-y-4 overflow-y-auto">
      <div>
        <p className="text-xs uppercase tracking-widest text-yellow-300 mb-2">Single Bid</p>
        <Button
          className="w-full h-14 bg-yellow-400 text-black hover:bg-yellow-300 text-lg font-extrabold shadow-[0_0_16px_rgba(251,191,36,0.45)]"
          onClick={handleBidClick}
          disabled={!canBid}
        >
          {isBidClicked ? 'BIDDING...' : `BID ${formatPrice(nextBid)}`}
        </Button>
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-yellow-300 mb-2">Recent Purchases</p>
        <div className="max-h-28 overflow-auto space-y-1 text-xs text-slate-200">
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
          View Remaining Players ({upcomingPlayers.length})
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
