import { useMemo, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { IPL_TEAMS } from '@/lib/constants';
import { EditablePlayer } from './PlayerEditor';
import { Button } from '@/components/ui/button';
import { TeamLogo } from './TeamLogo';

interface TeamsManagerProps {
  players: EditablePlayer[];
}

export const TeamsManager = ({ players }: TeamsManagerProps) => {
  const [activeTeam, setActiveTeam] = useState<string>(IPL_TEAMS[0].id);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

  const teamPlayers = useMemo(() => players.filter((p) => (p.previousTeamId || '').toLowerCase() === activeTeam.toLowerCase()), [players, activeTeam]);
  const unassigned = useMemo(() => players.filter((p) => !(p.previousTeamId || '').trim()), [players]);

  const handleAddPlayerToTeam = async () => {
    if (!selectedPlayerId) return;
    await setDoc(doc(db, 'players', selectedPlayerId), { previousTeamId: activeTeam }, { merge: true });
    setSelectedPlayerId('');
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Teams Manager</h2>
      <div className="grid md:grid-cols-[260px_1fr] gap-4">
        <div className="space-y-2 border rounded-lg p-3">
          {IPL_TEAMS.map((team) => (
            <button key={team.id} onClick={() => setActiveTeam(team.id)} className={`w-full text-left p-2 rounded flex items-center gap-2 ${activeTeam === team.id ? 'bg-primary/10 border border-primary/40' : 'hover:bg-muted/40'}`}>
              <TeamLogo logo={(team as any).logo} shortName={team.shortName} size="sm" />
              <span className="text-sm font-medium">{team.name}</span>
            </button>
          ))}
        </div>

        <div className="border rounded-lg p-4">
          {(() => {
            const team = IPL_TEAMS.find((t) => t.id === activeTeam)!;
            return (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <TeamLogo logo={(team as any).logo} shortName={team.shortName} size="lg" />
                  <div>
                    <h3 className="font-semibold text-lg">{team.name}</h3>
                    <p className="text-sm text-muted-foreground">Players tagged to this team in `previousTeamId`</p>
                  </div>
                </div>

                <div className="mb-4 flex gap-2">
                  <select className="border rounded px-2 py-2 bg-background flex-1" value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)}>
                    <option value="">Select player to add</option>
                    {unassigned.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Button onClick={handleAddPlayerToTeam}>Add to Team</Button>
                </div>

                <div className="space-y-2">
                  {teamPlayers.length === 0 ? <p className="text-sm text-muted-foreground">No players mapped.</p> : teamPlayers.map((p) => (
                    <div key={p.id} className="p-2 border rounded flex items-center gap-2">
                      {p.image ? <img src={p.image} className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded bg-muted" />}
                      <div className="text-sm">{p.name} <span className="text-muted-foreground">• {p.role}</span></div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
