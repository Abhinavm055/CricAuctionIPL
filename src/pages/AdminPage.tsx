import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { PlayersManager } from "@/components/PlayersManager";
import { TeamsManager } from "@/components/TeamsManager";
import { EditablePlayer } from "@/components/PlayerForm";

interface TeamDoc {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  players?: string[];
}

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState<"teams" | "players">("teams");
  const [players, setPlayers] = useState<EditablePlayer[]>([]);
  const [teams, setTeams] = useState<TeamDoc[]>([]);

  useEffect(() => {
    const unsubPlayers = onSnapshot(collection(db, "players"), (snap) => {
      const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as EditablePlayer[];
      setPlayers(mapped);
    });

    const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
      const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TeamDoc[];
      setTeams(mapped.sort((a, b) => a.name.localeCompare(b.name)));
    });

    return () => {
      unsubPlayers();
      unsubTeams();
    };
  }, []);

  const sidebarTabs = useMemo(() => ([
    { id: "teams", label: "Teams" },
    { id: "players", label: "Players" },
  ]), []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Super Admin Panel</h1>
          <p className="text-muted-foreground">Manage Firestore teams and players from a single dashboard.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
          <aside className="border rounded-xl p-3 h-fit bg-card">
            {sidebarTabs.map((tab) => (
              <Button
                key={tab.id}
                className="w-full justify-start mb-2"
                variant={activeTab === tab.id ? "default" : "ghost"}
                onClick={() => setActiveTab(tab.id as "teams" | "players")}
              >
                {tab.label}
              </Button>
            ))}
          </aside>

          <main className="border rounded-xl p-4 md:p-5 bg-card">
            {activeTab === "teams" ? (
              <TeamsManager teams={teams} players={players} />
            ) : (
              <PlayersManager players={players} teams={teams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName }))} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
