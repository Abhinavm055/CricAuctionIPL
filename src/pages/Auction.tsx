import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PlayerCard } from "@/components/PlayerCard";
import { BidTimer } from "@/components/BidTimer";
import { Player } from "@/lib/samplePlayers";
import { useGameData } from "@/contexts/GameDataContext";
import { formatPrice, getNextBid, IPL_TEAMS, SQUAD_CONSTRAINTS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  finalizePlayerSale,
  listenSession,
  listenTeams,
  placeBid,
  resolveRtmDecision,
  resolveRtmTimeout,
  startNextPlayer,
  skipCurrentPlayer,
  togglePauseAuction,
  startAcceleratedRound,
  skipAcceleratedRound,
} from "@/lib/sessionService";
import { getAIBid } from "@/lib/aiEngine";
import { TeamDetailsPanel } from "@/components/TeamDetailsPanel";
import { RTMModal } from "@/components/RTMModal";
import { HammerSoldEffect } from "@/components/HammerSoldEffect";
import { TeamLogo } from "@/components/TeamLogo";
import { Header } from "@/components/Header";
import { TeamGrid } from "@/components/TeamGrid";
import { BidControls } from "@/components/BidControls";

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

const normalizeRoleKey = (role: string) => {
  const key = String(role || "").toLowerCase();
  if (key.includes("wicket")) return "wk";
  if (key.includes("all")) return "ar";
  if (key.includes("bowl")) return "bowl";
  return "bat";
};

const buildLeaderboard = (teams: TeamState[], resolved: Record<string, { retained: Player[]; bought: Player[] }>) => {
  return teams
    .map((team) => {
      const roster = [...(resolved[team.id]?.retained || []), ...(resolved[team.id]?.bought || [])];
      const ratings = roster.map((p: any) => Number(p?.rating ?? p?.starRating ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
      const averagePlayerRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0;
      const roleSet = new Set(roster.map((p) => normalizeRoleKey(String((p as any).role || ""))));
      const squadBalanceBonus = roleSet.size * 2.5;
      const squadSize = Number(team.squadSize || roster.length);
      const squadSizeBonus = Math.max(0, Math.min(10, squadSize - SQUAD_CONSTRAINTS.MIN_SQUAD));
      const eliminated = squadSize < SQUAD_CONSTRAINTS.MIN_SQUAD;
      const teamScore = Number((averagePlayerRating * 10 + squadBalanceBonus + squadSizeBonus).toFixed(2));

      return {
        ...team,
        squadSize,
        averagePlayerRating,
        squadBalanceBonus,
        squadSizeBonus,
        teamScore,
        eliminated,
      };
    })
    .sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      return b.teamScore - a.teamScore;
    });
};

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
  const [nowMs, setNowMs] = useState<number>(Date.now());

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
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, setSession);
    return () => unsub();
  }, [gameCode]);


  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

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
  const aiTeams = teams.filter((team) => team.id !== myTeamId).slice(0, 9);

  const currentAuction = session?.currentAuction;

  const playerById = useMemo(() => new Map(masterPlayerList.map((p: any) => [p.id, p])), [masterPlayerList]);

  const remainingRoleCounts = useMemo(() => {
    const queue = (session?.auctionQueue || []) as string[];
    const queueIndex = Number(session?.queueIndex ?? -1);
    const remainingIds = queue.slice(Math.max(queueIndex + 1, 0));
    return remainingIds.reduce<Record<string, number>>((acc, playerId) => {
      const role = String((playerById.get(playerId) as any)?.role || '').toLowerCase();
      if (role.includes('wicket')) acc.wicketkeeper += 1;
      else if (role.includes('all')) acc.allRounder += 1;
      else if (role.includes('bowl')) acc.bowler += 1;
      else acc.batter += 1;
      return acc;
    }, { batter: 0, bowler: 0, allRounder: 0, wicketkeeper: 0 });
  }, [session?.auctionQueue, session?.queueIndex, playerById]);
  const currentPlayer = useMemo(() => masterPlayerList.find((p: any) => p.id === currentAuction?.activePlayerId) || null, [masterPlayerList, currentAuction?.activePlayerId]);
  const currentBidderTeam = teams.find((team) => team.id === currentAuction?.currentBidderId);

  const nextBid = getNextBid(currentAuction?.currentBid || 0);
  const timerSeconds = Math.max(0, Math.floor(((currentAuction?.timerEndsAt?.toMillis?.() || nowMs) - nowMs) / 1000));

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
      currentAuction.currentBidderId,
      {
        remainingPlayersInAuction: Math.max(queueLength - (Number(session?.queueIndex ?? -1) + 1), 0),
        remainingRoleCounts,
        teamPlayersByTeamId: teams.reduce<Record<string, Player[]>>((acc, team) => {
          acc[team.id] = [...(teamPlayersResolved[team.id]?.retained || []), ...(teamPlayersResolved[team.id]?.bought || [])];
          return acc;
        }, {}),
      }
    );

    if (!aiDecision) return;
    const timer = setTimeout(() => placeBid(gameCode, aiDecision.teamId, aiDecision.bid).catch(() => undefined), aiDecision.delayMs);
    return () => clearTimeout(timer);
  }, [isHost, gameCode, teams, currentPlayer, currentAuction?.status, currentAuction?.currentBid, currentAuction?.currentBidderId, queueLength, session?.queueIndex, remainingRoleCounts, teamPlayersResolved]);

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


  useEffect(() => {
    if (!isHost || !gameCode || !session?.pendingRtm?.expiresAt) return;

    const ms = Math.max(0, session.pendingRtm.expiresAt.toMillis() - Date.now());
    const timeout = window.setTimeout(() => {
      resolveRtmTimeout(gameCode).catch(() => undefined);
    }, ms + 100);

    return () => window.clearTimeout(timeout);
  }, [isHost, gameCode, session?.pendingRtm?.status, session?.pendingRtm?.expiresAt]);

  const pendingRtm = session?.pendingRtm;
  const rtmPlayer = masterPlayerList.find((p: any) => p.id === pendingRtm?.playerId) || null;
  const rtmOriginalTeam = teams.find((t) => t.id === pendingRtm?.originalTeamId);
  const rtmWinningTeam = teams.find((t) => t.id === pendingRtm?.winningTeamId);

  const recentPurchases = useMemo(() => {
    const purchases = (session?.recentPurchases || []) as Array<{ playerId: string; price: number; teamId: string }>;
    return purchases.slice(0, 5);
  }, [session?.recentPurchases]);

  const commentaryTicker = useMemo(() => {
    const saleLines = recentPurchases.map((p) => {
      const pl = masterPlayerList.find((x: any) => x.id === p.playerId);
      const team = teams.find((t) => t.id === p.teamId);
      return `${pl?.name || p.playerId} sold to ${team?.shortName || p.teamId} for ₹${(p.price / 10000000).toFixed(2)}Cr`;
    });
    return saleLines.length ? saleLines.join(' • ') : 'Auction is live • Waiting for next bid •';
  }, [recentPurchases, masterPlayerList, teams]);

  const showAcceleratedButton = useMemo(() => {
    if (!isHost) return false;
    const queueIndex = Number(session?.queueIndex ?? -1);
    const endedQueue = queueLength > 0 && queueIndex >= queueLength;
    return endedQueue && Number((session?.unsoldPlayers || []).length) > 0 && !session?.isAcceleratedRound;
  }, [isHost, session?.queueIndex, session?.unsoldPlayers, session?.isAcceleratedRound, queueLength]);

  const leaderboard = useMemo(() => buildLeaderboard(teams, teamPlayersResolved), [teams, teamPlayersResolved]);

  const showAcceleratedDecision = useMemo(() => {
    const queueIndex = Number(session?.queueIndex ?? -1);
    const endedQueue = queueLength > 0 && queueIndex >= queueLength;
    return endedQueue && Number((session?.unsoldPlayers || []).length) > 0 && !session?.isAcceleratedRound && !session?.acceleratedRoundSkipped;
  }, [queueLength, session?.queueIndex, session?.unsoldPlayers, session?.isAcceleratedRound, session?.acceleratedRoundSkipped]);

  const auctionEnded = (session?.phase === "AUCTION_COMPLETE") || (queueLength > 0 && Number(session?.queueIndex ?? -1) >= queueLength);

  if (!session || !userTeam) return <p className="p-6">Loading auction…</p>;

  return (
    <div className="h-screen broadcast-container flex flex-col overflow-hidden">
      <Header
        gameCode={gameCode!}
        timerSeconds={Math.max(0, Math.floor(timerSeconds))}
        currentPool={(currentPlayer as any)?.pool}
        playersRemaining={Math.max(queueLength - ((session?.queueIndex ?? -1) + 1), 0)}
        totalPlayers={queueLength}
      />

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

      {auctionEnded && showAcceleratedDecision && (
        <div className="p-6 mx-auto max-w-3xl w-full">
          <div className="border rounded-xl p-6 bg-card/60 space-y-4 text-center">
            <h2 className="text-2xl font-display">Main Auction Complete</h2>
            <p className="text-muted-foreground">{(session?.unsoldPlayers || []).length} players are unsold. Start the accelerated round (10s timer) or skip to leaderboard.</p>
            {isHost ? (
              <div className="flex gap-3 justify-center">
                <Button onClick={() => startAcceleratedRound(gameCode!)}>Start Accelerated Round</Button>
                <Button variant="outline" onClick={() => skipAcceleratedRound(gameCode!)}>Skip to Leaderboard</Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for host decision…</p>
            )}
          </div>
        </div>
      )}

      {auctionEnded && !showAcceleratedDecision && !pendingRtm && (
        <div className="p-6 mx-auto max-w-3xl w-full">
          <div className="border rounded-xl p-6 bg-card/60 space-y-3">
            <h2 className="text-2xl font-display">Final Leaderboard</h2>
            <div className="space-y-2">
              {leaderboard.map((team, index) => (
                <div key={team.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <TeamLogo teamId={team.id} logo={team.logo} shortName={team.shortName} size="sm" />
                    <p className="font-semibold">{index + 1}. {team.shortName}{team.eliminated ? ' (Eliminated)' : ''}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Score {team.teamScore.toFixed(2)} • Squad {team.squadSize}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!auctionEnded && (
        <>
          <div className="border-y border-yellow-500/40 bg-[#061734] overflow-hidden py-2">
            <div className="whitespace-nowrap animate-[marquee_28s_linear_infinite] text-sm text-yellow-100 px-4">
              {commentaryTicker} &nbsp; • &nbsp; {commentaryTicker}
            </div>
          </div>

          <main className="flex-1 overflow-hidden p-4 md:p-5">
            <div className="grid h-full grid-cols-[3fr_5fr_2fr] gap-4">
              <TeamGrid
                aiTeams={aiTeams.map((team) => ({
                  id: team.id,
                  shortName: team.shortName,
                  name: team.name,
                  logo: team.logo,
                  purseRemaining: Number(team.purseRemaining || 0),
                  squadSize: Number(team.squadSize || 0),
                  rtmCards: Number(team.rtmCards || 0),
                }))}
                userTeam={userTeam ? {
                  id: userTeam.id,
                  shortName: userTeam.shortName,
                  name: userTeam.name,
                  logo: userTeam.logo,
                  purseRemaining: Number(userTeam.purseRemaining || 0),
                  squadSize: Number(userTeam.squadSize || 0),
                  rtmCards: Number(userTeam.rtmCards || 0),
                } : null}
                currentBidderId={currentAuction?.currentBidderId}
                onSelectTeam={(teamId) => setSelectedTeamId(teamId)}
              />

              <div className="h-full grid grid-rows-[1fr_auto] gap-3 overflow-hidden">
                <div className="min-h-0 rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3 overflow-hidden">
                  {currentPlayer && currentAuction?.status === 'RUNNING' && (
                    <div className="h-full grid grid-rows-[auto_1fr] gap-3">
                      <BidTimer
                        key={`${currentAuction.activePlayerId}-${currentAuction.timerEndsAt?.seconds || 'no-timer'}`}
                        duration={Math.max(0, Math.floor(timerSeconds))}
                        isActive={currentAuction?.status === 'RUNNING'}
                        onTimeout={handleFinalize}
                      />
                      <PlayerCard player={currentPlayer as any} />
                    </div>
                  )}

                  {currentAuction?.status === 'PAUSED' && <p className="text-lg font-semibold text-yellow-400 mt-6">Auction Paused by Host</p>}

                  {(!currentPlayer || !['RUNNING', 'PAUSED'].includes(currentAuction?.status)) && !['SOLD', 'UNSOLD'].includes(currentAuction?.status || '') && (
                    <div className="mt-8 text-center">
                      {isHost ? <Button onClick={() => startNextPlayer(gameCode!)}>Start Auction</Button> : <p className="text-muted-foreground">Waiting for host to start auction.</p>}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-yellow-500/40 bg-[#071a3a] p-4">
                  <p className="text-xs text-slate-300 tracking-wide">CURRENT BID</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[32px] font-bold text-yellow-300 drop-shadow-[0_0_12px_rgba(250,204,21,0.75)] animate-pulse">
                      {formatPrice(Number(currentAuction?.currentBid || 0))}
                    </p>
                    <TeamLogo teamId={currentBidderTeam?.id || null} shortName={currentBidderTeam?.shortName || 'BID'} className="w-[50px] h-[50px] rounded-full" />
                  </div>
                </div>
              </div>

              <div className="h-full">
                <BidControls
                  currentBid={currentAuction?.currentBid || 0}
                  purseRemaining={Number(userTeam.purseRemaining || 0)}
                  canBid={canTeamBid(userTeam, currentPlayer, nextBid)}
                  onBid={handleBid}
                  isHost={isHost}
                  onSkip={() => skipCurrentPlayer(gameCode!)}
                  onPauseToggle={() => togglePauseAuction(gameCode!)}
                  isPaused={currentAuction?.status === 'PAUSED'}
                  recentPurchases={recentPurchases.map((p) => {
                    const pl = masterPlayerList.find((x: any) => x.id === p.playerId);
                    const team = teams.find((t) => t.id === p.teamId);
                    return {
                      playerName: pl?.name || p.playerId,
                      teamShortName: team?.shortName || p.teamId,
                      price: p.price,
                    };
                  })}
                />
              </div>
            </div>
          </main>

          <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
        </>
      )}

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
          countdownSeconds={Math.max(0, Math.ceil(((pendingRtm?.expiresAt?.toMillis?.() || nowMs) - nowMs) / 1000))}
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
