import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  const [showManagerForTeamId, setShowManagerForTeamId] = useState<string>('');

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

  const playersById = useMemo(() => {
    const map: Record<string, EditablePlayer> = {};
    players.forEach((player) => {
      if (player.id) map[player.id] = player;
    });
    return map;
  }, [players]);

  const filteredTeams = useMemo(() => {
    const q = globalSearch.toLowerCase().trim();
    if (!q) return teams;

    return teams.filter((team) => {
      const roster = Array.from(playerIdsByTeam[team.id] || []).map((playerId) => playersById[playerId]).filter(Boolean);
      const teamMatch = team.name.toLowerCase().includes(q) || team.shortName.toLowerCase().includes(q);
      const playerMatch = roster.some((player) => player.name.toLowerCase().includes(q) || player.role.toLowerCase().includes(q));
      return teamMatch || playerMatch;
    });
  }, [globalSearch, teams, playerIdsByTeam, playersById]);

  const selectedTeam = useMemo(
    () => filteredTeams.find((team) => team.id === selectedTeamId) || filteredTeams[0],
    [selectedTeamId, filteredTeams],
  );

  if (filteredTeams.length === 0) {
    return <p className="text-muted-foreground">No teams match the current search.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Teams (Firestore)</h2>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredTeams.map((team) => {
          const teamPlayerIds = Array.from(playerIdsByTeam[team.id] || []);
          const teamPlayers = teamPlayerIds.map((playerId) => playersById[playerId]).filter(Boolean);
          const isSelected = selectedTeam?.id === team.id;

          return (
            <Card
              key={team.id}
              className={`cursor-pointer transition-colors ${isSelected ? 'border-primary' : 'hover:border-primary/40'}`}
              onClick={() => setSelectedTeamId(team.id)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <TeamLogo logo={team.logo} shortName={team.shortName} size="md" />
                  <div>
                    <p className="font-semibold">{team.name}</p>
                    <p className="text-sm text-muted-foreground">{teamPlayers.length} players</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="space-y-2 border rounded-md p-2 bg-muted/20">
                    <p className="text-xs font-medium text-muted-foreground">Players in this team</p>
                    {teamPlayers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No players mapped in Firestore yet.</p>
                    ) : (
                      <div className="space-y-1 max-h-36 overflow-auto">
                        {teamPlayers.map((player) => (
                          <div key={player.id} className="flex items-center gap-2 text-xs">
                            {player.image ? (
                              <img src={player.image} alt={player.name} className="w-6 h-6 rounded object-cover border" />
                            ) : (
                              <div className="w-6 h-6 rounded bg-muted" />
                            )}
                            <span className="font-medium truncate">{player.name}</span>
                            <span className="text-muted-foreground">• {player.role}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowManagerForTeamId(team.id);
                      }}
                    >
                      Manage Team
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showManagerForTeamId && (
        <TeamDetails
          team={filteredTeams.find((team) => team.id === showManagerForTeamId) || filteredTeams[0]}
          players={players}
          teams={teams}
        />
      )}
    </div>
  );
};
