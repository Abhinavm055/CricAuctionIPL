import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { listenSession, startAuction } from "@/lib/sessionService";
import { IPL_TEAMS } from "@/lib/constants";

const RetentionReview = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<any>(null);
  const [starting, setStarting] = useState(false);

  const userId = localStorage.getItem("uid");

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, setSession);
    return () => unsub();
  }, [gameCode]);

  // Auto-navigate all users to auction when phase changes
  useEffect(() => {
    if (session?.phase === "AUCTION") {
      console.log("Phase is AUCTION, navigating to auction page");
      navigate(`/auction/${gameCode}`);
    }
  }, [session?.phase, gameCode, navigate]);

  if (!session) return <p className="p-6">Loading review…</p>;

  const isHost = session.hostId === userId;
  const retentions = session.retentions || {};

  const allLocked =
    Object.keys(retentions).length === 10 &&
    Object.values(retentions).every((r: any) => r.locked);

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-display mb-6">
        Retention Review
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {IPL_TEAMS.map((team) => {
          const r = retentions[team.id];

          return (
            <div
              key={team.id}
              className="p-4 border rounded-xl bg-secondary/30"
            >
              <h2 className="font-display text-xl mb-2">
                {team.shortName}
              </h2>

              {!r ? (
                <p className="text-sm text-muted-foreground">
                  Not locked yet
                </p>
              ) : (
                <>
                  <p className="text-sm mb-1">
                    Retained: {r.players.length}/6
                  </p>
                  <p className="text-sm mb-1">
                    RTM Cards: {r.rtm}
                  </p>
                  <p className="text-xs text-green-500 font-semibold">
                    LOCKED
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        {/* DEBUG: Show retention status */}
        <div className="mb-4 text-xs text-muted-foreground p-2 bg-muted/20 rounded">
          <div>isHost: {isHost ? "yes" : "no"}</div>
          <div>allLocked: {allLocked ? "yes" : "no"}</div>
          <div>starting: {starting ? "yes" : "no"}</div>
          <div>phase: {session?.phase}</div>
        </div>

        {isHost ? (
          <Button
            variant="gold"
            size="xl"
            className="w-full"
            disabled={starting}
            onClick={async () => {
              if (!gameCode) return;
              console.log("Start Auction clicked, starting...");
              try {
                setStarting(true);
                console.log("Calling startAuction(", gameCode, ")");
                await startAuction(gameCode);
                console.log("startAuction completed, navigating to auction");
                navigate(`/auction/${gameCode}`);
              } catch (err) {
                console.error("Error starting auction:", err);
              } finally {
                setStarting(false);
              }
            }}
          >
            {starting ? "Starting…" : "Start Auction"}
          </Button>
        ) : (
          <div className="text-center py-6">
            <p className="text-lg text-muted-foreground font-medium">
              Host will start the auction shortly
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RetentionReview;
