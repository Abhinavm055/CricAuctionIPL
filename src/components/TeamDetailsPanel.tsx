import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatPrice, SQUAD_CONSTRAINTS } from "@/lib/constants";
import { Player } from "@/lib/samplePlayers";
import { TeamLogo } from "./TeamLogo";
import { PlayerInitialsAvatar } from "./PlayerInitialsAvatar";
import { Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamDetailsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: any | null;
  retainedPlayers: Player[];
  boughtPlayers: Player[];
  playerPrices: Record<string, number>;
}

const normalizeRole = (role: string) => {
  const norm = String(role || '').toLowerCase();
  if (norm.includes('wicket')) return 'wk';
  if (norm.includes('all')) return 'ar';
  if (norm.includes('bowl')) return 'bowl';
  return 'bat';
};

export const TeamDetailsPanel = ({
  open,
  onOpenChange,
  team,
  retainedPlayers,
  boughtPlayers,
  playerPrices,
}: TeamDetailsPanelProps) => {
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'bat' | 'bowl' | 'ar' | 'wk'>('ALL');

  const allPlayers = useMemo(() => {
    return [
      ...retainedPlayers.map((p) => ({ ...p, acquisitionType: 'Retained' as const })),
      ...boughtPlayers.map((p) => ({ ...p, acquisitionType: 'Bought' as const })),
    ];
  }, [retainedPlayers, boughtPlayers]);

  const stats = useMemo(() => {
    let overseas = 0;
    let batters = 0;
    let bowlers = 0;
    let allrounders = 0;
    let keepers = 0;

    allPlayers.forEach((p) => {
      if ((p as any).overseas || p.isOverseas) overseas++;
      const r = normalizeRole(p.role);
      if (r === 'bat') batters++;
      else if (r === 'bowl') bowlers++;
      else if (r === 'ar') allrounders++;
      else if (r === 'wk') keepers++;
    });

    return { overseas, batters, bowlers, allrounders, keepers };
  }, [allPlayers]);

  const filteredPlayers = useMemo(() => {
    if (roleFilter === 'ALL') return allPlayers;
    return allPlayers.filter((p) => normalizeRole(p.role) === roleFilter);
  }, [allPlayers, roleFilter]);

  if (!team) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[560px] bg-[#09152A]/98 border-l border-white/[0.08] text-white p-6 overflow-y-auto backdrop-blur-2xl">
        <SheetHeader className="text-left border-b border-white/[0.06] pb-4">
          <div className="flex items-center gap-3.5">
            <TeamLogo
              teamId={team.id}
              logo={team.logo}
              shortName={team.shortName}
              size="md"
              className="shrink-0"
            />
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest text-amber-400 uppercase">
                <Shield className="w-3 h-3" />
                <span>Franchise Roster</span>
              </div>
              <SheetTitle className="font-display text-2xl font-black text-white uppercase tracking-wide leading-tight">
                {team.name}
              </SheetTitle>
            </div>
          </div>
        </SheetHeader>

        {/* Squad Metrics Dashboard */}
        <div className="grid grid-cols-3 gap-2.5 my-5">
          <div className="rounded-xl border border-white/[0.06] bg-[#050B16] p-3 text-center">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block">Purse Left</span>
            <span className="font-mono font-black text-amber-400 text-sm mt-0.5 block">
              {formatPrice(team.purseRemaining || 0)}
            </span>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#050B16] p-3 text-center">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block">Squad Size</span>
            <span className="font-mono font-black text-white text-sm mt-0.5 block">
              {allPlayers.length}/{SQUAD_CONSTRAINTS.MAX_SQUAD}
            </span>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#050B16] p-3 text-center">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block">Overseas</span>
            <span className="font-mono font-black text-cyan-400 text-sm mt-0.5 block">
              {stats.overseas}/8
            </span>
          </div>
        </div>

        {/* Role Breakdown Pills */}
        <div className="grid grid-cols-4 gap-2 mb-4 text-center">
          <div className="rounded-lg border border-white/[0.04] bg-[#050B16]/60 p-2">
            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Batters</span>
            <span className="font-mono font-bold text-white text-xs">{stats.batters}</span>
          </div>
          <div className="rounded-lg border border-white/[0.04] bg-[#050B16]/60 p-2">
            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Bowlers</span>
            <span className="font-mono font-bold text-white text-xs">{stats.bowlers}</span>
          </div>
          <div className="rounded-lg border border-white/[0.04] bg-[#050B16]/60 p-2">
            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">All-Round</span>
            <span className="font-mono font-bold text-white text-xs">{stats.allrounders}</span>
          </div>
          <div className="rounded-lg border border-white/[0.04] bg-[#050B16]/60 p-2">
            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Keepers</span>
            <span className="font-mono font-bold text-white text-xs">{stats.keepers}</span>
          </div>
        </div>

        {/* Role Filter Tabs */}
        <div className="flex gap-1 bg-[#050B16] rounded-xl p-1 border border-white/[0.06] mb-4">
          {[
            { key: 'ALL', label: 'All' },
            { key: 'bat', label: 'BAT' },
            { key: 'bowl', label: 'BOWL' },
            { key: 'ar', label: 'AR' },
            { key: 'wk', label: 'WK' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRoleFilter(tab.key as any)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                roleFilter === tab.key
                  ? "bg-[#09152A] text-amber-400 border border-amber-400/30 font-black shadow"
                  : "text-slate-400 hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Player Roster List */}
        <div className="space-y-2">
          {filteredPlayers.length ? (
            filteredPlayers.map((player) => {
              const isOverseas = Boolean((player as any).overseas || player.isOverseas);
              const price = playerPrices[player.id] || player.basePrice;

              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-[#050B16]/80 hover:border-amber-400/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlayerInitialsAvatar
                      name={player.name}
                      role={player.role}
                      isOverseas={isOverseas}
                      image={player.imageUrl || (player as any).image}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-sm truncate">
                          {player.name}
                        </span>
                        {isOverseas && (
                          <span className="text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                            OS
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="font-semibold uppercase">{player.role}</span>
                        <span>•</span>
                        <span className={cn("font-bold uppercase", player.acquisitionType === 'Retained' ? "text-amber-400" : "text-emerald-400")}>
                          {player.acquisitionType}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-amber-400 text-xs block">
                      {formatPrice(price)}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block">
                      {player.acquisitionType === 'Retained' ? 'Retention Cost' : 'Auction Price'}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center border border-dashed border-white/10 rounded-xl">
              <p className="text-xs text-slate-400">No players found matching current filter.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
