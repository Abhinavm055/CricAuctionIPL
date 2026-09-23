import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { IPL_TEAMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Users, ArrowLeft, Copy, Check, X, Shield, Sparkles, CheckCircle2, Bot, ArrowRight, User, Clock, Crown, Play, Link2, Pencil, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { selectTeam, listenSession, startRetention, resolveHostReconnectTimeout } from '@/lib/sessionService';
import { TeamLogo } from '@/components/TeamLogo';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useUserId } from '@/hooks/useUserId';
import { addDoc, collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';

const TEAM_INSIGHTS: Record<string, { titles: number; titleYears?: string; home: string; captain: string }> = {
  csk: { titles: 5, titleYears: '2010, 2011, 2018, 2021, 2023', home: 'MA Chidambaram Stadium', captain: 'Ruturaj Gaikwad' },
  mi: { titles: 5, titleYears: '2013, 2015, 2017, 2019, 2020', home: 'Wankhede Stadium', captain: 'Hardik Pandya' },
  kkr: { titles: 3, titleYears: '2012, 2014, 2024', home: 'Eden Gardens', captain: 'Ajinkya Rahane' },
  rr: { titles: 1, titleYears: '2008', home: 'Sawai Mansingh Stadium', captain: 'Riyan Parag' },
  srh: { titles: 1, titleYears: '2016', home: 'Rajiv Gandhi International Stadium', captain: 'Pat Cummins' },
  gt: { titles: 1, titleYears: '2022', home: 'Narendra Modi Stadium', captain: 'Shubman Gill' },
  rcb: { titles: 2, titleYears: '2025, 2026', home: 'M Chinnaswamy Stadium', captain: 'Rajat Patidar' },
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

  const userId = useUserId();

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020817] text-white select-none">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-amber-400 border-t-transparent" />
        <p className="font-display tracking-widest text-lg text-amber-400 mt-4 animate-pulse uppercase">ENTERING AUCTION CENTRAL...</p>
      </div>
    );
  }

  const isHost = session?.hostId === userId;
  const isVsAI = session.mode === 'VS_AI';
  const selectedTeams = session.selectedTeams || {};
  const managerNames = session.managerNames || {};
  const myConfirmedTeam = Object.entries(selectedTeams).find(([, uid]) => uid === userId)?.[0];
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

  const handleConfirmTeam = async () => {
    if (!draftTeam || !gameCode) return;
    if (!managerName.trim()) {
      toast({ title: 'Manager Name Required', description: 'Please enter your manager name before selecting a franchise.', variant: 'destructive' });
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
      toast({ title: 'Franchise Locked!', description: 'Seat secured. Prepare for retention & auction.' });
    } catch (error: any) {
      toast({ title: 'Selection Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(gameCode || '');
    setCopied(true);
    toast({ title: 'Room code copied to clipboard' });
    setTimeout(() => setCopied(false), 1500);
  };

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/join/${gameCode || ''}` : '';
  const copyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    toast({ title: 'Invite link copied to clipboard' });
    setTimeout(() => setInviteCopied(false), 1500);
  };

  const currentSelectedTeamObj = IPL_TEAMS.find((t) => t.id === (myConfirmedTeam || draftTeam));

  return (
    <div className={cn(
      "h-screen max-h-screen w-screen overflow-hidden flex flex-col justify-between bg-[#020817] text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950 relative p-3 sm:p-4 lg:p-6",
      isVsAI ? "theme-ai" : "theme-multiplayer"
    )}>
      {/* Stadium Ambient Lighting & Stage Halo (No IPL Images) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-radial-gradient from-[#08152c]/55 via-[#020817] to-[#01040d]" />
        {isVsAI ? (
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[350px] rounded-full bg-cyan-500/10 blur-[140px]" />
        ) : (
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[350px] rounded-full bg-purple-600/10 blur-[140px]" />
        )}
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full bg-blue-600/5 blur-[150px]" />
        <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[150px]" />
        {/* Subtle floor circle */}
        <div className="absolute -bottom-48 left-1/2 -translate-x-1/2 w-[1100px] h-[260px] rounded-full border border-amber-400/15 shadow-[0_0_80px_rgba(251,191,36,0.1)] pointer-events-none" />
      </div>

      {/* TOP HEADER BAR */}
      <header className="relative z-20 w-full flex items-center justify-between shrink-0 mb-2">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="rounded-xl border-white/[0.12] bg-[#09152A]/80 hover:bg-[#09152A] hover:border-amber-400/40 text-slate-300 text-xs font-semibold px-4 h-9 shadow-sm"
        >
          <Link to={isVsAI ? "/" : "/multiplayer"} className="flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
            <span>{isVsAI ? "Exit to Arena" : "Leave Lobby"}</span>
          </Link>
        </Button>

        <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right leading-tight select-none">
          {isVsAI ? (
            <>
              <div>GREAT PLAYERS</div>
              <div>BUILD GREATER STORIES</div>
            </>
          ) : (
            <>
              <div>GREAT TEAMS • RIVALRIES</div>
              <div>AUCTIONS • LEGENDS</div>
            </>
          )}
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <div className="relative z-10 flex-1 flex flex-col justify-between w-full max-w-7xl mx-auto min-h-0">
        {/* ======================= MODE HEADER ======================= */}
        <div className="flex items-center justify-between gap-4 shrink-0 mb-2 sm:mb-3">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-extrabold tracking-widest uppercase mb-1">
              {isVsAI ? (
                <span className="text-cyan-400">AI COMPETITIVE ARENA</span>
              ) : (
                <span className="text-purple-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> MULTIPLAYER ROOM
                </span>
              )}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white uppercase tracking-wider leading-none">
              {isVsAI ? (
                <>AI AUCTION <span className="text-amber-400">MODE</span></>
              ) : (
                <>MULTIPLAYER <span className="text-amber-400">AUCTION LOBBY</span></>
              )}
            </h1>
            <p className="text-slate-400 text-[10px] sm:text-xs font-medium tracking-wide mt-1 uppercase">
              {isVsAI
                ? 'BUILD YOUR SQUAD. OUTSMART THE AI.'
                : 'CLAIM YOUR FRANCHISE SEAT. LIVE ROSTERS SYNC IN REAL-TIME.'}
            </p>
          </div>

          {/* Right Status Controls */}
          {isVsAI ? (
            <div className="px-4 py-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 flex items-center gap-3 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-black uppercase tracking-wider text-cyan-300 leading-none">
                  AI OPPONENTS READY
                </div>
                <div className="text-[10px] text-cyan-400/80 font-medium tracking-wide mt-0.5">
                  9 TEAMS CONTROLLED BY AI
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Room Code Card */}
              <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border border-white/10 bg-[#09152A]/90">
                <div className="text-left">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">ROOM CODE</div>
                  <div className="font-mono font-black text-amber-400 text-sm leading-none">{gameCode}</div>
                </div>
                <button
                  onClick={copyCode}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-amber-400 transition-colors"
                  title="Copy room code"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Invite Link Card */}
              <button
                onClick={copyInviteLink}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/10 bg-[#09152A]/90 hover:border-amber-400/40 text-slate-300 hover:text-white transition-all text-xs font-semibold"
                title="Copy invite link"
              >
                <div className="text-left">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">INVITE LINK</div>
                  <div className="flex items-center gap-1 text-amber-400 font-bold text-xs leading-none">
                    {inviteCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Link2 className="w-3 h-3" />}
                    <span>{inviteCopied ? 'Copied!' : 'Copy Link'}</span>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* ======================= STATUS METRICS / SETUP BAR ======================= */}
        {isVsAI ? (
          /* AI MODE: Manager Setup + Franchise Allocation Card */
          <div className="rounded-2xl border border-white/[0.08] bg-[#09152A]/80 backdrop-blur-xl px-4 sm:px-6 py-2.5 sm:py-3 mb-2 sm:mb-3 shadow-lg flex items-center justify-between gap-6 shrink-0">
            {/* Left: Manager Name Input */}
            <div className="w-full sm:max-w-xs space-y-1">
              <label className="block text-[9px] uppercase tracking-widest text-slate-400 font-bold">
                MANAGER NAME
              </label>
              <div className="relative">
                <input
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  onBlur={() => persistManagerPreference(managerName)}
                  placeholder="Manager Name"
                  className="w-full pl-3 pr-8 py-1.5 rounded-xl bg-[#050B16] border border-white/15 text-white font-bold text-xs focus:outline-none focus:border-amber-400 transition-all"
                />
                <Shield className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              </div>
              <div className="text-[9px] text-slate-500">
                This is how you'll be identified in the auction.
              </div>
            </div>

            {/* Right: Franchise Allocation info */}
            <div className="flex items-center gap-3.5 flex-1 pl-6 border-l border-white/[0.08]">
              <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  FRANCHISE ALLOCATION
                </div>
                <div className="text-[10px] text-slate-400 leading-snug mt-0.5">
                  Select the franchise you want to manage. All remaining 9 teams will be strategically piloted by AI bidders.
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* MULTIPLAYER LOBBY: 4-Column Status Bar (Image 3) */
          <div className="rounded-2xl border border-white/[0.08] bg-[#09152A]/80 backdrop-blur-xl px-4 sm:px-6 py-2.5 sm:py-3 mb-2 sm:mb-3 shadow-lg grid grid-cols-2 sm:grid-cols-4 gap-4 items-center shrink-0">
            {/* 1. Manager Name */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-400 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[8px] sm:text-[9px] uppercase font-bold tracking-widest text-slate-400">MANAGER NAME</div>
                <div className="relative flex items-center">
                  <input
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    onBlur={() => persistManagerPreference(managerName)}
                    placeholder="Enter Name"
                    className="w-full bg-transparent text-xs font-bold text-white focus:outline-none focus:border-b focus:border-amber-400 pr-5"
                  />
                  <Pencil className="w-3 h-3 text-slate-500 absolute right-0 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* 2. Players Joined */}
            <div className="flex items-center gap-3 pl-2 sm:border-l sm:border-white/[0.06]">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[8px] sm:text-[9px] uppercase font-bold tracking-widest text-slate-400">PLAYERS JOINED</div>
                <div className="font-display text-base sm:text-lg font-black text-white leading-none">
                  {confirmedTeamsCount} <span className="text-slate-500 font-sans text-xs font-medium">/ 10</span>
                </div>
              </div>
            </div>

            {/* 3. Status */}
            <div className="flex items-center gap-3 pl-2 sm:border-l sm:border-white/[0.06]">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[8px] sm:text-[9px] uppercase font-bold tracking-widest text-slate-400">STATUS</div>
                <div className="text-xs font-bold text-slate-200 leading-none">
                  {confirmedTeamsCount >= 2 ? 'Ready to Start' : 'Waiting for players'}
                </div>
              </div>
            </div>

            {/* 4. You Are */}
            <div className="flex items-center gap-3 pl-2 sm:border-l sm:border-white/[0.06]">
              <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-400 shrink-0">
                {isHost ? <Crown className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-[8px] sm:text-[9px] uppercase font-bold tracking-widest text-slate-400">YOU ARE</div>
                <div className={cn("text-xs font-black uppercase leading-none", isHost ? "text-amber-400" : "text-slate-200")}>
                  {isHost ? 'Host' : 'Player'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= SECTION HEADING: FRANCHISES ======================= */}
        <div className="flex items-center justify-between mb-1.5 sm:mb-2 shrink-0">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-black text-white uppercase tracking-wider leading-none">
              {isVsAI ? (
                <>CHOOSE YOUR <span className="text-amber-400">FRANCHISE</span></>
              ) : (
                <>AVAILABLE <span className="text-amber-400">FRANCHISES</span></>
              )}
            </h2>
            <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
              {isVsAI
                ? 'SELECT 1 FRANCHISE TO LOCK INTO YOUR MANAGER SEAT'
                : 'Select a franchise to lock in your seat. Each team can be chosen by only one player.'}
            </p>
          </div>

          {!isVsAI && (
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mr-2">TEAMS LEFT</span>
              <span className="font-display text-base font-black text-amber-400">
                {10 - confirmedTeamsCount} <span className="text-slate-500 font-sans text-xs">/ 10</span>
              </span>
            </div>
          )}
        </div>

        {/* ======================= 10 TEAM CARDS (EXACT 2x5 GRID) ======================= */}
        <div className="grid grid-cols-5 gap-2 sm:gap-2.5 lg:gap-3 flex-1 min-h-0">
          {IPL_TEAMS.map((team) => {
            const takenBy = selectedTeams[team.id];
            const isTaken = Boolean(takenBy);
            const isMine = myConfirmedTeam === team.id;
            const isDraft = draftTeam === team.id;
            const isSelected = isMine || (Boolean(isDraft) && !myConfirmedTeam);
            const otherManagerName = managerNames[team.id] || (String(takenBy).startsWith('AI-') ? getAiManagerName(team.id) : 'Player');

            return (
              <button
                key={team.id}
                type="button"
                disabled={Boolean(myConfirmedTeam) || (isTaken && !isMine)}
                onClick={() => {
                  setDraftTeam(team.id);
                }}
                className={cn(
                  'relative rounded-xl border p-2 sm:p-2.5 lg:p-3 text-left flex flex-col justify-between transition-all duration-200 select-none outline-none overflow-hidden min-h-[86px] max-h-[108px] h-full',
                  'bg-[#09152A]/90 backdrop-blur-md shadow-md',
                  isSelected
                    ? 'border-2 border-amber-400 shadow-[0_0_20px_rgba(245,184,46,0.3)] bg-[#0C1A32]'
                    : isTaken && !isMine
                    ? 'border-white/[0.05] bg-[#050B16]/80 opacity-60 cursor-not-allowed'
                    : 'border-white/[0.08] hover:border-amber-400/40 hover:bg-[#0C1A32]/70 cursor-pointer'
                )}
              >
                {/* Top: Circular Team Logo + Names + Checkmark */}
                <div className="flex items-start justify-between gap-1.5 w-full">
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    {/* White circular logo badge */}
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white p-1 shadow-sm shrink-0 flex items-center justify-center overflow-hidden">
                      <img
                        src={team.logo}
                        alt={`${team.name} emblem`}
                        className="w-[85%] h-[85%] object-contain"
                        loading="eager"
                      />
                    </div>
                    {/* Short name + Full name */}
                    <div className="min-w-0">
                      <div className="font-display text-sm sm:text-base font-black text-white tracking-wide leading-none truncate">
                        {team.shortName}
                      </div>
                      <div className="text-[8px] sm:text-[9px] uppercase tracking-wider text-slate-400 font-semibold truncate mt-0.5">
                        {team.name}
                      </div>
                    </div>
                  </div>

                  {/* Gold Checkmark Badge when Selected */}
                  {isSelected && (
                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[9px] sm:text-[10px] font-black shrink-0 shadow-md">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Bottom Strip: Manager / Status details */}
                <div className="w-full border-t border-white/[0.06] pt-1.5 mt-auto">
                  {isVsAI ? (
                    /* AI Mode: Manager vs AI Opponent label */
                    <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
                      <span className={isSelected ? "text-amber-400 font-black" : "text-slate-500"}>
                        MANAGER
                      </span>
                      <span className="text-slate-500">
                        AI OPPONENT
                      </span>
                    </div>
                  ) : (
                    /* Multiplayer Mode: You (Locked), Other Player (Locked), Selecting, or Available */
                    <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
                      {isMine ? (
                        <>
                          <span className="flex items-center gap-1 text-amber-400 font-black truncate max-w-[65%]">
                            <User className="w-3 h-3" />
                            <span>{managerName || 'You'} (You)</span>
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-400 border border-amber-400/30">
                            LOCKED
                          </span>
                        </>
                      ) : isTaken ? (
                        <>
                          <span className="flex items-center gap-1 text-cyan-400 font-bold truncate max-w-[65%]">
                            <User className="w-3 h-3" />
                            <span>{otherManagerName}</span>
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            LOCKED
                          </span>
                        </>
                      ) : isSelected ? (
                        <>
                          <span className="flex items-center gap-1 text-amber-400 font-bold truncate max-w-[65%]">
                            <User className="w-3 h-3" />
                            <span>{managerName || 'You'}</span>
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-400/10 text-amber-300 border border-amber-400/20 animate-pulse">
                            SELECTED
                          </span>
                        </>
                      ) : (
                        <div className="flex items-center gap-1 text-slate-400 font-medium">
                          <PlusCircle className="w-3 h-3 text-slate-500" />
                          <span className="text-[9px] capitalize">Available</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ======================= BOTTOM STICKY ACTION BAR ======================= */}
        <div className="w-full rounded-2xl bg-[#09152A]/90 border border-white/10 backdrop-blur-xl px-4 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between shadow-2xl shrink-0 mt-2 sm:mt-3">
          {isVsAI ? (
            /* AI Mode: Selected team + Manager + Confirm button (Image 1) */
            <>
              {/* Left: Your Selection */}
              <div className="flex items-center gap-3.5">
                {currentSelectedTeamObj ? (
                  <>
                    <div className="w-11 h-11 rounded-xl bg-[#050B16] border border-white/10 p-1 flex items-center justify-center shrink-0 shadow-sm">
                      <img src={currentSelectedTeamObj.logo} alt={currentSelectedTeamObj.name} className="w-[85%] h-[85%] object-contain" />
                    </div>
                    <div>
                      <div className="text-[8px] uppercase tracking-widest text-slate-400 font-bold">YOUR SELECTION</div>
                      <div className="font-display text-lg sm:text-xl font-black text-white tracking-wide uppercase leading-none mt-0.5">
                        {currentSelectedTeamObj.shortName}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-medium mt-0.5 truncate max-w-[200px]">
                        {currentSelectedTeamObj.name}
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">YOUR SELECTION</div>
                    <div className="text-xs font-semibold text-slate-300 mt-0.5">Select a franchise card above to proceed</div>
                  </div>
                )}
              </div>

              {/* Middle: Manager */}
              <div className="hidden md:flex items-center gap-3 border-x border-white/10 px-8 py-1">
                <div className="w-9 h-9 rounded-xl bg-[#050B16] border border-white/10 flex items-center justify-center text-slate-400 shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[8px] uppercase tracking-widest text-slate-400 font-bold">MANAGER</div>
                  <div className="text-xs font-bold text-white tracking-wide mt-0.5">{managerName || 'Manager'}</div>
                </div>
              </div>

              {/* Right: Confirm Button */}
              <div>
                {!myConfirmedTeam ? (
                  <Button
                    onClick={handleConfirmTeam}
                    disabled={!draftTeam || isSubmitting}
                    className="h-10 sm:h-11 px-6 sm:px-8 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(251,191,36,0.35)] transition-all hover:shadow-[0_0_28px_rgba(251,191,36,0.55)]"
                  >
                    {isSubmitting ? "Locking..." : "CONFIRM TEAM →"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => startRetention(gameCode!)}
                    className="h-10 sm:h-11 px-6 sm:px-8 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(251,191,36,0.35)] transition-all hover:shadow-[0_0_28px_rgba(251,191,36,0.55)]"
                  >
                    START RETENTION →
                  </Button>
                )}
              </div>
            </>
          ) : (
            /* Multiplayer Mode: Players Joined stats + Start Auction / Confirm (Image 3) */
            <>
              {/* Left: Players Joined Stat */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-display text-sm sm:text-base font-black text-white uppercase tracking-wider leading-none">
                    {confirmedTeamsCount} OF 10 PLAYERS JOINED
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    Waiting for more players to join and select their franchises.
                  </div>
                </div>
              </div>

              {/* Right: Start Auction or Confirm Button */}
              <div className="text-right">
                {!myConfirmedTeam ? (
                  <Button
                    onClick={handleConfirmTeam}
                    disabled={!draftTeam || isSubmitting}
                    className="h-10 sm:h-11 px-6 sm:px-8 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(251,191,36,0.35)] transition-all"
                  >
                    {isSubmitting ? "Locking..." : "CONFIRM TEAM →"}
                  </Button>
                ) : isHost ? (
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      onClick={() => startRetention(gameCode!)}
                      disabled={!canStartRetention}
                      className={cn(
                        "h-10 sm:h-11 px-6 sm:px-8 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all",
                        canStartRetention
                          ? "bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_0_25px_rgba(251,191,36,0.35)]"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/10"
                      )}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>START AUCTION</span>
                    </Button>
                    <span className="text-[8px] text-slate-500 font-medium">
                      Host can start once minimum 2 players have joined
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#050B16] border border-white/10 text-xs text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Waiting for Host to start auction...</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Team Details Modal */}
      {insightTeamId && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-[#09152A] p-6 relative shadow-2xl"
          >
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              onClick={() => setInsightTeamId(null)}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            {(() => {
              const team = IPL_TEAMS.find((item) => item.id === insightTeamId);
              const insight = TEAM_INSIGHTS[insightTeamId] || { titles: 0, home: 'Home Ground', captain: 'Captain TBA' };
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-3.5 border-b border-white/[0.08] pb-3">
                    <div className="w-12 h-12 rounded-full bg-white p-1.5 shadow-md flex items-center justify-center shrink-0">
                      <img src={team?.logo} alt={team?.name} className="w-[85%] h-[85%] object-contain" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-display font-black text-amber-400 tracking-wide uppercase leading-none">
                        {team?.name || insightTeamId.toUpperCase()}
                      </h3>
                      <p className="text-xs text-slate-400 uppercase font-mono font-bold mt-1">
                        {team?.shortName}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-[#050B16] p-4 text-xs space-y-2.5">
                    <div className="flex justify-between border-b border-white/[0.06] pb-2">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">Captain</span>
                      <span className="font-bold text-white">{insight.captain}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/[0.06] pb-2">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">Home Stadium</span>
                      <span className="font-bold text-white text-right max-w-[60%]">{insight.home}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/[0.06] pb-2">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">Titles Won</span>
                      <span className="font-bold text-amber-400 font-mono text-sm">{insight.titles}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">Championship Years</span>
                      <span className="font-mono text-white text-right">{insight.titleYears || 'None'}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Lobby;
