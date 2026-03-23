import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
  recentPurchases?: RecentPurchase[];
  upcomingPlayers?: string[];
}

const BID_COOLDOWN_MS = 250;

const BidControlsComponent = ({
  currentBid,
  canBid,
  onBid,
  recentPurchases = [],
  upcomingPlayers = [],
}: BidControlsProps) => {
  const [isBidPending, setIsBidPending] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const lastClickRef = useRef(0);
  const nextBid = getNextBid(currentBid);

  useEffect(() => {
    if (canBid) setIsBidPending(false);
  }, [canBid, currentBid]);

  const handleBidClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < BID_COOLDOWN_MS || !canBid || isBidPending) return;
    lastClickRef.current = now;
    setIsBidPending(true);
    onBid(nextBid);
  }, [canBid, isBidPending, onBid, nextBid]);

  return (
    <div className="h-full overflow-y-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 space-y-4">
      <div>
        <p className="mb-2 text-xs uppercase tracking-widest text-[hsl(var(--primary))]">Single Bid</p>
        <Button
          className="h-14 w-full rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-lg font-extrabold hover:brightness-105"
          onClick={handleBidClick}
          disabled={!canBid || isBidPending}
        >
          {isBidPending ? 'Bidding...' : 'BID'}
        </Button>
        <p className="mt-2 text-center text-xs text-[hsl(var(--muted-foreground))]">Next bid: {formatPrice(nextBid)}</p>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-widest text-[hsl(var(--primary))]">Recent Purchases</p>
        <div className="max-h-[220px] space-y-1 overflow-y-auto text-xs text-[hsl(var(--foreground))]/85">
          {recentPurchases.length ? recentPurchases.map((p, idx) => (
            <p key={`${p.playerName}-${idx}`}>{p.playerName} → {p.teamShortName} → {formatPrice(p.price)}</p>
          )) : <p className="text-[hsl(var(--muted-foreground))]">No purchases yet.</p>}
        </div>
      </div>

      <div>
        <Button
          variant="outline"
          className="w-full rounded-xl border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]"
          onClick={() => setShowUpcoming((prev) => !prev)}
        >
          View Remaining Players ({upcomingPlayers.length})
        </Button>
        {showUpcoming && (
          <div className="mt-2 max-h-[180px] overflow-y-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]/70 p-2">
            <p className="mb-1 text-xs text-[hsl(var(--primary))]">Upcoming Players</p>
            {upcomingPlayers.length ? (
              <ul className="space-y-1 text-xs text-[hsl(var(--foreground))]/85">
                {upcomingPlayers.map((name, idx) => <li key={`${name}-${idx}`}>{name}</li>)}
              </ul>
            ) : (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">No remaining players in this set.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const BidControls = memo(BidControlsComponent);
