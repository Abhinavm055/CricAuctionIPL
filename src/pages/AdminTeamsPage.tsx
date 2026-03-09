import { useMemo, useState } from 'react';
import { TeamLogo } from '@/components/TeamLogo';
import { TeamDetails } from '@/components/TeamDetails';
import { EditablePlayer } from '@/components/PlayerForm';

interface TeamRecord {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  players?: string[];
}

interface AdminTeamsPageProps {
  teams: TeamRecord[];
  players: EditablePlayer[];
}

const AdminTeamsPage = ({ teams, players }: AdminTeamsPageProps) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || teams[0],
    [teams, selectedTeamId],
  );

  if (!teams.length) return <p className="text-muted-foreground">No teams available.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Teams</h2>
      <p className="text-sm text-muted-foreground">Click a team logo to manage squad details.</p>

      <div className="flex flex-wrap gap-3">
        {teams.map((team) => (
          <button
            key={team.id}
            type="button"
            className={`p-2 rounded-xl border transition ${selectedTeam?.id === team.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
            onClick={() => setSelectedTeamId(team.id)}
            title={team.name}
          >
            <TeamLogo teamId={team.id} logo={team.logo} shortName={team.shortName} size="lg" className="w-14 h-14" />
          </button>
        ))}
      </div>

      {selectedTeam && <TeamDetails team={selectedTeam} players={players} teams={teams} />}
    </div>
  );
};

export default AdminTeamsPage;
