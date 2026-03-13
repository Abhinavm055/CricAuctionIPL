import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { IPL_TEAMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Users, ArrowLeft, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { selectTeam, listenSession, startRetention } from '@/lib/sessionService';
import { TeamLogo } from '@/components/TeamLogo';

const TEAM_INSIGHTS: Record<string, { titles: number; home: string; captain: string }> = {
  csk: { titles: 5, home: 'Chepauk', captain: 'MS Dhoni' },
  mi: { titles: 5, home: 'Wankhede', captain: 'Hardik Pandya' },
  rcb: { titles: 0, home: 'Chinnaswamy', captain: 'Rajat Patidar' },
  kkr: { titles: 3, home: 'Eden Gardens', captain: 'Ajinkya Rahane' },
  dc: { titles: 0, home: 'Arun Jaitley Stadium', captain: 'Axar Patel' },
  pbks: { titles: 0, home: 'Mullanpur', captain: 'Shreyas Iyer' },
  rr: { titles: 1, home: 'Sawai Mansingh', captain: 'Sanju Samson' },
  srh: { titles: 1, home: 'Rajiv Gandhi Intl Stadium', captain: 'Pat Cummins' },
  gt: { titles: 1, home: 'Narendra Modi Stadium', captain: 'Shubman Gill' },
  lsg: { titles: 0, home: 'Ekana Cricket Stadium', captain: 'Rishabh Pant' },
};

const Lobby = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [draftTeam, setDraftTeam] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [managerName, setManagerName] = useState(localStorage.getItem('managerName') || '');

  const userId = useMemo(() => {
    let uid = localStorage.getItem('uid');
    if (!uid) {
      uid = `user-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('uid', uid);
    }
    return uid;
  }, []);

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, (data) => setSession(data));
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    if (session?.phase === 'AUCTION') navigate(`/auction/${gameCode}`);
    if (session?.phase === 'RETENTION') navigate(`/retention/${gameCode}`);
    if (session?.phase === 'ENDED') navigate(`/auction/${gameCode}`);
  }, [session?.phase, gameCode, navigate]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="animate-pulse font-display text-xl">Loading Lobby...</p>
      </div>
    );
  }

  const isHost = session?.hostId === userId;
  const isVsAI = session.mode === 'VS_AI';
  const selectedTeams = session.selectedTeams || {};
  const managerNames = session.managerNames || {};
  const myConfirmedTeam = Object.entries(selectedTeams).find(([_, uid]) => uid === userId)?.[0];
  const confirmedTeamsCount = Object.keys(selectedTeams).length;
  const canStartRetention = confirmedTeamsCount >= 1;

  const handleConfirmTeam = async () => {
    if (!draftTeam || !gameCode) return;
    if (isVsAI && !managerName.trim()) {
      toast({ title: 'Manager name required', description: 'Please enter your manager name before selecting a franchise.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const finalManagerName = isVsAI ? managerName.trim() : managerNames[draftTeam] || 'Player';
      await selectTeam(gameCode, draftTeam, userId, finalManagerName);
      if (isVsAI) localStorage.setItem('managerName', finalManagerName);
      localStorage.setItem('myTeamId', draftTeam);
      toast({ title: 'Team Locked!', description: 'Waiting for host...' });
    } catch (error: any) {
      toast({ title: 'Selection Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(gameCode || '');
    setCopied(true);
    toast({ title: 'Room code copied' });
    setTimeout(() => setCopied(false), 1500);
  };

  const connectedPlayerRows = Object.entries(selectedTeams).map(([teamId, uid]) => {
    const team = IPL_TEAMS.find((t) => t.id === teamId);
    const isAIManager = String(uid).startsWith('AI-');
    const manager = managerNames[teamId] || (isAIManager ? 'AI Manager' : String(uid).slice(0, 6));
    return { teamId, shortName: team?.shortName || teamId.toUpperCase(), manager };
  });

  return (
    <div className="min-h-screen p-6 relative overflow-hidden" style={{ background: 'radial-gradient(circle at center, #0b1f4d, #020617)' }}>
      <div className="absolute inset-0 bg-[#020617]/50 backdrop-blur-[2px]" />
      <div className="relative z-10 max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>

          <h1 className="font-display text-3xl tracking-tighter text-primary">
            {isVsAI ? 'AI AUCTION MODE' : 'MULTIPLAYER AUCTION LOBBY'}
          </h1>

          {isVsAI ? <div className="w-28" /> : (
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-card/70 px-3 py-2">
              <span className="text-xs text-muted-foreground">Room Code:</span>
              <code className="font-mono font-bold text-yellow-400">{gameCode}</code>
              <button onClick={copyCode} className="ml-1 text-primary hover:text-yellow-300 transition-colors" aria-label="Copy room code">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </header>

        {isVsAI ? (
          <div className="text-center mb-7">
            <label className="block text-sm text-gray-300 mb-2">Manager Name</label>
            <input
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="Enter your name"
              className="w-full max-w-sm mx-auto px-4 py-2 rounded-lg bg-[#0f172a] border border-white/20 focus:border-yellow-400 focus:outline-none"
            />
            <p className="text-gray-400 mt-4 text-sm">
              Select Your Franchise. Remaining teams will be controlled by AI.
            </p>
            <p className="text-gray-400 mt-2">🤖 AI Mode: Competitive</p>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-white/10 bg-card/50 p-4">
            <h2 className="font-display text-2xl mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Players Joined
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
              {IPL_TEAMS.map((team) => {
                const uid = selectedTeams[team.id];
                const manager = uid ? managerNames[team.id] || String(uid).slice(0, 6) : 'Waiting';
                return (
                  <div key={team.id} className="rounded-lg border border-white/10 px-3 py-2 bg-[#0f172a]/70">
                    <span className="text-yellow-400 font-semibold">{team.shortName}</span> – <span className="text-muted-foreground">{manager}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isVsAI && connectedPlayerRows.length > 0 && (
          <div className="mb-6 text-sm text-muted-foreground">Connected Managers: {connectedPlayerRows.map((x) => `${x.shortName} - ${x.manager}`).join(' · ')}</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {IPL_TEAMS.map((team, index) => {
            const takenBy = selectedTeams[team.id];
            const isTaken = !!takenBy;
            const isMine = myConfirmedTeam === team.id;
            const isDraft = draftTeam === team.id;
            const isSelected = isMine || (!!isDraft && !myConfirmedTeam);
            const insight = TEAM_INSIGHTS[team.id] || { titles: 0, home: 'Home Ground', captain: 'Captain TBA' };
            const managerLabel = isSelected
              ? (isVsAI ? managerName || 'YOU' : managerNames[team.id] || 'YOU')
              : isTaken
                ? (managerNames[team.id] || 'Reserved')
                : isVsAI ? 'AI Manager' : 'Waiting';

            return (
              <button
                key={team.id}
                disabled={!!myConfirmedTeam || (isTaken && !isMine)}
                onClick={() => setDraftTeam(team.id)}
                className={cn(
                  'group relative p-4 rounded-xl border-2 transition-all duration-300 text-left h-44 overflow-hidden slide-up',
                  'bg-card/60 backdrop-blur-sm border-white/10 hover:-translate-y-1 hover:scale-105 hover:shadow-[0_0_25px_rgba(251,191,36,0.5)] hover:border-yellow-400/70',
                  isSelected && 'border-yellow-400 shadow-[0_0_25px_rgba(251,191,36,0.6)] bg-yellow-500/10',
                  isTaken && !isMine && 'opacity-60 cursor-not-allowed grayscale',
                )}
                style={{ animationDelay: `${0.08 * index}s` }}
              >
                <div className={cn('transition-opacity duration-300', isSelected ? 'opacity-0' : 'opacity-100')}>
                  <TeamLogo teamId={team.id} logo={(team as any).logo} shortName={team.shortName} size="md" className="mb-2" />
                  <div className="font-display text-xl leading-none mb-1">{team.shortName}</div>
                  <div className="text-xs uppercase text-muted-foreground font-medium truncate">{team.name}</div>
                </div>

                <div className={cn('absolute inset-3 transition-opacity duration-300', isSelected ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                  <div className="text-sm font-semibold text-yellow-400 mb-1">Captain: {insight.captain}</div>
                  <div className="text-xs text-gray-300">Home: {insight.home}</div>
                  <div className="text-xs text-gray-300">Titles: {insight.titles}</div>
                </div>

                <p className="text-yellow-400 text-xs mt-2">Manager: {managerLabel}</p>

                {isSelected && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-yellow-400 text-black">
                    YOU
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-5 py-8 border-t border-white/5">
          {!myConfirmedTeam && draftTeam && (
            <Button variant="gold" size="xl" className="px-12" onClick={handleConfirmTeam} disabled={isSubmitting}>
              {isSubmitting ? 'Locking...' : `Confirm ${draftTeam.toUpperCase()}`}
            </Button>
          )}

          {isHost && (
            <Button
              variant="gold"
              size="xl"
              disabled={!canStartRetention}
              onClick={() => startRetention(gameCode!)}
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-semibold hover:scale-105 hover:shadow-[0_0_20px_rgba(251,191,36,0.8)] transition-all"
            >
              ⚡ START RETENTION ROUND
            </Button>
          )}

          {!isHost && <p className="text-muted-foreground animate-pulse">Host is preparing the auction...</p>}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
