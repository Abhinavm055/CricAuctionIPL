import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { generateGameCode } from '@/lib/constants';
import { Bot, Users, Menu, Trophy, PlayCircle, Swords, ListChecks, Gavel } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { createSession, joinSession } from '@/lib/sessionService';
import { auth, db } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';

const getUserId = () => {
  const existing = localStorage.getItem('uid');
  if (existing) return existing;
  const id = `user-${Math.random().toString(36).slice(2, 9)}`;
  localStorage.setItem('uid', id);
  return id;
};

const Landing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const howItWorksRef = useRef<HTMLElement | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rulesMode, setRulesMode] = useState<'multiplayer' | 'ai' | 'create' | 'start' | 'squad'>('multiplayer');

  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authError, setAuthError] = useState('');
  const [resumeSession, setResumeSession] = useState<{ gameCode: string; auctionStage: string } | null>(null);
  const [joiningInvite, setJoiningInvite] = useState(false);
  const [invalidRoomCode, setInvalidRoomCode] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setResumeSession(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const joinCode = String(searchParams.get('join') || '').trim().toUpperCase();
    if (!joinCode) return;
    setInvalidRoomCode(false);
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (joiningInvite) return;

    const joinViaInvite = async () => {
      try {
        setJoiningInvite(true);
        const uid = getUserId();
        await joinSession(joinCode, uid);
        navigate(`/lobby/${joinCode}`, { replace: true });
      } catch {
        setJoiningInvite(false);
        setInvalidRoomCode(true);
      }
    };
    joinViaInvite();
  }, [searchParams, user, navigate, joiningInvite]);

  useEffect(() => {
    if (!user) return;
    const loadResume = async () => {
      const q = query(collection(db, 'sessions'), where('ownerUid', '==', user.uid), where('active', '==', true), limit(1));
      const snap = await getDocs(q);
      const record = snap.docs[0]?.data();
      if (!record?.gameCode) return;
      const gameCode = String(record.gameCode);
      const sessionSnap = await getDoc(doc(db, 'sessions', gameCode));
      if (!sessionSnap.exists()) return;
      const sessionData = sessionSnap.data() as { phase?: string; auctionQueue?: string[]; queueIndex?: number };
      const phase = String(sessionData?.phase || '');
      const queue = (sessionData?.auctionQueue || []) as string[];
      const queueIndex = Number(sessionData?.queueIndex ?? -1);
      const notCompleted = phase === 'AUCTION' && !(queue.length > 0 && queueIndex >= queue.length);
      const isActiveAuction = notCompleted;
      if (!isActiveAuction) {
        setResumeSession(null);
        return;
      }
      setResumeSession({ gameCode, auctionStage: String(record.auctionStage || 'retention') });
    };

    loadResume();
  }, [user]);

  useEffect(() => {
    const section = howItWorksRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowHowItWorks(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setShowAuthModal(false);
    } catch (error) {
      const err = error as Error;
      setAuthError(err.message || 'Google login failed');
    }
  };

  const handleEmailAuth = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError('');
    try {
      if (isRegisterMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setShowAuthModal(false);
      setEmail('');
      setPassword('');
    } catch (error) {
      const err = error as Error;
      setAuthError(err.message || 'Authentication failed');
    }
  };

  const handlePlayMultiplayer = () => navigate('/multiplayer');

  const handlePlayWithAI = async () => {
    const code = generateGameCode();
    const userId = getUserId();
    await createSession(code, userId, 'VS_AI');
    navigate(`/lobby/${code}?host=true&ai=true`);
  };

  const openRules = (mode: 'multiplayer' | 'ai' | 'create' | 'start' | 'squad') => {
    setRulesMode(mode);
    setRulesModalOpen(true);
  };

  const actionButtons = [
    { key: 'multiplayer' as const, label: 'Play Multiplayer', icon: Users, onClick: () => openRules('multiplayer'), description: 'Host or join live auction rooms with friends.' },
    { key: 'ai' as const, label: 'VS AI', icon: Bot, onClick: () => openRules('ai'), description: 'Challenge intelligent AI teams with dynamic bidding.' },
    { key: 'create' as const, label: 'Create Lobby', icon: ListChecks, onClick: () => openRules('create'), description: 'Configure teams, purse limits and auction settings.' },
    { key: 'start' as const, label: 'Start Auction', icon: Gavel, onClick: () => openRules('start'), description: 'Launch the live bidding experience.' },
    { key: 'squad' as const, label: 'Build Squad', icon: Trophy, onClick: () => openRules('squad'), description: 'Review squad balance, strategy and team composition.' },
  ];

  return (
    <div className="landing-page min-h-screen relative flex flex-col overflow-hidden bg-slate-950">
      <div className="absolute inset-0 z-0" style={{ backgroundColor: "rgba(0,0,0,0.45)" }} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="stadium-ambient stadium-ambient-cyan -top-40 -left-40 w-[600px] h-[600px]" />
        <div className="stadium-ambient stadium-ambient-gold -bottom-40 -right-40 w-[700px] h-[700px]" />
      </div>

      <header className="relative z-20 flex justify-between items-center px-8 py-4 bg-[#020617]/40 backdrop-blur-md border-b border-white/5 shadow-lg">
        <h1 className="text-xl font-display font-black tracking-widest uppercase select-none">
          <span className="text-[#22D3EE]">CRIC</span>
          <span className="text-[#2DD4BF]">AUCTION</span>
          <span className="text-[#22D3EE]">IPL</span>
        </h1>

        <div className="md:hidden flex items-center">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-[#020617]/95 border-white/10 p-6 flex flex-col gap-6 pt-12 backdrop-blur-xl">
              <SheetHeader className="hidden">
                <SheetTitle className="text-yellow-400">Menu</SheetTitle>
              </SheetHeader>
              <Link to="/leaderboard" className="text-xl font-display tracking-widest text-gray-300 hover:text-yellow-400 transition-colors">Leaderboard</Link>
              <Link to="/feedback" className="text-xl font-display tracking-widest text-gray-300 hover:text-yellow-400 transition-colors">Feedback</Link>
              {user ? (
                <>
                  <button onClick={() => navigate('/profile')} className="block text-left text-xl font-display tracking-widest text-gray-300 hover:text-yellow-400 transition-colors">Profile</button>
                  <button onClick={async () => {
                    await signOut(auth);
                    localStorage.removeItem('managerName');
                  }} className="block text-left text-xl font-display tracking-widest text-red-400 mt-auto">Logout</button>
                </>
              ) : (
                <button onClick={() => setShowAuthModal(true)} className="block text-left text-xl font-display tracking-widest text-yellow-500 hover:text-yellow-400 transition-colors">Login</button>
              )}
            </SheetContent>
          </Sheet>
        </div>

        <nav className="hidden md:flex gap-6 text-gray-300 items-center text-sm md:text-base">
          <Link to="/leaderboard" className="hover:text-yellow-400 transition-colors font-semibold">Leaderboard</Link>
          <Link to="/feedback" className="hover:text-yellow-400 transition-colors font-semibold">Feedback</Link>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className="flex items-center gap-2 hover:text-yellow-400 transition-colors font-semibold"
              >
                👤 {user.displayName || user.email?.split('@')[0] || 'Profile'}
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-44 bg-[#0f172ad0] backdrop-blur-md rounded-lg shadow-lg border border-white/10 overflow-hidden">
                  <button onClick={() => navigate('/profile')} className="block w-full text-left px-4 py-2 hover:bg-white/5">Profile</button>
                  <button onClick={() => navigate('/profile')} className="block w-full text-left px-4 py-2 hover:bg-white/5">Statistics</button>
                  <button
                    onClick={async () => {
                      await signOut(auth);
                      localStorage.removeItem('managerName');
                      setShowProfileMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-white/5 text-red-300"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="hover:text-yellow-400 transition-colors font-semibold">Login</button>
          )}
        </nav>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-start px-6 pt-2 md:pt-4 pb-8 w-full max-w-6xl mx-auto">
        {invalidRoomCode && (
          <div className="mb-4 text-red-400 font-semibold bg-red-950/40 border border-red-500/30 px-4 py-2 rounded-xl backdrop-blur-md">Invalid Room Code</div>
        )}
        {resumeSession && (
          <div className="mb-5 rounded-xl border border-yellow-500/30 bg-[#0f172a]/80 backdrop-blur-md px-4 py-3 text-sm flex items-center shadow-lg">
            <span className="text-slate-300">Resume Active Auction?</span>
            <button
              onClick={() => navigate(`/lobby/${resumeSession.gameCode}`)}
              className="ml-3 text-yellow-400 hover:text-yellow-300 font-bold underline decoration-yellow-400/30 hover:decoration-yellow-300 underline-offset-4"
            >
              Continue {resumeSession.gameCode}
            </button>
          </div>
        )}

        <motion.section 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex justify-center mb-4 -mt-4 md:-mt-8"
        >
          <img
            src="/logo.png"
            alt="CAIPL Logo"
            className="hero-logo"
          />
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          className="grid md:grid-cols-3 gap-6 w-full max-w-6xl"
        >
          <article className="group p-5 md:p-6 rounded-2xl border border-white/10 bg-[#0f182c]/40 backdrop-blur-lg hover:border-[#8B5CF6]/40 hover:shadow-[0_12px_40px_rgba(168,85,247,0.25)] transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/10 border border-[#A855F7]/25 flex items-center justify-center mb-4 group-hover:scale-105 group-hover:border-[#A855F7]/50 group-hover:shadow-[0_0_20px_rgba(124,58,237,0.3)] transition-all duration-300">
                <Users className="w-6 h-6 text-[#A855F7]" />
              </div>
              <h3 className="font-display text-2xl mb-4 text-white uppercase tracking-wide">Multiplayer Room</h3>
            </div>
            <Button
              size="lg"
              onClick={handlePlayMultiplayer}
              className="w-full btn-multiplayer-purple"
            >
              Play Multiplayer
            </Button>
          </article>

          <article className="group p-5 md:p-6 rounded-2xl border border-white/10 bg-[#0f182c]/40 backdrop-blur-lg hover:border-[#00CFFF]/45 hover:shadow-[0_12px_40px_rgba(0,207,255,0.15)] transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-400/10 border border-cyan-400/25 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                <Bot className="w-6 h-6 text-[#00CFFF]" />
              </div>
              <h3 className="font-display text-2xl mb-4 text-white uppercase tracking-wide">VS Computer AI</h3>
            </div>
            <Button
              variant="default"
              size="lg"
              onClick={handlePlayWithAI}
              className="w-full text-slate-950 font-bold hover:shadow-[0_0_20px_rgba(0,207,255,0.4)] transition-all duration-300"
            >
              Play VS AI
            </Button>
          </article>

          <article className="group p-5 md:p-6 rounded-2xl border border-white/10 bg-[#0f182c]/40 backdrop-blur-lg hover:border-emerald-500/40 hover:shadow-[0_12px_40px_rgba(16,185,129,0.15)] transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-400/10 border border-emerald-400/25 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                <Trophy className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-display text-2xl mb-4 text-white uppercase tracking-wide">Tournament Mode</h3>
            </div>
            <Button
              size="lg"
              onClick={() => navigate('/tournament')}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:brightness-110 transition-all duration-300"
            >
              Play Tournament
            </Button>
          </article>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-5 mt-6 text-center w-full max-w-6xl relative z-10"
        >
          {actionButtons.map(({ key, label, icon: Icon, onClick, description }) => (
            <Tooltip key={key} delayDuration={200}>
              <TooltipTrigger asChild>
                <Button
                  variant="broadcast"
                  onClick={onClick}
                  className="h-auto min-h-24 w-full flex-col gap-2 rounded-2xl border border-white/5 bg-[#0f182c]/40 backdrop-blur-md text-[#FFD700] hover:border-yellow-400/40 hover:bg-white/5 transition-all duration-300 hover:scale-105 py-4"
                >
                  <Icon className="h-5 w-5 text-yellow-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#0b1329] border border-yellow-500/30 text-slate-200 text-xs py-2 px-3 rounded-lg shadow-xl max-w-[200px] text-center">
                {description}
              </TooltipContent>
            </Tooltip>
          ))}
        </motion.section>

        <motion.section
          ref={howItWorksRef}
          initial={{ opacity: 0, y: 30 }}
          animate={showHowItWorks ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="w-full max-w-6xl mt-24 mb-12 relative z-10"
        >
          <div className="text-center mb-10">
            <h3 className="font-display text-4xl text-white uppercase tracking-wider font-extrabold">
              How It <span className="text-yellow-400 text-shadow-glow">Works</span>
            </h3>
            <p className="text-sm text-slate-400 mt-2">Follow these 5 simple steps to conduct your premier IPL auction and lead your franchise to victory</p>
            <div className="w-24 h-1 bg-yellow-400 mx-auto mt-4 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
            {/* Horizontal connection line on desktop */}
            <div className="hidden md:block absolute top-[44px] left-[10%] right-[10%] h-[2px] bg-gradient-to-r from-yellow-400/20 via-cyan-400/20 to-emerald-400/20 z-0" />

            {[
              { step: '01', title: 'Choose Mode', desc: 'Select Multiplayer Room, VS Computer AI, or the local Tournament beta mode.', color: 'border-yellow-500/30 text-yellow-400 bg-yellow-400/5' },
              { step: '02', title: 'Configure Teams', desc: 'Set budget limits (₹120 Cr), customize rosters, and assign human/AI owners.', color: 'border-amber-500/30 text-amber-400 bg-amber-400/5' },
              { step: '03', title: 'Start Auction', desc: 'Launch the live bidding engine. Bid in real-time and utilize RTM strategy.', color: 'border-cyan-500/30 text-[#00CFFF] bg-cyan-400/5' },
              { step: '04', title: 'Build Your Squad', desc: 'Construct your playing XI meeting the 8 overseas and role constraint rules.', color: 'border-teal-500/30 text-teal-400 bg-teal-400/5' },
              { step: '05', title: 'Win Tournament', desc: 'Generate fixtures, track the standings table, and lift the coveted trophy.', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-400/5' }
            ].map((s, idx) => (
              <div
                key={idx}
                className="relative z-10 flex flex-col items-center text-center p-6 rounded-2xl border border-white/5 bg-[#0f182c]/40 backdrop-blur-md hover:border-white/10 transition-all duration-300"
              >
                {/* Step bubble */}
                <div className={`w-14 h-14 rounded-full border flex items-center justify-center font-display font-black text-lg mb-4 shadow-lg ${s.color}`}>
                  {s.step}
                </div>
                <h4 className="font-display text-base font-bold text-white uppercase tracking-wider mb-2">{s.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>
      </main>

      <Dialog open={rulesModalOpen} onOpenChange={setRulesModalOpen}>
        <DialogContent className="max-w-2xl border border-[#FFD70055] bg-[#061328f2] text-white backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl text-[#FFD700]">
              {rulesMode === 'multiplayer' && 'Play Multiplayer'}
              {rulesMode === 'ai' && 'VS AI'}
              {rulesMode === 'create' && 'Create Lobby'}
              {rulesMode === 'start' && 'Start Auction'}
              {rulesMode === 'squad' && 'Build Squad'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed">
            {rulesMode === 'multiplayer' && (
              <>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-[#FFD700]">Room Hosting</h4>
                  <p className="text-slate-300">Host a multiplayer room and share the game code with up to 9 other players to join as active franchise owners.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-[#FFD700]">Real-Time Sync</h4>
                  <p className="text-slate-300">Bids are synchronized instantly. Watch the countdown timer closely, as bids reset the timer to ensure everyone has a chance to respond.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-[#FFD700]">RTM Cards</h4>
                  <p className="text-slate-300">Franchises can activate Right-To-Match (RTM) on their former players once the final hammer price is reached.</p>
                </div>
              </>
            )}
            {rulesMode === 'ai' && (
              <>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-[#00CFFF]">AI Personalities</h4>
                  <p className="text-slate-300">Challenge 9 distinct computer-controlled teams, each operating on personality-driven bidding profiles (Aggressive, Analytical, Budget-Saver, or Star-Chaser).</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-[#00CFFF]">Speed Play</h4>
                  <p className="text-slate-300">Enjoy instant, fluid bidding actions without waiting for network clients. Perfect for testing team strategies quickly.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-[#00CFFF]">Intelligent RTM</h4>
                  <p className="text-slate-300">AI franchises will dynamically calculate whether to execute their RTM options based on player valuation and remaining budget.</p>
                </div>
              </>
            )}
            {rulesMode === 'create' && (
              <>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-yellow-400">Lobby Settings</h4>
                  <p className="text-slate-300">Configure core parameters of the auction including team purse size (default: ₹120 Crore), squad limits (18-25 players), and minimum players count.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-yellow-400">Custom Franchises</h4>
                  <p className="text-slate-300">Assign franchise names and colors. Choose which teams are owned by active human managers and which are managed by computer AI profiles.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-yellow-400">Pool Initialization</h4>
                  <p className="text-slate-300">Choose between the full player database or set custom player retention tags before the auction begins.</p>
                </div>
              </>
            )}
            {rulesMode === 'start' && (
              <>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-yellow-400">Auction Flow</h4>
                  <p className="text-slate-300">The auction progresses set by set (Marquee, Batsmen, Bowlers, All-rounders, Wicketkeepers). Each player will be put up for bidding in turn.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-yellow-400">Hammer & Sold</h4>
                  <p className="text-slate-300">When the bidding stops, the host triggers the hammer action. A countdown will sound, after which the player is declared SOLD or UNSOLD.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-yellow-400">Accelerated Round</h4>
                  <p className="text-slate-300">At the end of standard sets, unsold players enter the Accelerated Round where teams nominate players to bid on at base price discount.</p>
                </div>
              </>
            )}
            {rulesMode === 'squad' && (
              <>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-yellow-400">Squad Size Limits</h4>
                  <p className="text-slate-300">A complete team must consist of a minimum of 18 players and a maximum of 25 players to complete the league requirements.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-yellow-400">Overseas Cap</h4>
                  <p className="text-slate-300">Strictly adhere to the league roster rule: no more than 8 overseas (non-Indian) players can be registered in your 25-man squad.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <h4 className="mb-1 text-base font-semibold text-yellow-400">Required Playing XI Roles</h4>
                  <p className="text-slate-300">Ensure role balance for a valid lineup: must include at least 1 wicketkeeper, 3-5 batsmen, 3-5 bowlers, and 1-3 all-rounders in your squad.</p>
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              {rulesMode === 'multiplayer' && <Button variant="gold" onClick={handlePlayMultiplayer}><PlayCircle className="h-4 w-4" /> Continue</Button>}
              {rulesMode === 'ai' && <Button variant="gold" onClick={handlePlayWithAI}><Swords className="h-4 w-4" /> Continue</Button>}
              {rulesMode !== 'multiplayer' && rulesMode !== 'ai' && <Button variant="gold" onClick={() => setRulesModalOpen(false)}>Got it</Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showAuthModal && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-yellow-400/30 bg-[#0f172a] p-5">
            <h3 className="font-display text-3xl text-primary mb-4">LOGIN</h3>
            <form onSubmit={handleEmailAuth} className="space-y-3 mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full rounded-lg bg-[#111b31] border border-white/15 px-3 py-2 focus:outline-none focus:border-yellow-400"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full rounded-lg bg-[#111b31] border border-white/15 px-3 py-2 focus:outline-none focus:border-yellow-400"
              />
              <Button type="submit" variant="gold" className="w-full">
                {isRegisterMode ? 'Create Account' : 'Login'}
              </Button>
            </form>

            <Button onClick={handleGoogleLogin} variant="outline" className="w-full mb-3">Sign in with Google</Button>

            <div className="flex justify-between items-center text-xs text-gray-400">
              <button onClick={() => setIsRegisterMode((prev) => !prev)} className="hover:text-yellow-400">
                {isRegisterMode ? 'Already have an account? Login' : 'New here? Create account'}
              </button>
              <button onClick={() => setShowAuthModal(false)} className="hover:text-yellow-400">Close</button>
            </div>

            {authError && <p className="text-red-300 text-xs mt-2">{authError}</p>}
          </div>
        </div>
      )}



    </div>
  );
};

export default Landing;
