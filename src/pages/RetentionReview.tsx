import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { listenSession, listenTeams, startAuction } from '@/lib/sessionService';
import { IPL_TEAMS, formatPrice } from '@/lib/constants';
import { useGameData } from '@/contexts/GameDataContext';
import { User } from 'lucide-react';
import { TeamLogo } from '@/components/TeamLogo';
import { cn } from '@/lib/utils';

const RetentionReview = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [starting, setStarting] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
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

        <div className="grid mb-10" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          {IPL_TEAMS.map((team) => {
            const teamDoc = teams.find((t) => t.id === team.id) || {};
            const retainedIds = (teamDoc.retainedPlayers || session?.retentions?.[team.id]?.players || []) as string[];
            const retainedPlayers = retainedIds.map((id) => playerById.get(id)).filter(Boolean) as any[];
            const prices = teamDoc.playerPurchasePrices || {};
            const managerName = session?.managerNames?.[team.id] || (String(session?.selectedTeams?.[team.id] || '').startsWith('AI-') ? 'AI Manager' : 'Available');

            return (
              <div 
                key={team.id} 
                className="group relative h-[320px] rounded-xl cursor-pointer"
                style={{ perspective: '1000px' }}
                onClick={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}
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
                    className="absolute inset-0 border border-yellow-500/50 bg-[#0B1C3D] rounded-xl p-4 overflow-y-auto custom-scrollbar"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  >
                    <h3 className="text-yellow-400 font-display text-lg mb-3 border-b border-white/10 pb-1 sticky top-0 bg-[#0B1C3D] z-10">
                      Retained Players
                    </h3>
                    {retainedPlayers.length === 0 ? (
                      <p className="text-sm text-muted-foreground mt-4 text-center">No players retained</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {retainedPlayers.map((p) => (
                          <div key={p.id} className="rounded-lg border border-white/10 bg-[#111c34] p-2 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-[#06122b] flex items-center justify-center overflow-hidden mb-2 border border-white/5">
                              {(p.image || p.imageUrl) ? <img src={p.image || p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-muted-foreground" />}
                            </div>
                            <p className="text-xs font-semibold truncate w-full">{p.name}</p>
                            <p className="text-[11px] text-yellow-400">{formatPrice(prices[p.id] || 0)}</p>
                          </div>
                        ))}
                      </div>
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
