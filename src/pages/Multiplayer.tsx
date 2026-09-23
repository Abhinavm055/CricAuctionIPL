import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { createSession, joinSession, generateGameCode } from "@/lib/sessionService";
import { Users, Lock, ArrowLeft, KeyRound, Gamepad2, Settings, Trophy, Scale } from "lucide-react";
import { useUserId } from "@/hooks/useUserId";
import { motion } from "framer-motion";

const AuctionStartedBlock = ({ onBack }: { onBack: () => void }) => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020817] px-6 text-center select-none">
    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
      <Lock className="h-10 w-10 text-red-400" />
    </div>
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold tracking-widest uppercase mb-3">
      Auction Closed
    </div>
    <h1 className="font-display text-4xl md:text-5xl font-black text-white uppercase tracking-wider mb-3">
      Auction Already Started
    </h1>
    <p className="text-slate-400 text-sm md:text-base max-w-md leading-relaxed mb-8">
      This session has entered active bidding and is no longer accepting new franchise entries.
    </p>
    <div className="flex flex-col sm:flex-row gap-3">
      <Button
        onClick={onBack}
        variant="default"
        className="px-8 h-12 text-xs font-bold tracking-widest uppercase"
      >
        Return to Portal
      </Button>
    </div>
  </div>
);

const Multiplayer = () => {
  const navigate = useNavigate();
  const userId = useUserId();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [auctionStarted, setAuctionStarted] = useState(false);

  const handleCreateRoom = async () => {
    setError("");
    setIsCreating(true);
    try {
      const newGameCode = generateGameCode();
      await createSession(newGameCode, userId);
      navigate(`/lobby/${newGameCode}`);
    } catch (err) {
      console.error(err);
      setError("Failed to create room. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    const formattedCode = joinCode.trim().toUpperCase();

    if (formattedCode.length < 5) {
      setError("Please enter a valid room code (e.g. CAIPL1234)");
      return;
    }

    setIsJoining(true);
    try {
      setError("");
      await joinSession(formattedCode, userId);
      navigate(`/lobby/${formattedCode}`);
    } catch (err: any) {
      if (err?.message === "AUCTION_ALREADY_STARTED") {
        setAuctionStarted(true);
      } else {
        setError("Room not found. Check the code and try again.");
      }
    } finally {
      setIsJoining(false);
    }
  };

  if (auctionStarted) {
    return <AuctionStartedBlock onBack={() => setAuctionStarted(false)} />;
  }

  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden flex flex-col justify-between bg-[#020817] text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950 relative">
      {/* Stadium Ambient Lighting & Stage Ring */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-radial-gradient from-[#08152c]/50 via-[#020817] to-[#01040d]" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[350px] rounded-full bg-blue-500/10 blur-[130px]" />
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[150px]" />
        <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[150px]" />
        {/* Stage circular golden light ring on floor */}
        <div className="absolute -bottom-48 left-1/2 -translate-x-1/2 w-[1100px] h-[300px] rounded-full border border-amber-400/20 shadow-[0_0_80px_rgba(251,191,36,0.15)] pointer-events-none" />
      </div>

      {/* Side Watermark Texts */}
      <div className="hidden xl:flex flex-col gap-3 absolute left-8 top-1/2 -translate-y-1/2 text-[10px] font-black tracking-[0.35em] uppercase text-slate-700/60 select-none z-10">
        <span>PLAY</span>
        <span>BID</span>
        <span>BUILD</span>
        <span>DOMINATE</span>
      </div>
      <div className="hidden xl:flex flex-col gap-3 absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-black tracking-[0.35em] uppercase text-slate-700/60 select-none z-10 text-right">
        <span>TEAMS</span>
        <span>FRIENDS</span>
        <span>RIVALS</span>
        <span>LEGENDS</span>
      </div>

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-6xl mx-auto px-6 pt-5 pb-1 flex items-center justify-between shrink-0">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="rounded-xl border-white/[0.12] bg-[#09152A]/80 hover:bg-[#09152A] hover:border-amber-400/40 text-slate-300 text-xs font-semibold px-4 h-9 shadow-sm"
        >
          <Link to="/" className="flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
            <span>Back to Arena</span>
          </Link>
        </Button>

        <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right leading-tight select-none">
          <div>SAME PASSION.</div>
          <div>DIFFERENT WAYS TO PLAY.</div>
        </div>
      </header>

      {/* Center Main Stage */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 w-full max-w-5xl mx-auto py-2">
        {/* Title Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center mb-6 sm:mb-8"
        >
          <div className="flex items-center justify-center gap-3 text-[10px] sm:text-xs font-extrabold tracking-[0.3em] text-amber-400 uppercase select-none">
            <span className="w-7 sm:w-10 h-[1px] bg-gradient-to-r from-transparent to-amber-400/80" />
            <span>AUCTION CENTRAL</span>
            <span className="w-7 sm:w-10 h-[1px] bg-gradient-to-l from-transparent to-amber-400/80" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black text-white uppercase tracking-wider mt-1.5 leading-none">
            MULTIPLAYER <span className="text-amber-400">PORTAL</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-md sm:max-w-lg mx-auto mt-2 leading-relaxed">
            Host a private auction arena with friends or enter a room code to claim your franchise seat.
          </p>
        </motion.div>

        {/* 2-Column Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 w-full max-w-4xl">
          {/* HOST ROOM CARD */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="flex flex-col justify-between p-6 sm:p-7 rounded-2xl border border-purple-500/35 bg-[#09152A]/90 hover:border-purple-500/60 transition-all duration-300 shadow-[0_0_35px_rgba(168,85,247,0.12)] backdrop-blur-xl group"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.25)]">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 bg-purple-500/15 px-3 py-1 rounded-full border border-purple-500/30">
                  HOST MODE
                </span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl font-black tracking-wide text-white uppercase mb-2">
                CREATE NEW AUCTION
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-5">
                Generate a private auction arena. Configure team purse, manage player sets, and invite your friends via a shareable room code.
              </p>

              {/* Feature bullet list */}
              <div className="space-y-2.5 pt-1 border-t border-white/[0.06] mb-6">
                <div className="flex items-center gap-2.5 text-xs text-slate-300 font-medium">
                  <Settings className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Custom team configuration</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300 font-medium">
                  <Users className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Invite up to 10 franchise owners</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300 font-medium">
                  <Scale className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Set auction rules & purse</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300 font-medium">
                  <Trophy className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Real-time multiplayer experience</span>
                </div>
              </div>
            </div>

            <Button
              size="lg"
              disabled={isCreating}
              className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(251,191,36,0.3)] transition-all hover:shadow-[0_0_28px_rgba(251,191,36,0.5)]"
              onClick={handleCreateRoom}
            >
              <span>{isCreating ? "Initializing Arena..." : "CREATE NEW GAME →"}</span>
            </Button>
          </motion.div>

          {/* JOIN ROOM CARD */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="flex flex-col justify-between p-6 sm:p-7 rounded-2xl border border-blue-500/35 bg-[#09152A]/90 hover:border-blue-500/60 transition-all duration-300 shadow-[0_0_35px_rgba(59,130,246,0.12)] backdrop-blur-xl group"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.25)]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-300 bg-blue-500/15 px-3 py-1 rounded-full border border-blue-500/30">
                  JOIN MODE
                </span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl font-black tracking-wide text-white uppercase mb-2">
                JOIN ACTIVE ARENA
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Received an invite code from your host? Enter the 9-character code to join the lobby and claim your franchise.
              </p>

              <div className="space-y-2 mb-6">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <input
                    value={joinCode}
                    onChange={(e) => {
                      setJoinCode(e.target.value.toUpperCase());
                      setError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoinRoom();
                    }}
                    placeholder="CAIPLXXXX"
                    maxLength={9}
                    className="w-full text-center text-lg sm:text-xl font-mono font-black tracking-widest uppercase h-13 rounded-xl bg-[#050B16] border border-white/15 text-amber-400 placeholder:text-slate-600 focus:outline-none focus:border-blue-400 focus:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all"
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-400 font-medium text-center pt-0.5">{error}</p>
                )}
              </div>
            </div>

            <Button
              size="lg"
              variant="outline"
              disabled={isJoining || !joinCode.trim()}
              className="w-full h-12 rounded-xl border border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/15 text-blue-200 hover:text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
              onClick={handleJoinRoom}
            >
              <span>{isJoining ? "Connecting..." : "JOIN GAME →"}</span>
            </Button>
          </motion.div>
        </div>
      </main>

      {/* Footer / Bottom Text */}
      <footer className="relative z-20 w-full py-3.5 text-center shrink-0">
        <div className="flex items-center justify-center gap-3 text-[10px] font-bold tracking-[0.25em] text-slate-500 uppercase select-none">
          <span className="w-8 sm:w-12 h-[1px] bg-gradient-to-r from-transparent to-amber-400/50" />
          <span>AUCTION BRINGS US TOGETHER</span>
          <span className="w-8 sm:w-12 h-[1px] bg-gradient-to-l from-transparent to-amber-400/50" />
        </div>
      </footer>
    </div>
  );
};

export default Multiplayer;
