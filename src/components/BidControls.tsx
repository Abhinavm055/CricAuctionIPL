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
  isHost?: boolean;
  onSkip?: () => void;
  onPauseToggle?: () => void;
  isPaused?: boolean;
  recentPurchases?: RecentPurchase[];
}

export const BidControls = ({
  currentBid,
  purseRemaining,
  canBid,
  onBid,
  isHost,
  onSkip,
  onPauseToggle,
  isPaused,
  recentPurchases = [],
}: BidControlsProps) => {
  const nextBid = getNextBid(currentBid);

  return (
    <div className="h-full rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3 space-y-3 relative z-20">
      <p className="text-xs uppercase tracking-widest text-yellow-300">Control Panel</p>

      <div className="space-y-1 text-sm text-slate-200">
        <p>YOUR PURSE</p>
        <p className="text-2xl font-bold text-yellow-300">{formatPrice(purseRemaining)}</p>
      </div>

      <Button
        className="w-full bg-yellow-400 text-black hover:bg-yellow-300 font-bold relative z-30"
        onClick={() => onBid(nextBid)}
        disabled={!canBid}
      >
        BID
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onSkip} disabled={!isHost || !onSkip}>SKIP PLAYER</Button>
        <Button variant="outline" onClick={onPauseToggle} disabled={!isHost || !onPauseToggle}>{isPaused ? 'RESUME' : 'PAUSE'}</Button>
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-yellow-300 mb-2">Recent Purchases</p>
        <div className="max-h-28 overflow-auto space-y-1 text-xs text-slate-200">
          {recentPurchases.length ? recentPurchases.map((p, idx) => (
            <p key={`${p.playerName}-${idx}`}>{p.playerName} → {p.teamShortName} → {formatPrice(p.price)}</p>
          )) : <p className="text-muted-foreground">No purchases yet.</p>}
        </div>
      </div>
    </div>
  );
};
