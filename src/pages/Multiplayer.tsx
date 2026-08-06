import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSession, joinSession, generateGameCode } from "@/lib/sessionService";
import { Users, Gavel, Lock } from "lucide-react";
import { useUserId } from "@/hooks/useUserId";

const AuctionStartedBlock = ({ onBack }: { onBack: () => void }) => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020617] px-6 text-center">
    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30">
      <Lock className="h-10 w-10 text-red-400" />
    </div>
    <h1 className="font-display text-4xl font-black text-white uppercase tracking-wide mb-4">
      Auction Already Started
    </h1>
    <p className="text-slate-400 text-base max-w-md leading-relaxed mb-2">
      This auction has already begun and is no longer accepting new participants.
    </p>
    <p className="text-slate-500 text-sm max-w-md leading-relaxed mb-8">
      Please create a new auction or join another available room.
    </p>
    <div className="flex flex-col sm:flex-row gap-3">
      <Button
        disabled
        className="opacity-40 cursor-not-allowed px-8 h-12 text-sm font-bold tracking-wider uppercase"
      >
        Join Room (Closed)
      </Button>
      <Button
        onClick={onBack}
        variant="outline"
        className="px-8 h-12 text-sm font-bold tracking-wider uppercase border-white/20 hover:border-yellow-400/40 hover:text-yellow-400"
      >
        Go Back
      </Button>
    </div>
  </div>
);

const Multiplayer = () => {
  const navigate = useNavigate();
  const userId = useUserId();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [auctionStarted, setAuctionStarted] = useState(false);

  const handleCreateRoom = async () => {
    setError("");
    try {
      const newGameCode = generateGameCode();
      await createSession(newGameCode, userId);
      navigate(`/lobby/${newGameCode}`);
    } catch (err) {
      console.error(err);
      setError("Failed to create room. Try again.");
    }
  };

  const handleJoinRoom = async () => {
    const formattedCode = joinCode.trim().toUpperCase();

    if (formattedCode.length < 5) {
      setError("Invalid Room Code");
      return;
    }

    try {
      setError("");
      await joinSession(formattedCode, userId);
      navigate(`/lobby/${formattedCode}`);
    } catch (err: any) {
      if (err?.message === "AUCTION_ALREADY_STARTED") {
        setAuctionStarted(true);
      } else {
        setError("Invalid Room Code");
      }
    }
  };

  if (auctionStarted) {
    return <AuctionStartedBlock onBack={() => setAuctionStarted(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <h1 className="text-4xl font-display mb-10 text-primary">Multiplayer Auction</h1>
      
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl">
        {/* CREATE ROOM CARD */}
        <div className="flex-1 flex flex-col items-center gap-6 p-8 rounded-3xl border-2 border-primary/20 bg-secondary/10 hover:border-primary/40 transition-all">
          <div className="p-4 bg-primary/10 rounded-full">
            <Users className="w-12 h-12 text-primary" />
          </div>
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-2">Host a Room</h3>
            <p className="text-sm text-muted-foreground">
              Start a new session and get a unique CAIPL code to invite friends.
            </p>
          </div>
          <Button size="xl" className="w-full font-bold shadow-lg shadow-primary/20" onClick={handleCreateRoom}>
            Create New Game
          </Button>
        </div>

        {/* JOIN ROOM CARD */}
        <div className="flex-1 flex flex-col items-center gap-6 p-8 rounded-3xl border-2 border-muted bg-card hover:border-primary/40 transition-all">
          <div className="p-4 bg-secondary rounded-full">
            <Gavel className="w-12 h-12 text-foreground" />
          </div>
          <div className="text-center w-full">
            <h3 className="text-2xl font-bold mb-2">Join a Room</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter the 9-character code shared by your friend.
            </p>
            
            <Input
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                setError("");
              }}
              placeholder="CAIPL1234"
              className="text-center text-2xl font-mono h-14 border-2 focus-visible:ring-primary uppercase"
              maxLength={9}
            />
          </div>

          {error && <p className="text-sm text-destructive font-medium">{error}</p>}

          <Button size="xl" variant="outline" className="w-full border-2 font-bold" onClick={handleJoinRoom}>
            Join Game
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Multiplayer;
