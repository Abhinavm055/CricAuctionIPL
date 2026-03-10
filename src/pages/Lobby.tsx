import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { IPL_TEAMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Check, Copy, Users, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { selectTeam, listenSession, fillAITeams, startRetention } from '@/lib/sessionService';
import { TeamLogo } from '@/components/TeamLogo';

const Lobby = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [draftTeam, setDraftTeam] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  }, [session?.phase, gameCode, navigate]);

  const isHost = session?.hostId === userId;

  useEffect(() => {
    if (!session?.hostId) return;
    console.log('hostId:', session.hostId);
    console.log('userId:', userId);
  }, [session?.hostId, userId]);

  useEffect(() => {
    if (!isHost || !session || !gameCode) return;
    if (session.isAIFilled) return;

    const selectedTeams = session.selectedTeams || {};
    const humanSelected = Object.values(selectedTeams).some((uid: string) => !uid.startsWith('AI-'));
    if (!humanSelected) return;

    const fillRemainingTeams = async () => {
      const takenTeamIds = Object.keys(selectedTeams);
      const remainingTeams = IPL_TEAMS.filter((team) => !takenTeamIds.includes(team.id));

      for (const team of remainingTeams) {
        await selectTeam(gameCode, team.id, `AI-${team.id}`);
      }
      await fillAITeams(gameCode);
    };

    fillRemainingTeams().catch((error) => console.error('AI Fill failed:', error));
  }, [isHost, session, gameCode]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="animate-pulse font-display text-xl">Loading Lobby...</p>
      </div>
    );
  }

  const selectedTeams = session.selectedTeams || {};
  const myConfirmedTeam = Object.entries(selectedTeams).find(([_, uid]) => uid === userId)?.[0];
  const confirmedTeamsCount = Object.keys(selectedTeams).length;
  const canStartRetention = confirmedTeamsCount >= 10;

  const handleConfirmTeam = async () => {
    if (!draftTeam || !gameCode) return;
    setIsSubmitting(true);
    try {
      await selectTeam(gameCode, draftTeam, userId);
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
    toast({ title: 'Code Copied' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen broadcast-container p-6">
      <div className="relative z-10 max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-10">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>

          <h1 className="font-display text-3xl tracking-tighter text-primary">
            {session.mode === 'VS_AI' ? 'VS AI LOBBY' : 'CRICAUCTION'}
          </h1>

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Room Code</span>
            <button onClick={copyCode} className="flex items-center gap-3 px-4 py-2 bg-secondary/50 hover:bg-secondary border border-white/10 rounded-lg transition-colors">
              <code className="font-mono text-xl font-bold">{gameCode}</code>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-primary" />}
            </button>
          </div>
        </header>

        <div className="mb-8">
          <h2 className="font-display text-2xl mb-2 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            {myConfirmedTeam ? 'Lobby Ready' : 'Select Your Franchise'}
          </h2>
          <p className="text-muted-foreground">
            {session.mode === 'VS_AI'
              ? 'Pick one team. Remaining 9 teams will be controlled by AI.'
              : 'Human players can lock teams. Unlocked teams auto-fill as AI.'}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {IPL_TEAMS.map((team) => {
            const takenBy = selectedTeams[team.id];
            const isTaken = !!takenBy;
            const isMine = myConfirmedTeam === team.id;
            const isDraft = draftTeam === team.id;
            const isAI = String(takenBy || '').startsWith('AI-');

            return (
              <button
                key={team.id}
                disabled={!!myConfirmedTeam || (isTaken && !isMine)}
                onClick={() => setDraftTeam(team.id)}
                className={cn(
                  'relative p-4 rounded-xl border-2 transition-all duration-300 text-left h-32 flex flex-col justify-between overflow-hidden',
                  'bg-card/40 backdrop-blur-sm border-white/5',
                  isDraft && !myConfirmedTeam && 'border-yellow-500 bg-yellow-500/10',
                  isMine && 'border-primary bg-primary/10',
                  isTaken && !isMine && 'opacity-50 cursor-not-allowed grayscale',
                )}
              >
                <div>
                  <TeamLogo teamId={team.id} logo={(team as any).logo} shortName={team.shortName} size="md" className="mb-2" />
                  <div className="font-display text-xl leading-none mb-1">{team.shortName}</div>
                  <div className="text-[10px] uppercase text-muted-foreground font-medium truncate">{team.name}</div>
                </div>

                {isMine && (
                  <div className="flex items-center gap-1 text-primary text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3" /> SECURED
                  </div>
                )}
                {isAI && <div className="text-[10px] font-bold text-muted-foreground italic">AI BOT</div>}
                {isTaken && !isMine && !isAI && <div className="text-[10px] font-bold text-red-500">OCCUPIED</div>}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-6 py-8 border-t border-white/5">
          {!myConfirmedTeam && draftTeam && (
            <Button variant="gold" size="xl" className="px-12" onClick={handleConfirmTeam} disabled={isSubmitting}>
              {isSubmitting ? 'Locking...' : `Confirm ${draftTeam.toUpperCase()}`}
            </Button>
          )}

          {isHost && (
            <Button variant="gold" size="xl" disabled={!canStartRetention} onClick={() => startRetention(gameCode!)}>
              Start Retention
            </Button>
          )}

          {!isHost && <p className="text-muted-foreground animate-pulse">Host is preparing the auction...</p>}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
