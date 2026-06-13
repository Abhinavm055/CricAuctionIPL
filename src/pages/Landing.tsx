import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { generateGameCode } from '@/lib/constants';
import { Bot, Users, Volume2, VolumeX, Menu, Trophy, PlayCircle, Swords, ListChecks, Gavel } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const howItWorksRef = useRef<HTMLElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [counts, setCounts] = useState({ liveAuctions: 0, playersOnline: 0 });
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

  const stats = useMemo(() => ({ liveAuctions: 12, playersOnline: 68 }), []);

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
      const sessionData = sessionSnap.data() as any;
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
    const audio = new Audio('/crowd.mp3');
    audio.volume = 0.03;
    audio.loop = true;
    audioRef.current = audio;

    audio.play().catch(() => {
      setIsMuted(true);
    });

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const duration = 1100;
    const stepTime = 25;
    const steps = duration / stepTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep += 1;
      const progress = Math.min(currentStep / steps, 1);
      setCounts({
        liveAuctions: Math.floor(stats.liveAuctions * progress),
        playersOnline: Math.floor(stats.playersOnline * progress),
      });
      if (progress === 1) clearInterval(timer);
    }, stepTime);

    return () => clearInterval(timer);
  }, [stats]);

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

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextMuted = !isMuted;
    audio.muted = nextMuted;
    if (!nextMuted) {
      audio.play().catch(() => setIsMuted(true));
    }
    setIsMuted(nextMuted);
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setShowAuthModal(false);
    } catch (error: any) {
      setAuthError(error.message || 'Google login failed');
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
    } catch (error: any) {
      setAuthError(error.message || 'Authentication failed');
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
    { key: 'multiplayer' as const, label: 'Play Multiplayer', icon: Users, onClick: () => openRules('multiplayer') },
    { key: 'ai' as const, label: 'VS AI', icon: Bot, onClick: () => openRules('ai') },
    { key: 'create' as const, label: 'Create Lobby', icon: ListChecks, onClick: () => openRules('create') },
    { key: 'start' as const, label: 'Start Auction', icon: Gavel, onClick: () => openRules('start') },
    { key: 'squad' as const, label: 'Build Squad', icon: Trophy, onClick: () => openRules('squad') },
  ];

  return (
    <div className="landing-page min-h-screen relative flex flex-col overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[#020617]/65 backdrop-blur-[1.5px] z-0" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="stadium-ambient stadium-ambient-cyan -top-40 -left-40 w-[600px] h-[600px]" />
        <div className="stadium-ambient stadium-ambient-gold -bottom-40 -right-40 w-[700px] h-[700px]" />
      </div>

      <header className="relative z-20 flex justify-between items-center px-8 py-4 bg-[#020617]/40 backdrop-blur-md border-b border-white/5 shadow-lg">
        <h1 className="text-yellow-400 text-xl font-display font-black tracking-widest uppercase">
          CRIC<span className="text-[#00CFFF]">AUCTION</span>IPL
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

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-10 w-full max-w-6xl mx-auto">
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
          className="text-center mb-12"
        >
          <h2 className="font-display text-6xl md:text-8xl text-white mb-2 tracking-wide font-extrabold">
            IPL <span className="text-yellow-400 text-shadow-glow glow-title">AUCTION</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-200 to-[#00CFFF] text-5xl md:text-7xl font-black mt-1 uppercase tracking-widest">SIMULATOR</span>
          </h2>
          <div className="f1-accent-line w-48 mx-auto mt-4 rounded-full" />
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          className="grid md:grid-cols-2 gap-6 w-full max-w-5xl"
        >
          <article className="group p-8 rounded-3xl border border-white/10 bg-[#0f182c]/40 backdrop-blur-lg hover:border-yellow-500/40 hover:shadow-[0_12px_40px_rgba(251,191,36,0.15)] transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300">
                <Users className="w-7 h-7 text-yellow-400" />
              </div>
              <h3 className="font-display text-3xl mb-3 text-white uppercase tracking-wide">Multiplayer Room</h3>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">Host or join a live session and bid against friends in real-time.</p>
            </div>
            <Button
              variant="gold"
              size="lg"
              onClick={handlePlayMultiplayer}
              className="w-full text-slate-950 font-bold hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-all duration-300"
            >
              Play Multiplayer
            </Button>
          </article>

          <article className="group p-8 rounded-3xl border border-white/10 bg-[#0f182c]/40 backdrop-blur-lg hover:border-[#00CFFF]/45 hover:shadow-[0_12px_40px_rgba(0,207,255,0.15)] transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-cyan-400/10 border border-cyan-400/25 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300">
                <Bot className="w-7 h-7 text-[#00CFFF]" />
              </div>
              <h3 className="font-display text-3xl mb-3 text-white uppercase tracking-wide">VS Computer AI</h3>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">1 human team vs 9 AI teams with personality-driven bidding profiles.</p>
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
        </motion.section>

        <motion.section 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="flex justify-center gap-8 md:gap-12 mt-12 text-[#FFD700] text-sm md:text-base font-semibold"
        >
          <div className="flex items-center gap-2 bg-[#020714]/65 border border-white/5 px-4 py-2 rounded-full backdrop-blur-sm">🔥 <span>Live Auctions: {counts.liveAuctions}</span></div>
          <div className="flex items-center gap-2 bg-[#020714]/65 border border-white/5 px-4 py-2 rounded-full backdrop-blur-sm">👥 <span>Players Online: {counts.playersOnline}</span></div>
        </motion.section>

        <motion.section 
          ref={howItWorksRef}
          initial={{ opacity: 0, y: 20 }}
          animate={showHowItWorks ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-5 mt-16 text-center w-full max-w-6xl relative z-10"
        >
          {actionButtons.map(({ key, label, icon: Icon, onClick }) => (
            <Button
              key={key}
              variant="broadcast"
              onClick={onClick}
              className="h-auto min-h-24 w-full flex-col gap-2 rounded-2xl border border-white/5 bg-[#0f182c]/40 backdrop-blur-md text-[#FFD700] hover:border-yellow-400/40 hover:bg-white/5 transition-all duration-300 hover:scale-105 py-4"
            >
              <Icon className="h-5 w-5 text-yellow-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{label}</span>
            </Button>
          ))}
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
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <h4 className="mb-1 text-base font-semibold text-[#FFD700]">Rules</h4>
              <p>Select a franchise, respect purse limits, and build a valid squad while competing in live bidding rounds.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <h4 className="mb-1 text-base font-semibold text-[#FFD700]">RTM Rules</h4>
              <p>Each team gets limited RTM cards. RTM can only be used on eligible former players after a winning bid is confirmed.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <h4 className="mb-1 text-base font-semibold text-[#FFD700]">Squad Rules</h4>
              <p>Maintain squad-size and overseas constraints. Balanced roles improve long-term auction performance.</p>
            </div>
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

      <button
        type="button"
        onClick={toggleMute}
        className="fixed bottom-5 right-20 z-50 w-10 h-10 rounded-full bg-[#0f172a] border border-primary/70 text-primary shadow-lg flex items-center justify-center hover:shadow-[0_0_14px_rgba(251,191,36,0.75)] transition-all"
        aria-label={isMuted ? 'Unmute crowd ambience' : 'Mute crowd ambience'}
      >
        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

    </div>
  );
};

export default Landing;
