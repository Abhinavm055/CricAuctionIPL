import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { listenSession, startAuction } from "@/lib/sessionService";
import { IPL_TEAMS, formatPrice } from "@/lib/constants";
import { useGameData } from "@/contexts/GameDataContext";
import { User } from "lucide-react";

const RetentionReview = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [starting, setStarting] = useState(false);
  const { masterPlayerList } = useGameData();
  const userId = localStorage.getItem("uid");

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, setSession);
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    if (session?.phase === "AUCTION") navigate(`/auction/${gameCode}`);
  }, [session?.phase, gameCode, navigate]);

  const playerById = useMemo(() => new Map(masterPlayerList.map((p) => [p.id, p])), [masterPlayerList]);

  if (!session) return <p className="p-6">Loading review…</p>;

  const isHost = session.hostId === userId;
  const retentions = session.retentions || {};

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-display mb-6">Retention Review</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {IPL_TEAMS.map((team) => {
          const r = retentions[team.id];
          const retainedIds = (r?.players || []) as string[];
          const retainedPlayers = retainedIds.map((id) => playerById.get(id)).filter(Boolean) as any[];
          const retainedSpend = retainedPlayers.reduce((sum, p) => sum + Number(p.basePrice || 0), 0);

          return (
            <div key={team.id} className="p-4 border rounded-xl bg-secondary/30">
              <h2 className="font-display text-xl mb-2">{team.shortName}</h2>
              {!r ? (
                <p className="text-sm text-muted-foreground">Not locked yet</p>
              ) : (
                <>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {retainedPlayers.map((p) => (
                      <div key={p.id} className="text-center">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden mx-auto" title={p.name}>
                          {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <User className="w-4 h-4" />}
                        </div>
                        <p className="text-[10px] mt-1 w-16 truncate">{p.name}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm mb-1">Retained: {retainedIds.length}/6</p>
                  <p className="text-sm mb-1">RTM Cards: {r.rtm ?? 0}</p>
                  <p className="text-sm mb-1">Remaining Purse: {formatPrice(Math.max(0, team.purse - retainedSpend))}</p>
                  <p className="text-xs text-green-500 font-semibold">LOCKED</p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {isHost ? (
        <Button
          variant="gold"
          size="xl"
          className="w-full"
          disabled={starting}
          onClick={async () => {
            if (!gameCode) return;
            try {
              setStarting(true);
              await startAuction(gameCode);
              navigate(`/auction/${gameCode}`);
            } finally {
              setStarting(false);
            }
          }}
        >
          {starting ? "Starting…" : "Start Auction"}
        </Button>
      ) : (
        <div className="text-center py-6">
          <p className="text-lg text-muted-foreground font-medium">Host will start the auction shortly</p>
        </div>
      )}
    </div>
  );
};

export default RetentionReview;
