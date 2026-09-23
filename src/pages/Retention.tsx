import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { IPL_TEAMS, formatPrice, RETENTION_COSTS, getPlayerPreviousTeam } from '@/lib/constants';
import { listenSession, lockRetention } from '@/lib/sessionService';
import type { Player } from '@/lib/samplePlayers';
import { useGameData } from '@/contexts/GameDataContext';
import { TeamLogo } from '@/components/TeamLogo';
import { Check, CheckCircle2, Sparkles, User, Shield, ArrowRight, ArrowLeft } from 'lucide-react';
import { RETENTION_ROLE_ORDER, groupPlayersByRetentionRole } from '@/lib/playerSorting';
import { motion } from 'framer-motion';
import { useUserId } from '@/hooks/useUserId';
import { PlayerInitialsAvatar } from '@/components/PlayerInitialsAvatar';
import { cn } from '@/lib/utils';

const roleBadge = (role: string) => {
  if (role.toLowerCase().includes('wicket')) return 'WK';
  if (role.toLowerCase().includes('all')) return 'AR';
  if (role.toLowerCase().includes('bowl')) return 'BWL';
  return 'BAT';
};

const Retention = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const { masterPlayerList } = useGameData();
  const userId = useUserId();

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, setSession);
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    if (!session?.retentions || !session?.allTeams) return;
    const allLocked = session.allTeams.map((t: any) => t.id).every((id: string) => session.retentions[id]?.locked === true);
    if (session?.phase === 'ENDED') {
      navigate(`/auction/${gameCode}`);
      return;
    }
    if (allLocked) navigate(`/retention-review/${gameCode}`);
  }, [session, gameCode, navigate]);

  const myTeam = useMemo(() => {
    if (!session || !userId) return null;
    return Object.entries(session.selectedTeams || {}).find(([, uid]) => uid === userId)?.[0] ?? null;
  }, [session, userId]);

  const managerName = useMemo(() => {
    if (!myTeam) return localStorage.getItem('managerName') || 'Manager';
    return session?.managerNames?.[myTeam] || localStorage.getItem('managerName') || 'Manager';
  }, [myTeam, session]);

  const squad: Player[] = useMemo(() => {
    if (!myTeam) return [];
    return masterPlayerList.filter((p: any) => getPlayerPreviousTeam(p).toLowerCase() === myTeam.toLowerCase());
  }, [masterPlayerList, myTeam]);

  const groupedSquad = useMemo(() => groupPlayersByRetentionRole(squad as any[]), [squad]);

  const costById = useMemo(() => {
    let cappedSlot = 0;
    const map: Record<string, number> = {};
    selected.forEach((id) => {
      const p: any = squad.find((s) => s.id === id);
      if (!p) return;
      if (p.isCapped) {
        map[id] = RETENTION_COSTS.CAPPED_SLOTS[Math.min(cappedSlot, RETENTION_COSTS.CAPPED_SLOTS.length - 1)];
        cappedSlot += 1;
      } else {
        map[id] = RETENTION_COSTS.UNCAPPED;
      }
    });
    return map;
  }, [selected, squad]);

  const cappedCount = useMemo(
    () => selected.filter((id) => Boolean((squad.find((p: any) => p.id === id) as any)?.isCapped)).length,
    [selected, squad],
  );
  const uncappedCount = selected.length - cappedCount;
  const selectedSpend = useMemo(() => selected.reduce((sum, id) => sum + Number(costById[id] || 0), 0), [selected, costById]);

  const basePurse = IPL_TEAMS.find((t) => t.id === myTeam)?.purse || 0;
  const remainingPurse = Math.max(0, basePurse - selectedSpend);
  const rtmCards = Math.max(0, 6 - selected.length);

  const handleFinalize = async () => {
    if (!gameCode || !myTeam) return;
    await lockRetention(gameCode, myTeam, selected, cappedCount, uncappedCount);
    navigate(`/retention-review/${gameCode}`);
  };

  const handleToggle = (playerId: string) => {
    if (selected.includes(playerId)) {
      setSelected((prev) => prev.filter((id) => id !== playerId));
      return;
    }

    if (selected.length >= 6) return;
    const player: any = squad.find((p) => p.id === playerId);
    if (!player) return;
    if (player.isCapped && cappedCount >= 5) return;
    if (!player.isCapped && uncappedCount >= 2) return;
    setSelected((prev) => [...prev, playerId]);
  };

  if (!session || !myTeam) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#020817] text-white select-none">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-amber-400 border-t-transparent" />
      <p className="font-display tracking-widest text-lg text-amber-400 mt-4 animate-pulse uppercase">LOADING RETENTIONS...</p>
    </div>
  );

  const team = IPL_TEAMS.find((t) => t.id === myTeam);

  return (
    <div className="min-h-screen flex flex-col bg-[#020817] text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950 relative overflow-hidden">
      {/* Top Header Navigation (No Landing Tagbar) */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-4 md:px-8 pt-6 pb-2 flex items-center justify-between">
        <Button asChild variant="outline" size="sm" className="border-white/[0.12] hover:border-yellow-500/40 text-slate-300">
          <Link to={`/lobby/${gameCode}`} className="flex items-center gap-1.5 text-xs font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Lobby
          </Link>
        </Button>
      </header>

      {/* Atmospheric ambient lighting */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-radial-gradient from-[#071225]/60 via-[#020817] to-[#01030a]" />
        <div className="absolute top-1/4 -left-32 w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-[150px]" />
        <div className="absolute top-1/3 -right-32 w-[600px] h-[600px] rounded-full bg-blue-600/5 blur-[160px]" />
      </div>

      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-4 md:px-8 py-8 w-full pb-36">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="mx-auto mb-3 w-fit bg-[#09152A] border border-white/10 p-2.5 rounded-2xl shadow-xl">
            <TeamLogo teamId={myTeam} logo={(team as any)?.logo} shortName={team?.shortName} size="lg" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-400 text-xs font-bold tracking-widest uppercase mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Auction Preparation</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-black text-white uppercase tracking-wider leading-none">
            Retention Phase
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Franchise: <span className="text-white font-bold">{team?.name}</span> • Manager: <span className="text-amber-400 font-bold">{managerName}</span>
          </p>
        </motion.div>

        {/* Live Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 mb-8">
          <div className="rounded-2xl border border-white/[0.08] bg-[#09152A]/90 p-4 shadow-xl">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Team Purse</p>
            <p className="text-2xl font-black text-amber-400 font-mono mt-1">{formatPrice(basePurse)}</p>
          </div>
          <div className="rounded-2xl border border-amber-400/40 bg-[#09152A]/90 p-4 shadow-[0_0_20px_rgba(245,184,46,0.1)]">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Purse Remaining</p>
            <p className="text-2xl font-black text-amber-400 font-mono mt-1">{formatPrice(remainingPurse)}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#09152A]/90 p-4 shadow-xl">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Retention Slots</p>
            <p className="text-2xl font-black text-white font-mono mt-1">
              {selected.length} <span className="text-xs text-slate-500 font-normal">/ 6 Max</span>
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#09152A]/90 p-4 shadow-xl">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Capped / Uncapped</p>
            <p className="text-2xl font-black text-white font-mono mt-1">
              {cappedCount}<span className="text-xs text-slate-500">/5</span> • {uncappedCount}<span className="text-xs text-slate-500">/2</span>
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#09152A]/90 p-4 shadow-xl col-span-2 sm:col-span-1">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">RTM Cards</p>
            <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {rtmCards} <span className="text-xs text-slate-500 font-normal">Available</span>
            </p>
          </div>
        </div>

        {/* Squad Selection by Role */}
        <div className="space-y-8">
          {RETENTION_ROLE_ORDER.map((roleGroup) => {
            const rolePlayers = groupedSquad[roleGroup.key] || [];
            if (rolePlayers.length === 0) return null;

            return (
              <div key={roleGroup.key} className="rounded-2xl border border-white/[0.08] bg-[#09152A]/70 backdrop-blur-md p-6 shadow-xl">
                <div className="mb-5 flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <h2 className="font-display text-2xl font-black text-amber-400 uppercase tracking-wide">
                    {roleGroup.label}
                  </h2>
                  <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-0.5 text-xs font-bold text-amber-300">
                    {rolePlayers.length} Players Available
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                  {rolePlayers.map((player: any) => {
                    const isSelected = selected.includes(player.id);
                    const role = roleBadge(player.role || '');
                    const cost = isSelected ? Number(costById[player.id] || 0) : undefined;

                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => handleToggle(player.id)}
                        className={cn(
                          'relative text-left rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between select-none outline-none min-h-[300px] overflow-hidden group',
                          isSelected
                            ? 'border-amber-400 bg-[#0B1930] shadow-[0_0_25px_rgba(245,184,46,0.25)] -translate-y-1'
                            : 'border-white/[0.08] bg-[#050B16]/80 hover:border-amber-400/50 hover:bg-[#0B1930]/60 hover:-translate-y-0.5'
                        )}
                      >
                        {/* Top Badges */}
                        <div className="w-full flex items-center justify-between z-10">
                          {isSelected ? (
                            <span className="text-xs text-amber-400 font-black font-mono flex items-center gap-1 bg-amber-400/15 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                              - {formatPrice(cost || 0)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                              {player.isCapped ? 'Capped' : 'Uncapped'}
                            </span>
                          )}
                          <span className="text-[10px] rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-300 font-black tracking-widest uppercase">
                            {role}
                          </span>
                        </div>

                        {/* Large Player Image / Avatar */}
                        <div className="w-full h-40 flex items-center justify-center my-3 relative">
                          <PlayerInitialsAvatar
                            name={player.name}
                            role={player.role}
                            isOverseas={player.isOverseas}
                            image={player.image || player.imageUrl}
                            size="xl"
                          />
                        </div>

                        {/* Player Info Footer */}
                        <div className="w-full border-t border-white/[0.06] pt-3 z-10">
                          <p className="font-extrabold text-white truncate text-base leading-tight uppercase tracking-wide group-hover:text-amber-400 transition-colors">
                            {player.name}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-slate-400 font-medium">
                              {player.isCapped ? 'Capped' : 'Uncapped'}
                            </span>
                            {isSelected ? (
                              <div className="flex items-center gap-1 text-[10px] text-amber-400 font-black uppercase tracking-wider bg-amber-400/10 px-2 py-0.5 rounded">
                                <Check className="w-3 h-3 stroke-[3]" /> Retained
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                                Click to Retain
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* STICKY BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#020817]/95 border-t border-white/[0.1] backdrop-blur-xl py-4 px-4 md:px-8 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Retention Commitment
            </div>
            <div className="text-sm font-semibold text-slate-200">
              <span className="text-amber-400 font-black font-mono">{selected.length} of 6</span> players retained • Remaining Purse: <span className="text-amber-400 font-black font-mono">{formatPrice(remainingPurse)}</span>
            </div>
          </div>

          <Button
            variant="default"
            size="lg"
            onClick={handleFinalize}
            className="h-12 px-10 text-xs font-black tracking-widest uppercase flex items-center gap-2 shadow-[0_0_25px_rgba(245,184,46,0.35)]"
          >
            <span>Confirm Retentions →</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Retention;
