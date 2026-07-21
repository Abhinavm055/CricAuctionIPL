import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { listenSession, listenTeams, startAuction } from '@/lib/sessionService';
import { IPL_TEAMS, formatPrice } from '@/lib/constants';
import { useGameData } from '@/contexts/GameDataContext';
import { ChevronLeft, ChevronRight, RotateCcw, User, Sparkles } from 'lucide-react';
import { TeamLogo } from '@/components/TeamLogo';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useUserId } from '@/hooks/useUserId';
import { PlayerInitialsAvatar } from '@/components/PlayerInitialsAvatar';

const RetentionPlayerImage = ({ player }: { player: Player }) => {
  const [failed, setFailed] = useState(false);
  
  useEffect(() => {
    setFailed(false);
  }, [player.id]);

  const imageUrl = player.image || player.imageUrl;

  if (imageUrl && !failed) {
    return (
      <img 
        src={imageUrl} 
        alt={player.name} 
        className="h-full w-full object-contain object-center scale-[1.03] transition-transform duration-500 hover:scale-[1.1] drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" 
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <PlayerInitialsAvatar
      name={player.name}
      role={player.role}
      isOverseas={player.isOverseas}
      size="xl"
    />
  );
};

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

const TEAM_GRADIENTS: Record<string, string> = {
  pbks: 'from-red-950/40 via-red-900/20 to-yellow-600/5',
  mi: 'from-blue-950/40 via-blue-900/20 to-yellow-600/5',
  csk: 'from-yellow-950/40 via-yellow-900/20 to-yellow-500/5',
  rcb: 'from-red-950/40 via-red-900/20 to-black/20',
  kkr: 'from-purple-950/40 via-purple-900/20 to-yellow-600/5',
  dc: 'from-blue-950/40 via-blue-900/20 to-red-600/5',
  rr: 'from-pink-950/40 via-pink-900/20 to-blue-600/5',
  srh: 'from-orange-950/40 via-orange-900/20 to-black/20',
  gt: 'from-slate-950/40 via-slate-900/20 to-yellow-600/5',
  lsg: 'from-cyan-950/40 via-blue-950/20 to-yellow-600/5',
};

const TEAM_BORDER_GLOWS: Record<string, string> = {
  csk: 'group-hover:border-yellow-400/50 group-hover:shadow-[0_0_25px_rgba(253,224,71,0.18)]',
  mi: 'group-hover:border-blue-500/50 group-hover:shadow-[0_0_25px_rgba(59,130,246,0.18)]',
  rcb: 'group-hover:border-red-500/50 group-hover:shadow-[0_0_25px_rgba(239,68,68,0.18)]',
  kkr: 'group-hover:border-purple-500/50 group-hover:shadow-[0_0_25px_rgba(168,85,247,0.18)]',
  dc: 'group-hover:border-blue-600/50 group-hover:shadow-[0_0_25px_rgba(37,99,235,0.18)]',
  pbks: 'group-hover:border-red-600/50 group-hover:shadow-[0_0_25px_rgba(220,38,38,0.18)]',
  rr: 'group-hover:border-pink-500/50 group-hover:shadow-[0_0_25px_rgba(236,72,153,0.18)]',
  srh: 'group-hover:border-orange-500/50 group-hover:shadow-[0_0_25px_rgba(249,115,22,0.18)]',
  gt: 'group-hover:border-slate-400/50 group-hover:shadow-[0_0_25px_rgba(148,163,184,0.18)]',
  lsg: 'group-hover:border-cyan-500/50 group-hover:shadow-[0_0_25px_rgba(6,182,212,0.18)]',
};

const RetentionReview = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [starting, setStarting] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [retentionSlideIndex, setRetentionSlideIndex] = useState<Record<string, number>>({});
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400" />
      <p className="font-display tracking-widest text-xl text-yellow-400 mt-4 animate-pulse uppercase">LOADING REVIEW...</p>
    </div>
  );

  const isHost = session.hostId === userId;

  return (
    <div className={cn("min-h-screen p-6 relative overflow-hidden", session?.mode === 'VS_AI' ? "theme-ai" : "theme-multiplayer")} style={{ background: 'radial-gradient(circle at center, #071739 0%, #020617 100%)' }}>
      {/* Stadium-inspired atmospheric lighting */}
      <div className="stadium-ambient stadium-ambient-cyan -top-40 -left-40 w-[600px] h-[600px]" />
      <div className="stadium-ambient stadium-ambient-gold -bottom-40 -right-40 w-[600px] h-[600px]" />

      <div className="relative z-10 max-w-[1500px] mx-auto space-y-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="flex items-center gap-1.5 justify-center mb-1">
            <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse" />
            <span className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">AUCTION PREPARATION</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-wide">RETENTION REVIEW</h1>
          <p className="text-sm text-slate-400 mt-2">Franchise squads finalized their retentions. Review squads below before auction starts.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {IPL_TEAMS.map((team) => {
            const teamDoc = teams.find((t) => t.id === team.id) || {};
            const retainedIds = (teamDoc.retainedPlayers || session?.retentions?.[team.id]?.players || []) as string[];
            const retainedPlayers = retainedIds.map((id) => playerById.get(id)).filter(Boolean) as any[];
            const prices = teamDoc.playerPurchasePrices || {};
            const managerName = session?.managerNames?.[team.id] || (String(session?.selectedTeams?.[team.id] || '').startsWith('AI-') ? TEAM_OWNERS[team.id] || 'AI Manager' : TEAM_OWNERS[team.id] || 'Available');

            const rawIndex = retentionSlideIndex[team.id] || 0;
            const activeIndex = retainedPlayers.length > 0 
              ? Math.max(0, Math.min(rawIndex, retainedPlayers.length - 1)) 
              : 0;

            const moveSlide = (direction: -1 | 1) => {
              setRetentionSlideIndex((prev) => {
                const current = prev[team.id] || 0;
                let next = current + direction;
                if (next < 0) {
                  next = Math.max(0, retainedPlayers.length - 1);
                } else if (next > retainedPlayers.length - 1) {
                  next = 0;
                }
                return { ...prev, [team.id]: next };
              });
            };

            const borderGlow = TEAM_BORDER_GLOWS[team.id] || 'group-hover:border-yellow-400/40 group-hover:shadow-[0_8px_30px_rgba(250,204,21,0.15)]';

            return (
              <div 
                key={team.id} 
                className="group relative h-[480px] rounded-3xl cursor-pointer"
                style={{ perspective: '1000px' }}
                onClick={() => {
                  if (expandedTeamId !== team.id) setExpandedTeamId(team.id);
                }}
              >
                <div 
                  className={cn(
                    "relative w-full h-full transition-all duration-500 rounded-3xl",
                    expandedTeamId === team.id ? "[transform:rotateY(180deg)]" : ""
                  )}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  
                  {/* FRONT FACE */}
                  <div 
                    className={cn(
                      "absolute inset-0 border border-white/5 bg-[#0f172a]/20 backdrop-blur-md rounded-3xl p-5 flex flex-col justify-between transition-all duration-300",
                      borderGlow,
                      expandedTeamId === team.id ? "pointer-events-none" : ""
                    )}
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <div className="relative z-10 transition-all duration-200 h-full flex flex-col justify-between group-hover:opacity-90">
                      <div>
                        <div className="flex items-center gap-4 mb-4 border-b border-white/5 pb-3">
                          <TeamLogo teamId={team.id} logo={teamDoc.logo || team.logo} shortName={team.shortName} size="lg" className="bg-white/5 border border-white/10" />
                          <div>
                            <h2 className="font-display text-2xl font-black text-white leading-none">{team.shortName}</h2>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 font-bold">{team.name}</p>
                          </div>
                        </div>

                        <div className="space-y-4 mt-6 text-xs md:text-sm">
                          <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Manager</span>
                            <span className="font-extrabold text-white truncate max-w-[60%]">{managerName}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col rounded-xl bg-slate-950/20 border border-white/5 p-2.5">
                              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Retained</span>
                              <span className="text-base font-extrabold text-white mt-1">{retainedIds.length} <span className="text-[10px] text-slate-500 font-normal">/ 6</span></span>
                            </div>
                            <div className="flex flex-col rounded-xl bg-slate-950/20 border border-white/5 p-2.5">
                              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">RTM Cards</span>
                              <span className="text-base font-extrabold text-white mt-1">{teamDoc.rtmCards ?? session?.retentions?.[team.id]?.rtm ?? 0}</span>
                            </div>
                          </div>
                          <div className="flex flex-col rounded-xl bg-slate-950/20 border border-white/5 p-3">
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Purse Available</span>
                            <span className="text-lg font-black text-yellow-400 mt-1">{formatPrice(teamDoc.purseRemaining ?? team.purse)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Status</span>
                        <span className={cn(
                          "text-[9px] font-black tracking-widest px-3 py-1 rounded-full border uppercase",
                          (session?.retentions?.[team.id]?.locked || retainedIds.length)
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                            : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400 animate-pulse'
                        )}>
                          {(session?.retentions?.[team.id]?.locked || retainedIds.length) ? '🟢 LOCKED' : '🟡 PENDING'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BACK FACE */}
                  <div 
                    className={cn(
                      "absolute inset-0 border border-yellow-500/25 bg-[#051126]/90 backdrop-blur-xl rounded-3xl p-5 overflow-hidden flex flex-col justify-between select-none shadow-[0_0_30px_rgba(250,204,21,0.1)]",
                      expandedTeamId !== team.id ? "pointer-events-none" : ""
                    )}
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-2 shrink-0">
                      <h3 className="text-yellow-400 font-display text-[10px] tracking-widest uppercase font-black">Retained Players</h3>
                      <div className="flex items-center gap-2">
                        {retainedPlayers.length > 0 && (
                          <span className="rounded-full border border-yellow-400/25 bg-yellow-400/10 px-2.5 py-0.5 text-[10px] text-yellow-300 font-bold font-mono">
                            {activeIndex + 1}/{retainedPlayers.length}
                          </span>
                        )}
                        <button
                          type="button"
                          className="inline-flex h-6 items-center gap-1 rounded-full border border-white/10 bg-[#030712]/60 px-2.5 text-[9px] font-bold text-white transition hover:border-yellow-400/60 hover:text-yellow-300 cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedTeamId(null);
                          }}
                          aria-label={`Show ${team.shortName} team details`}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Details
                        </button>
                      </div>
                    </div>
                    {retainedPlayers.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10 mt-3 p-4">
                        <User className="h-8 w-8 text-slate-600 mb-2" />
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider text-center">No players retained</p>
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const activePlayer = retainedPlayers[activeIndex];
                          if (!activePlayer) return null;
                          const retentionPrice = prices[activePlayer.id] || 0;
                          const teamGradient = TEAM_GRADIENTS[team.id] || 'from-[#111c34] to-[#071229]';

                          return (
                            <div className="flex-1 flex flex-col justify-between mt-3 overflow-hidden min-h-0">
                              
                              {/* LARGE PLAYER SHOWCASE AREA */}
                              <div className={cn(
                                "relative h-[220px] w-full overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b shrink-0 flex items-center justify-center shadow-inner py-3 px-2",
                                teamGradient
                              )}>
                                <div key={activePlayer.id} className="w-full h-full flex items-center justify-center animate-[retentionSlideIn_0.35s_ease-out]">
                                    <RetentionPlayerImage player={activePlayer} />
                                </div>

                                {/* Vertically centered navigation arrows inside showcase */}
                                <button
                                  type="button"
                                  className="absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white transition hover:scale-110 hover:border-yellow-400/60 hover:bg-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                                  onClick={(event) => { event.stopPropagation(); moveSlide(-1); }}
                                  disabled={retainedPlayers.length <= 1}
                                  aria-label={`Show previous retained ${team.shortName} player`}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white transition hover:scale-110 hover:border-yellow-400/60 hover:bg-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                                  onClick={(event) => { event.stopPropagation(); moveSlide(1); }}
                                  disabled={retainedPlayers.length <= 1}
                                  aria-label={`Show next retained ${team.shortName} player`}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                              </div>

                              {/* Player Name and Role centered */}
                              <div className="text-center mt-2.5 shrink-0 flex-1 flex flex-col justify-center min-h-0">
                                <p className="w-full truncate text-lg font-black text-white tracking-wide leading-tight uppercase">{activePlayer.name}</p>
                                <p className="text-[9px] uppercase tracking-[0.2em] text-[#00CFFF] font-black mt-1">{activePlayer.role || activePlayer.category || 'Retained Player'}</p>
                              </div>

                              {/* Price and Rating centered at the bottom */}
                              <div className="grid w-full grid-cols-2 gap-3 text-xs mt-2 shrink-0">
                                <div className="rounded-xl bg-[#030712]/50 border border-white/5 px-2.5 py-1.5 flex flex-col items-center justify-center shadow-md">
                                  <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black">Retention Price</span>
                                  <span className="font-extrabold text-yellow-400 mt-0.5">{formatPrice(retentionPrice)}</span>
                                </div>
                                <div className="rounded-xl bg-[#030712]/50 border border-white/5 px-2.5 py-1.5 flex flex-col items-center justify-center shadow-md">
                                  <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black">Star Rating</span>
                                  <span className="font-extrabold text-emerald-400 mt-0.5">{activePlayer.rating || activePlayer.starRating || '—'} ★</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {isHost ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center border-t border-white/5 pt-6"
          >
            <Button variant="gold" size="xl" className="px-14 tracking-widest uppercase h-14 font-extrabold cursor-pointer" disabled={starting} onClick={async () => {
              if (!gameCode) return;
              try {
                setStarting(true);
                await startAuction(gameCode);
                navigate(`/auction/${gameCode}`);
              } finally {
                setStarting(false);
              }
            }}>
              {starting ? 'Starting...' : 'Start Auction'}
            </Button>
          </motion.div>
        ) : (
          <div className="text-center py-6 border-t border-white/5"><p className="text-sm text-slate-400 font-bold uppercase tracking-wider animate-pulse">Waiting for the host to initialize the live auction room...</p></div>
        )}
      </div>
    </div>
  );
};

export default RetentionReview;
