import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { listenSession, listenTeams, startAuction } from "@/lib/sessionService";
import { IPL_TEAMS, formatPrice } from "@/lib/constants";
import { useGameData } from "@/contexts/GameDataContext";
import { User } from "lucide-react";
import { TeamLogo } from "@/components/TeamLogo";

const RetentionReview = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [starting, setStarting] = useState(false);
  const { masterPlayerList } = useGameData();
  const userId = localStorage.getItem("uid");

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, setSession);
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenTeams(gameCode, setTeams);
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    if (session?.phase === "AUCTION") navigate(`/auction/${gameCode}`);
  }, [session?.phase, gameCode, navigate]);

  const playerById = useMemo(() => new Map(masterPlayerList.map((p) => [p.id, p])), [masterPlayerList]);

  if (!session) return <p className="p-6">Loading review…</p>;

  const isHost = session.hostId === userId;

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-display mb-6">Retention Review</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {IPL_TEAMS.map((team) => {
          const teamDoc = teams.find((t) => t.id === team.id) || {};
          const retainedIds = (teamDoc.retainedPlayers || session?.retentions?.[team.id]?.players || []) as string[];
          const retainedPlayers = retainedIds.map((id) => playerById.get(id)).filter(Boolean) as any[];
          const prices = teamDoc.playerPurchasePrices || {};

          return (
            <div key={team.id} className="p-4 border rounded-xl bg-secondary/30">
              <div className="flex items-center gap-3 mb-2">
                <TeamLogo teamId={team.id} logo={teamDoc.logo || team.logo} shortName={team.shortName} size="md" />
                <h2 className="font-display text-xl">{team.shortName}</h2>
              </div>
              <div className="flex gap-2 flex-wrap mb-3">
                {retainedPlayers.map((p) => (
                  <div key={p.id} className="text-center">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden mx-auto" title={p.name}>
                      {(p.image || p.imageUrl) ? <img src={(p.image || p.imageUrl)} className="w-full h-full object-cover" /> : <User className="w-4 h-4" />}
                    </div>
                    <p className="text-[10px] mt-1 w-16 truncate">{p.name}</p>
                    {Number(p.rating || 0) >= 4 && <p className="text-[10px] text-yellow-400">{Array(Math.floor(Number(p.rating || 0))).fill('⭐').join(' ')}</p>}
                    <p className="text-[10px] text-muted-foreground">{formatPrice(prices[p.id] || 0)}</p>
                    <p className={`text-[9px] font-semibold ${p.isCapped ? 'text-emerald-500' : 'text-slate-400'}`}>{p.isCapped ? 'CAPPED' : 'UNCAPPED'}</p>
                    {p.overseas && <p className="text-[10px] text-yellow-400">✈️</p>}
                  </div>
                ))}
              </div>

              <p className="text-sm mb-1">Retained: {retainedIds.length}/6</p>
              <p className="text-sm mb-1">RTM Cards: {teamDoc.rtmCards ?? session?.retentions?.[team.id]?.rtm ?? 0}</p>
              <p className="text-sm mb-1">Remaining Purse: {formatPrice(teamDoc.purseRemaining ?? team.purse)}</p>
              <p className="text-xs text-green-500 font-semibold">{retainedIds.length ? "LOCKED" : "Not locked yet"}</p>
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
