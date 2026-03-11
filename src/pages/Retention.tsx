import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { IPL_TEAMS, formatPrice, RETENTION_COSTS } from "@/lib/constants";
import { listenSession, listenTeams, lockRetention } from "@/lib/sessionService";
import type { Player } from "@/lib/samplePlayers";
import { useGameData } from "@/contexts/GameDataContext";
import { User } from "lucide-react";
import { TeamLogo } from "@/components/TeamLogo";

const Retention = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());
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
    const allLocked = session.allTeams.map((t: any) => t.id).every((id: string) => session.retentions[id]?.locked === true);
    if (allLocked) navigate(`/retention-review/${gameCode}`);
  }, [session, gameCode, navigate]);

  const myTeam = useMemo(() => {
    if (!session || !userId) return null;
    return Object.entries(session.selectedTeams || {}).find(([, uid]) => uid === userId)?.[0] ?? null;
  }, [session, userId]);

  const squad: Player[] = useMemo(() => {
    if (!myTeam) return [];
    return masterPlayerList.filter((p: any) => (p.previousTeamId || p.previousTeam || "").toLowerCase() === myTeam.toLowerCase());
  }, [masterPlayerList, myTeam]);

  const costById = useMemo(() => {
    const cappedSorted = selected
      .map((id) => squad.find((p) => p.id === id))
      .filter((p): p is Player => !!p)
      .filter((p: any) => Boolean((p as any).isCapped));

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

  const cappedCount = useMemo(() => selected.filter((id) => Boolean((squad.find((p: any) => p.id === id) as any)?.isCapped)).length, [selected, squad]);
  const uncappedCount = selected.length - cappedCount;
  const selectedSpend = useMemo(() => selected.reduce((sum, id) => sum + Number(costById[id] || 0), 0), [selected, costById]);

  const basePurse = IPL_TEAMS.find((t) => t.id === myTeam)?.purse || 0;
  const remainingPurse = Math.max(0, basePurse - selectedSpend);
  const rtmPreview = Math.max(0, 6 - selected.length);

  const handleLock = useCallback(async () => {
    if (!gameCode || !myTeam) return;
    await lockRetention(gameCode, myTeam, selected, cappedCount, uncappedCount);
    navigate(`/retention-review/${gameCode}`);
  }, [gameCode, myTeam, selected, cappedCount, uncappedCount, navigate]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const timerEndsAtMs = session?.currentAuction?.timerEndsAt?.toMillis?.() || 0;
  const timeLeft = Math.max(0, Math.floor((timerEndsAtMs - nowMs) / 1000));

  useEffect(() => {
    if (session?.currentAuction?.timerMode !== "RETENTION") return;
    if (timeLeft === 0) handleLock();
  }, [timeLeft, handleLock, session?.currentAuction?.timerMode]);

  const handleToggle = (playerId: string) => {
    if (selected.includes(playerId)) return setSelected((prev) => prev.filter((id) => id !== playerId));
    if (selected.length >= 6) return;
    const player: any = squad.find((p) => p.id === playerId);
    if (!player) return;
    if (player.isCapped && cappedCount >= 5) return;
    if (!player.isCapped && uncappedCount >= 2) return;
    setSelected((prev) => [...prev, playerId]);
  };

  if (!session || !myTeam) return <p className="p-6">Loading retention…</p>;

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-display mb-4">Retention – {myTeam.toUpperCase()} (⏱ {timeLeft}s)</h1>

      <div className="grid md:grid-cols-4 gap-3 mb-6 text-sm">
        <div className="p-3 border rounded-lg">Retained: <strong>{selected.length}/6</strong></div>
        <div className="p-3 border rounded-lg">Total Cost: <strong>{formatPrice(selectedSpend)}</strong></div>
        <div className="p-3 border rounded-lg">Purse Remaining: <strong>{formatPrice(remainingPurse)}</strong></div>
        <div className="p-3 border rounded-lg">RTM Cards: <strong>{rtmPreview}</strong></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {squad.map((player: any) => {
          const isSelected = selected.includes(player.id);
          const displayedCost = isSelected ? costById[player.id] : (player.isCapped ? RETENTION_COSTS.CAPPED_SLOTS[0] : RETENTION_COSTS.UNCAPPED);
          return (
            <div key={player.id} onClick={() => handleToggle(player.id)} className={`p-3 border rounded-lg cursor-pointer transition ${isSelected ? "border-primary bg-primary/10" : "border-border"}`}>
              <div className="mb-2">
                <div className="w-full aspect-square rounded-md bg-secondary flex items-center justify-center overflow-hidden mb-2 border">
                  {(player.image || player.imageUrl) ? <img src={(player.image || player.imageUrl)} className="w-full h-full object-cover" /> : <User className="w-8 h-8" />}
                </div>
                <p className="font-semibold text-xs truncate">{player.name}</p>
                <p className="text-[11px] text-muted-foreground">{player.role}</p>
              </div>
              <p className="text-xs">Retention Cost: <strong>{formatPrice(displayedCost)}</strong></p>
              <p className="text-xs text-muted-foreground">{player.isCapped ? "Capped" : "Uncapped"}</p>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-5 gap-2 mb-4 text-xs">
        {IPL_TEAMS.map((t) => {
          const teamDoc = teams.find((tm) => tm.id === t.id);
          const r = session?.retentions?.[t.id];
          return (
            <div key={t.id} className="p-2 border rounded flex items-center gap-2">
              <TeamLogo logo={(teamDoc as any)?.logo || (t as any).logo} shortName={t.shortName} size="sm" />
              <div>{t.shortName}: Purse {formatPrice(teamDoc?.purseRemaining || t.purse)} • Ret {teamDoc?.retainedPlayers?.length ?? r?.players?.length ?? 0} • RTM {teamDoc?.rtmCards ?? r?.rtm ?? 0}</div>
            </div>
          );
        })}
      </div>

      <Button onClick={handleLock} disabled={selected.length === 0}>Confirm Retention ({selected.length}/6)</Button>
    </div>
  );
};

export default Retention;
