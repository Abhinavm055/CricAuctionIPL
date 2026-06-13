import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { IPL_TEAMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Users, ArrowLeft, Copy, Check, X, Shield, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { selectTeam, listenSession, startRetention, resolveHostReconnectTimeout } from '@/lib/sessionService';
import { TeamLogo } from '@/components/TeamLogo';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';

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

const TEAM_GLOWS: Record<string, { border: string; shadow: string; glow: string; text: string }> = {
  csk: { border: 'border-yellow-400', shadow: 'shadow-[0_0_20px_rgba(253,224,71,0.22)]', glow: 'bg-yellow-500/10', text: 'text-yellow-400' },
  mi: { border: 'border-blue-500', shadow: 'shadow-[0_0_20px_rgba(59,130,246,0.22)]', glow: 'bg-blue-500/10', text: 'text-blue-400' },
  rcb: { border: 'border-red-500', shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.22)]', glow: 'bg-red-500/10', text: 'text-red-400' },
  kkr: { border: 'border-purple-500', shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.22)]', glow: 'bg-purple-500/10', text: 'text-purple-400' },
  dc: { border: 'border-blue-600', shadow: 'shadow-[0_0_20px_rgba(37,99,235,0.22)]', glow: 'bg-blue-600/10', text: 'text-blue-500' },
  pbks: { border: 'border-red-600', shadow: 'shadow-[0_0_20px_rgba(220,38,38,0.22)]', glow: 'bg-red-600/10', text: 'text-red-500' },
  rr: { border: 'border-pink-500', shadow: 'shadow-[0_0_20px_rgba(236,72,153,0.22)]', glow: 'bg-pink-500/10', text: 'text-pink-400' },
  srh: { border: 'border-orange-500', shadow: 'shadow-[0_0_20px_rgba(249,115,22,0.22)]', glow: 'bg-orange-500/10', text: 'text-orange-400' },
  gt: { border: 'border-slate-400', shadow: 'shadow-[0_0_20px_rgba(148,163,184,0.22)]', glow: 'bg-slate-400/10', text: 'text-slate-400' },
  lsg: { border: 'border-cyan-500', shadow: 'shadow-[0_0_20px_rgba(6,182,212,0.22)]', glow: 'bg-cyan-500/10', text: 'text-cyan-400' },
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

const TEAM_OWNERS: Record<string, string> = {
  pbks: 'Preity Zinta',
  mi: 'Mukesh Ambani',
  csk: 'N. Srinivasan',
  rcb: 'United Spirits',
  kkr: 'Shah Rukh Khan',
  dc: 'GMR Group',
  rr: 'Manoj Badale',
  srh: 'Kalanithi Maran',
  gt: 'CVC Capital Partners',
  lsg: 'Sanjiv Goenka',
};

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
  const [inviteCopied, setInviteCopied] = useState(false);
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
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUid(user?.uid || null);
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const saved = String(snap.data()?.managerName || '').trim();
        const fallbackName = user.displayName || user.email?.split('@')[0] || '';
        const nameToSet = saved || fallbackName;
        
        if (nameToSet) {
          setManagerName(nameToSet);
          localStorage.setItem('managerName', nameToSet);
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!gameCode) return;
    const unsub = listenSession(gameCode, (data) => setSession(data));
    return () => unsub();
  }, [gameCode]);

  useEffect(() => {
    if (!gameCode || session?.hostReconnect?.status !== 'PENDING') return;
    resolveHostReconnectTimeout(gameCode).catch(() => undefined);
    const timer = window.setInterval(() => {
      resolveHostReconnectTimeout(gameCode).catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [gameCode, session?.hostReconnect?.status, session?.hostReconnect?.deadlineAt]);

  useEffect(() => {
    if (session?.phase === 'AUCTION') navigate(`/auction/${gameCode}`);
    if (session?.phase === 'RETENTION') navigate(`/retention/${gameCode}`);
    if (session?.phase === 'ENDED') navigate(`/auction/${gameCode}`);
  }, [session?.phase, gameCode, navigate]);

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400" />
        <p className="font-display tracking-widest text-xl text-yellow-400 mt-4 animate-pulse uppercase">LOADING LOBBY...</p>
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

  const persistManagerPreference = async (value: string) => {
    const normalized = value.trim();
    localStorage.setItem('managerName', normalized);
  };

  const upsertLeaderboardPlayerAfterJoin = async (finalManagerName: string) => {
    if (!authUid) return;
    const userRef = doc(db, 'users', authUid);
    const existing = await getDoc(userRef);
    if (existing.exists()) {
      await setDoc(userRef, { managerName: finalManagerName }, { merge: true });
      return;
    }

    await setDoc(
      userRef,
      {
        uid: authUid,
        name: finalManagerName,
        managerName: finalManagerName,
        email: auth.currentUser?.email || '',
        auctionsPlayed: 0,
        auctionsWon: 0,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
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
        : (isVsAI ? TEAM_OWNERS[team.id] || getAiManagerName(team.id) : TEAM_OWNERS[team.id] || 'Available');

    const glowCfg = TEAM_GLOWS[team.id] || { border: 'border-white/10', shadow: 'shadow-none', glow: '', text: 'text-slate-300' };

    return (
      <motion.button
        key={team.id}
        disabled={!!myConfirmedTeam || (isTaken && !isMine)}
        onClick={() => { setDraftTeam(team.id); setInsightTeamId(team.id); }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.05 }}
        whileHover={!myConfirmedTeam && (!isTaken || isMine) ? { scale: 1.05, y: -4 } : {}}
        className={cn(
          'group relative p-5 rounded-2xl border transition-all duration-300 text-left h-44 overflow-hidden',
          'glass-panel backdrop-blur-md border-white/5 shadow-lg',
          isSelected ? `${glowCfg.border} ${glowCfg.shadow} ${glowCfg.glow}` : 'hover:border-yellow-400/40 hover:shadow-[0_8px_30px_rgba(250,204,21,0.15)]',
          isTaken && !isMine && 'opacity-40 cursor-not-allowed grayscale border-white/5 shadow-none',
        )}
      >
        <div className={cn('transition-opacity duration-300 relative z-10', isSelected ? 'opacity-0' : 'opacity-100')}>
          <TeamLogo teamId={team.id} logo={(team as any).logo} shortName={team.shortName} size="md" className="mb-2" />
          <div className="font-display text-2xl font-extrabold tracking-wide leading-none mb-1 text-white">{team.shortName}</div>
          <div className="text-[10px] uppercase text-slate-400 font-bold tracking-widest truncate">{team.name}</div>
        </div>

        <div className={cn('absolute inset-4 transition-opacity duration-300 flex flex-col justify-center relative z-10', isSelected ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
          <div className="text-sm font-black text-yellow-400 mb-1">Captain: {insight.captain}</div>
          <div className="text-xs text-slate-300 mb-0.5 font-medium">Home: {insight.home}</div>
          <div className="text-xs text-slate-300 leading-tight">
            Titles: <span className="text-yellow-400 font-extrabold">{insight.titles}</span> {insight.titleYears && <span className="opacity-80 block mt-0.5 font-mono">({insight.titleYears})</span>}
          </div>
        </div>

        <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between border-t border-white/5 pt-2 z-10">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Manager</p>
          <p className={cn("text-[10px] uppercase tracking-wider font-extrabold truncate max-w-[65%]", isSelected ? "text-yellow-400" : "text-slate-300")}>{managerLabel}</p>
        </div>
        
        {showSelectedBadge && isSelected && (
          <div className="absolute top-3 right-3 px-2 py-0.5 text-[8px] font-black rounded bg-yellow-400 text-black tracking-wider uppercase z-20">YOU</div>
        )}
      </motion.button>
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
      await upsertLeaderboardPlayerAfterJoin(finalManagerName);

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
  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/join/${gameCode || ''}` : '';
  const copyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    toast({ title: 'Invite link copied' });
    setTimeout(() => setInviteCopied(false), 1500);
  };

  return (
    <div className="min-h-screen p-6 relative overflow-hidden" style={{ background: 'radial-gradient(circle at center, #071739 0%, #020617 100%)' }}>
      {/* Stadium-inspired atmospheric lighting */}
      <div className="stadium-ambient stadium-ambient-cyan -top-40 -left-40 w-[600px] h-[600px]" />
      <div className="stadium-ambient stadium-ambient-gold -bottom-40 -right-40 w-[600px] h-[600px]" />

      <div className="relative z-10 max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors cursor-pointer self-start md:self-auto"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
          <div className="text-center md:text-left flex-1 md:ml-4">
            <div className="flex items-center gap-1.5 justify-center md:justify-start">
              <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse" />
              <span className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">AUCTION CENTRAL</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-black text-white uppercase tracking-wide">{isVsAI ? 'AI AUCTION MODE' : 'MULTIPLAYER AUCTION LOBBY'}</h1>
          </div>
          {isVsAI ? <div className="w-28" /> : (
            <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/45 p-4 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Room Code:</span>
                <code className="font-mono font-extrabold text-yellow-400 text-sm">{gameCode}</code>
                <button onClick={copyCode} className="ml-1 text-[#00CFFF] hover:text-yellow-300 transition-colors" aria-label="Copy room code">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Invite:</span>
                <code className="font-mono text-xs text-yellow-200">{inviteLink}</code>
                <button onClick={copyInviteLink} className="ml-1 text-[#00CFFF] hover:text-yellow-300 transition-colors" aria-label="Copy invite link">{inviteCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
              </div>
            </div>
          )}
        </header>

        <div className="p-6 rounded-3xl border border-white/5 bg-[#0f172a]/20 backdrop-blur-xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="w-full md:max-w-md space-y-2">
            <label className="block text-xs uppercase tracking-widest text-slate-400 font-black">Manager Name</label>
            <div className="relative">
              <input
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                onBlur={() => persistManagerPreference(managerName)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl bg-[#030712]/60 border border-white/10 text-white placeholder-slate-500 focus:border-yellow-400 focus:outline-none transition-all duration-300 font-medium"
              />
              <Shield className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            {isVsAI ? (
              <>
                <p className="text-sm text-slate-300 font-semibold">Select Your Franchise. Remaining slots will be filled by AI managers.</p>
                <p className="text-xs text-yellow-400 font-black uppercase tracking-wider mt-1.5 flex items-center justify-center md:justify-start gap-1">🤖 AI Competitive Mode Active</p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300 font-semibold">Claim your franchise seat. Live changes sync across all connected managers.</p>
                <p className="text-xs text-slate-400 mt-1">Multiplayer room updates automatically.</p>
              </>
            )}
          </div>
        </div>

        {!isVsAI && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8 p-6 rounded-3xl border border-white/5 bg-[#0f172a]/30 backdrop-blur-md shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <Users className="h-24 w-24 text-white" />
            </div>
            <h2 className="font-display text-xl font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-[#00CFFF]" /> Players Joined ({confirmedTeamsCount} / 10)</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs md:text-sm">
              {IPL_TEAMS.map((team) => {
                const uid = selectedTeams[team.id];
                const manager = uid
                  ? (String(uid).startsWith('AI-') ? getAiManagerName(team.id) : managerNames[team.id] || String(uid).slice(0, 6))
                  : TEAM_OWNERS[team.id] || 'Available';
                return (
                  <div key={team.id} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#030712]/30 border border-white/5">
                    <span className="font-extrabold text-yellow-400 tracking-wider font-mono">{team.shortName}</span>
                    <span className="text-slate-300 font-medium truncate max-w-[70%]">{manager}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {IPL_TEAMS.map((team, index) => renderTeamCard(team, index, false))}
        </div>

        <div className="flex flex-col items-center gap-5 py-8 border-t border-white/5">
          <div className={cn("transition-all duration-300", !myConfirmedTeam && draftTeam ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden")}>
            <Button variant="gold" size="xl" className="px-14 text-slate-950 font-black tracking-widest uppercase cursor-pointer" onClick={handleConfirmTeam} disabled={isSubmitting}>{isSubmitting ? 'Locking...' : `Confirm Team`}</Button>
          </div>
          {isHost && myConfirmedTeam && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="fade-in"
            >
              <Button variant="gold" size="xl" disabled={!canStartRetention} onClick={() => startRetention(gameCode!)} className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-extrabold hover:scale-105 hover:shadow-[0_0_30px_rgba(250,204,21,0.5)] transition-all cursor-pointer tracking-widest uppercase px-14 h-14">Retention Round</Button>
            </motion.div>
          )}
          {!isHost && myConfirmedTeam && <p className="text-slate-400 font-bold uppercase tracking-wider text-xs animate-pulse">Waiting for the host to start the retention round...</p>}
        </div>

        {insightTeamId && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md rounded-3xl border border-yellow-500/35 bg-[#051126]/95 backdrop-blur-xl p-6 relative shadow-2xl"
            >
              <button className="absolute top-4 right-4 text-slate-400 hover:text-yellow-400 transition-colors" onClick={() => setInsightTeamId(null)} aria-label="Close team details">
                <X className="w-5 h-5" />
              </button>
              {(() => {
                const team = IPL_TEAMS.find((item) => item.id === insightTeamId);
                const insight = TEAM_INSIGHTS[insightTeamId] || { titles: 0, home: 'Home Ground', captain: 'Captain TBA' };
                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 border-b border-white/5 pb-3">
                      <TeamLogo teamId={team?.id || insightTeamId} logo={(team as any)?.logo} shortName={team?.shortName} size="md" className="bg-white/5 border border-white/10" />
                      <div>
                        <p className="text-2xl font-display font-black text-yellow-300 tracking-wide uppercase leading-none">{team?.name || insightTeamId.toUpperCase()}</p>
                        <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider font-mono">{team?.shortName}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-[#030712]/55 p-4 text-xs md:text-sm space-y-2">
                      <p className="flex justify-between border-b border-white/5 pb-2"><span className="text-slate-400 font-bold uppercase tracking-wider">Captain</span> <span className="font-extrabold text-white">{insight.captain}</span></p>
                      <p className="flex justify-between border-b border-white/5 pb-2"><span className="text-slate-400 font-bold uppercase tracking-wider">Home Stadium</span> <span className="font-extrabold text-white text-right max-w-[60%]">{insight.home}</span></p>
                      <p className="flex justify-between border-b border-white/5 pb-2"><span className="text-slate-400 font-bold uppercase tracking-wider">Titles Won</span> <span className="font-extrabold text-yellow-400 text-base">{insight.titles}</span></p>
                      <p className="flex justify-between"><span className="text-slate-400 font-bold uppercase tracking-wider">Championship Years</span> <span className="font-mono font-bold text-white text-right">{insight.titleYears || '—'}</span></p>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;

