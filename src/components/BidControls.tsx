import { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './ui/dialog';
import { formatPrice, getNextBid } from '@/lib/constants';

const formatCrPrice = (amount: number) => `₹${(Number(amount || 0) / 10000000).toFixed(2)} Cr`;
import { Player } from '@/lib/samplePlayers';
import { StarRating } from './StarRating';
import { Search, SlidersHorizontal, ArrowUpDown, Flag, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface RecentPurchase {
  playerName: string;
  teamShortName: string;
  price: number;
  timestamp?: number;
}

interface BidControlsProps {
  currentBid: number;
  canBid: boolean;
  onBid: (amount: number) => Promise<void> | void;
  recentPurchases?: RecentPurchase[];
  remainingPlayers?: Player[];
  unsoldPlayers?: Player[];
  soldPlayers?: (Player & { soldPrice?: number; soldTeamShortName?: string; soldTeamId?: string; isRetained?: boolean })[];
  currentPlayer?: Player | null;
  lockedAuctionSets?: Array<{ key: string; label: string; playerIds: string[] }>;
  activeSetKey?: string;
  isSquadComplete?: boolean;
}

const BID_COOLDOWN_MS = 250;

const BidControlsComponent = ({
  currentBid,
  canBid,
  onBid,
  recentPurchases = [],
  remainingPlayers = [],
  unsoldPlayers = [],
  soldPlayers = [],
  currentPlayer = null,
  lockedAuctionSets = [],
  activeSetKey,
  isSquadComplete = false,
}: BidControlsProps) => {
  const [isBidPending, setIsBidPending] = useState(false);
  const lastClickRef = useRef(0);
  const nextBid = getNextBid(currentBid);

  // Tab State
  const [activeTab, setActiveTab] = useState<'sets' | 'sold' | 'unsold'>('sets');
  const [expandedSetKeys, setExpandedSetKeys] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper'>('ALL');
  const [setFilter, setSetFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'basePrice' | 'rating'>('basePrice');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Profile Modal State
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (canBid) setIsBidPending(false);
  }, [canBid, currentBid]);

  const handleBidClick = useCallback(async () => {
    const now = Date.now();
    if (now - lastClickRef.current < BID_COOLDOWN_MS || !canBid || isBidPending) return;
    lastClickRef.current = now;
    setIsBidPending(true);
    try {
      await onBid(nextBid);
    } catch (err) {
      console.error("[BidControls UI Error] Bid execution failed:", err);
    } finally {
      setIsBidPending(false);
    }
  }, [canBid, isBidPending, onBid, nextBid]);

  // Clean and filter helper
  const filterAndSort = useCallback(<T extends Player>(list: T[]): T[] => {
    return list
      .filter((p) => {
        if (!p) return false;
        // Search bar
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Role filter
        let matchesRole = true;
        if (roleFilter !== 'ALL') {
          const roleNormalized = p.role.toLowerCase();
          const filterNormalized = roleFilter.toLowerCase();
          if (filterNormalized === 'wicket-keeper') {
            matchesRole = roleNormalized.includes('wicket');
          } else if (filterNormalized === 'all-rounder') {
            matchesRole = roleNormalized.includes('all');
          } else {
            matchesRole = roleNormalized.startsWith(filterNormalized.slice(0, 3));
          }
        }

        // Set filter
        let matchesSet = true;
        if (setFilter !== 'ALL') {
          if (setFilter === 'ACTIVE') {
            if (activeSetKey) {
              const activeSet = lockedAuctionSets.find((s) => s.key === activeSetKey);
              matchesSet = Boolean(activeSet?.playerIds?.includes(p.id));
            } else {
              matchesSet = false;
            }
          } else {
            const targetSet = lockedAuctionSets.find((s) => s.key === setFilter);
            matchesSet = Boolean(targetSet?.playerIds?.includes(p.id));
          }
        }

        return matchesSearch && matchesRole && matchesSet;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'name') {
          comparison = a.name.localeCompare(b.name);
        } else if (sortBy === 'basePrice') {
          comparison = a.basePrice - b.basePrice;
        } else if (sortBy === 'rating') {
          const ratingA = Number((a as any).starRating ?? a.rating ?? 3);
          const ratingB = Number((b as any).starRating ?? b.rating ?? 3);
          comparison = ratingA - ratingB;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [searchQuery, roleFilter, setFilter, sortBy, sortOrder, lockedAuctionSets, activeSetKey]);

  // Processed lists
  const filteredUnsold = useMemo(() => filterAndSort(unsoldPlayers), [unsoldPlayers, filterAndSort]);

  const filteredRecentPurchases = useMemo(() => {
    return (recentPurchases || []).filter(p => p.playerName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [recentPurchases, searchQuery]);

  const soldPlayerMap = useMemo(() => {
    return new Map((soldPlayers || []).map(p => [p.id, p]));
  }, [soldPlayers]);

  const unsoldPlayerMap = useMemo(() => {
    return new Map((unsoldPlayers || []).map(p => [p.id, p]));
  }, [unsoldPlayers]);

  const allPlayersMap = useMemo(() => {
    const map = new Map<string, Player>();
    (remainingPlayers || []).forEach(p => { if (p.id) map.set(p.id, p); });
    (soldPlayers || []).forEach(p => { if (p.id) map.set(p.id, p); });
    (unsoldPlayers || []).forEach(p => { if (p.id) map.set(p.id, p); });
    if (currentPlayer && currentPlayer.id) map.set(currentPlayer.id, currentPlayer);
    return map;
  }, [remainingPlayers, soldPlayers, unsoldPlayers, currentPlayer]);

  const toggleSetExpand = useCallback((key: string) => {
    setExpandedSetKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  const normalizeRoleBadge = (role: string) => {
    const norm = String(role || '').toLowerCase();
    if (norm.includes('wicket')) return 'WK';
    if (norm.includes('all')) return 'AR';
    if (norm.includes('bowl')) return 'BOWL';
    return 'BAT';
  };

  const getRoleColor = (role: string) => {
    const norm = String(role || '').toLowerCase();
    if (norm.includes('wicket')) return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    if (norm.includes('all')) return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    if (norm.includes('bowl')) return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  };

  return (
    <div className="h-full flex flex-col rounded-2xl border border-yellow-500/35 bg-gradient-to-br from-[#051126]/95 to-[#020917]/98 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* Bid Interaction Panel */}
      <div className="bg-[#030d1c]/80 rounded-xl p-3 border border-white/5 space-y-2 shrink-0 mb-3">
        <div className="flex justify-between items-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Place Bid</p>
          {currentPlayer && (
            <span className="text-[9px] uppercase tracking-wider text-yellow-400 font-bold bg-yellow-500/10 border border-yellow-500/30 px-1.5 py-0.5 rounded">
              Active: {currentPlayer.name.split(' ')[0]}
            </span>
          )}
        </div>
        <Button
          className="h-12 w-full rounded-xl bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-slate-950 text-lg font-black hover:brightness-105 transition-all shadow-[0_4px_15px_rgba(234,179,8,0.25)] border border-yellow-300/40 cursor-pointer disabled:opacity-50"
          onClick={handleBidClick}
          disabled={!canBid || isBidPending}
        >
          {isSquadComplete ? 'SQUAD COMPLETE' : isBidPending ? 'BIDDING...' : 'PLACE BID'}
        </Button>
        <p className="text-center text-[11px] text-slate-400 font-medium">
          Next bid: <span className="font-extrabold text-yellow-400 tracking-wide">{formatPrice(nextBid)}</span>
        </p>
      </div>

      {/* Upgraded Directory Panel */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Main Tab Selection */}
        <div className="grid grid-cols-3 gap-1 bg-[#020d1c]/90 rounded-lg p-1 border border-white/5 shrink-0 mb-2.5 relative">
          <button
            onClick={() => setActiveTab('sets')}
            className={`py-1.5 px-2 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'sets'
                ? 'bg-[#0066cc] text-white shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            📋 SETS
          </button>
          <button
            onClick={() => setActiveTab('sold')}
            className={`py-1.5 px-2 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'sold'
                ? 'bg-emerald-500 text-white shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            🤝 SOLD
          </button>
          <button
            onClick={() => setActiveTab('unsold')}
            className={`py-1.5 px-2 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'unsold'
                ? 'bg-rose-500 text-white shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            ❌ UNSOLD
          </button>
        </div>

        {/* Directory Controls and Collapsible Filters */}
        {activeTab !== 'sets' && (
          <div className="shrink-0 space-y-2 mb-2">
            <div className="flex justify-between items-center bg-black/10 p-1.5 rounded-lg border border-white/5 animate-[fadeIn_0.2s_ease]">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Directory Controls</span>
              <Button
                variant="outline"
                className="h-6 text-[9px] px-2 border-slate-700/80 hover:bg-slate-800 text-slate-300 font-bold flex items-center gap-1 cursor-pointer"
                onClick={() => setShowFilters(prev => !prev)}
              >
                <SlidersHorizontal className="h-2.5 w-2.5 text-yellow-400" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </Button>
            </div>

            {/* Collapsible Filter Panel */}
            {showFilters && (
              <div className="space-y-2 bg-black/15 p-2 rounded-lg border border-white/5 animate-[fadeIn_0.2s_ease]">
                {/* Search bar */}
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Search Directory</span>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    <Input
                      type="text"
                      placeholder="Search player name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 rounded-md bg-[#020b17] border-slate-700/60 text-xs text-white placeholder-slate-500 focus-visible:ring-yellow-500/50"
                    />
                  </div>
                </div>

                {activeTab === 'unsold' && (
                  <>
                    {/* Filter options */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Filter role */}
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1 leading-none">Role</span>
                        <Select
                          value={roleFilter}
                          onValueChange={(val: any) => setRoleFilter(val)}
                        >
                          <SelectTrigger className="h-7 text-[10px] bg-[#020b17] border-slate-700/60 rounded-md text-white">
                            <SelectValue placeholder="All Roles" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#051126] border-slate-700 text-white text-[10px]">
                            <SelectItem value="ALL">All Roles</SelectItem>
                            <SelectItem value="Batsman">Batsmen</SelectItem>
                            <SelectItem value="Bowler">Bowlers</SelectItem>
                            <SelectItem value="All-Rounder">All-Rounders</SelectItem>
                            <SelectItem value="Wicket-Keeper">Wicket Keepers</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Filter set */}
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1 leading-none">Set</span>
                        <Select
                          value={setFilter}
                          onValueChange={(val: string) => setSetFilter(val)}
                        >
                          <SelectTrigger className="h-7 text-[10px] bg-[#020b17] border-slate-700/60 rounded-md text-white">
                            <SelectValue placeholder="All Sets" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#051126] border-slate-700 text-white text-[10px] max-h-40 overflow-y-auto">
                            <SelectItem value="ALL">All Sets</SelectItem>
                            <SelectItem value="ACTIVE">Current Set Only</SelectItem>
                            {lockedAuctionSets.map((set) => (
                              <SelectItem key={set.key} value={set.key}>{set.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Sort options row */}
                    <div className="space-y-1">
                      <span
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="text-[9px] uppercase font-bold text-slate-400 flex items-center justify-between hover:text-white cursor-pointer select-none"
                      >
                        <span className="flex items-center gap-1">
                          <ArrowUpDown className="h-2.5 w-2.5 text-yellow-400" /> Sort Order
                        </span>
                        <span className="text-[8px] font-mono text-yellow-400">({sortOrder.toUpperCase()})</span>
                      </span>
                      <Select
                        value={sortBy}
                        onValueChange={(val: any) => setSortBy(val)}
                      >
                        <SelectTrigger className="h-7 text-[10px] bg-[#020b17] border-slate-700/60 rounded-md text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#051126] border-slate-700 text-white text-[10px]">
                          <SelectItem value="basePrice">Base Price</SelectItem>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="rating">Rating</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Scrollable list */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-800 bg-[#020b17]/50 p-2 space-y-2.5 scrollbar-thin pr-1">
          {activeTab === 'sets' && (
            <div className="space-y-2">
              {lockedAuctionSets.map((set) => {
                const isExpanded = expandedSetKeys[set.key];
                const totalCount = set.playerIds?.length || 0;
                
                let soldCount = 0;
                let unsoldCount = 0;
                let upcomingCount = 0;
                
                set.playerIds?.forEach(id => {
                  if (id === currentPlayer?.id) {
                    upcomingCount++;
                  } else if (soldPlayerMap.has(id)) {
                    soldCount++;
                  } else if (unsoldPlayerMap.has(id)) {
                    unsoldCount++;
                  } else {
                    upcomingCount++;
                  }
                });

                return (
                  <div key={set.key} className="border border-white/5 rounded-xl bg-slate-950/25 overflow-hidden transition-all duration-200">
                    <button
                      onClick={() => toggleSetExpand(set.key)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-all cursor-pointer"
                    >
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-yellow-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                          {set.label}
                        </h4>
                        <div className="flex gap-2.5 text-[9px] font-mono text-slate-400 pl-5">
                          <span>Tot: {totalCount}</span>
                          {soldCount > 0 && <span className="text-emerald-400 font-bold">S: {soldCount}</span>}
                          {unsoldCount > 0 && <span className="text-rose-400 font-bold">U: {unsoldCount}</span>}
                          {upcomingCount > 0 && <span className="text-yellow-400/80">R: {upcomingCount}</span>}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-white/5 p-2.5 bg-[#020b17]/40 space-y-2 divide-y divide-white/5 max-h-[250px] overflow-y-auto scrollbar-thin">
                        {set.playerIds?.map(playerId => {
                          const player = allPlayersMap.get(playerId);
                          if (!player) return null;
                          
                          const isPlayerActive = playerId === currentPlayer?.id;
                          const soldPlayer = soldPlayerMap.get(playerId);
                          const unsoldPlayer = unsoldPlayerMap.get(playerId);
                          
                          let statusBadge = null;
                          if (isPlayerActive) {
                            statusBadge = (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 animate-pulse">
                                ⚡ ACTIVE
                              </span>
                            );
                          } else if (soldPlayer) {
                            statusBadge = (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                {soldPlayer.isRetained ? 'RETAINED' : 'SOLD'} ({soldPlayer.soldTeamShortName} - {formatCrPrice(soldPlayer.soldPrice || 0)})
                              </span>
                            );
                          } else if (unsoldPlayer) {
                            statusBadge = (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/25">
                                UNSOLD
                              </span>
                            );
                          } else {
                            statusBadge = (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                                UPCOMING
                              </span>
                            );
                          }

                          return (
                            <div 
                              key={playerId} 
                              onClick={() => setSelectedPlayer(player)}
                              className="flex items-center justify-between pt-2 first:pt-0 hover:bg-white/5 p-1 rounded transition-colors cursor-pointer"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-extrabold text-[10.5px] text-slate-200 truncate uppercase">
                                  {player.name}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[7.5px] text-slate-400 uppercase font-black">{normalizeRoleBadge(player.role)}</span>
                                  <span className="text-[8px] text-slate-500 font-mono">Base: {formatPrice(player.basePrice)}</span>
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                {statusBadge}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'sold' && (
            <div className="space-y-2">
              {filteredRecentPurchases.length ? (
                filteredRecentPurchases.map((purchase, index) => {
                  const pl = allPlayersMap.get(purchase.playerId || '');
                  return (
                    <div 
                      key={`${purchase.playerName}-${index}`} 
                      onClick={() => pl && setSelectedPlayer(pl)}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#051126]/60 border border-slate-800 hover:border-slate-700/60 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-extrabold text-[11px] text-slate-200 uppercase truncate">
                          {purchase.playerName}
                        </p>
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold uppercase mt-1 inline-block">
                          SOLD to {purchase.teamShortName}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-yellow-400 block font-mono">
                          {formatCrPrice(purchase.price)}
                        </span>
                        <span className="text-[7px] text-slate-500 font-bold uppercase block mt-0.5">Sold Price</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No sold players found.
                </div>
              )}
            </div>
          )}

          {activeTab === 'unsold' && (
            <div className="space-y-2">
              {filteredUnsold.length ? (
                filteredUnsold.map((player) => (
                  <div 
                    key={player.id} 
                    onClick={() => setSelectedPlayer(player)}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#051126]/60 border border-slate-800 hover:border-slate-700/60 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-extrabold text-[11px] text-slate-200 uppercase truncate">
                        {player.name}
                      </p>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border mt-1 inline-block ${getRoleColor(player.role)}`}>
                        {normalizeRoleBadge(player.role)}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-yellow-400 block font-mono">
                        {formatPrice(player.basePrice)}
                      </span>
                      <span className="text-[7px] text-slate-500 font-bold uppercase block mt-0.5">Base Price</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No unsold players found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile Details Dialog */}
      <Dialog open={!!selectedPlayer} onOpenChange={(open) => !open && setSelectedPlayer(null)}>
        <DialogContent className="max-w-md bg-[#051126] border border-yellow-500/40 text-white rounded-2xl shadow-2xl p-5">
          {selectedPlayer && (() => {
            const playerImage = (selectedPlayer as any).image || selectedPlayer.imageUrl;
            const rating = Number((selectedPlayer as any).starRating ?? selectedPlayer.rating ?? 3) as 1 | 2 | 3 | 4 | 5;
            const soldDetails = soldPlayerMap.get(selectedPlayer.id);
            const isUnsold = unsoldPlayerMap.has(selectedPlayer.id);

            return (
              <div className="space-y-4">
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider border uppercase ${getRoleColor(selectedPlayer.role)}`}>
                      {selectedPlayer.role}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Flag className="h-3 w-3 text-yellow-400" /> {selectedPlayer.nationality}
                    </span>
                  </div>
                  <DialogTitle className="text-2xl font-display uppercase tracking-wide text-yellow-100 mt-1.5">
                    {selectedPlayer.name}
                  </DialogTitle>
                </DialogHeader>

                {/* Main Card Content */}
                <div className="grid grid-cols-[1.2fr_2fr] gap-4 bg-black/30 p-3 rounded-xl border border-white/5">
                  <div className="aspect-[3/4] rounded-lg border border-slate-700 bg-slate-900 overflow-hidden relative flex items-center justify-center">
                    {playerImage ? (
                      <img
                        src={playerImage}
                        alt={selectedPlayer.name}
                        className="h-full w-full object-contain object-center"
                        onError={(e) => {
                          (e.target as any).src = '';
                          (e.target as any).style.display = 'none';
                        }}
                      />
                    ) : (
                      <HelpCircle className="h-10 w-10 text-slate-600 animate-pulse" />
                    )}
                  </div>

                  <div className="space-y-2.5 text-xs text-slate-300">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-slate-500 text-[9px] uppercase tracking-wider block font-bold">Class</span>
                        <span className="font-semibold text-slate-100">{selectedPlayer.isCapped ? 'Capped' : 'Uncapped'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[9px] uppercase tracking-wider block font-bold">Country</span>
                        <span className="font-semibold text-slate-100">{selectedPlayer.isOverseas ? 'Overseas ✈' : 'India 🇮🇳'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[9px] uppercase tracking-wider block font-bold">Rating</span>
                        <div className="flex pt-0.5"><StarRating rating={rating} size="sm" /></div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[9px] uppercase tracking-wider block font-bold">Prev Team</span>
                        <span className="font-semibold text-slate-100 truncate block">{selectedPlayer.previousTeam || 'None'}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <div className="flex justify-between items-center bg-[#020b17]/85 p-2 rounded border border-white/5">
                        <span className="text-slate-400 font-medium">Base Price:</span>
                        <span className="font-bold text-white">{formatCrPrice(selectedPlayer.basePrice)}</span>
                      </div>

                      {/* Sold Details */}
                      {soldDetails && (
                        <div className="flex flex-col gap-1.5 bg-emerald-500/10 p-2 rounded border border-emerald-500/25">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400 font-bold uppercase tracking-wider">Status:</span>
                            <span className="font-black text-emerald-400 uppercase tracking-widest text-xs">
                              {soldDetails.isRetained ? 'RETAINED' : 'SOLD'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400 font-bold">Sold Price:</span>
                            <span className="font-black text-emerald-300 text-sm">{formatCrPrice(soldDetails.soldPrice || 0)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px] pt-1 border-t border-emerald-500/15">
                            <span className="text-slate-400 font-bold">Purchaser:</span>
                            <span className="font-extrabold text-white text-xs">{soldDetails.soldTeamShortName}</span>
                          </div>
                        </div>
                      )}

                      {/* Unsold Details */}
                      {isUnsold && (
                        <div className="bg-rose-500/10 p-2.5 rounded border border-rose-500/25 text-center">
                          <span className="font-black text-rose-400 uppercase tracking-widest text-xs">
                            ❌ UNSOLD IN GENERAL ROUND
                          </span>
                          <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                            Can be nominated again in the upcoming Accelerated Round.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <DialogClose asChild>
                    <Button variant="outline" className="h-8 border-slate-700/80 hover:bg-slate-800 text-xs px-4">
                      Close Profile
                    </Button>
                  </DialogClose>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const BidControls = memo(BidControlsComponent);
