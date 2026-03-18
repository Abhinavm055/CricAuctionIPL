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
  purseRemaining?: number;
  canBid: boolean;
  onBid: (amount: number) => void;
  isHost?: boolean;
  onSkip?: () => void;
  onPauseToggle?: () => void;
  isPaused?: boolean;
  recentPurchases?: RecentPurchase[];
  teamLabel?: string;
  modeLabel?: string;
  isSpectator?: boolean;
  onViewRemainingPlayers?: () => void;
  onSimulateAuction?: () => void;
  showSimulateAuction?: boolean;
  canManageAuction?: boolean;
}

const BID_COOLDOWN_MS = 300;

const BidControlsComponent = ({
  currentBid,
  purseRemaining,
  canBid,
  onBid,
  isHost,
  onSkip,
  onPauseToggle,
  isPaused,
  recentPurchases = [],
  teamLabel,
  modeLabel,
  isSpectator = false,
  onViewRemainingPlayers,
  onSimulateAuction,
  showSimulateAuction = false,
  canManageAuction,
}: BidControlsProps) => {
  const [isBidClicked, setIsBidClicked] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const lastClickRef = useRef(0);
  const nextBid = getNextBid(currentBid);
  const manager = typeof canManageAuction === 'boolean' ? canManageAuction : isHost;

  return (
    <div className="h-full rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3 space-y-3 relative z-20">
      <p className="text-xs uppercase tracking-widest text-yellow-300">Control Panel</p>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-200">
        <div className="rounded-lg border border-white/10 bg-black/10 p-2">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Mode</p>
          <p className="mt-1 font-semibold text-white">{modeLabel || 'Auction'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/10 p-2">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Seat</p>
          <p className="mt-1 font-semibold text-white">{teamLabel || (isSpectator ? 'Spectator' : 'Unassigned')}</p>
        </div>
      </div>

      <div className="space-y-1 text-sm text-slate-200">
        <p>{isSpectator ? 'VIEW ONLY' : 'YOUR PURSE'}</p>
        <p className="text-2xl font-bold text-yellow-300">{isSpectator ? '—' : formatPrice(Number(purseRemaining || 0))}</p>
      </div>

      <Button
        className="w-full bg-yellow-400 text-black hover:bg-yellow-300 font-bold relative z-30"
        onClick={() => onBid(nextBid)}
        disabled={!canBid || isSpectator}
      >
        {isSpectator ? 'SPECTATOR MODE' : `BID ${formatPrice(nextBid)}`}
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onViewRemainingPlayers} disabled={!onViewRemainingPlayers}>REMAINING</Button>
        <Button variant="outline" onClick={onPauseToggle} disabled={!manager || !onPauseToggle}>{isPaused ? 'RESUME' : 'PAUSE'}</Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onSkip} disabled={!manager || !onSkip}>SKIP PLAYER</Button>
        <Button variant="outline" onClick={onSimulateAuction} disabled={!showSimulateAuction || !onSimulateAuction}>
          AI SIM
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
    </div>
  );
};

export const BidControls = memo(BidControlsComponent);
