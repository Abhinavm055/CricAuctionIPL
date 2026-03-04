import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuctionHeader } from "@/components/AuctionHeader";
import { PlayerCard } from "@/components/PlayerCard";
import { TeamCard } from "@/components/TeamCard";
import { BidTimer } from "@/components/BidTimer";
import { BidControls } from "@/components/BidControls";
import { PoolTransition } from "@/components/PoolTransition";
import {
  createAuctionQueueFrom,
  Player,
} from "@/lib/samplePlayers";
import { useGameData } from '@/contexts/GameDataContext';
import {
  IPL_TEAMS,
  formatPrice,
  getNextBid,
  AUCTION_TIMER,
  SQUAD_CONSTRAINTS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowLeft } from "lucide-react";
import { listenSession } from "@/lib/sessionService";
import { getAIBid } from "@/lib/aiEngine";

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

  // Stable user id
  const userId =
    localStorage.getItem("uid") ||
    (() => {
      const id = "user-" + Math.random().toString(36).slice(2, 9);
      localStorage.setItem("uid", id);
      return id;
    })();

  // 🔥 Listen to session
  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, (data) => setSession(data));
    return () => unsub();
  }, [gameCode]);

  // 🚫 Safety: cannot open auction directly
  useEffect(() => {
    if (session && session.phase !== "AUCTION") {
      navigate(`/lobby/${gameCode}`);
    }
  }, [session, gameCode, navigate]);

  // Initialize auction queue ONCE using master player list from context
  const { masterPlayerList } = useGameData();
  const [playerQueue, setPlayerQueue] = useState<Player[]>([]);
  const [initialTotalPlayers, setInitialTotalPlayers] = useState(0);

  // when master list arrives, create randomized queue
  useEffect(() => {
    if (masterPlayerList.length > 0 && playerQueue.length === 0) {
      const queue = createAuctionQueueFrom(masterPlayerList);
      setPlayerQueue(queue);
      setInitialTotalPlayers(queue.length);
    }
  }, [masterPlayerList, playerQueue.length]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [currentBidder, setCurrentBidder] = useState<string | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  const [auctionEnded, setAuctionEnded] = useState(false);
  const [soldPlayers, setSoldPlayers] = useState<any[]>([]);
  const [unsoldPlayers, setUnsoldPlayers] = useState<Player[]>([]);

  // 🔥 Build teams FROM SESSION including AI entries
  const [teams, setTeams] = useState<TeamState[]>([]);

  useEffect(() => {
    if (!session?.allTeams) return;

    const builtTeams: TeamState[] = session.allTeams.map((t: any) => {
      const base = IPL_TEAMS.find((bt) => bt.id === t.id)!;
      return {
        ...base,
        purseRemaining: base.purse,
        players: [],
        isAI: !!t.isAI,
      };
    });

    setTeams(builtTeams);
  }, [session]);

  // 🔥 My team from Firestore
  const myTeamId = Object.entries(session?.selectedTeams || {}).find(
    ([_, uid]) => uid === userId
  )?.[0];

  const userTeam = teams.find((t) => t.id === myTeamId);
  const currentBidderTeam = teams.find(
    (t) => t.shortName === currentBidder
  );

  // Can team bid
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

  // Init first player
  useEffect(() => {
    if (!currentPlayer && playerQueue.length > 0) {
      const p = playerQueue[0];
      setCurrentPlayer(p);
      setCurrentBid(p.basePrice);
      setCurrentBidder(null);
      setTimerActive(true);
      setTimerKey((k) => k + 1);
    }
  }, [playerQueue, currentPlayer]);

  // AI bidding effect: try to bid when timer is active
  useEffect(() => {
    if (!timerActive || !currentPlayer) return;

    // schedule a random AI bid before timer expires
    const aiDecision = getAIBid(teams, currentPlayer, currentBid);
    if (!aiDecision) return;
    const timeout = setTimeout(() => {
      // only bid if nobody else has bid or bid is lower
      if (
        !currentBidder ||
        (currentBidder !== aiDecision.teamShortName &&
          canTeamBid(
            teams.find((t) => t.shortName === aiDecision.teamShortName),
            currentPlayer,
            aiDecision.bid
          ))
      ) {
        placeBid(aiDecision.teamShortName, aiDecision.bid);
      }
    }, Math.random() * (AUCTION_TIMER - 1000) + 500);

    return () => clearTimeout(timeout);
  }, [timerActive, currentPlayer, currentBid, teams, currentBidder]);

  const moveNext = useCallback(() => {
    const rest = playerQueue.slice(1);
    setPlayerQueue(rest);

    if (rest.length === 0) {
      setAuctionEnded(true);
      setCurrentPlayer(null);
      return;
    }

    const next = rest[0];
    setCurrentPlayer(next);
    setCurrentBid(next.basePrice);
    setCurrentBidder(null);
    setTimerKey((k) => k + 1);
  }, [playerQueue]);

  const handleTimeout = () => {
    if (!currentPlayer) return;

    if (currentBidder) {
      setTeams((prev) =>
        prev.map((t) =>
          t.shortName === currentBidder
            ? {
                ...t,
                purseRemaining: t.purseRemaining - currentBid,
                players: [...t.players, currentPlayer],
              }
            : t
        )
      );
      setSoldPlayers((p) => [
        ...p,
        { player: currentPlayer, team: currentBidder, price: currentBid },
      ]);
    } else {
      setUnsoldPlayers((u) => [...u, currentPlayer]);
    }

    moveNext();
  };

  const placeBid = (teamShortName: string, amount: number) => {
    setCurrentBid(amount);
    setCurrentBidder(teamShortName);
    setTimerKey((k) => k + 1);
  };

  const handleBid = (amount: number) => {
    if (!userTeam || !currentPlayer) return;
    if (!canTeamBid(userTeam, currentPlayer, amount)) return;

    placeBid(userTeam.shortName, amount);
  };

  if (!session || !userTeam || playerQueue.length === 0)
    return <p className="p-6">Loading auction…</p>;

  /* ================= END SCREEN ================= */
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

  /* ================= MAIN AUCTION ================= */
  return (
    <div className="min-h-screen broadcast-container flex flex-col">
      <AuctionHeader
        gameCode={gameCode!}
        currentPool={currentPlayer?.pool}
        playersRemaining={playerQueue.length}
        totalPlayers={initialTotalPlayers || playerQueue.length}
      />

      <main className="flex-1 p-6">
        <div className="grid grid-cols-12 gap-6 max-w-7xl mx-auto">
          {/* TEAMS */}
          <div className="col-span-3 grid grid-cols-2 gap-2">
            {teams.map((team) => (
             <TeamCard
               key={team.id}
               {...team}
               playersCount={team.players.length}
               overseasCount={team.players.filter((p) => p.isOverseas).length}
               isCurrentBidder={team.shortName === currentBidder}
               isBidding={team.shortName === currentBidder}
               isUserTeam={team.id === myTeamId}
            />

            ))}
          </div>

          {/* PLAYER */}
          <div className="col-span-6 flex flex-col items-center">
            {currentPlayer && (
              <>
                <BidTimer
                  key={timerKey}
                  duration={AUCTION_TIMER}
                  isActive={timerActive}
                  onTimeout={handleTimeout}
                />
                <PlayerCard
                  player={currentPlayer}
                  currentBid={currentBid}
                  currentBidder={currentBidder}
                  teamColor={currentBidderTeam?.color}
                />
              </>
            )}
          </div>

          {/* CONTROLS */}
          <div className="col-span-3">
            <BidControls
              currentBid={currentBid}
              purseRemaining={userTeam.purseRemaining}
              isYourTurn={true}
              canBid={canTeamBid(
                userTeam,
                currentPlayer,
                getNextBid(currentBid)
              )}
              onBid={handleBid}
              onPass={() => {}}
              isHost={false}
              onSkip={() => {}}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auction;
