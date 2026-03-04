import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { IPL_TEAMS, SQUAD_CONSTRAINTS, formatPrice } from "@/lib/constants";
import { listenSession, listenTeams, lockRetention } from "@/lib/sessionService";
import type { Player } from "@/lib/samplePlayers";
import { useGameData } from "@/contexts/GameDataContext";
import { User } from "lucide-react";

const Retention = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const { masterPlayerList } = useGameData();
  const userId = localStorage.getItem("uid");

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
    if (!session?.retentions || !session?.allTeams) return;
    const allTeamIds = session.allTeams.map((t: any) => t.id);
    const allLocked = allTeamIds.every((id: string) => session.retentions[id]?.locked === true);
    if (allLocked) navigate(`/retention-review/${gameCode}`);
  }, [session, gameCode, navigate]);

  const myTeam = useMemo(() => {
    if (!session || !userId) return null;
    return Object.entries(session.selectedTeams || {}).find(([, uid]) => uid === userId)?.[0] ?? null;
  }, [session, userId]);

  const squad: Player[] = useMemo(() => {
    if (!myTeam) return [];
    return masterPlayerList.filter((p) => p.previousTeam && p.previousTeam.toLowerCase() === myTeam.toLowerCase());
  }, [masterPlayerList, myTeam]);

  const cappedCount = useMemo(() => selected.filter((id) => squad.find((p) => p.id === id)?.isCapped).length, [selected, squad]);
  const uncappedCount = selected.length - cappedCount;
  const selectedSpend = selected.reduce((sum, id) => sum + Number(squad.find((p) => p.id === id)?.basePrice || 0), 0);
  const currentTeamDoc = teams.find((t) => t.id === myTeam);
  const basePurse = IPL_TEAMS.find((t) => t.id === myTeam)?.purse || 0;
  const remainingPurse = Math.max(0, basePurse - selectedSpend);
  const rtmPreview = Math.max(0, 6 - selected.length);

  const handleLock = useCallback(async () => {
    if (!gameCode || !myTeam) return;
    await lockRetention(gameCode, myTeam, selected, cappedCount, uncappedCount);
    navigate(`/retention-review/${gameCode}`);
  }, [gameCode, myTeam, selected, cappedCount, uncappedCount, navigate]);

  useEffect(() => {
    if (!session?.retentionStartedAt) return;
    const start = session.retentionStartedAt.toDate().getTime();
    const interval = setInterval(() => {
      const remaining = 30 - Math.floor((Date.now() - start) / 1000);
      setTimeLeft(Math.max(0, remaining));
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.retentionStartedAt]);

  useEffect(() => {
    if (timeLeft === 0) handleLock();
  }, [timeLeft, handleLock]);

  const handleToggle = (playerId: string) => {
    if (selected.includes(playerId)) return setSelected((prev) => prev.filter((id) => id !== playerId));
    if (selected.length >= 6) return;
    const player = squad.find((p) => p.id === playerId);
    if (!player) return;
    if (player.isCapped && cappedCount >= 5) return;
    if (!player.isCapped && uncappedCount >= 2) return;
    setSelected((prev) => [...prev, playerId]);
  };

  if (!session || !myTeam) return <p className="p-6">Loading retention…</p>;

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-display mb-4">Retention – {myTeam.toUpperCase()} (⏱ {timeLeft}s)</h1>

      <div className="grid md:grid-cols-3 gap-3 mb-6 text-sm">
        <div className="p-3 border rounded-lg">Remaining Purse: <strong>{formatPrice(remainingPurse)}</strong></div>
        <div className="p-3 border rounded-lg">Retained Count: <strong>{selected.length}/6</strong></div>
        <div className="p-3 border rounded-lg">RTM Cards: <strong>{rtmPreview}</strong></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {squad.map((player) => {
          const isSelected = selected.includes(player.id);
          return (
            <div key={player.id} onClick={() => handleToggle(player.id)} className={`p-3 border rounded-lg cursor-pointer transition ${isSelected ? "border-primary bg-primary/10" : "border-border"}`}>
              <div className="flex gap-3 items-center mb-2">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                  {player.imageUrl ? <img src={player.imageUrl} className="w-full h-full object-cover" /> : <User className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-sm">{player.name}</p>
                  <p className="text-xs text-muted-foreground">{player.role}</p>
                </div>
              </div>
              <p className="text-xs">Retention Price: <strong>{formatPrice(player.basePrice)}</strong></p>
              <p className="text-xs text-muted-foreground">{player.isCapped ? "Capped" : "Uncapped"}</p>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-5 gap-2 mb-4 text-xs">
        {IPL_TEAMS.map((t) => {
          const r = session?.retentions?.[t.id];
          return <div key={t.id} className="p-2 border rounded">{t.shortName}: Purse {formatPrice(teams.find((tm) => tm.id === t.id)?.purseRemaining || IPL_TEAMS.find((it) => it.id === t.id)?.purse || 0)} • Ret {r?.players?.length || 0} • RTM {teams.find((tm) => tm.id === t.id)?.rtmCards ?? r?.rtm ?? 0}</div>;
        })}
      </div>

      <Button onClick={handleLock} disabled={selected.length === 0 || (currentTeamDoc?.retainedPlayers || []).length > 0}>Confirm Retention ({selected.length}/6)</Button>
    </div>
  );
};

export default Retention;
