import { POOL_ORDER } from '@/lib/samplePlayers';

interface AuctionHeaderProps {
  gameCode: string;
  currentPool: string;
  playersRemaining: number;
  totalPlayers: number;
}

export const AuctionHeader = ({
  gameCode,
  currentPool,
  playersRemaining,
  totalPlayers,
}: AuctionHeaderProps) => {
  const currentPoolIndex = POOL_ORDER.indexOf(currentPool as typeof POOL_ORDER[number]);
  const progress = ((totalPlayers - playersRemaining) / totalPlayers) * 100;

  return (
    <header className="w-full px-6 py-4 bg-secondary/50 backdrop-blur-md border-b border-border/50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          {/* Logo and title */}
          <div className="flex items-center gap-4">
            <h1 className="font-display text-3xl text-primary">
              CricAuction<span className="text-foreground">IPL</span>
            </h1>
            <div className="h-8 w-px bg-border" />
            <span className="px-3 py-1 bg-primary/20 text-primary font-mono font-bold rounded-lg border border-primary/30">
              {gameCode}
            </span>
          </div>

          {/* Auction info */}
          <div className="flex items-center gap-8">
            {/* Current pool */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Set</p>
              <p className="font-display text-xl text-primary">{currentPool}</p>
            </div>

            {/* Players remaining */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Remaining</p>
              <p className="font-display text-xl text-foreground">
                {playersRemaining} <span className="text-muted-foreground text-sm">/ {totalPlayers}</span>
              </p>
            </div>

            {/* Live indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 rounded-full">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-bold text-red-500 uppercase tracking-wider">Live</span>
            </div>
          </div>
        </div>

        {/* Pool progress bar */}
        <div className="flex items-center gap-2">
          {POOL_ORDER.map((pool, index) => (
            <div key={pool} className="flex-1 flex items-center gap-1">
              <div 
                className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                  index < currentPoolIndex 
                    ? 'bg-primary' 
                    : index === currentPoolIndex 
                      ? 'bg-gradient-to-r from-primary to-primary/50' 
                      : 'bg-border'
                }`}
              />
              <span 
                className={`text-[10px] font-medium whitespace-nowrap ${
                  index <= currentPoolIndex ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {pool.split('-')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
};
