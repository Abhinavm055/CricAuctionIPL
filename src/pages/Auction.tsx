import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuctionHeader } from "@/components/AuctionHeader";
import { PlayerCard } from "@/components/PlayerCard";
import { TeamCard } from "@/components/TeamCard";
import { BidTimer } from "@/components/BidTimer";
import { BidControls } from "@/components/BidControls";
import { Player } from "@/lib/samplePlayers";
import { useGameData } from '@/contexts/GameDataContext';
import {
  getNextBid,
  SQUAD_CONSTRAINTS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowLeft } from "lucide-react";
import { finalizePlayerSale, listenSession, listenTeams, placeBid, startNextPlayer } from "@/lib/sessionService";

export interface TeamState {
  id: string;
  name: string;
  shortName: string;
  color: string;
  purseRemaining: number;
  players: Player[];
  isAI: boolean;
}

const Auction = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<TeamState[]>([]);

  const userId =
    localStorage.getItem("uid") ||
    (() => {
      const id = "user-" + Math.random().toString(36).slice(2, 9);
      localStorage.setItem("uid", id);
      return id;
    })();

  const { masterPlayerList } = useGameData();

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, (data) => setSession(data));
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenTeams(gameCode, (teamDocs) => {
      const normalizedTeams = teamDocs.map((team) => ({
        ...team,
        players: ((team.players || []) as string[])
          .map((playerId) => masterPlayerList.find((player) => player.id === playerId))
          .filter(Boolean),
      }));
      setTeams(normalizedTeams as TeamState[]);
    });
    return () => unsub();
  }, [gameCode, masterPlayerList]);

  useEffect(() => {
    if (session && session.phase !== "AUCTION") {
      navigate(`/lobby/${gameCode}`);
    }
  }, [session, gameCode, navigate]);

  const isHost = session?.hostId === userId;
  const queueLength = (session?.auctionQueue || []).length;

  const myTeamId = Object.entries(session?.selectedTeams || {}).find(
    ([_, uid]) => uid === userId
  )?.[0] as string | undefined;

  const userTeam = teams.find((t) => t.id === myTeamId);

  const currentAuction = session?.currentAuction;
  const activePlayerId = currentAuction?.activePlayerId;

  const currentPlayer = useMemo(
    () => masterPlayerList.find((player) => player.id === activePlayerId) || null,
    [masterPlayerList, activePlayerId]
  );

  const currentBidderTeam = teams.find(
    (t) => t.id === currentAuction?.currentBidderId
  );

  const canTeamBid = (
    team: TeamState | undefined,
    player: Player | null,
    bid: number
  ) => {
    if (!team || !player) return false;
    if (team.purseRemaining < bid) return false;
    if (team.players.length >= SQUAD_CONSTRAINTS.MAX_SQUAD) return false;
    return true;
  };

  const handleHostStartNext = useCallback(async () => {
    if (!gameCode) return;
    await startNextPlayer(gameCode);
  }, [gameCode]);

  const handleBid = useCallback(async (amount: number) => {
    if (!gameCode || !myTeamId || !userTeam || !currentPlayer) return;
    if (!canTeamBid(userTeam, currentPlayer, amount)) return;

    await placeBid(gameCode, myTeamId, amount);
  }, [gameCode, myTeamId, userTeam, currentPlayer]);

  const handleFinalize = useCallback(async () => {
    if (!gameCode || !isHost) return;
    await finalizePlayerSale(gameCode);
  }, [gameCode, isHost]);

  const auctionEnded =
    queueLength > 0 &&
    session?.queueIndex >= queueLength - 1 &&
    ["SOLD", "UNSOLD", "IDLE"].includes(currentAuction?.status || "");

  if (!session || !userTeam) {
    return <p className="p-6">Loading auction…</p>;
  }

  if (auctionEnded) {
    return (
      <div className="min-h-screen broadcast-container p-6">
        <Button variant="ghost" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Home
        </Button>

        <div className="text-center mt-12">
          <Trophy className="w-20 h-20 mx-auto text-primary" />
          <h2 className="text-4xl font-display mt-4">Auction Complete</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen broadcast-container flex flex-col">
      <AuctionHeader
        gameCode={gameCode!}
        currentPool={currentPlayer?.pool}
        playersRemaining={Math.max(queueLength - ((session?.queueIndex ?? -1) + 1), 0)}
        totalPlayers={queueLength}
      />

      <main className="flex-1 p-6">
        <div className="grid grid-cols-12 gap-6 max-w-7xl mx-auto">
          <div className="col-span-3 grid grid-cols-2 gap-2">
            {teams.map((team) => (
             <TeamCard
               key={team.id}
               {...team}
               playersCount={team.players.length}
               overseasCount={team.players.filter((p) => p.isOverseas).length}
               isCurrentBidder={team.id === currentAuction?.currentBidderId}
               isBidding={team.id === currentAuction?.currentBidderId}
               isUserTeam={team.id === myTeamId}
            />
            ))}
          </div>

          <div className="col-span-6 flex flex-col items-center">
            {currentPlayer && currentAuction?.status === "RUNNING" && (
              <>
                <BidTimer
                  key={`${currentAuction.activePlayerId}-${currentAuction.timerEndsAt?.seconds || "no-timer"}`}
                  duration={Math.max(
                    1,
                    ((currentAuction?.timerEndsAt?.toMillis?.() || Date.now()) - Date.now()) / 1000
                  )}
                  isActive={true}
                  onTimeout={handleFinalize}
                />
                <PlayerCard
                  player={currentPlayer}
                  currentBid={currentAuction.currentBid}
                  currentBidder={currentBidderTeam?.shortName || null}
                  teamColor={currentBidderTeam?.color}
                />
              </>
            )}

            {(!currentPlayer || currentAuction?.status !== "RUNNING") && (
              <div className="mt-8">
                {isHost ? (
                  <Button onClick={handleHostStartNext}>Start Next Player</Button>
                ) : (
                  <p className="text-muted-foreground">Waiting for host to start next player…</p>
                )}
              </div>
            )}
          </div>

          <div className="col-span-3">
            <BidControls
              currentBid={currentAuction?.currentBid || 0}
              purseRemaining={userTeam.purseRemaining}
              isYourTurn={true}
              canBid={canTeamBid(
                userTeam,
                currentPlayer,
                getNextBid(currentAuction?.currentBid || 0)
              ) && currentAuction?.status === "RUNNING"}
              onBid={handleBid}
              onPass={() => {}}
              isHost={isHost}
              onSkip={handleHostStartNext}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auction;
