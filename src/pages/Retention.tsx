import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { IPL_TEAMS, formatPrice, RETENTION_COSTS } from '@/lib/constants';
import { listenSession, lockRetention } from '@/lib/sessionService';
import type { Player } from '@/lib/samplePlayers';
import { useGameData } from '@/contexts/GameDataContext';
import { TeamLogo } from '@/components/TeamLogo';
import { CheckCircle2 } from 'lucide-react';

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

  if (!session || !myTeam) return <p className="p-6">Loading retention…</p>;

  const team = IPL_TEAMS.find((t) => t.id === myTeam);

  return (
    <div className="min-h-screen p-6 bg-[#020617]">
      <div className="max-w-[1500px] mx-auto">
        <section className="text-center mb-8 fade-in">
          <div className="mx-auto mb-3 w-fit">
            <TeamLogo teamId={myTeam} logo={(team as any)?.logo} shortName={team?.shortName} size="lg" />
          </div>
          <h1 className="font-display text-4xl text-primary">{team?.name}</h1>
          <p className="text-muted-foreground">Manager: <span className="text-yellow-400">{managerName}</span></p>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 slide-up">
          <div className="rounded-xl border border-yellow-400/50 bg-[#0f172a] p-4 glow-primary">
            <p className="text-xs text-muted-foreground">Retention</p>
            <p className="text-2xl font-bold text-yellow-400">{selected.length} / 6</p>
          </div>
          <div className="rounded-xl border border-yellow-400/30 bg-[#0f172a] p-4">
            <p className="text-xs text-muted-foreground">Capped</p>
            <p className="text-2xl font-bold">{cappedCount} / 5</p>
          </div>
          <div className="rounded-xl border border-yellow-400/30 bg-[#0f172a] p-4">
            <p className="text-xs text-muted-foreground">Uncapped</p>
            <p className="text-2xl font-bold">{uncappedCount} / 2</p>
          </div>
          <div className="rounded-xl border border-yellow-400/30 bg-[#0f172a] p-4">
            <p className="text-xs text-muted-foreground">RTM Cards</p>
            <p className="text-2xl font-bold">{rtmCards}</p>
          </div>
          <div className="rounded-xl border border-yellow-400/50 bg-[#0f172a] p-4 glow-primary">
            <p className="text-xs text-muted-foreground">Purse</p>
            <p className="text-2xl font-bold text-yellow-400">{formatPrice(remainingPurse)}</p>
          </div>
        </section>

        <section className="slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="max-h-[74vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-5">
              {squad.map((player: any) => {
                const isSelected = selected.includes(player.id);
                const role = roleBadge(player.role || '');
                const cost = isSelected ? Number(costById[player.id] || 0) : undefined;
                return (
                  <button
                    key={player.id}
                    onClick={() => handleToggle(player.id)}
                    className={cn(
                      'relative text-left rounded-xl border p-3 bg-[#0f172a] transition-all duration-300',
                      'hover:scale-[1.02] hover:shadow-[0_0_18px_rgba(251,191,36,0.45)]',
                      isSelected ? 'border-yellow-400 shadow-[0_0_22px_rgba(251,191,36,0.6)]' : 'border-white/10',
                    )}
                  >
                    {isSelected && (
                      <>
                        <div className="absolute left-2 top-2 text-[11px] text-yellow-400 font-semibold">- {formatPrice(cost || 0)}</div>
                        <div className="absolute right-2 bottom-2 flex items-center gap-1 text-xs text-yellow-400">
                          <CheckCircle2 className="w-4 h-4" /> Retained
                        </div>
                      </>
                    )}

                    <span className="absolute right-2 top-2 text-[10px] rounded-md border border-yellow-400/50 px-2 py-0.5 text-yellow-400">{role}</span>

                    <div className="w-full aspect-square rounded-md bg-secondary flex items-center justify-center overflow-hidden mb-3 mt-2">
                      {player.imageUrl || player.image ? (
                        <img src={player.imageUrl || player.image} alt={player.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-muted-foreground text-xs">No image</span>
                      )}
                    </div>

                    <p className="font-semibold truncate">{player.name}</p>
                    <p className="text-xs text-muted-foreground">{player.isCapped ? 'Capped' : 'Uncapped'}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-8 flex flex-wrap justify-center gap-4">
          <Button
            variant="gold"
            size="xl"
            onClick={handleFinalize}
            className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-semibold hover:scale-105 hover:shadow-[0_0_20px_rgba(251,191,36,0.8)] transition-all"
          >
            FINALIZE RETENTIONS
          </Button>
        </section>
      </div>
    </div>
  );
};

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export default Retention;
