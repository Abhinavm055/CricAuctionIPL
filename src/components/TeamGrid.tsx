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

export const TeamGrid = ({ teams, myTeamId, currentBidderId, glowingTeamId, onSelectTeam }: TeamGridProps) => {
  // Sort teams in a stable, consistent order matching the official IPL_TEAMS definition
  const orderedTeams = [...teams].sort((a, b) => {
    const idxA = IPL_TEAMS.findIndex((t) => t.id === a.id);
    const idxB = IPL_TEAMS.findIndex((t) => t.id === b.id);
    return idxA - idxB;
  });

  return (
    <div className="rounded-3xl border border-white/5 bg-[#0f172a]/20 backdrop-blur-xl p-4.5 shadow-2xl flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5 shrink-0">
        <p className="text-xs font-display uppercase tracking-widest text-yellow-400 font-semibold">Team Standings & Stats</p>
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold font-mono bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">10 Franchises</span>
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
