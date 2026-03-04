import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSession, joinSession, generateGameCode } from "@/lib/sessionService";
import { Users, Gavel } from "lucide-react";

const Multiplayer = () => {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");

  /**
   * 🆔 CONSISTENT USER ID
   * We get the ID from localStorage. If it doesn't exist, we create one.
   * This is critical so Firebase knows you are the same person if you refresh.
   */
  const getUserId = () => {
    let id = localStorage.getItem("uid");
    if (!id) {
      id = "user-" + Math.random().toString(36).slice(2, 9);
      localStorage.setItem("uid", id);
    }
    return id;
  };

  const handleCreateRoom = async () => {
    setError("");
    try {
      const userId = getUserId();
      const newGameCode = generateGameCode(); // Generates "CAIPLxxxx"

      // Pass the code and the hostId to the service
      await createSession(newGameCode, userId);
      
      // Navigate to lobby with the generated code
      navigate(`/lobby/${newGameCode}`);
    } catch (err) {
      console.error(err);
      setError("Failed to create room. Try again.");
    }
  };

  const handleJoinRoom = async () => {
    const userId = getUserId();
    const formattedCode = joinCode.trim().toUpperCase();

    if (formattedCode.length < 5) {
      setError("Enter a valid game code (e.g., CAIPL1234)");
      return;
    }

    try {
      setError("");
      // This checks if the room exists and adds user to playersJoined
      await joinSession(formattedCode, userId);
      
      // Navigate to the lobby
      navigate(`/lobby/${formattedCode}`);
    } catch (err: any) {
      setError(err.message || "Room not found");
    }
  };

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