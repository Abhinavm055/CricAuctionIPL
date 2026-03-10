import { TeamCard } from './TeamCard';

interface TeamInfo {
  id: string;
  shortName: string;
  logo?: string;
}

interface TeamGridProps {
  aiTeams: TeamInfo[];
  userTeam: TeamInfo | null;
  currentBidderId?: string | null;
  onSelectTeam: (teamId: string) => void;
}

export const TeamGrid = ({ aiTeams, userTeam, currentBidderId, onSelectTeam }: TeamGridProps) => {
  return (
    <div className="h-full rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3 grid grid-rows-[auto_1fr_auto] gap-3">
      <p className="text-xs uppercase tracking-widest text-yellow-300">Teams</p>

      <div className="grid grid-cols-3 gap-2 content-start">
        {aiTeams.map((team) => (
          <TeamCard
            key={team.id}
            id={team.id}
            shortName={team.shortName}
            logo={team.logo}
            isCurrentBidder={team.id === currentBidderId}
            onClick={() => onSelectTeam(team.id)}
          />
        ))}
      </div>

      {userTeam && (
        <div>
          <p className="text-xs uppercase tracking-widest text-yellow-300 mb-2">My Team</p>
          <TeamCard
            id={userTeam.id}
            shortName={userTeam.shortName}
            logo={userTeam.logo}
            isCurrentBidder={userTeam.id === currentBidderId}
            isUserTeam
            logoSize="large"
            onClick={() => onSelectTeam(userTeam.id)}
          />
        </div>
      )}
    </div>
  );
};
