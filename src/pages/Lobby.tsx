import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { IPL_TEAMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Check, Copy, Users, Play, ArrowLeft, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  selectTeam,
  listenSession,
  startAuction,
  fillAITeams,
} from "@/lib/sessionService";
import { startRetention } from "@/lib/sessionService";


const Lobby = () => {
  // 1. HOOKS (Must always be at the top and always execute in the same order)
  const { gameCode } = useParams<{ gameCode: string }>();
  const [searchParams] = useSearchParams();
  const isHost = searchParams.get("host") === "true";
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [draftTeam, setDraftTeam] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stable userId
  const userId = useMemo(() => {
    const existing = localStorage.getItem("uid");
    if (existing) return existing;
    const id = "user-" + Math.random().toString(36).slice(2, 9);
    localStorage.setItem("uid", id);
    return id;
  }, []);

  // Effect 1: Real-time listener
  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, (data) => setSession(data));
    return () => unsub();
  }, [gameCode]);

  // Effect 2: Auto-navigation
  useEffect(() => {
    if (session?.phase === "AUCTION") {
      navigate(`/auction/${gameCode}`);
    }
  }, [session?.phase, gameCode, navigate]);

  // Effect 3: AI Auto-fill Logic (Safe top-level Hook)
  useEffect(() => {
    // Exit early inside the effect, not by skipping the hook itself
    if (!isHost || !session || session.aiFillDone) return;

    const selectedTeams = session.selectedTeams || {};
    const playersJoined = session.playersJoined || [];
    
    // Check if every human in the lobby has chosen a team
    const allHumansSelected = playersJoined.length > 0 && playersJoined.every((uid: string) => 
      Object.values(selectedTeams).includes(uid)
    );

    if (allHumansSelected) {
      const fillRemainingTeams = async () => {
        const takenTeamIds = Object.keys(selectedTeams);
        const remainingTeams = IPL_TEAMS.filter(t => !takenTeamIds.includes(t.id));
        
        try {
          for (const team of remainingTeams) {
            await selectTeam(gameCode!, team.id, `AI-${team.id}`);
          }
          await fillAITeams(gameCode!);
        } catch (error) {
          console.error("AI Fill failed:", error);
        }
      };
      fillRemainingTeams();
    }
  }, [isHost, session, gameCode]);
  useEffect(() => {
  if (session?.phase === "RETENTION") {
    navigate(`/retention/${gameCode}`);
  }
}, [session?.phase, gameCode, navigate]);


  // 2. EARLY RETURN (Only allowed AFTER all hooks are declared)
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="animate-pulse font-display text-xl">Loading Lobby...</p>
      </div>
    );
  }

  // 3. LOGIC & HELPERS
  const selectedTeams = session.selectedTeams || {};
  const playersJoined = session.playersJoined || [];
  
  const myConfirmedTeam = Object.entries(selectedTeams).find(
    ([_, uid]) => uid === userId
  )?.[0];

  const confirmedTeamsCount = Object.keys(selectedTeams).length;
  const canStartAuction = confirmedTeamsCount >= 2;


  const handleConfirmTeam = async () => {
    if (!draftTeam || !gameCode) return;
    setIsSubmitting(true);
    try {
      await selectTeam(gameCode, draftTeam, userId);
      toast({ title: "Team Locked!", description: "Waiting for host..." });
    } catch (e: any) {
      toast({
        title: "Selection Failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(gameCode || "");
    setCopied(true);
    toast({ title: "Code Copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen broadcast-container p-6">
      <div className="relative z-10 max-w-6xl mx-auto">
        {/* HEADER */}
        <header className="flex items-center justify-between mb-10">
          <Button variant="ghost" onClick={() => navigate("/")} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>

          <h1 className="font-display text-3xl tracking-tighter text-primary">
            CRIC<span className="text-foreground">AUCTION</span>
          </h1>

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Room Code</span>
            <button
              onClick={copyCode}
              className="flex items-center gap-3 px-4 py-2 bg-secondary/50 hover:bg-secondary border border-white/10 rounded-lg transition-colors"
            >
              <code className="font-mono text-xl font-bold">{gameCode}</code>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-primary" />}
            </button>
          </div>
        </header>

        <div className="mb-8">
          <h2 className="font-display text-2xl mb-2 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            {myConfirmedTeam ? "Lobby Ready" : "Select Your Franchise"}
          </h2>
          <p className="text-muted-foreground">
            {myConfirmedTeam 
              ? "Waiting for the host to finalize teams and start." 
              : "Choose your team. Once confirmed, your choice is locked."}
          </p>
        </div>

        {/* TEAM GRID */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {IPL_TEAMS.map((team) => {
            const takenBy = selectedTeams[team.id];
            const isTaken = !!takenBy;
            const isMine = myConfirmedTeam === team.id;
            const isDraft = draftTeam === team.id;
            const isAI = takenBy?.startsWith("AI-");

            return (
              <button
                key={team.id}
                disabled={!!myConfirmedTeam || (isTaken && !isMine)}
                onClick={() => setDraftTeam(team.id)}
                className={cn(
                  "relative p-4 rounded-xl border-2 transition-all duration-300 text-left h-32 flex flex-col justify-between overflow-hidden",
                  "bg-card/40 backdrop-blur-sm border-white/5",
                  isDraft && !myConfirmedTeam && "border-yellow-500 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.2)]",
                  isMine && "border-primary bg-primary/10",
                  isTaken && !isMine && "opacity-40 cursor-not-allowed grayscale"
                )}
              >
                <div>
                  <div className="w-10 h-10 rounded-md mb-2 bg-secondary/60 border border-white/10 flex items-center justify-center overflow-hidden">
                    {(team as any).logo ? (
                      <img src={(team as any).logo} alt={`${team.shortName} logo`} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-xs">{team.shortName}</span>
                    )}
                  </div>
                  <div className="font-display text-xl leading-none mb-1">{team.shortName}</div>
                  <div className="text-[10px] uppercase text-muted-foreground font-medium truncate">{team.name}</div>
                </div>

                {isMine && (
                  <div className="flex items-center gap-1 text-primary text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3" /> SECURED
                  </div>
                )}
                
                {isAI && (
                  <div className="text-[10px] font-bold text-muted-foreground italic">AI BOT</div>
                )}

                {isTaken && !isMine && !isAI && (
                  <div className="text-[10px] font-bold text-red-500">OCCUPIED</div>
                )}
              </button>
            );
          })}
        </div>

        {/* ACTION AREA */}
        <div className="flex flex-col items-center gap-6 py-8 border-t border-white/5">
          {!myConfirmedTeam && draftTeam && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Button
                variant="gold"
                size="xl"
                className="px-12 shadow-lg shadow-yellow-600/20"
                onClick={handleConfirmTeam}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Locking..." : `Confirm ${draftTeam}`}
              </Button>
            </div>
          )}
           {isHost && (
              <div className="flex justify-center">
                  <Button
                   variant="gold"
                   size="xl"
                   disabled={!canStartAuction}
                   onClick={() => startRetention(gameCode!)}
                   >
                  Proceed to Retention
                </Button>
               </div>
             )}

          {/* always-available button for routing to retention */}
          <div className="flex justify-center mt-4 w-full">
            <Button
              variant="gold"
              size="xl"
              className="w-full"
              onClick={() => navigate(`/retention/${gameCode}`)}
            >
              Start Retention
            </Button>
          </div>


          {!isHost && myConfirmedTeam && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-muted-foreground animate-pulse">
                The auctioneer is preparing the room...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Lobby;