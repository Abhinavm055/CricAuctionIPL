import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuctionHeader } from "@/components/AuctionHeader";
import { PlayerCard } from "@/components/PlayerCard";
import { TeamCard } from "@/components/TeamCard";
import { BidTimer } from "@/components/BidTimer";
import { BidControls } from "@/components/BidControls";
import { Player } from "@/lib/samplePlayers";
import { useGameData } from "@/contexts/GameDataContext";
import { getNextBid, IPL_TEAMS, SQUAD_CONSTRAINTS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  finalizePlayerSale,
  listenSession,
  listenTeams,
  placeBid,
  resolveRtmDecision,
  startNextPlayer,
  skipCurrentPlayer,
  togglePauseAuction,
  startAcceleratedRound,
} from "@/lib/sessionService";
import { getAIBid } from "@/lib/aiEngine";
import { TeamDetailsPanel } from "@/components/TeamDetailsPanel";
import { RTMModal } from "@/components/RTMModal";
import { HammerSoldEffect } from "@/components/HammerSoldEffect";

export interface TeamState {
  id: string;
  name: string;
  shortName: string;
  color: string;
  logo?: string;
  purseRemaining: number;
  players: string[];
  retainedPlayers: string[];
  overseasCount: number;
  squadSize: number;
  rtmCards: number;
  playerPurchasePrices: Record<string, number>;
  isAI: boolean;
}

const isOverseasPlayer = (player: any) => Boolean(player?.overseas ?? player?.isOverseas);

const Auction = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<TeamState[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [commentary, setCommentary] = useState<string[]>([]);
  const [banner, setBanner] = useState<{ kind: 'SOLD' | 'UNSOLD'; text: string } | null>(null);
  const [showHammer, setShowHammer] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);

  const userId = localStorage.getItem("uid") || "";
  const { masterPlayerList } = useGameData();

  const prevBidRef = useRef<number>(0);
  const prevBidderRef = useRef<string | null>(null);
  const prevStatusRef = useRef<string>("IDLE");
  const autoAdvanceKeyRef = useRef<string | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const autoAdvanceHostTimeoutRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const playTone = useCallback((freq: number, duration = 0.12, volume = 0.04) => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, setSession);
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenTeams(gameCode, (teamDocs) => {
      const enriched = (teamDocs as any[]).map((team) => ({ ...IPL_TEAMS.find((t) => t.id === team.id), ...team }));
      setTeams(enriched as TeamState[]);
    });
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    if (session && !["AUCTION", "AUCTION_COMPLETE"].includes(session.phase)) navigate(`/lobby/${gameCode}`);
  }, [session, gameCode, navigate]);

  const isHost = session?.hostId === userId;
  const queueLength = (session?.auctionQueue || []).length;
  const myTeamId = Object.entries(session?.selectedTeams || {}).find(([_, uid]) => uid === userId)?.[0] as string | undefined;
  const userTeam = teams.find((team) => team.id === myTeamId);

  const currentAuction = session?.currentAuction;
  const currentPlayer = useMemo(() => masterPlayerList.find((p: any) => p.id === currentAuction?.activePlayerId) || null, [masterPlayerList, currentAuction?.activePlayerId]);
  const currentBidderTeam = teams.find((team) => team.id === currentAuction?.currentBidderId);

  const nextBid = getNextBid(currentAuction?.currentBid || 0);
  const timerSeconds = Math.max(0, Math.floor(((currentAuction?.timerEndsAt?.toMillis?.() || Date.now()) - Date.now()) / 1000));

  const teamPlayersResolved = useMemo(() => {
    const lookup = new Map(masterPlayerList.map((p: any) => [p.id, p]));
    return teams.reduce<Record<string, { retained: Player[]; bought: Player[] }>>((acc, team) => {
      acc[team.id] = {
        retained: (team.retainedPlayers || []).map((id) => lookup.get(id)).filter(Boolean) as Player[],
        bought: (team.players || []).map((id) => lookup.get(id)).filter(Boolean) as Player[],
      };
      return acc;
    }, {});
  }, [teams, masterPlayerList]);

  const canTeamBid = (team: TeamState | undefined, player: Player | null, amount: number) => {
    if (!team || !player) return false;
    if (currentAuction?.status !== "RUNNING") return false;
    if (currentAuction?.currentBidderId === team.id) return false;
    if (Number(team.purseRemaining || 0) < amount) return false;
    if (Number(team.squadSize || 0) >= SQUAD_CONSTRAINTS.MAX_SQUAD) return false;
    if (isOverseasPlayer(player) && Number(team.overseasCount || 0) >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) return false;
    return true;
  };

  const skipDisabled = useMemo(() => {
    if (!currentPlayer || !currentAuction) return true;
    return Number(currentAuction.currentBid || 0) > Number((currentPlayer as any).basePrice || 0);
  }, [currentPlayer, currentAuction]);

  const handleBid = useCallback(async (amount: number) => {
    if (!gameCode || !myTeamId || !userTeam || !currentPlayer) return;
    if (!canTeamBid(userTeam, currentPlayer, amount)) return;
    await placeBid(gameCode, myTeamId, amount);
  }, [gameCode, myTeamId, userTeam, currentPlayer, currentAuction?.status, currentAuction?.currentBidderId]);

  const handleFinalize = useCallback(async () => {
    if (!gameCode || !isHost) return;
    playTone(220, 0.2, 0.08); // hammer
    await finalizePlayerSale(gameCode);
  }, [gameCode, isHost, playTone]);

  useEffect(() => {
    if (!isHost || !gameCode || !currentPlayer) return;
    if (currentAuction?.status !== "RUNNING") return;

    const aiDecision = getAIBid(
      teams.map((t) => ({
        ...t,
        players: [...(t.players || []), ...(t.retainedPlayers || [])],
        overseasCount: t.overseasCount,
        isAI: !!t.isAI,
      })),
      currentPlayer,
      currentAuction.currentBid,
      currentAuction.currentBidderId
    );

    if (!aiDecision) return;
    const timer = setTimeout(() => placeBid(gameCode, aiDecision.teamId, aiDecision.bid).catch(() => undefined), aiDecision.delayMs);
    return () => clearTimeout(timer);
  }, [isHost, gameCode, teams, currentPlayer, currentAuction?.status, currentAuction?.currentBid, currentAuction?.currentBidderId]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) window.clearInterval(autoAdvanceTimerRef.current);
      if (autoAdvanceHostTimeoutRef.current) window.clearTimeout(autoAdvanceHostTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!currentAuction) return;

    if (currentAuction.currentBidderId && Number(currentAuction.currentBid || 0) !== prevBidRef.current) {
      const team = teams.find((t) => t.id === currentAuction.currentBidderId);
      const line = prevBidderRef.current ? `${team?.shortName || "Team"} raises to ₹${(Number(currentAuction.currentBid) / 10000000).toFixed(2)} Cr` : `${team?.shortName || "Team"} enters the bidding`;
      setCommentary((prev) => [line, ...prev].slice(0, 8));
      playTone(880, 0.08, 0.05); // bid sound
    }

    if (currentAuction.status === "SOLD" && prevStatusRef.current !== "SOLD") {
      const team = teams.find((t) => t.id === currentAuction.currentBidderId);
      const text = `SOLD TO ${team?.shortName || "TEAM"} • ₹${(Number(currentAuction.currentBid || 0) / 10000000).toFixed(2)} Cr`;
      setBanner({ kind: 'SOLD', text });
      setShowHammer(true);
      setCommentary((prev) => [text, ...prev].slice(0, 8));
      setTimeout(() => setShowHammer(false), 1400);
      setTimeout(() => setBanner(null), 3000);
      playTone(260, 0.2, 0.08);
    }

    if (currentAuction.status === "UNSOLD" && prevStatusRef.current !== "UNSOLD") {
      const text = `UNSOLD • ${currentPlayer?.name || "Player"}`;
      setBanner({ kind: 'UNSOLD', text });
      setCommentary((prev) => [text, ...prev].slice(0, 8));
      setTimeout(() => setBanner(null), 2500);
      playTone(180, 0.22, 0.07);
    }

    prevBidRef.current = Number(currentAuction.currentBid || 0);
    prevBidderRef.current = currentAuction.currentBidderId || null;
    prevStatusRef.current = currentAuction.status || "IDLE";
  }, [currentAuction, teams, currentPlayer, playTone]);

  useEffect(() => {
    if (!currentAuction) return;
    if (!['SOLD', 'UNSOLD'].includes(currentAuction.status || '')) {
      setAutoNextCountdown(null);
      return;
    }

    const key = `${currentAuction.activePlayerId}-${currentAuction.status}`;
    if (autoAdvanceKeyRef.current === key) return;
    autoAdvanceKeyRef.current = key;

    if (autoAdvanceTimerRef.current) window.clearInterval(autoAdvanceTimerRef.current);

    let counter = 3;
    setAutoNextCountdown(counter);

    autoAdvanceTimerRef.current = window.setInterval(() => {
      counter -= 1;

      if (counter <= 0) {
        setAutoNextCountdown(null);
        if (autoAdvanceTimerRef.current) {
          window.clearInterval(autoAdvanceTimerRef.current);
          autoAdvanceTimerRef.current = null;
        }
        return;
      }

      setAutoNextCountdown(counter);
    }, 1000);
  }, [currentAuction]);

  useEffect(() => {
    if (!isHost || !gameCode || !currentAuction) return;
    if (!['SOLD', 'UNSOLD'].includes(currentAuction.status || '')) return;

    const key = `${currentAuction.activePlayerId}-${currentAuction.status}`;
    if (autoAdvanceHostTimeoutRef.current) window.clearTimeout(autoAdvanceHostTimeoutRef.current);

    autoAdvanceHostTimeoutRef.current = window.setTimeout(() => {
      if (autoAdvanceKeyRef.current !== key) return;
      startNextPlayer(gameCode).catch(() => undefined);
    }, 3000);
  }, [isHost, gameCode, currentAuction]);

  useEffect(() => {
    if (timerSeconds === 5) playTone(500, 0.05, 0.03);
    if (timerSeconds === 3) playTone(900, 0.08, 0.05);
    if (timerSeconds === 0 && currentAuction?.status === "RUNNING") playTone(220, 0.2, 0.08);
  }, [timerSeconds, currentAuction?.status, playTone]);

  const pendingRtm = session?.pendingRtm;
  const rtmPlayer = masterPlayerList.find((p: any) => p.id === pendingRtm?.playerId) || null;
  const rtmOriginalTeam = teams.find((t) => t.id === pendingRtm?.originalTeamId);
  const rtmWinningTeam = teams.find((t) => t.id === pendingRtm?.winningTeamId);

  const recentPurchases = useMemo(() => {
    const purchases = (session?.recentPurchases || []) as Array<{ playerId: string; price: number; teamId: string }>;
    return purchases.slice(0, 5);
  }, [session?.recentPurchases]);

  const purseBoard = useMemo(() => [...teams].sort((a, b) => Number(b.purseRemaining) - Number(a.purseRemaining)).slice(0, 5), [teams]);

  const showAcceleratedButton = useMemo(() => {
    if (!isHost) return false;
    const queueIndex = Number(session?.queueIndex ?? -1);
    const endedNormalQueue = queueLength > 0 && queueIndex >= queueLength;
    return endedNormalQueue && Number((session?.unsoldPlayers || []).length) > 0;
  }, [isHost, session?.queueIndex, session?.unsoldPlayers, queueLength]);

  const auctionEnded =
    (session?.phase === "AUCTION_COMPLETE") ||
    (queueLength > 0 && session?.queueIndex >= queueLength - 1 && ["SOLD", "UNSOLD", "IDLE"].includes(currentAuction?.status || "") && !pendingRtm);

  if (!session || !userTeam) return <p className="p-6">Loading auction…</p>;

  return (
    <div className="min-h-screen broadcast-container flex flex-col">
      <AuctionHeader gameCode={gameCode!} currentPool={(currentPlayer as any)?.pool} playersRemaining={Math.max(queueLength - ((session?.queueIndex ?? -1) + 1), 0)} totalPlayers={queueLength} />

      <HammerSoldEffect open={showHammer} text={banner?.kind === "SOLD" ? banner.text : ""} />

      {banner && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none ${banner.kind === 'SOLD' ? 'bg-yellow-500/20' : 'bg-red-500/20'} animate-pulse`}>
          <div className={`px-8 py-6 rounded-2xl text-3xl font-display shadow-2xl ${banner.kind === 'SOLD' ? 'bg-yellow-500 text-black' : 'bg-red-600 text-white'} `}>
            {banner.kind}: {banner.text}
          </div>
        </div>
      )}

      {autoNextCountdown !== null && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-black/70 text-white text-center border border-white/20">
          <p className="text-xs uppercase tracking-wide text-white/70">Next player in</p>
          <p className="text-3xl font-display leading-none">{autoNextCountdown}</p>
        </div>
      )}

      <main className="flex-1 p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-7xl mx-auto">
          <div className="lg:col-span-3 overflow-x-auto">
            <div className="grid grid-flow-col lg:grid-flow-row auto-cols-[180px] lg:auto-cols-auto lg:grid-cols-2 gap-2">
              {teams.map((team) => {
                const resolved = teamPlayersResolved[team.id] || { retained: [], bought: [] };
                const allPlayers = [...resolved.retained, ...resolved.bought];
                return (
                  <TeamCard
                    key={team.id}
                    {...team}
                    playersCount={Number(team.squadSize || allPlayers.length)}
                    overseasCount={Number(team.overseasCount || allPlayers.filter((p) => isOverseasPlayer(p)).length)}
                    rtmCards={team.rtmCards || 0}
                    isCurrentBidder={team.id === currentAuction?.currentBidderId}
                    isBidding={team.id === currentAuction?.currentBidderId}
                    isUserTeam={team.id === myTeamId}
                    onClick={() => setSelectedTeamId(team.id)}
                  />
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col items-center">
            {currentPlayer && currentAuction?.status === "RUNNING" && (
              <>
                <BidTimer key={`${currentAuction.activePlayerId}-${currentAuction.timerEndsAt?.seconds || "no-timer"}`} duration={Math.max(0, Math.floor(timerSeconds))} isActive={currentAuction?.status === 'RUNNING'} onTimeout={handleFinalize} />
                <PlayerCard player={currentPlayer as any} currentBid={currentAuction.currentBid} currentBidder={currentBidderTeam?.shortName || null} teamColor={currentBidderTeam?.color} />
              </>
            )}

            {currentAuction?.status === 'PAUSED' && <p className="text-lg font-semibold text-yellow-400 mt-6">Auction Paused by Host</p>}

            {(!currentPlayer || !["RUNNING", "PAUSED"].includes(currentAuction?.status)) && !['SOLD', 'UNSOLD'].includes(currentAuction?.status || '') && (
              <div className="mt-8">
                {isHost ? <Button onClick={() => startNextPlayer(gameCode!)}>Start Auction</Button> : <p className="text-muted-foreground">Waiting for host…</p>}
              </div>
            )}
          </div>

          <div className="lg:col-span-3 space-y-3">
            <BidControls
              currentBid={currentAuction?.currentBid || 0}
              purseRemaining={userTeam.purseRemaining}
              isYourTurn={true}
              canBid={canTeamBid(userTeam, currentPlayer, nextBid)}
              onBid={handleBid}
              onPass={() => {}}
              isHost={isHost}
              onSkip={() => skipCurrentPlayer(gameCode!)}
              skipDisabled={skipDisabled}
              onPauseToggle={() => togglePauseAuction(gameCode!)}
              isPaused={currentAuction?.status === 'PAUSED'}
              onStartAccelerated={() => startAcceleratedRound(gameCode!)}
              showStartAccelerated={showAcceleratedButton}
            />

            <div className="p-3 border rounded-xl bg-card/40">
              <h3 className="font-semibold mb-2">Live Commentary</h3>
              <div className="space-y-1 text-xs text-muted-foreground max-h-40 overflow-auto">
                {commentary.length ? commentary.map((c, i) => <p key={`${c}-${i}`}>{c}</p>) : <p>Waiting for bidding action…</p>}
              </div>
            </div>

            <div className="p-3 border rounded-xl bg-card/40">
              <h3 className="font-semibold mb-2">Auction Analytics</h3>
              <p className="text-xs font-medium mb-1">Recent Purchases</p>
              <div className="text-xs space-y-1 mb-2">
                {recentPurchases.map((p) => {
                  const pl = masterPlayerList.find((x: any) => x.id === p.playerId);
                  const team = teams.find((t) => t.id === p.teamId);
                  return <p key={`${p.playerId}-${p.teamId}`}>{pl?.name || p.playerId} – ₹{(p.price / 10000000).toFixed(2)} Cr – {team?.shortName || p.teamId}</p>;
                })}
                {!recentPurchases.length && <p className="text-muted-foreground">No purchases yet.</p>}
              </div>
              <p className="text-xs font-medium mb-1">Purse Leaderboard</p>
              <div className="text-xs space-y-1 mb-2">{purseBoard.map((t) => <p key={t.id}>{t.shortName} – ₹{(Number(t.purseRemaining) / 10000000).toFixed(2)} Cr</p>)}</div>
              <p className="text-xs font-medium mb-1">Players Bought</p>
              <div className="text-xs space-y-1">{teams.map((t) => <p key={t.id}>{t.shortName}: {Number(t.squadSize || 0)}</p>)}</div>
            </div>
          </div>
        </div>
      </main>

      <TeamDetailsPanel
        open={!!selectedTeamId}
        onOpenChange={(open) => !open && setSelectedTeamId(null)}
        team={teams.find((t) => t.id === selectedTeamId) || null}
        retainedPlayers={selectedTeamId ? teamPlayersResolved[selectedTeamId]?.retained || [] : []}
        boughtPlayers={selectedTeamId ? teamPlayersResolved[selectedTeamId]?.bought || [] : []}
        playerPrices={selectedTeamId ? teams.find((t) => t.id === selectedTeamId)?.playerPurchasePrices || {} : {}}
      />

      {!!pendingRtm && isHost && (
        <RTMModal
          open={true}
          stage={pendingRtm.status}
          player={rtmPlayer as any}
          originalTeamName={rtmOriginalTeam?.name}
          winningTeamName={rtmWinningTeam?.name}
          finalBid={Number(pendingRtm.finalBid || 0)}
          onPrimary={() => {
            const actionByStage: Record<string, any> = {
              AWAIT_ORIGINAL: "ORIGINAL_YES",
              AWAIT_WINNER_COUNTER: "WINNER_COUNTER_YES",
              AWAIT_ORIGINAL_MATCH: "ORIGINAL_MATCH_YES",
            };
            resolveRtmDecision(gameCode!, actionByStage[pendingRtm.status]);
          }}
          onSecondary={() => {
            const actionByStage: Record<string, any> = {
              AWAIT_ORIGINAL: "ORIGINAL_NO",
              AWAIT_WINNER_COUNTER: "WINNER_COUNTER_NO",
              AWAIT_ORIGINAL_MATCH: "ORIGINAL_MATCH_NO",
            };
            resolveRtmDecision(gameCode!, actionByStage[pendingRtm.status]);
          }}
        />
      )}
    </div>
  );
};

export default Auction;
