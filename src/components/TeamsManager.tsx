import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamLogo } from "./TeamLogo";
import { EditablePlayer } from "./PlayerForm";
import { TeamDetails } from "./TeamDetails";

interface TeamDoc {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  players?: string[];
}

interface TeamsManagerProps {
  teams: TeamDoc[];
  players: EditablePlayer[];
}

export const TeamsManager = ({ teams, players }: TeamsManagerProps) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Teams Manager</h2>
        <p className="text-sm text-muted-foreground">Manage team rosters and assign players from the global players pool.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {teams.map((team) => (
          <Card key={team.id} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <TeamLogo logo={team.logo} shortName={team.shortName} size="md" />
                <span>{team.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Players: {(team.players || []).length}</p>
              <TeamDetails team={team} allPlayers={players} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
