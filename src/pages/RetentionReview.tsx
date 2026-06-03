import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { listenSession, listenTeams, startAuction } from '@/lib/sessionService';
import { IPL_TEAMS, formatPrice } from '@/lib/constants';
import { useGameData } from '@/contexts/GameDataContext';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
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

const RetentionReview = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [starting, setStarting] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [retentionSlideIndex, setRetentionSlideIndex] = useState<Record<string, number>>({});
  const [retentionTransitioning, setRetentionTransitioning] = useState<Record<string, boolean>>({});
  const retentionTransitionTimersRef = useRef<Record<string, number>>({});
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

  useEffect(() => () => {
    Object.values(retentionTransitionTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
  }, []);

  const openTeamCard = (teamId: string) => {
    setExpandedTeamId(teamId);
  };

  const moveRetainedPlayer = (teamId: string, activeIndex: number, playerCount: number, direction: -1 | 1) => {
    if (playerCount <= 1 || retentionTransitioning[teamId]) return;

    window.clearTimeout(retentionTransitionTimersRef.current[teamId]);
    setRetentionTransitioning((prev) => ({ ...prev, [teamId]: true }));

    retentionTransitionTimersRef.current[teamId] = window.setTimeout(() => {
      setRetentionSlideIndex((prev) => ({
        ...prev,
        [teamId]: (activeIndex + direction + playerCount) % playerCount,
      }));
      setRetentionTransitioning((prev) => ({ ...prev, [teamId]: false }));
    }, 520);
  };

  const playerById = useMemo(() => new Map(masterPlayerList.map((p) => [p.id, p])), [masterPlayerList]);

  if (!session) return <p className="p-6">Loading review…</p>;
  const isHost = session.hostId === userId;

  return (
    <div className="min-h-screen p-6 bg-[#020617]">
      <div className="max-w-[1500px] mx-auto">
        <h1 className="text-3xl font-display mb-6 text-center text-primary">RETENTION REVIEW</h1>

        <div className="grid mb-10" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          {IPL_TEAMS.map((team) => {
            const teamDoc = teams.find((t) => t.id === team.id) || {};
            const retainedIds = (teamDoc.retainedPlayers || session?.retentions?.[team.id]?.players || []) as string[];
            const retainedPlayers = retainedIds.map((id) => playerById.get(id)).filter(Boolean) as any[];
            const prices = teamDoc.playerPurchasePrices || {};
            const managerName = session?.managerNames?.[team.id] || (String(session?.selectedTeams?.[team.id] || '').startsWith('AI-') ? TEAM_OWNERS[team.id] || 'AI Manager' : TEAM_OWNERS[team.id] || 'Available');

            return (
              <div 
                key={team.id} 
                className="group relative h-[320px] rounded-xl cursor-pointer"
                style={{ perspective: '1000px' }}
                onClick={() => openTeamCard(team.id)}
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
                    className="absolute inset-0 border border-white/10 bg-[#0f172a] rounded-xl p-4 flex flex-col justify-between hover:shadow-[0_0_20px_rgba(251,191,36,0.5)] hover:border-yellow-400/70 overflow-hidden"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <div className="relative z-10 transition-all duration-200 h-full group-hover:opacity-90">
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <TeamLogo teamId={team.id} logo={teamDoc.logo || team.logo} shortName={team.shortName} size="md" />
                          <div>
                            <h2 className="font-display text-lg leading-none">{team.shortName}</h2>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{team.name}</p>
                          </div>
                        </div>

                        <p className="text-sm mb-1 text-muted-foreground">Manager: <span className="text-foreground truncate block">{managerName}</span></p>
                        <p className="text-sm mb-1">Retained: {retainedIds.length}/6</p>
                        <p className="text-sm mb-1">RTM: {teamDoc.rtmCards ?? session?.retentions?.[team.id]?.rtm ?? 0}</p>
                        <p className="text-sm mb-2">Purse: <span className="text-yellow-400">{formatPrice(teamDoc.purseRemaining ?? team.purse)}</span></p>
                        <p className={(session?.retentions?.[team.id]?.locked || retainedIds.length) ? 'text-xs font-semibold text-emerald-400' : 'text-xs font-semibold text-yellow-300'}>
                          {(session?.retentions?.[team.id]?.locked || retainedIds.length) ? '🟢 LOCKED' : '🟡 PENDING'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BACK FACE */}
                  <div 
                    className="absolute inset-0 border border-yellow-500/50 bg-[#0B1C3D] rounded-xl p-4 overflow-hidden"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-1">
                      <h3 className="text-yellow-400 font-display text-lg">Retained Players</h3>
                      {retainedPlayers.length > 0 && (
                        <span className="rounded-full border border-yellow-400/30 px-2 py-0.5 text-[11px] text-yellow-200">
                          {(retentionSlideIndex[team.id] || 0) + 1}/{retainedPlayers.length}
                        </span>
                      )}
                    </div>
                    {retainedPlayers.length === 0 ? (
                      <div className="flex h-[238px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/10">
                        <p className="text-sm text-muted-foreground text-center">No players retained</p>
                      </div>
                    ) : (() => {
                      const activeIndex = Math.min(retentionSlideIndex[team.id] || 0, retainedPlayers.length - 1);
                      const activePlayer = retainedPlayers[activeIndex];
                      const retentionPrice = prices[activePlayer.id] || 0;
                      const isPlayerTransitioning = Boolean(retentionTransitioning[team.id]);

                      return (
                        <div className="relative h-[238px] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#111c34] to-[#071229] p-3">
                          {isPlayerTransitioning ? (
                            <div className="flex h-full flex-col items-center justify-center text-center" aria-live="polite" aria-label="Changing retained player">
                              <div className="relative h-28 w-28 rounded-full border border-yellow-300/30 bg-yellow-400/5 shadow-[0_0_40px_rgba(250,204,21,0.30)] animate-pulse">
                                <div className="absolute inset-3 rounded-full border border-yellow-300/40 animate-ping" />
                                <div className="absolute inset-8 rounded-full bg-yellow-300/30 blur-lg" />
                              </div>
                              <div className="mt-5 h-1 w-32 overflow-hidden rounded-full bg-white/10">
                                <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-yellow-300 to-transparent animate-[retentionSlideIn_0.52s_ease-out]" />
                              </div>
                            </div>
                          ) : (
                            <div key={activePlayer.id} className="flex h-full flex-col items-center justify-center text-center animate-[retentionSlideIn_0.35s_ease-out]">
                              <div className="relative mb-3 h-28 w-28 overflow-hidden rounded-full border-2 border-yellow-400/50 bg-[#06122b] shadow-[0_0_24px_rgba(250,204,21,0.20)]">
                                {(activePlayer.image || activePlayer.imageUrl) ? (
                                  <img src={activePlayer.image || activePlayer.imageUrl} alt={activePlayer.name} className="h-full w-full object-cover transition-transform duration-500 hover:scale-110" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center"><User className="h-10 w-10 text-muted-foreground" /></div>
                                )}
                              </div>
                              <p className="w-full truncate text-base font-bold text-white">{activePlayer.name}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{activePlayer.role || activePlayer.category || 'Retained Player'}</p>
                              <div className="mt-3 grid w-full grid-cols-2 gap-2 text-xs">
                                <div className="rounded-lg bg-black/20 px-2 py-1.5">
                                  <p className="text-muted-foreground">Price</p>
                                  <p className="font-semibold text-yellow-400">{formatPrice(retentionPrice)}</p>
                                </div>
                                <div className="rounded-lg bg-black/20 px-2 py-1.5">
                                  <p className="text-muted-foreground">Rating</p>
                                  <p className="font-semibold text-emerald-300">{activePlayer.rating || activePlayer.starRating || '—'}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          <button
                            type="button"
                            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white transition hover:scale-110 hover:border-yellow-400/60 hover:bg-yellow-400/20"
                            onClick={(event) => { event.stopPropagation(); moveRetainedPlayer(team.id, activeIndex, retainedPlayers.length, -1); }}
                            aria-label={`Show previous retained ${team.shortName} player`}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white transition hover:scale-110 hover:border-yellow-400/60 hover:bg-yellow-400/20"
                            onClick={(event) => { event.stopPropagation(); moveRetainedPlayer(team.id, activeIndex, retainedPlayers.length, 1); }}
                            aria-label={`Show next retained ${team.shortName} player`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })()}
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
