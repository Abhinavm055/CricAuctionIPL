import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { IPL_TEAMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Users, ArrowLeft, Copy, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { selectTeam, listenSession, startRetention } from '@/lib/sessionService';
import { TeamLogo } from '@/components/TeamLogo';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const TEAM_INSIGHTS: Record<string, { titles: number; titleYears?: string; home: string; captain: string }> = {
  csk: { titles: 5, titleYears: '2010, 2011, 2018, 2021, 2023', home: 'MA Chidambaram Stadium', captain: 'Ruturaj Gaikwad' },
  mi: { titles: 5, titleYears: '2013, 2015, 2017, 2019, 2020', home: 'Wankhede Stadium', captain: 'Hardik Pandya' },
  kkr: { titles: 3, titleYears: '2012, 2014, 2024', home: 'Eden Gardens', captain: 'Ajinkya Rahane' },
  rr: { titles: 1, titleYears: '2008', home: 'Sawai Mansingh Stadium', captain: 'Riyan Parag' },
  srh: { titles: 1, titleYears: '2016', home: 'Rajiv Gandhi International Stadium', captain: 'Pat Cummins' },
  gt: { titles: 1, titleYears: '2022', home: 'Narendra Modi Stadium', captain: 'Shubman Gill' },
  rcb: { titles: 1, titleYears: '2025', home: 'M Chinnaswamy Stadium', captain: 'Rajat Patidar' },
  dc: { titles: 0, home: 'Arun Jaitley Stadium', captain: 'Axar Patel' },
  lsg: { titles: 0, home: 'BRSABV Ekana Stadium', captain: 'Rishabh Pant' },
  pbks: { titles: 0, home: 'Maharaja Yadavindra Singh Stadium', captain: 'Shreyas Iyer' },
};

const AI_MANAGERS = [
  'Rahul Sharma',
  'Vikram Patel',
  'Amit Desai',
  'Karan Mehta',
  'Siddharth Nair',
  'Neeraj Gupta',
  'Arjun Kapoor',
];

const getAiManagerName = (teamId: string) => {
  const hash = teamId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return AI_MANAGERS[hash % AI_MANAGERS.length];
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
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [insightTeamId, setInsightTeamId] = useState<string | null>(null);

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
    return <div className="min-h-screen flex items-center justify-center"><p className="animate-pulse font-display text-xl">Loading Lobby...</p></div>;
  }

  const isVsAI = session.mode === 'VS_AI';
  const selectedTeams = session.selectedTeams || {};
  const managerNames = session.managerNames || {};
  const myConfirmedTeam = Object.entries(selectedTeams).find(([_, uid]) => uid === userId)?.[0];
  const confirmedTeamsCount = Object.keys(selectedTeams).length;
  const canStartRetention = confirmedTeamsCount >= 1;

  const persistManagerPreference = async (value: string) => {
    const normalized = value.trim();
    localStorage.setItem('managerName', normalized);
    if (!authUid || !normalized) return;
    await setDoc(doc(db, 'users', authUid), { uid: authUid, managerName: normalized }, { merge: true });
  };

  const renderTeamCard = (team: (typeof IPL_TEAMS)[number], index: number, showSelectedBadge = true) => {
    const takenBy = selectedTeams[team.id];
    const isTaken = !!takenBy;
    const isMine = myConfirmedTeam === team.id;
    const isDraft = draftTeam === team.id;
    const isSelected = isMine || (!!isDraft && !myConfirmedTeam);
    const insight = TEAM_INSIGHTS[team.id] || { titles: 0, home: 'Home Ground', captain: 'Captain TBA' };
    const managerLabel = isSelected
      ? (managerName || 'YOU')
      : isTaken
        ? (String(takenBy).startsWith('AI-') ? getAiManagerName(team.id) : managerNames[team.id] || 'Reserved')
        : (isVsAI ? getAiManagerName(team.id) : 'Available');

    return (
      <button
        key={team.id}
        disabled={!!myConfirmedTeam || (isTaken && !isMine)}
        onClick={() => { setDraftTeam(team.id); setInsightTeamId(team.id); }}
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

        <div className={cn('absolute inset-3 transition-opacity duration-300 flex flex-col justify-center', isSelected ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
          <div className="text-sm font-semibold text-yellow-400 mb-1">Captain: {insight.captain}</div>
          <div className="text-xs text-gray-300 mb-0.5">Home: {insight.home}</div>
          <div className="text-xs text-gray-300 leading-tight">
            Titles: <span className="text-yellow-400 font-bold">{insight.titles}</span> {insight.titleYears && <span className="opacity-80 block mt-0.5">({insight.titleYears})</span>}
          </div>
        </div>

        <p className="text-yellow-400 text-xs mt-2">Manager: {managerLabel}</p>
        {showSelectedBadge && isSelected && <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-yellow-400 text-black">YOU</div>}
      </button>
    );
  };

  const handleConfirmTeam = async () => {
    if (!draftTeam || !gameCode) return;
    if (!managerName.trim()) {
      toast({ title: 'Manager name required', description: 'Please enter your manager name before selecting a franchise.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const finalManagerName = managerName.trim();
      await selectTeam(gameCode, draftTeam, userId, finalManagerName);
      await persistManagerPreference(finalManagerName);

      if (authUid) {
        await addDoc(collection(db, 'sessions'), {
          ownerUid: authUid,
          managerName: finalManagerName,
          team: draftTeam,
          purse: 120,
          retainedPlayers: [],
          boughtPlayers: [],
          auctionStage: 'retention',
          gameCode,
          active: true,
          createdAt: serverTimestamp(),
        });
      }

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

  return (
    <div className="min-h-screen p-6 relative overflow-hidden" style={{ background: 'radial-gradient(circle at center, #0b1f4d, #020617)' }}>
      <div className="absolute inset-0 bg-[#020617]/50 backdrop-blur-[2px]" />
      <div className="relative z-10 max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-muted-foreground"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
          <h1 className="font-display text-3xl tracking-tighter text-primary">{isVsAI ? 'AI AUCTION MODE' : 'MULTIPLAYER AUCTION LOBBY'}</h1>
          {isVsAI ? <div className="w-28" /> : (
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-card/70 px-3 py-2">
              <span className="text-xs text-muted-foreground">Room Code:</span>
              <code className="font-mono font-bold text-yellow-400">{gameCode}</code>
              <button onClick={copyCode} className="ml-1 text-primary hover:text-yellow-300 transition-colors" aria-label="Copy room code">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
            </div>
          )}
        </header>

        <div className="text-center mb-7">
          <label className="block text-sm text-gray-300 mb-2">Manager Name</label>
          <input
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            onBlur={() => persistManagerPreference(managerName)}
            placeholder="Enter your name"
            className="w-full max-w-sm mx-auto px-4 py-2 rounded-lg bg-[#0f172a] border border-white/20 focus:border-yellow-400 focus:outline-none"
          />
          {isVsAI ? (
            <>
              <p className="text-gray-400 mt-4 text-sm">Select Your Franchise. Remaining teams will be controlled by AI.</p>
              <p className="text-gray-400 mt-2">🤖 AI Mode: Competitive</p>
            </>
          ) : (
            <p className="text-gray-400 mt-4 text-sm">Manager names are shown live for all franchise slots.</p>
          )}
        </div>

        {!isVsAI && (
          <div className="mb-6 p-4 rounded-xl border border-white/10 bg-[#0f172a]/70">
            <h2 className="font-display text-2xl mb-3 flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Players Joined</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
              {IPL_TEAMS.map((team) => {
                const uid = selectedTeams[team.id];
                const manager = uid
                  ? (String(uid).startsWith('AI-') ? getAiManagerName(team.id) : managerNames[team.id] || String(uid).slice(0, 6))
                  : 'Available';
                return <div key={team.id} className="px-1 py-1"><span className="text-yellow-400 font-semibold">{team.shortName}</span> — <span className="text-muted-foreground">{manager}</span></div>;
              })}
            </div>
          </div>
        )}

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

        <div className="flex flex-col items-center gap-5 py-8 border-t border-white/5">
          {!myConfirmedTeam && draftTeam && (
            <Button variant="gold" size="xl" className="px-12" onClick={handleConfirmTeam} disabled={isSubmitting}>{isSubmitting ? 'Locking...' : `Confirm ${draftTeam.toUpperCase()}`}</Button>
          )}
          {isHost && (
            <Button variant="gold" size="xl" disabled={!canStartRetention} onClick={() => startRetention(gameCode!)}>
              Start Retention
            </Button>
          )}

          {!isHost && <p className="text-muted-foreground animate-pulse">Host is preparing the auction...</p>}
        </div>

        {insightTeamId && (
          <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-xl border border-yellow-500/50 bg-[#0f172a] p-5 relative">
              <button className="absolute top-3 right-3 text-slate-300 hover:text-yellow-300" onClick={() => setInsightTeamId(null)} aria-label="Close team details">
                <X className="w-4 h-4" />
              </button>
              {(() => {
                const team = IPL_TEAMS.find((item) => item.id === insightTeamId);
                const insight = TEAM_INSIGHTS[insightTeamId] || { titles: 0, home: 'Home Ground', captain: 'Captain TBA' };
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <TeamLogo teamId={team?.id || insightTeamId} logo={(team as any)?.logo} shortName={team?.shortName} size="md" />
                      <div>
                        <p className="text-xl font-display text-yellow-300">{team?.name || insightTeamId.toUpperCase()}</p>
                        <p className="text-xs text-slate-400">{team?.shortName}</p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#111c34] p-3 text-sm space-y-1">
                      <p><span className="text-yellow-300">Captain:</span> {insight.captain}</p>
                      <p><span className="text-yellow-300">Home Stadium:</span> {insight.home}</p>
                      <p><span className="text-yellow-300">Titles Won:</span> {insight.titles}</p>
                      <p><span className="text-yellow-300">Championship Years:</span> {insight.titleYears || '—'}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;
