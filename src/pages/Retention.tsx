import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { IPL_TEAMS, formatPrice, RETENTION_COSTS } from '@/lib/constants';
import { listenSession, lockRetention } from '@/lib/sessionService';
import type { Player } from '@/lib/samplePlayers';
import { useGameData } from '@/contexts/GameDataContext';
import { TeamLogo } from '@/components/TeamLogo';
import { CheckCircle2, Sparkles, User } from 'lucide-react';
import { RETENTION_ROLE_ORDER, groupPlayersByRetentionRole } from '@/lib/playerSorting';
import { motion } from 'framer-motion';

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
  const userId = localStorage.getItem('uid');

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
    if (!myTeam) return localStorage.getItem('managerName') || 'You';
    return session?.managerNames?.[myTeam] || localStorage.getItem('managerName') || 'You';
  }, [myTeam, session]);

  const squad: Player[] = useMemo(() => {
    if (!myTeam) return [];
    return masterPlayerList.filter((p: any) => (p.previousTeamId || p.previousTeam || '').toLowerCase() === myTeam.toLowerCase());
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400" />
      <p className="font-display tracking-widest text-xl text-yellow-400 mt-4 animate-pulse uppercase">LOADING RETENTIONS...</p>
    </div>
  );

  const team = IPL_TEAMS.find((t) => t.id === myTeam);

  return (
    <div className="min-h-screen p-6 relative overflow-hidden" style={{ background: 'radial-gradient(circle at center, #071739 0%, #020617 100%)' }}>
      {/* Stadium-inspired atmospheric lighting */}
      <div className="stadium-ambient stadium-ambient-cyan -top-40 -left-40 w-[600px] h-[600px]" />
      <div className="stadium-ambient stadium-ambient-gold -bottom-40 -right-40 w-[600px] h-[600px]" />

      <div className="relative z-10 max-w-[1500px] mx-auto space-y-8">
        <motion.section 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 w-fit bg-[#030712]/50 border border-white/10 p-2 rounded-full backdrop-blur-md">
            <TeamLogo teamId={myTeam} logo={(team as any)?.logo} shortName={team?.shortName} size="lg" />
          </div>
          <div className="flex items-center gap-1.5 justify-center mb-1">
            <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse" />
            <span className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">RETENTION PORTAL</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-black text-white uppercase tracking-wide leading-none">{team?.name}</h1>
          <p className="text-sm text-slate-400 mt-2">Franchise Manager: <span className="text-yellow-400 font-bold">{managerName}</span></p>
        </motion.section>

        {/* Dashboard Statistics Widget Grid */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4"
        >
          <div className="rounded-2xl border border-yellow-400/30 bg-[#0f172a]/20 backdrop-blur-xl p-5 shadow-2xl flex flex-col justify-between">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Retention Count</p>
            <p className="text-3xl font-black text-yellow-400 font-mono mt-1">{selected.length} <span className="text-xs text-slate-500 font-normal">/ 6</span></p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#0f172a]/20 backdrop-blur-xl p-5 shadow-xl flex flex-col justify-between">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Capped Players</p>
            <p className="text-3xl font-black text-white font-mono mt-1">{cappedCount} <span className="text-xs text-slate-500 font-normal">/ 5 Slots</span></p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#0f172a]/20 backdrop-blur-xl p-5 shadow-xl flex flex-col justify-between">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Uncapped Players</p>
            <p className="text-3xl font-black text-white font-mono mt-1">{uncappedCount} <span className="text-xs text-slate-500 font-normal">/ 2 Slots</span></p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#0f172a]/20 backdrop-blur-xl p-5 shadow-xl flex flex-col justify-between">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">RTM Cards Available</p>
            <p className="text-3xl font-black text-white font-mono mt-1">{rtmCards} <span className="text-xs text-slate-500 font-normal">RTM</span></p>
          </div>
          <div className="rounded-2xl border border-yellow-400/30 bg-[#0f172a]/20 backdrop-blur-xl p-5 shadow-2xl flex flex-col justify-between">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Remaining Purse</p>
            <p className="text-3xl font-black text-yellow-400 font-mono mt-1">{formatPrice(remainingPurse)}</p>
          </div>
        </motion.section>

        {/* Squad Selection Section */}
        <motion.section 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="space-y-8"
        >
          <div className="max-h-[66vh] overflow-y-auto pr-2 space-y-8 scrollbar-thin">
            {RETENTION_ROLE_ORDER.map((roleGroup) => {
              const rolePlayers = groupedSquad[roleGroup.key] || [];
              if (rolePlayers.length === 0) return null;
              
              return (
                <div key={roleGroup.key} className="rounded-3xl border border-white/5 bg-[#07142d]/30 backdrop-blur-md p-6 shadow-2xl">
                  <div className="mb-6 flex items-center justify-between gap-3 border-b border-white/5 pb-4">
                    <h2 className="font-display text-2xl font-black text-yellow-400 uppercase tracking-wide">{roleGroup.label}</h2>
                    <span className="rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3.5 py-1 text-xs font-extrabold text-yellow-300">
                      {rolePlayers.length} Players Available
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-6">
                    {rolePlayers.map((player: any) => {
                      const isSelected = selected.includes(player.id);
                      const role = roleBadge(player.role || '');
                      const cost = isSelected ? Number(costById[player.id] || 0) : undefined;
                      return (
                        <motion.button
                          key={player.id}
                          onClick={() => handleToggle(player.id)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            'relative text-left rounded-2xl border p-4 bg-[#0f172a]/30 backdrop-blur-md transition-all duration-300 flex flex-col justify-between select-none outline-none h-[230px]',
                            isSelected 
                              ? 'border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.22)] bg-yellow-500/5' 
                              : 'border-white/5 hover:border-yellow-400/40 hover:shadow-[0_8px_25px_rgba(250,204,21,0.12)]',
                          )}
                        >
                          <div className="w-full flex items-center justify-between z-10">
                            {isSelected ? (
                              <span className="text-[10px] text-yellow-400 font-extrabold flex items-center gap-1">
                                - {formatPrice(cost || 0)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                {player.isCapped ? 'Capped' : 'Uncapped'}
                              </span>
                            )}
                            <span className="text-[9px] rounded-md border border-cyan-500/30 bg-cyan-500/5 px-2 py-0.5 text-cyan-400 font-bold uppercase tracking-widest">{role}</span>
                          </div>

                          <div className="w-full h-28 rounded-xl bg-slate-950/45 border border-white/5 flex items-center justify-center overflow-hidden my-3 relative shrink-0">
                            {player.imageUrl || player.image ? (
                              <img src={player.imageUrl || player.image} alt={player.name} className="h-full w-full object-contain object-center scale-[1.03] transition-transform duration-500 hover:scale-[1.1]" />
                            ) : (
                              <div className="flex flex-col items-center justify-center">
                                <User className="h-8 w-8 text-slate-600 mb-1" />
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">No Image</span>
                              </div>
                            )}
                          </div>

                          <div className="w-full space-y-1 z-10 shrink-0">
                            <p className="font-extrabold text-white truncate text-sm leading-tight uppercase">{player.name}</p>
                            {isSelected ? (
                              <div className="flex items-center gap-1 text-[9px] text-yellow-400 font-bold uppercase tracking-wider mt-0.5">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Retained
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 font-medium">{player.isCapped ? 'Capped' : 'Uncapped'}</p>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Action Controls Section */}
        <motion.section 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex justify-center border-t border-white/5 pt-6"
        >
          <Button
            variant="gold"
            size="xl"
            onClick={handleFinalize}
            className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-extrabold hover:scale-105 hover:shadow-[0_0_30px_rgba(250,204,21,0.6)] transition-all cursor-pointer px-14 tracking-widest uppercase h-14"
          >
            FINALIZE RETENTIONS
          </Button>
        </motion.section>
      </div>
    </div>
  );
};

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export default Retention;
