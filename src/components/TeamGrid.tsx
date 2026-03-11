import { TeamCard } from './TeamCard';

interface TeamInfo {
  id: string;
  shortName: string;
  name: string;
  logo?: string;
  purseRemaining: number;
  squadSize: number;
  rtmCards: number;
}

interface TeamGridProps {
  teams: TeamInfo[];
  myTeamId?: string;
  currentBidderId?: string | null;
  glowingTeamId?: string | null;
  onSelectTeam: (teamId: string) => void;
}

export const TeamGrid = ({ teams, myTeamId, currentBidderId, glowingTeamId, onSelectTeam }: TeamGridProps) => {
  const myTeam = teams.find((team) => team.id === myTeamId) || null;
  const gridTeams = (myTeam ? teams.filter((team) => team.id !== myTeam.id) : teams).slice(0, 9);

  return (
    <div className="h-full rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3 overflow-y-auto">
      <p className="text-xs uppercase tracking-widest text-yellow-300 mb-2">Teams</p>

      <div className="hidden md:grid grid-cols-3 gap-2 content-start">
        {gridTeams.map((team) => (
          <TeamCard
            key={team.id}
            id={team.id}
            shortName={team.shortName}
            name={team.name}
            logo={team.logo}
            purseRemaining={team.purseRemaining}
            squadSize={team.squadSize}
            rtmCards={team.rtmCards}
            isCurrentBidder={team.id === currentBidderId}
            shouldGlow={team.id === glowingTeamId}
            isUserTeam={team.id === myTeamId}
            logoSize="normal"
            onClick={() => onSelectTeam(team.id)}
          />
        ))}
      </div>

      <div className="md:hidden flex gap-3 overflow-x-auto pb-2">
        {gridTeams.map((team) => (
          <div key={team.id} className="min-w-[220px]">
            <TeamCard
              id={team.id}
              shortName={team.shortName}
              name={team.name}
              logo={team.logo}
              purseRemaining={team.purseRemaining}
              squadSize={team.squadSize}
              rtmCards={team.rtmCards}
              isCurrentBidder={team.id === currentBidderId}
              shouldGlow={team.id === glowingTeamId}
              isUserTeam={team.id === myTeamId}
              logoSize="normal"
              onClick={() => onSelectTeam(team.id)}
            />
          </div>
        ))}
      </div>

      {myTeam && (
        <div className="mt-3 border-t border-yellow-500/30 pt-3">
          <p className="text-[10px] uppercase tracking-widest text-yellow-300 mb-2">My Team</p>
          <TeamCard
            id={myTeam.id}
            shortName={myTeam.shortName}
            name={myTeam.name}
            logo={myTeam.logo}
            purseRemaining={myTeam.purseRemaining}
            squadSize={myTeam.squadSize}
            rtmCards={myTeam.rtmCards}
            isCurrentBidder={myTeam.id === currentBidderId}
            shouldGlow={myTeam.id === glowingTeamId}
            isUserTeam
            logoSize="large"
            onClick={() => onSelectTeam(myTeam.id)}
          />
        </div>
      )}
    </div>
  );
};
