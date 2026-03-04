import { useState, useCallback, useEffect, useMemo } from "react";
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
import { Trophy, ArrowLeft } from "lucide-react";
import {
  finalizePlayerSale,
  listenSession,
  listenTeams,
  placeBid,
  resolveRtmDecision,
  startNextPlayer,
} from "@/lib/sessionService";
import { getAIBid } from "@/lib/aiEngine";
import { TeamDetailsPanel } from "@/components/TeamDetailsPanel";
import { RTMModal } from "@/components/RTMModal";

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

  const userId = localStorage.getItem("uid") || "";
  const { masterPlayerList } = useGameData();

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, setSession);
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenTeams(gameCode, (teamDocs) => {
      const enriched = (teamDocs as any[]).map((team) => ({
        ...IPL_TEAMS.find((t) => t.id === team.id),
        ...team,
      }));
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
  const currentPlayer = useMemo(() => masterPlayerList.find((p) => p.id === currentAuction?.activePlayerId) || null, [masterPlayerList, currentAuction?.activePlayerId]);
  const currentBidderTeam = teams.find((team) => team.id === currentAuction?.currentBidderId);

  const nextBid = getNextBid(currentAuction?.currentBid || 0);
  const timerSeconds = Math.max(1, Math.ceil(((currentAuction?.timerEndsAt?.toMillis?.() || Date.now()) - Date.now()) / 1000));

  const teamPlayersResolved = useMemo(() => {
    const lookup = new Map(masterPlayerList.map((p) => [p.id, p]));
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

  const handleBid = useCallback(async (amount: number) => {
    if (!gameCode || !myTeamId || !userTeam || !currentPlayer) return;
    if (!canTeamBid(userTeam, currentPlayer, amount)) return;
    await placeBid(gameCode, myTeamId, amount);
  }, [gameCode, myTeamId, userTeam, currentPlayer, currentAuction?.status, currentAuction?.currentBidderId]);

  const handleFinalize = useCallback(async () => {
    if (!gameCode || !isHost) return;
    await finalizePlayerSale(gameCode);
  }, [gameCode, isHost]);

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
    const timer = setTimeout(() => placeBid(gameCode, aiDecision.teamId, aiDecision.bid).catch(() => undefined), 1200 + Math.random() * 2800);
    return () => clearTimeout(timer);
  }, [isHost, gameCode, teams, currentPlayer, currentAuction?.status, currentAuction?.currentBid, currentAuction?.currentBidderId]);

  const pendingRtm = session?.pendingRtm;
  const rtmPlayer = masterPlayerList.find((p) => p.id === pendingRtm?.playerId) || null;
  const rtmOriginalTeam = teams.find((t) => t.id === pendingRtm?.originalTeamId);
  const rtmWinningTeam = teams.find((t) => t.id === pendingRtm?.winningTeamId);

  const auctionEnded =
    (session?.phase === "AUCTION_COMPLETE") ||
    (queueLength > 0 && session?.queueIndex >= queueLength - 1 && ["SOLD", "UNSOLD", "IDLE"].includes(currentAuction?.status || "") && !pendingRtm);

  if (!session || !userTeam) return <p className="p-6">Loading auction…</p>;

  return (
    <div className="min-h-screen broadcast-container flex flex-col">
      <AuctionHeader
        gameCode={gameCode!}
        currentPool={(currentPlayer as any)?.pool}
        playersRemaining={Math.max(queueLength - ((session?.queueIndex ?? -1) + 1), 0)}
        totalPlayers={queueLength}
      />

      {auctionEnded && (
        <div className="text-center py-4">
          <Button variant="ghost" onClick={() => navigate("/")}><ArrowLeft className="w-4 h-4 mr-2" />Home</Button>
          <Trophy className="w-14 h-14 mx-auto text-primary" />
        </div>
      )}

      <main className="flex-1 p-6">
        <div className="grid grid-cols-12 gap-6 max-w-7xl mx-auto">
          <div className="col-span-3 grid grid-cols-2 gap-2">
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

          <div className="col-span-6 flex flex-col items-center">
            {currentPlayer && currentAuction?.status === "RUNNING" && (
              <>
                <BidTimer key={`${currentAuction.activePlayerId}-${currentAuction.timerEndsAt?.seconds || "no-timer"}`} duration={timerSeconds} isActive={true} onTimeout={handleFinalize} />
                <PlayerCard player={currentPlayer as any} currentBid={currentAuction.currentBid} currentBidder={currentBidderTeam?.shortName || null} teamColor={currentBidderTeam?.color} />
              </>
            )}

            {(!currentPlayer || currentAuction?.status !== "RUNNING") && (
              <div className="mt-8">
                {isHost ? <Button onClick={() => startNextPlayer(gameCode!)}>Start Next Player</Button> : <p className="text-muted-foreground">Waiting for host…</p>}
              </div>
            )}
          </div>

          <div className="col-span-3">
            <BidControls
              currentBid={currentAuction?.currentBid || 0}
              purseRemaining={userTeam.purseRemaining}
              isYourTurn={true}
              canBid={canTeamBid(userTeam, currentPlayer, nextBid)}
              onBid={handleBid}
              onPass={() => {}}
              isHost={isHost}
              onSkip={() => startNextPlayer(gameCode!)}
            />
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
