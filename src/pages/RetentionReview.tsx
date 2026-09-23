import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { listenSession, listenTeams, startAuction } from '@/lib/sessionService';
import { IPL_TEAMS, formatPrice } from '@/lib/constants';
import { useGameData } from '@/contexts/GameDataContext';
import { ChevronLeft, ChevronRight, User, Sparkles, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { TeamLogo } from '@/components/TeamLogo';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useUserId } from '@/hooks/useUserId';
import { PlayerInitialsAvatar } from '@/components/PlayerInitialsAvatar';

const TEAM_OWNERS: Record<string, string> = {
  pbks: 'Preity Zinta',
  mi: 'Mukesh Ambani',
  csk: 'N. Srinivasan',
  rcb: 'United Spirits',
  kkr: 'Shah Rukh Khan',
  dc: 'GMR Group',
  rr: 'Manoj Badale',
  srh: 'Kalanithi Maran',
  gt: 'CVC Capital Partners',
  lsg: 'Sanjiv Goenka',
};

const RetentionReview = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [starting, setStarting] = useState(false);
  const { masterPlayerList } = useGameData();
  const userId = useUserId();

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, setSession);
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenTeams(gameCode, setTeams);
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    if (session?.phase === 'AUCTION') navigate(`/auction/${gameCode}`);
  }, [session?.phase, gameCode, navigate]);

  const playerById = useMemo(() => new Map(masterPlayerList.map((p) => [p.id, p])), [masterPlayerList]);

  if (!session) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#020817] text-white select-none">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-amber-400 border-t-transparent" />
      <p className="font-display tracking-widest text-lg text-amber-400 mt-4 animate-pulse uppercase">LOADING REVIEW...</p>
    </div>
  );

  const isHost = session.hostId === userId;

  const handleStartAuction = async () => {
    if (!gameCode || starting) return;
    setStarting(true);
    try {
      await startAuction(gameCode);
      navigate(`/auction/${gameCode}`);
    } catch (err) {
      console.error(err);
      setStarting(false);
    }
  };

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
        <div className="absolute top-1/3 -right-32 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[160px]" />
      </div>

      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-4 md:px-8 py-8 w-full pb-36">
        {/* Title Banner */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-400 text-xs font-bold tracking-widest uppercase mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Auction Preparation Complete</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-black text-white uppercase tracking-wider leading-none">
            Retention Review
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto mt-2">
            All 10 franchises have confirmed their core retentions. Inspect squad states before proceeding to the live auction floor.
          </p>
        </motion.div>

        {/* 10 Franchise Review Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {IPL_TEAMS.map((team) => {
            const teamDoc = teams.find((t) => t.id === team.id) || {};
            const retainedIds = (teamDoc.retainedPlayers || session?.retentions?.[team.id]?.players || []) as string[];
            const retainedPlayers = retainedIds.map((id) => playerById.get(id)).filter(Boolean) as any[];
            const managerName = session?.managerNames?.[team.id] || (String(session?.selectedTeams?.[team.id] || '').startsWith('AI-') ? TEAM_OWNERS[team.id] || 'AI Manager' : TEAM_OWNERS[team.id] || 'Available');
            const isLocked = Boolean(session?.retentions?.[team.id]?.locked || retainedIds.length);

            return (
              <div
                key={team.id}
                className="rounded-2xl border border-white/[0.08] bg-[#09152A]/90 backdrop-blur-md p-5 shadow-xl flex flex-col justify-between hover:border-amber-400/40 transition-all duration-200"
              >
                <div>
                  {/* Card Header: Emblem & Name */}
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
                    <div className="flex items-center gap-3">
                      <TeamLogo
                        teamId={team.id}
                        logo={teamDoc.logo || team.logo}
                        shortName={team.shortName}
                        size="md"
                        className="shrink-0"
                      />
                      <div>
                        <h3 className="font-display text-xl font-black text-white leading-none uppercase">
                          {team.shortName}
                        </h3>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold mt-1">
                          {team.name}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full border uppercase",
                        isLocked
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-amber-400/10 border-amber-400/30 text-amber-400"
                      )}
                    >
                      {isLocked ? 'LOCKED' : 'PENDING'}
                    </span>
                  </div>

                  {/* Manager & Stats Row */}
                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span className="uppercase text-[10px] tracking-wider font-bold">Manager</span>
                      <span className="font-bold text-white truncate max-w-[65%]">{managerName}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span className="uppercase text-[10px] tracking-wider font-bold">Remaining Purse</span>
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        {formatPrice(teamDoc.purseRemaining ?? team.purse)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span className="uppercase text-[10px] tracking-wider font-bold">RTM Cards</span>
                      <span className="font-bold text-emerald-400">
                        {teamDoc.rtmCards ?? session?.retentions?.[team.id]?.rtm ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Retained Players List */}
                  <div className="border-t border-white/[0.06] pt-3">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">
                      Retained Players ({retainedPlayers.length}/6)
                    </p>
                    {retainedPlayers.length > 0 ? (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {retainedPlayers.map((player: any) => (
                          <div
                            key={player.id}
                            className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-[#050B16] border border-white/[0.04]"
                          >
                            <span className="font-semibold text-white truncate max-w-[70%]">
                              {player.name}
                            </span>
                            <span className="text-[10px] font-mono text-amber-400 font-bold">
                              {player.role ? player.role.slice(0, 3).toUpperCase() : 'BAT'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic py-2">No players retained (all 6 RTM cards active)</p>
                    )}
                  </div>
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
              Retention Summary
            </div>
            <div className="text-sm font-semibold text-slate-200">
              All 10 franchises evaluated • Ready to open player sets
            </div>
          </div>

          <div>
            {isHost ? (
              <Button
                variant="default"
                size="lg"
                disabled={starting}
                onClick={handleStartAuction}
                className="h-12 px-10 text-xs font-black tracking-widest uppercase flex items-center gap-2 shadow-[0_0_25px_rgba(245,184,46,0.35)]"
              >
                <span>{starting ? "Launching Auction Arena..." : "Start Auction Floor →"}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-[#09152A] text-xs font-semibold text-slate-300">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Waiting for Host to launch live auction...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetentionReview;
