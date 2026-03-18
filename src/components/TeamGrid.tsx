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
  onSelectTeam: (teamId: string) => void;
}

export const TeamGrid = ({ teams, myTeamId, currentBidderId, onSelectTeam }: TeamGridProps) => {
  return (
    <div className="h-full rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3 overflow-y-auto">
      <p className="text-xs uppercase tracking-widest text-yellow-300 mb-2">Teams</p>
      <div className="grid grid-cols-3 gap-2 content-start">
        {teams.map((team) => (
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
            isUserTeam={team.id === myTeamId}
            logoSize={team.id === myTeamId ? 'large' : 'normal'}
            onClick={() => onSelectTeam(team.id)}
          />
        ))}
      </div>

      {myTeam && (
        <div className="mt-3">
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
            onClick={() => onSelectTeam(myTeam.id)}
          />
        </div>
      )}
    </div>
  );
};
