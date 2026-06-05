import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { listenSession, listenTeams, startAuction } from '@/lib/sessionService';
import { IPL_TEAMS, formatPrice } from '@/lib/constants';
import { useGameData } from '@/contexts/GameDataContext';
import { ChevronLeft, ChevronRight, RotateCcw, User } from 'lucide-react';
import { TeamLogo } from '@/components/TeamLogo';
import { cn } from '@/lib/utils';

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
  pbks: 'from-red-950/60 via-red-900/40 to-yellow-600/10',
  mi: 'from-blue-950/60 via-blue-900/40 to-yellow-600/10',
  csk: 'from-yellow-950/60 via-yellow-900/40 to-yellow-500/10',
  rcb: 'from-red-950/60 via-red-900/40 to-black/40',
  kkr: 'from-purple-950/60 via-purple-900/40 to-yellow-600/10',
  dc: 'from-blue-950/60 via-blue-900/40 to-red-600/10',
  rr: 'from-pink-950/60 via-pink-900/40 to-blue-600/10',
  srh: 'from-orange-950/60 via-orange-900/40 to-black/40',
  gt: 'from-slate-950/60 via-slate-900/40 to-yellow-600/10',
  lsg: 'from-cyan-950/60 via-blue-950/40 to-yellow-600/10',
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
  const userId = localStorage.getItem('uid');

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

  if (!session) return <p className="p-6">Loading review…</p>;
  const isHost = session.hostId === userId;

  return (
    <div className="min-h-screen p-6 bg-[#020617]">
      <div className="max-w-[1500px] mx-auto">
        <h1 className="text-3xl font-display mb-6 text-center text-primary">RETENTION REVIEW</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
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
                console.log(`[Carousel Navigation] Team ${team.id} index: ${current} -> ${next} (Total: ${retainedPlayers.length})`);
                return { ...prev, [team.id]: next };
              });
            };
            return (
              <div 
                key={team.id} 
                className="group relative h-[480px] rounded-xl cursor-pointer"
                style={{ perspective: '1000px' }}
                onClick={() => {
                  if (expandedTeamId !== team.id) setExpandedTeamId(team.id);
                }}
              >
                <div 
                  className={cn(
                    "relative w-full h-full transition-all duration-500 rounded-xl",
                    expandedTeamId === team.id ? "[transform:rotateY(180deg)]" : ""
                  )}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  
                  {/* FRONT FACE */}
                  <div 
                    className={cn(
                      "absolute inset-0 border border-white/10 bg-[#0f172a] rounded-xl p-4 flex flex-col justify-between hover:shadow-[0_0_20px_rgba(251,191,36,0.5)] hover:border-yellow-400/70 overflow-hidden",
                      expandedTeamId === team.id ? "pointer-events-none" : ""
                    )}
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <div className="relative z-10 transition-all duration-200 h-full flex flex-col justify-between group-hover:opacity-90">
                      <div>
                        <div className="flex items-center gap-4 mb-4">
                          <TeamLogo teamId={team.id} logo={teamDoc.logo || team.logo} shortName={team.shortName} size="lg" />
                          <div>
                            <h2 className="font-display text-xl leading-none">{team.shortName}</h2>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">{team.name}</p>
                          </div>
                        </div>

                        <div className="space-y-4 mt-6 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Manager</p>
                            <p className="text-base font-semibold text-white mt-0.5 truncate">{managerName}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Retained</p>
                              <p className="text-lg font-bold text-white mt-0.5">{retainedIds.length} <span className="text-xs text-muted-foreground font-normal">/ 6</span></p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">RTM Cards</p>
                              <p className="text-lg font-bold text-white mt-0.5">{teamDoc.rtmCards ?? session?.retentions?.[team.id]?.rtm ?? 0}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Remaining Purse</p>
                            <p className="text-xl font-bold text-yellow-400 mt-0.5">{formatPrice(teamDoc.purseRemaining ?? team.purse)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Status</span>
                        <span className={cn(
                          "text-xs font-semibold px-2.5 py-1 rounded-full border",
                          (session?.retentions?.[team.id]?.locked || retainedIds.length)
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                        )}>
                          {(session?.retentions?.[team.id]?.locked || retainedIds.length) ? '🟢 LOCKED' : '🟡 PENDING'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BACK FACE */}
                  <div 
                    className={cn(
                      "absolute inset-0 border border-yellow-500/50 bg-[#0B1C3D] rounded-xl p-4 overflow-hidden flex flex-col justify-between select-none",
                      expandedTeamId !== team.id ? "pointer-events-none" : ""
                    )}
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
                      <h3 className="text-yellow-400 font-display text-sm tracking-wider uppercase font-semibold">Retained Players</h3>
                      <div className="flex items-center gap-2">
                        {retainedPlayers.length > 0 && (
                          <span className="rounded-full border border-yellow-400/30 px-2.5 py-0.5 text-[11px] text-yellow-200 font-semibold">
                            {activeIndex + 1}/{retainedPlayers.length}
                          </span>
                        )}
                        <button
                          type="button"
                          className="inline-flex h-6 items-center gap-1 rounded-full border border-white/15 bg-black/20 px-2.5 text-[10px] text-white transition hover:border-yellow-400/60 hover:text-yellow-200"
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
                      <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/10">
                        <p className="text-sm text-muted-foreground text-center">No players retained</p>
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
                                "relative h-[230px] w-full overflow-hidden rounded-lg border border-white/5 bg-gradient-to-b shrink-0 flex items-center justify-center shadow-inner py-3 px-2",
                                teamGradient
                              )}>
                                <div key={activePlayer.id} className="w-full h-full flex items-center justify-center animate-[retentionSlideIn_0.35s_ease-out]">
                                  {(activePlayer.image || activePlayer.imageUrl) ? (
                                    <img 
                                      src={activePlayer.image || activePlayer.imageUrl} 
                                      alt={activePlayer.name} 
                                      className="h-full w-full object-contain object-center scale-[1.03] transition-transform duration-500 hover:scale-[1.1]" 
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <User className="h-12 w-12 text-muted-foreground/60" />
                                    </div>
                                  )}
                                </div>

                                {/* Vertically centered navigation arrows inside showcase */}
                                <button
                                  type="button"
                                  className="absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white transition hover:scale-110 hover:border-yellow-400/60 hover:bg-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-30"
                                  onClick={(event) => { event.stopPropagation(); moveSlide(-1); }}
                                  disabled={retainedPlayers.length <= 1}
                                  aria-label={`Show previous retained ${team.shortName} player`}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white transition hover:scale-110 hover:border-yellow-400/60 hover:bg-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-30"
                                  onClick={(event) => { event.stopPropagation(); moveSlide(1); }}
                                  disabled={retainedPlayers.length <= 1}
                                  aria-label={`Show next retained ${team.shortName} player`}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                              </div>

                              {/* Player Name and Role centered */}
                              <div className="text-center mt-2.5 shrink-0 flex-1 flex flex-col justify-center min-h-0">
                                <p className="w-full truncate text-lg md:text-xl font-extrabold text-white tracking-wide leading-tight">{activePlayer.name}</p>
                                <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-yellow-400 font-bold mt-1">{activePlayer.role || activePlayer.category || 'Retained Player'}</p>
                              </div>

                              {/* Price and Rating centered at the bottom */}
                              <div className="grid w-full grid-cols-2 gap-3.5 text-[11px] mt-2.5 pb-0.5 shrink-0">
                                <div className="rounded-lg bg-black/40 border border-white/5 px-2.5 py-1.5 flex flex-col items-center justify-center shadow-md">
                                  <span className="text-[8px] md:text-[9px] text-slate-400 uppercase tracking-widest font-semibold">Price</span>
                                  <span className="font-extrabold text-yellow-400 text-sm mt-0.5">{formatPrice(retentionPrice)}</span>
                                </div>
                                <div className="rounded-lg bg-black/40 border border-white/5 px-2.5 py-1.5 flex flex-col items-center justify-center shadow-md">
                                  <span className="text-[8px] md:text-[9px] text-slate-400 uppercase tracking-widest font-semibold">Rating</span>
                                  <span className="font-extrabold text-emerald-400 text-sm mt-0.5">{activePlayer.rating || activePlayer.starRating || '—'}</span>
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
          <div className="flex justify-center">
            <Button variant="gold" size="lg" className="min-w-64" disabled={starting} onClick={async () => {
              if (!gameCode) return;
              try {
                setStarting(true);
                await startAuction(gameCode);
                navigate(`/auction/${gameCode}`);
              } finally {
                setStarting(false);
              }
            }}>
              {starting ? 'Starting…' : 'Start Auction'}
            </Button>
          </div>
        ) : (
          <div className="text-center py-6"><p className="text-lg text-muted-foreground font-medium">Host will start the auction shortly</p></div>
        )}
      </div>
    </div>
  );
};

export default RetentionReview;
