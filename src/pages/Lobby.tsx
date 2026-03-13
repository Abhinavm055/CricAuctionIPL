import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { IPL_TEAMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Users, ArrowLeft } from 'lucide-react';
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
    if (session?.phase === 'ENDED') navigate(`/auction/${gameCode}`);
  }, [session?.phase, gameCode, navigate]);

  const isHost = session?.hostId === userId;

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
  const canStartRetention = confirmedTeamsCount >= 1;

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

  const isVsAI = session.mode === 'VS_AI';

  return (
    <div className="min-h-screen p-6 relative overflow-hidden" style={{ background: 'radial-gradient(circle at center, #0b1f4d, #020617)' }}>
      <div className="absolute inset-0 bg-[#020617]/50 backdrop-blur-[2px]" />
      <div className="relative z-10 max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-10">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>

          <h1 className="font-display text-3xl tracking-tighter text-primary">{isVsAI ? 'SELECT YOUR FRANCHISE' : 'CRICAUCTION'}</h1>

          {!isVsAI && <div className="w-24" />}
        </header>

        <div className="mb-8">
          {isVsAI ? (
            <div className="text-center mb-10">
              <p className="text-gray-400 mt-2">
                Pick your IPL team and lead them as the franchise manager.
                <br />
                The remaining teams will be controlled by AI.
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl mb-2 flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                {myConfirmedTeam ? 'Lobby Ready' : 'Select Your Franchise'}
              </h2>
              <p className="text-muted-foreground">
                Human players can lock teams. Unlocked teams stay empty until host starts retention.
              </p>
            </>
          )}
        </div>

        {isVsAI && (
          <div className="text-center text-gray-400 mb-6">🤖 AI Mode: Competitive Auction Strategy</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {IPL_TEAMS.map((team, index) => {
            const takenBy = selectedTeams[team.id];
            const isTaken = !!takenBy;
            const isMine = myConfirmedTeam === team.id;
            const isDraft = draftTeam === team.id;
            const isSelected = isMine || (!!isDraft && !myConfirmedTeam);
            const managerLabel = isSelected ? 'YOU' : isTaken ? 'Reserved' : 'AI Manager';
            const insight = TEAM_INSIGHTS[team.id] || { titles: 0, home: 'Home Ground', captain: 'Captain TBA' };

            return (
              <button
                key={team.id}
                disabled={!!myConfirmedTeam || (isTaken && !isMine)}
                onClick={() => setDraftTeam(team.id)}
                className={cn(
                  'group relative p-4 rounded-xl border-2 transition-all duration-300 text-left h-40 flex flex-col justify-between overflow-visible slide-up',
                  'bg-card/60 backdrop-blur-sm border-white/10 hover:scale-105 hover:shadow-[0_0_25px_rgba(251,191,36,0.5)] hover:border-yellow-400/70',
                  isSelected && 'border-yellow-400 shadow-[0_0_25px_rgba(251,191,36,0.6)] bg-yellow-500/10',
                  isTaken && !isMine && 'opacity-50 cursor-not-allowed grayscale',
                )}
                style={{ animationDelay: `${0.08 * index}s` }}
              >
                <div>
                  <TeamLogo teamId={team.id} logo={(team as any).logo} shortName={team.shortName} size="md" className="mb-2" />
                  <div className="font-display text-xl leading-none mb-1">{team.shortName}</div>
                  <div className="text-xs uppercase text-muted-foreground font-medium truncate">{team.name}</div>
                  <p className="text-yellow-400 text-xs mt-1">Manager: {managerLabel}</p>
                </div>

                {isSelected && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-yellow-400 text-black">
                    YOU
                  </div>
                )}

                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-28 w-44 rounded-lg bg-[#0f172a] border border-yellow-400/40 p-3 text-xs shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                  <p>🏆 Titles: {insight.titles}</p>
                  <p>🏟 Home: {insight.home}</p>
                  <p>👑 Captain: {insight.captain}</p>
                </div>
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
