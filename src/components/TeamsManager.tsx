import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TeamLogo } from './TeamLogo';
import { EditablePlayer } from './PlayerForm';
import { TeamDetails } from './TeamDetails';

interface TeamRecord {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  players?: string[];
}

interface TeamsManagerProps {
  teams: TeamRecord[];
  players: EditablePlayer[];
  globalSearch?: string;
}

export const TeamsManager = ({ teams, players, globalSearch = '' }: TeamsManagerProps) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  const playerIdsByTeam = useMemo(() => {
    const map: Record<string, Set<string>> = {};

    teams.forEach((team) => {
      map[team.id] = new Set(team.players || []);
    });

    players.forEach((player) => {
      if (!player.id || !player.previousTeamId) return;
      if (!map[player.previousTeamId]) map[player.previousTeamId] = new Set();
      map[player.previousTeamId].add(player.id);
    });

    return map;
  }, [teams, players]);

  const filteredTeams = useMemo(() => {
    const q = globalSearch.toLowerCase().trim();
    if (!q) return teams;

    return teams.filter((team) => {
      const roster = players.filter((player) => playerIdsByTeam[team.id]?.has(player.id || ''));
      const teamMatch = team.name.toLowerCase().includes(q) || team.shortName.toLowerCase().includes(q);
      const playerMatch = roster.some((player) => player.name.toLowerCase().includes(q) || player.role.toLowerCase().includes(q));
      return teamMatch || playerMatch;
    });
  }, [globalSearch, teams, players, playerIdsByTeam]);

  const selectedTeam = useMemo(
    () => filteredTeams.find((team) => team.id === selectedTeamId) || filteredTeams[0],
    [selectedTeamId, filteredTeams],
  );

  if (filteredTeams.length === 0) {
    return <p className="text-muted-foreground">No teams match the current search.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeams.map((team) => (
          <Card
            key={team.id}
            className={`cursor-pointer transition-colors ${selectedTeam?.id === team.id ? 'border-primary' : 'hover:border-primary/40'}`}
            onClick={() => setSelectedTeamId(team.id)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <TeamLogo logo={team.logo} shortName={team.shortName} size="md" />
              <div>
                <p className="font-semibold">{team.name}</p>
                <p className="text-sm text-muted-foreground">{playerIdsByTeam[team.id]?.size || 0} players</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedTeam && <TeamDetails team={selectedTeam} players={players} teams={teams} />}
    </div>
  );
};
