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
            <div key={team.id} className="p-4 border rounded-xl bg-secondary/30">
              <div className="flex items-center gap-3 mb-2">
                <TeamLogo teamId={team.id} logo={teamDoc.logo || team.logo} shortName={team.shortName} size="md" />
                <h2 className="font-display text-xl">{team.shortName}</h2>
              </div>
              <div className="flex gap-2 flex-wrap mb-3">
                {retainedPlayers.map((p) => (
                  <div key={p.id} className="text-center">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden mx-auto" title={p.name}>
                      {(p.image || p.imageUrl) ? <img src={(p.image || p.imageUrl)} className="w-full h-full object-cover" /> : <User className="w-4 h-4" />}
                    </div>
                    <p className="text-[10px] mt-1 w-16 truncate">{p.name}</p>
                    {Number(p.rating || 0) >= 4 && <p className="text-[10px] text-yellow-400">{Array(Math.floor(Number(p.rating || 0))).fill('⭐').join(' ')}</p>}
                    <p className="text-[10px] text-muted-foreground">{formatPrice(prices[p.id] || 0)}</p>
                    <p className={`text-[9px] font-semibold ${p.isCapped ? 'text-emerald-500' : 'text-slate-400'}`}>{p.isCapped ? 'CAPPED' : 'UNCAPPED'}</p>
                    {p.overseas && <p className="text-[10px] text-yellow-400">✈️</p>}
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
