import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { listenSession, listenTeams, startAuction } from '@/lib/sessionService';
import { IPL_TEAMS, formatPrice } from '@/lib/constants';
import { useGameData } from '@/contexts/GameDataContext';
import { User } from 'lucide-react';
import { TeamLogo } from '@/components/TeamLogo';

const RetentionReview = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [starting, setStarting] = useState(false);
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

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
          {IPL_TEAMS.map((team) => {
            const teamDoc = teams.find((t) => t.id === team.id) || {};
            const retainedIds = (teamDoc.retainedPlayers || session?.retentions?.[team.id]?.players || []) as string[];
            const retainedPlayers = retainedIds.map((id) => playerById.get(id)).filter(Boolean) as any[];
            const prices = teamDoc.playerPurchasePrices || {};
            const managerName = session?.managerNames?.[team.id] || (String(session?.selectedTeams?.[team.id] || '').startsWith('AI-') ? 'AI Manager' : 'Waiting');
            const isLocked = Boolean(session?.retentions?.[team.id]?.locked) || retainedIds.length > 0;

            return (
              <div
                key={team.id}
                className="group relative rounded-xl border border-white/10 bg-[#0f172a] p-4 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-yellow-400/70 hover:shadow-[0_0_20px_rgba(251,191,36,0.5)]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <TeamLogo teamId={team.id} logo={teamDoc.logo || team.logo} shortName={team.shortName} size="md" />
                  <div>
                    <h2 className="font-display text-lg leading-none">{team.shortName}</h2>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{team.name}</p>
                  </div>
                </div>

                <p className="text-sm mb-1 text-muted-foreground">Manager: <span className="text-foreground">{managerName}</span></p>
                <p className="text-sm mb-1">Retained: {retainedIds.length}/6</p>
                <p className="text-sm mb-1">RTM Cards: {teamDoc.rtmCards ?? session?.retentions?.[team.id]?.rtm ?? 0}</p>
                <p className="text-sm mb-2">Purse: <span className="text-yellow-400">{formatPrice(teamDoc.purseRemaining ?? team.purse)}</span></p>
                <p className={isLocked ? 'text-xs font-semibold text-emerald-400' : 'text-xs font-semibold text-yellow-300'}>
                  {isLocked ? '🟢 LOCKED' : '🟡 PENDING'}
                </p>

                <div className="pointer-events-none absolute left-0 right-0 bottom-full mb-3 z-30 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                  <div className="rounded-xl border border-yellow-400/50 bg-[#0f172a] p-3 shadow-2xl">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {retainedPlayers.length > 0 ? retainedPlayers.map((p) => (
                        <div key={p.id} className="rounded-lg border border-white/10 bg-[#111c34] p-2">
                          <div className="w-full h-20 rounded-md bg-muted flex items-center justify-center overflow-hidden mb-2">
                            {(p.image || p.imageUrl) ? (
                              <img src={p.image || p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </div>
                          <p className="text-xs font-semibold truncate">{p.name}</p>
                          <p className="text-[11px] text-yellow-400">{formatPrice(prices[p.id] || 0)}</p>
                          <p className="text-[10px] text-muted-foreground">{p.isCapped ? 'Capped' : 'Uncapped'}</p>
                        </div>
                      )) : (
                        <p className="text-xs text-muted-foreground col-span-full">No retained players.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {isHost ? (
          <div className="flex justify-center">
            <Button
              variant="gold"
              size="lg"
              className="min-w-64"
              disabled={starting}
              onClick={async () => {
                if (!gameCode) return;
                try {
                  setStarting(true);
                  await startAuction(gameCode);
                  navigate(`/auction/${gameCode}`);
                } finally {
                  setStarting(false);
                }
              }}
            >
              {starting ? 'Starting…' : 'Start Auction'}
            </Button>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-lg text-muted-foreground font-medium">Host will start the auction shortly</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RetentionReview;
