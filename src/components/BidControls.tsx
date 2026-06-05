import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { formatPrice, getNextBid } from '@/lib/constants';
import { Player } from '@/lib/samplePlayers';

interface RecentPurchase {
  playerName: string;
  teamShortName: string;
  price: number;
  timestamp?: number;
}

interface BidControlsProps {
  currentBid: number;
  canBid: boolean;
  onBid: (amount: number) => void;
  recentPurchases?: RecentPurchase[];
  upcomingPlayers?: string[];
  currentPlayer?: Player | null;
}

const BID_COOLDOWN_MS = 250;

const BidControlsComponent = ({
  currentBid,
  canBid,
  onBid,
  recentPurchases = [],
  upcomingPlayers = [],
  currentPlayer = null,
}: BidControlsProps) => {
  const [isBidPending, setIsBidPending] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [viewAll, setViewAll] = useState(false);
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

  const displayedPurchases = viewAll ? recentPurchases : recentPurchases.slice(0, 5);

  return (
    <div className="h-full flex flex-col justify-between rounded-2xl border border-yellow-500/35 bg-gradient-to-br from-[#051126]/95 to-[#020917]/98 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] space-y-3.5 overflow-hidden">
      {/* Bid Interaction Panel */}
      <div className="bg-[#030d1c]/80 rounded-xl p-3.5 border border-white/5 space-y-2.5 shrink-0">
        <p className="text-[10px] md:text-xs uppercase tracking-widest text-slate-400 font-semibold">Place Bid</p>
        <Button
          className="h-14 w-full rounded-xl bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-slate-950 text-xl font-black hover:brightness-105 transition-all shadow-[0_4px_20px_rgba(234,179,8,0.3)] hover:shadow-[0_4px_25px_rgba(234,179,8,0.55)] border border-yellow-300/40 cursor-pointer"
          onClick={handleBidClick}
          disabled={!canBid || isBidPending}
        >
          {isBidPending ? 'BIDDING...' : 'PLACE BID'}
        </Button>
        <p className="text-center text-xs text-slate-400 font-medium">
          Next bid: <span className="font-extrabold text-yellow-400 tracking-wide">{formatPrice(nextBid)}</span>
        </p>
      </div>

      {/* Recent Purchases Section */}
      <div className="flex-1 flex flex-col min-h-0 space-y-2">
        <div className="flex items-center justify-between shrink-0">
          <p className="text-[10px] md:text-xs uppercase tracking-widest text-slate-400 font-semibold">Recent Purchases</p>
          {recentPurchases.length > 5 && (
            <button
              onClick={() => setViewAll((prev) => !prev)}
              className="text-[10px] md:text-xs font-bold text-yellow-400 hover:text-yellow-300 transition-colors uppercase tracking-wider cursor-pointer"
            >
              {viewAll ? 'Show Less' : 'View All'}
            </button>
          )}
        </div>

        {recentPurchases.length ? (
          <div className="flex-1 overflow-y-auto rounded-lg border border-slate-700/35 bg-[#030c1a]/60 divide-y divide-white/5 pr-1">
            {displayedPurchases.map((p, idx) => {
              const purchaseTime = p.timestamp
                ? new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={`${p.playerName}-${idx}`} className="flex items-center justify-between p-2.5 text-xs text-slate-300 hover:bg-slate-900/50 transition-colors">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-white truncate">{p.playerName}</p>
                    <span className="text-[9px] uppercase font-semibold tracking-wider text-slate-400">
                      Bought by <span className="text-yellow-400 font-bold">{p.teamShortName}</span>
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-emerald-400">{formatPrice(p.price)}</p>
                    <span className="text-[9px] text-slate-500 font-mono">{purchaseTime}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State Details */
          <div className="flex-1 flex flex-col justify-center items-center rounded-lg border border-dashed border-slate-700/50 bg-[#030c1a]/40 p-4 text-center select-none">
            <p className="text-xs font-black text-yellow-400 animate-pulse tracking-widest mb-3.5">
              📢 WAITING FOR FIRST SALE
            </p>
            {currentPlayer && (
              <div className="w-full text-left bg-gradient-to-br from-[#061530]/90 to-[#030a1c]/90 rounded-xl p-3.5 border border-white/5 space-y-1.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold font-mono">Under Hammer</span>
                  <span className="rounded-full bg-yellow-500/10 border border-yellow-400/35 px-2 py-0.5 text-[8px] font-black text-yellow-400 leading-none tracking-widest animate-pulse">
                    ACTIVE
                  </span>
                </div>
                <p className="text-sm font-extrabold text-white truncate tracking-wide">{currentPlayer.name}</p>
                <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-white/5">
                  <div>
                    <span className="text-slate-500 text-[8px] uppercase tracking-wider block font-medium">Base Price</span>
                    <span className="font-bold text-slate-200">{formatPrice(currentPlayer.basePrice)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[8px] uppercase tracking-wider block font-medium">Current Bid</span>
                    <span className="font-extrabold text-yellow-400">{formatPrice(currentBid)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upcoming Players list trigger */}
      <div className="shrink-0 pt-0.5">
        <Button
          variant="outline"
          className="w-full rounded-xl border-slate-700/80 text-slate-300 hover:bg-slate-900/60 hover:text-white transition-all text-xs font-semibold cursor-pointer"
          onClick={() => setShowUpcoming((prev) => !prev)}
        >
          {showUpcoming ? 'Hide' : 'View'} Set Players ({upcomingPlayers.length})
        </Button>
        {showUpcoming && (
          <div className="mt-2 max-h-[120px] overflow-y-auto rounded-lg border border-slate-700/60 bg-slate-950 p-2.5">
            <p className="mb-1 text-[9px] text-yellow-400 font-extrabold uppercase tracking-wider">Remaining in Set</p>
            {upcomingPlayers.length ? (
              <ul className="space-y-1 text-xs text-slate-300">
                {upcomingPlayers.map((name, idx) => (
                  <li key={`${name}-${idx}`} className="truncate border-b border-white/5 pb-0.5 last:border-none">
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">No remaining players in this set.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const BidControls = memo(BidControlsComponent);
