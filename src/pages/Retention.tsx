import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { listenSession, lockRetention } from "@/lib/sessionService";
import type { Player } from "@/lib/samplePlayers";
import { useGameData } from '@/contexts/GameDataContext';

const Retention = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  
  // Timer state (Server Sync)
  const [timeLeft, setTimeLeft] = useState(30);
  
  // Local state for players (using global master list)
  const { masterPlayerList } = useGameData();
  const players = masterPlayerList;

  const userId = localStorage.getItem("uid");

  /* ===================== LISTEN SESSION ===================== */
  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, setSession);
    return () => unsub();
  }, [gameCode]);


  /* ===================== AUTO NAVIGATE ===================== */
  // ✅ FIX: Check if ALL 10 TEAMS are locked (AI + Humans)
  // keep effect for auto-navigation, but user also navigates on lock button
  useEffect(() => {
    if (!session?.retentions || !session?.allTeams) return;

    const allTeamIds = session.allTeams.map((t: any) => t.id);

    const allLocked = allTeamIds.every(
      (id: string) => session.retentions[id]?.locked === true
    );

    if (allLocked) {
      navigate(`/retention-review/${gameCode}`);
    }
  }, [session, gameCode, navigate]);

  /* ===================== DERIVED DATA ===================== */
  const myTeam = useMemo(() => {
    if (!session || !userId) return null;
    return Object.entries(session.selectedTeams || {}).find(
      ([, uid]) => uid === userId
    )?.[0] ?? null;
  }, [session, userId]);

  // ✅ FIX: Case-insensitive filter + Safety check
  const squad: Player[] = useMemo(() => {
    if (!myTeam || players.length === 0) return [];
    
    return players.filter((p) => 
      p.previousTeam && 
      p.previousTeam.toLowerCase() === myTeam.toLowerCase()
    );
  }, [players, myTeam]);

  const cappedCount = useMemo(() => {
    return selected.filter(
      (id) => squad.find((p) => p.id === id)?.isCapped
    ).length;
  }, [selected, squad]);

  const uncappedCount = selected.length - cappedCount;

  /* ===================== LOCK RETENTION ===================== */
  const handleLock = useCallback(async () => {
    if (!gameCode || !myTeam) return;

    await lockRetention(
      gameCode,
      myTeam,
      selected,
      cappedCount,
      uncappedCount
    );

    // after locking, navigate the user to review page immediately
    navigate(`/retention-review/${gameCode}`);
  }, [gameCode, myTeam, selected, cappedCount, uncappedCount, navigate]);

  /* ===================== SERVER SYNC TIMER ===================== */
  useEffect(() => {
    if (!session?.retentionStartedAt) return;

    const start = session.retentionStartedAt.toDate().getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000);
      const remaining = 30 - diff;

      if (remaining <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.retentionStartedAt]);

  // Trigger lock when time expires
  useEffect(() => {
    if (timeLeft === 0) {
      handleLock();
    }
  }, [timeLeft, handleLock]);

  /* ===================== UI HANDLERS ===================== */
  const handleToggle = (playerId: string) => {
    if (selected.includes(playerId)) {
      setSelected((prev) => prev.filter((id) => id !== playerId));
      return;
    }

    if (selected.length >= 6) return;

    const player = squad.find((p) => p.id === playerId);
    if (!player) return;

    if (player.isCapped && cappedCount >= 5) return;
    if (!player.isCapped && uncappedCount >= 2) return;

    setSelected((prev) => [...prev, playerId]);
  };

  /* ===================== RENDER ===================== */
  if (!session || !myTeam) {
    return <p className="p-6">Loading retention…</p>;
  }

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-display mb-4">
        Retention – {myTeam} (⏱ {timeLeft}s)
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {squad.map((player) => {
          const isSelected = selected.includes(player.id);
          return (
            <div
              key={player.id}
              onClick={() => handleToggle(player.id)}
              className={`p-4 border rounded-lg cursor-pointer transition ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border"
              }`}
            >
              <p className="font-semibold">{player.name}</p>
              <p className="text-xs text-muted-foreground">
                {player.isCapped ? "Capped" : "Uncapped"}
              </p>
            </div>
          );
        })}
      </div>

      <Button onClick={handleLock} disabled={selected.length === 0}>
        Confirm Retention ({selected.length}/6)
      </Button>
    </div>
  );
};

export default Retention;