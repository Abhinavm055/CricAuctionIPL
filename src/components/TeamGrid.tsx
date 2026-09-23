import { memo, useMemo } from 'react';
import { TeamCard } from './TeamCard';
import { IPL_TEAMS } from '@/lib/constants';

interface TeamInfo {
  id: string;
  shortName: string;
  name: string;
  logo?: string;
  purseRemaining: number;
  squadSize: number;
  rtmCards: number;
  retainedCount?: number;
}

interface TeamGridProps {
  teams: TeamInfo[];
  myTeamId?: string;
  currentBidderId?: string | null;
  glowingTeamId?: string | null;
  onSelectTeam: (teamId: string) => void;
}

const TeamGridComponent = ({ teams, myTeamId, currentBidderId, glowingTeamId, onSelectTeam }: TeamGridProps) => {
  // Sort teams in a stable, consistent order matching the official IPL_TEAMS definition
  const orderedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      const idxA = IPL_TEAMS.findIndex((t) => t.id === a.id);
      const idxB = IPL_TEAMS.findIndex((t) => t.id === b.id);
      return idxA - idxB;
    });
  }, [teams]);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#09152A]/90 backdrop-blur-md p-4 shadow-2xl flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between mb-3 border-b border-white/[0.06] pb-2.5 shrink-0">
        <p className="text-xs font-display uppercase tracking-widest text-amber-400 font-black">Team Standings & Stats</p>
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">10 Franchises</span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1.5 grid grid-cols-2 gap-3.5 pb-1">
        {orderedTeams.map((team) => (
          <TeamCard
            key={team.id}
            id={team.id}
            shortName={team.shortName}
            name={team.name}
            logo={team.logo}
            purseRemaining={team.purseRemaining}
            squadSize={team.squadSize}
            rtmCards={team.rtmCards}
            retainedCount={team.retainedCount}
            isCurrentBidder={team.id === currentBidderId}
            shouldGlow={team.id === glowingTeamId}
            isUserTeam={team.id === myTeamId}
            onClick={() => onSelectTeam(team.id)}
          />
        ))}
      </div>
    </div>
  );
};

export const TeamGrid = memo(TeamGridComponent);
