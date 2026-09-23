import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { generateGameCode, IPL_TEAMS } from '@/lib/constants';
import auctionRoomArenaImg from '@/assets/auction-room-10teams.png';
import {
  Bot,
  Users,
  Menu,
  Trophy,
  PlayCircle,
  Swords,
  Gavel,
  Lock,
  User,
  ShieldCheck,
  Settings,
  Zap,
  Gamepad2,
  ArrowRight,
  Play,
  Quote,
  X,
  Sparkles,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createSession, joinSession } from '@/lib/sessionService';
import { useAdmin } from '@/contexts/AdminContext';
import { auth, db } from '@/lib/firebase';
import { useUserId } from '@/hooks/useUserId';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';

const GithubIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

const TEAM_BANNERS = [
  // 5 Left Wall Banners
  { id: 'super_kings', name: 'SUPER KINGS', left: '0.2%', top: '11%', width: '7.2%', height: '29%', color: 'rgba(250, 204, 21, 0.85)', glow: 'shadow-[0_0_35px_rgba(250,204,21,0.95)]' },
  { id: 'indians', name: 'INDIANS', left: '7.6%', top: '15%', width: '7.8%', height: '27%', color: 'rgba(0, 102, 204, 0.85)', glow: 'shadow-[0_0_35px_rgba(0,102,204,0.95)]' },
  { id: 'royal_challengers', name: 'ROYAL CHALLENGERS', left: '18.2%', top: '21.5%', width: '7.3%', height: '24.5%', color: 'rgba(236, 28, 36, 0.85)', glow: 'shadow-[0_0_35px_rgba(236,28,36,0.95)]' },
  { id: 'knight_riders', name: 'KNIGHT RIDERS', left: '27.8%', top: '25.5%', width: '7%', height: '22.5%', color: 'rgba(139, 92, 246, 0.85)', glow: 'shadow-[0_0_35px_rgba(139,92,246,0.95)]' },
  { id: 'capitals', name: 'CAPITALS', left: '34.8%', top: '27%', width: '6.4%', height: '21.5%', color: 'rgba(14, 165, 233, 0.85)', glow: 'shadow-[0_0_35px_rgba(14,165,233,0.95)]' },

  // 5 Right Wall Banners
  { id: 'kings', name: 'KINGS', left: '60.2%', top: '27%', width: '6.3%', height: '21.5%', color: 'rgba(221, 31, 45, 0.85)', glow: 'shadow-[0_0_35px_rgba(221,31,45,0.95)]' },
  { id: 'royals', name: 'ROYALS', left: '66.5%', top: '25.5%', width: '7%', height: '22.5%', color: 'rgba(234, 26, 133, 0.85)', glow: 'shadow-[0_0_35px_rgba(234,26,133,0.95)]' },
  { id: 'sunrisers', name: 'SUNRISERS', left: '76.2%', top: '21.5%', width: '7.6%', height: '24.5%', color: 'rgba(242, 101, 34, 0.85)', glow: 'shadow-[0_0_35px_rgba(242,101,34,0.95)]' },
  { id: 'titans', name: 'TITANS', left: '86.5%', top: '15%', width: '7.7%', height: '27%', color: 'rgba(6, 182, 212, 0.85)', glow: 'shadow-[0_0_35px_rgba(6,182,212,0.95)]' },
  { id: 'super_giants', name: 'SUPER GIANTS', left: '94.5%', top: '11%', width: '5.5%', height: '29%', color: 'rgba(56, 189, 248, 0.85)', glow: 'shadow-[0_0_35px_rgba(56,189,248,0.95)]' },
];

const Landing = () => {
  const navigate = useNavigate();
  const userId = useUserId();
  const [searchParams] = useSearchParams();
  const heroRef = useRef<HTMLElement | null>(null);
  const howItWorksRef = useRef<HTMLElement | null>(null);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const { isAdmin } = useAdmin();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authError, setAuthError] = useState('');
  const [resumeSession, setResumeSession] = useState<{ gameCode: string; auctionStage: string } | null>(null);
  const [joiningInvite, setJoiningInvite] = useState(false);
  const [invalidRoomCode, setInvalidRoomCode] = useState(false);
  const [auctionStarted, setAuctionStarted] = useState(false);

  // Interactive auction room states
  const [hoveredBanner, setHoveredBanner] = useState<string | null>(null);
  const [isGavelHovered, setIsGavelHovered] = useState(false);
  const [gavelClicked, setGavelClicked] = useState(false);

  // Mouse Parallax Physics for Auction Room
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothRotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), { damping: 25, stiffness: 120 });
  const smoothRotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [5, -5]), { damping: 25, stiffness: 120 });

  // Camera zoom into podium on scroll
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const cameraScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const cameraY = useTransform(scrollYProgress, [0, 1], [0, 30]);

  // Rules dialog
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rulesMode, setRulesMode] = useState<'multiplayer' | 'ai' | 'create' | 'start' | 'squad'>('multiplayer');

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleHeroMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

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
        await joinSession(joinCode, userId);
        navigate(`/lobby/${joinCode}`, { replace: true });
      } catch (err: any) {
        setJoiningInvite(false);
        if (err?.message === 'AUCTION_ALREADY_STARTED') {
          setAuctionStarted(true);
        } else {
          setInvalidRoomCode(true);
        }
      }
    };
    joinViaInvite();
  }, [searchParams, user, navigate, joiningInvite, userId]);

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
    await createSession(code, userId, 'VS_AI');
    navigate(`/lobby/${code}?host=true&ai=true`);
  };

  const openRules = (mode: 'multiplayer' | 'ai' | 'create' | 'start' | 'squad') => {
    setRulesMode(mode);
    setRulesModalOpen(true);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGavelClick = () => {
    setGavelClicked(true);
    setTimeout(() => {
      setGavelClicked(false);
      scrollToSection('features');
    }, 400);
  };

  if (auctionStarted) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020617] px-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30">
          <Lock className="h-10 w-10 text-red-400" />
        </div>
        <h1 className="font-display text-4xl font-black text-white uppercase tracking-wide mb-4">
          Auction Already Started
        </h1>
        <p className="text-slate-400 text-base max-w-md leading-relaxed mb-2">
          This auction has already begun and is no longer accepting new participants.
        </p>
        <p className="text-slate-500 text-sm max-w-md leading-relaxed mb-8">
          Please create a new auction or join another available room.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            disabled
            className="opacity-40 cursor-not-allowed px-8 h-12 text-sm font-bold tracking-wider uppercase"
          >
            Join Room (Closed)
          </Button>
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            className="px-8 h-12 text-sm font-bold tracking-wider uppercase border-white/20 hover:border-amber-400/40 hover:text-amber-400"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col overflow-x-hidden bg-[#020614] text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Cinematic dark stadium ambient glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-radial-gradient from-[#061226]/50 via-[#020614] to-[#01030a]" />
        <div className="absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full bg-cyan-500/10 blur-[140px]" />
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[150px]" />
        <div className="absolute top-1/2 right-1/4 w-[600px] h-[400px] rounded-full bg-blue-600/5 blur-[160px]" />
      </div>

      {/* ===================== HEADER ===================== */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#020614]/85 border-b border-white/[0.07] transition-all">
        <div className="max-w-7xl mx-auto px-6 md:px-10 h-20 flex items-center justify-between">
          {/* Brand Logo with New CricAuctionIPL Asset */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/logo-horizontal.png"
              alt="CRICAUCTIONIPL"
              className="h-8 md:h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-9 text-sm font-medium text-slate-300">
            <button
              onClick={() => scrollToSection('hero')}
              className="relative text-amber-400 font-semibold py-1 transition-colors flex flex-col items-center"
            >
              <span>Home</span>
              <span className="w-5 h-[2px] bg-amber-400 rounded-full mt-0.5 shadow-[0_0_8px_#f59e0b]" />
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="text-slate-300 hover:text-amber-400 transition-colors py-1"
            >
              Features
            </button>
            <Link
              to="/leaderboard"
              className="text-slate-300 hover:text-amber-400 transition-colors py-1"
            >
              Leaderboard
            </Link>
          </nav>

          {/* Header Action Buttons */}
          <div className="hidden md:flex items-center gap-3.5">
            {/* Star on GitHub */}
            <a
              href="https://github.com/Abhinavm055/CricAuctionIPL"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/30 text-white text-xs font-semibold tracking-wide transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.02)] hover:shadow-[0_0_20px_rgba(0,207,255,0.2)]"
            >
              <GithubIcon className="w-4 h-4 text-white" />
              <span>Star on GitHub</span>
            </a>

            {/* Login / Profile */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu((prev) => !prev)}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-400/60 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 text-xs font-semibold tracking-wide transition-all duration-300 shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                >
                  <User className="h-4 w-4" />
                  <span>{user.displayName || user.email?.split('@')[0] || 'Profile'}</span>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#091124]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/15 overflow-hidden z-50 py-1">
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          navigate('/admin');
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-amber-400 font-semibold flex items-center gap-2 text-xs border-b border-white/10"
                      >
                        <ShieldCheck className="h-4 w-4" /> Admin Panel
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/profile');
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-white/5 text-slate-200 text-xs"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/feedback');
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-white/5 text-slate-200 text-xs"
                    >
                      Feedback
                    </button>
                    <button
                      onClick={async () => {
                        await signOut(auth);
                        localStorage.removeItem('managerName');
                        setShowProfileMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-white/5 text-red-400 text-xs border-t border-white/10"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 px-5 py-1.5 rounded-full border border-amber-400/80 hover:border-amber-400 bg-transparent hover:bg-amber-400/10 text-amber-400 text-xs font-semibold tracking-wide transition-all duration-300 shadow-[0_0_15px_rgba(251,191,36,0.15)] hover:shadow-[0_0_20px_rgba(251,191,36,0.3)]"
              >
                <User className="w-4 h-4" />
                <span>Login</span>
              </button>
            )}
          </div>

          {/* Mobile Navigation Drawer Trigger */}
          <div className="md:hidden flex items-center">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
                >
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="bg-[#020614]/98 border-white/10 p-6 flex flex-col gap-6 pt-12 backdrop-blur-2xl"
              >
                <SheetHeader className="text-left">
                  <SheetTitle className="text-amber-400 font-display text-2xl tracking-wider">
                    CRICAUCTIONIPL
                  </SheetTitle>
                </SheetHeader>
                <button
                  onClick={() => scrollToSection('hero')}
                  className="text-left text-lg font-medium text-slate-200 hover:text-amber-400 transition-colors"
                >
                  Home
                </button>
                <button
                  onClick={() => scrollToSection('features')}
                  className="text-left text-lg font-medium text-slate-200 hover:text-amber-400 transition-colors"
                >
                  Features
                </button>
                <Link
                  to="/leaderboard"
                  className="text-lg font-medium text-slate-200 hover:text-amber-400 transition-colors"
                >
                  Leaderboard
                </Link>
                <Link
                  to="/feedback"
                  className="text-lg font-medium text-slate-200 hover:text-amber-400 transition-colors"
                >
                  Feedback
                </Link>

                <div className="mt-auto flex flex-col gap-3 pt-6 border-t border-white/10">
                  <a
                    href="https://github.com/Abhinavm055/CricAuctionIPL"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-full border border-white/15 bg-white/5 text-white text-sm font-semibold"
                  >
                    <GithubIcon className="w-4 h-4" />
                    <span>Star on GitHub</span>
                  </a>

                  {user ? (
                    <>
                      <Button
                        onClick={() => navigate('/profile')}
                        variant="outline"
                        className="w-full border-amber-400/50 text-amber-400"
                      >
                        Profile
                      </Button>
                      <Button
                        onClick={async () => {
                          await signOut(auth);
                          localStorage.removeItem('managerName');
                        }}
                        variant="ghost"
                        className="w-full text-red-400"
                      >
                        Logout
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => setShowAuthModal(true)}
                      className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold"
                    >
                      Login
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex flex-col w-full">
        {/* Invalid Room Code Notification Banner */}
        {invalidRoomCode && (
          <div className="max-w-md mx-auto mt-4 text-red-400 font-semibold bg-red-950/40 border border-red-500/30 px-4 py-2 rounded-xl backdrop-blur-md text-sm text-center">
            Invalid Room Code
          </div>
        )}

        {/* Resume Active Session Banner */}
        {resumeSession && (
          <div className="max-w-md mx-auto mt-4 rounded-full border border-amber-500/40 bg-[#091124]/90 backdrop-blur-md px-5 py-2.5 text-xs md:text-sm flex items-center justify-between shadow-[0_0_20px_rgba(251,191,36,0.15)]">
            <span className="text-slate-300">Resume Active Auction?</span>
            <button
              onClick={() => navigate(`/lobby/${resumeSession.gameCode}`)}
              className="ml-3 text-amber-400 hover:text-amber-300 font-bold underline decoration-amber-400/50 hover:decoration-amber-300 underline-offset-4"
            >
              Continue {resumeSession.gameCode}
            </button>
          </div>
        )}

        {/* ===================== HERO SECTION ===================== */}
        <section
          id="hero"
          ref={heroRef}
          onMouseMove={handleHeroMouseMove}
          onMouseLeave={handleHeroMouseLeave}
          className="relative w-full max-w-7xl mx-auto px-6 md:px-10 pt-6 md:pt-10 pb-14 lg:pb-20"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-4 items-center">
            {/* Left Hero Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="lg:col-span-6 flex flex-col justify-center text-left z-20"
            >
              {/* Eyebrow */}
              <div className="text-slate-400 text-xs md:text-sm font-bold tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
                <span>STRATEGY</span>
                <span className="text-slate-500 font-bold">·</span>
                <span>AUCTION</span>
                <span className="text-slate-500 font-bold">·</span>
                <span>TEAM BUILDING</span>
              </div>

              {/* Main Headline in Title Case */}
              <h1 className="font-sans text-5xl sm:text-6xl md:text-7xl lg:text-[76px] font-extrabold tracking-tight text-white leading-[1.04]">
                Build. Bid.
                <span className="block text-amber-400 drop-shadow-[0_0_35px_rgba(251,191,36,0.35)]">
                  Dominate.
                </span>
              </h1>

              {/* Description */}
              <p className="text-slate-100 text-lg md:text-xl font-medium mt-5">
                The ultimate cricket auction simulator.
              </p>

              {/* Supporting Text */}
              <p className="text-slate-400 text-sm md:text-base leading-relaxed mt-2 max-w-lg">
                Create your dream team, outsmart your rivals, and experience the thrill of a live auction like never before.
              </p>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-4 mt-8">
                {/* Start Playing Primary Button */}
                <button
                  onClick={() => scrollToSection('features')}
                  className="group px-7 py-3 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm md:text-base flex items-center gap-3 transition-all duration-300 shadow-[0_0_25px_rgba(251,191,36,0.4)] hover:shadow-[0_0_35px_rgba(251,191,36,0.6)] transform hover:-translate-y-0.5"
                >
                  <div className="w-5 h-5 rounded-full bg-slate-950 flex items-center justify-center">
                    <Play className="w-2.5 h-2.5 text-amber-400 fill-amber-400 ml-0.5" />
                  </div>
                  <span>Start Playing</span>
                </button>

                {/* Watch Demo Secondary Button */}
                <button
                  onClick={() => setShowDemoModal(true)}
                  className="px-7 py-3 rounded-full border border-white/20 hover:border-white/40 bg-white/[0.04] hover:bg-white/[0.08] text-white font-semibold text-sm md:text-base flex items-center gap-2.5 backdrop-blur-md transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <Play className="w-4 h-4 text-white" />
                  <span>Watch Demo</span>
                </button>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4 sm:gap-6 mt-12 pt-8 border-t border-white/[0.08] max-w-xl">
                {/* 10K+ Players */}
                <div className="flex items-center gap-3">
                  <div className="text-cyan-400">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-base leading-tight">10K+</div>
                    <div className="text-slate-400 text-xs mt-0.5">Players</div>
                  </div>
                </div>

                {/* Multiple Modes */}
                <div className="flex items-center gap-3">
                  <div className="text-cyan-400">
                    <Gamepad2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-base leading-tight">Multiple Modes</div>
                    <div className="text-slate-400 text-xs mt-0.5">Play your way</div>
                  </div>
                </div>

                {/* Endless Strategies */}
                <div className="flex items-center gap-3">
                  <div className="text-cyan-400">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-base leading-tight">Endless Strategies</div>
                    <div className="text-slate-400 text-xs mt-0.5">New possibilities</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Hero: Interactive Grand Auction Room Arena */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }}
              style={{
                perspective: 1200,
              }}
              className="lg:col-span-6 relative flex items-center justify-center z-10"
            >
              {/* 3D Parallax & Scroll-Zoom Interactive Container */}
              <motion.div
                style={{
                  rotateY: smoothRotateY,
                  rotateX: smoothRotateX,
                  scale: cameraScale,
                  y: cameraY,
                  transformStyle: 'preserve-3d',
                }}
                className="relative w-full max-w-[620px] rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/[0.08] group/arena transition-shadow duration-500 hover:shadow-[0_25px_70px_rgba(251,191,36,0.12)]"
              >
                {/* Base Auction Room Canvas */}
                <img
                  src={auctionRoomArenaImg}
                  alt="Live Grand Auction Arena"
                  className="w-full h-auto object-cover select-none pointer-events-none block"
                />

                {/* Team Banners Interactive Hotspots */}
                {TEAM_BANNERS.map((banner) => {
                  const isHovered = hoveredBanner === banner.id;
                  return (
                    <div
                      key={banner.id}
                      onMouseEnter={() => setHoveredBanner(banner.id)}
                      onMouseLeave={() => setHoveredBanner(null)}
                      className="absolute cursor-pointer transition-all duration-300"
                      style={{
                        left: banner.left,
                        top: banner.top,
                        width: banner.width,
                        height: banner.height,
                      }}
                      title={`${banner.name} Franchise Banner`}
                    >
                      {/* Active Accent Light Beam */}
                      <div
                        className={`absolute inset-0 rounded-md transition-opacity duration-300 pointer-events-none ${banner.glow} ${
                          isHovered ? 'opacity-90' : 'opacity-0'
                        }`}
                        style={{
                          background: `linear-gradient(180deg, ${banner.color} 0%, rgba(255,255,255,0.15) 30%, transparent 100%)`,
                        }}
                      />
                      {/* Hover Tooltip Badge */}
                      {isHovered && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-950/90 border border-white/20 text-[9px] font-bold tracking-widest text-white whitespace-nowrap shadow-lg animate-fade-in pointer-events-none">
                          {banner.name}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Interactive Gavel / Bid Trigger Hotspot on the Auction Podium */}
                <div
                  onMouseEnter={() => setIsGavelHovered(true)}
                  onMouseLeave={() => setIsGavelHovered(false)}
                  onClick={handleGavelClick}
                  className="absolute cursor-pointer group/gavel"
                  style={{
                    left: '41.6%',
                    top: '40.6%',
                    width: '22.0%',
                    height: '15.2%',
                  }}
                  title="Auction Gavel: Click to Enter Live Auction"
                >
                  {/* Pure Soft Ambient Golden Glow ONLY (Zero Outlines, Zero Badges, Zero Borders) */}
                  <motion.div
                    animate={{
                      opacity: isGavelHovered ? 0.45 : 0,
                      scale: isGavelHovered ? 1.08 : 0.9,
                    }}
                    transition={{
                      duration: 0.25,
                      ease: 'easeOut',
                    }}
                    className="absolute inset-0 rounded-full pointer-events-none mix-blend-screen blur-md"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(255, 225, 130, 0.6) 0%, rgba(251, 191, 36, 0.35) 45%, rgba(245, 158, 11, 0.1) 65%, transparent 80%)',
                    }}
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ===================== GAME MODES SECTION (Transited from Gavel) ===================== */}
        <section id="features" className="relative w-full max-w-7xl mx-auto px-6 md:px-10 py-14">
          <div className="text-center mb-10">
            <h2 className="font-sans text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white">
              CHOOSE YOUR <span className="text-amber-400">ARENA</span>
            </h2>
            <p className="text-slate-400 text-sm mt-1.5">
              Take the auctioneer gavel and lead your franchise to victory.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Card 1: MULTIPLAYER ROOM */}
            <article className="group relative rounded-2xl border border-purple-500/25 bg-[#090d1f]/75 hover:bg-[#0c1228]/85 backdrop-blur-xl p-7 flex flex-col justify-between transition-all duration-300 hover:border-purple-500/50 hover:shadow-[0_0_35px_rgba(168,85,247,0.2)] transform hover:-translate-y-1">
              <div>
                {/* Purple Icon Badge */}
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center p-2.5 mb-6 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all">
                  <Users className="w-5 h-5 text-[#A855F7]" />
                </div>
                {/* Title */}
                <h3 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wider text-white mb-3">
                  MULTIPLAYER ROOM
                </h3>
                {/* Description */}
                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                  Play with your friends in real-time and experience a live auction.
                </p>
              </div>

              {/* Purple CTA Button */}
              <button
                onClick={handlePlayMultiplayer}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:from-[#6d28d9] hover:to-[#9333ea] text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(168,85,247,0.35)] hover:shadow-[0_0_35px_rgba(168,85,247,0.55)] transition-all duration-300"
              >
                <span>Play Multiplayer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </article>

            {/* Card 2: VS COMPUTER AI */}
            <article className="group relative rounded-2xl border border-cyan-500/25 bg-[#090d1f]/75 hover:bg-[#0c1228]/85 backdrop-blur-xl p-7 flex flex-col justify-between transition-all duration-300 hover:border-cyan-500/50 hover:shadow-[0_0_35px_rgba(0,207,255,0.2)] transform hover:-translate-y-1">
              <div>
                {/* Cyan Icon Badge */}
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center p-2.5 mb-6 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(0,207,255,0.3)] transition-all">
                  <Bot className="w-5 h-5 text-[#00CFFF]" />
                </div>
                {/* Title */}
                <h3 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wider text-white mb-3">
                  VS COMPUTER AI
                </h3>
                {/* Description */}
                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                  Challenge our AI with smart bidding and team building.
                </p>
              </div>

              {/* Cyan CTA Button */}
              <button
                onClick={handlePlayWithAI}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00b4d8] to-[#00f5d4] hover:from-[#0096c7] hover:to-[#00e0c0] text-slate-950 font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,245,212,0.4)] hover:shadow-[0_0_35px_rgba(0,245,212,0.6)] transition-all duration-300"
              >
                <span>Play VS AI</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </article>

            {/* Card 3: TOURNAMENT MODE */}
            <article className="group relative rounded-2xl border border-emerald-500/25 bg-[#090d1f]/75 hover:bg-[#0c1228]/85 backdrop-blur-xl p-7 flex flex-col justify-between transition-all duration-300 hover:border-emerald-500/50 hover:shadow-[0_0_35px_rgba(16,185,129,0.2)] transform hover:-translate-y-1">
              <div>
                {/* Emerald Green Icon Badge */}
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center p-2.5 mb-6 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all">
                  <Trophy className="w-5 h-5 text-[#10B981]" />
                </div>
                {/* Title */}
                <h3 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wider text-white mb-3">
                  TOURNAMENT MODE
                </h3>
                {/* Description */}
                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                  Compete in structured tournaments and prove your skills.
                </p>
              </div>

              {/* Emerald CTA Button */}
              <button
                onClick={() => navigate('/tournament')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#10b981] to-[#34d399] hover:from-[#059669] hover:to-[#10b981] text-slate-950 font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_35px_rgba(16,185,129,0.6)] transition-all duration-300"
              >
                <span>Play Tournament</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </article>
          </motion.div>
        </section>

        {/* ===================== HOW IT WORKS SECTION ===================== */}
        <section
          id="how-it-works"
          ref={howItWorksRef}
          className="relative w-full max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-20"
        >
          {/* Header */}
          <div className="text-center mb-16">
            <h2 className="font-sans text-3xl sm:text-4xl md:text-5xl font-extrabold uppercase tracking-tight text-white">
              HOW IT <span className="text-amber-400 drop-shadow-[0_0_25px_rgba(251,191,36,0.3)]">WORKS</span>
            </h2>
            <p className="text-slate-400 text-sm md:text-base mt-2.5">
              Get started in 5 simple steps and create your legacy.
            </p>
          </div>

          {/* 5-Step Horizontal Timeline */}
          <div className="relative max-w-6xl mx-auto">
            {/* Desktop Horizontal Dotted Line */}
            <div className="hidden md:block absolute top-7 left-[8%] right-[8%] h-[1px] border-t border-dotted border-white/20 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-4 relative z-10">
              {/* Step 01 */}
              <div
                onClick={() => openRules('multiplayer')}
                className="flex flex-col items-center text-center cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="text-purple-400 font-bold text-sm tracking-wider">01</span>
                  <div className="w-14 h-14 rounded-full border border-purple-500/40 bg-[#090d1f] flex items-center justify-center text-purple-400 group-hover:scale-110 group-hover:border-purple-400 group-hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all duration-300">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
                <h4 className="font-sans text-sm font-bold uppercase tracking-wider text-white group-hover:text-purple-400 transition-colors mb-2">
                  CHOOSE MODE
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed max-w-[180px]">
                  Select Multiplayer, VS AI, or Tournament mode.
                </p>
              </div>

              {/* Step 02 */}
              <div
                onClick={() => openRules('create')}
                className="flex flex-col items-center text-center cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="text-amber-400 font-bold text-sm tracking-wider">02</span>
                  <div className="w-14 h-14 rounded-full border border-amber-500/40 bg-[#090d1f] flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:border-amber-400 group-hover:shadow-[0_0_25px_rgba(251,191,36,0.4)] transition-all duration-300">
                    <Settings className="w-6 h-6" />
                  </div>
                </div>
                <h4 className="font-sans text-sm font-bold uppercase tracking-wider text-white group-hover:text-amber-400 transition-colors mb-2">
                  CONFIGURE TEAMS
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed max-w-[180px]">
                  Set budget limits, customize rosters, and assign owners.
                </p>
              </div>

              {/* Step 03 */}
              <div
                onClick={() => openRules('start')}
                className="flex flex-col items-center text-center cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="text-cyan-400 font-bold text-sm tracking-wider">03</span>
                  <div className="w-14 h-14 rounded-full border border-cyan-500/40 bg-[#090d1f] flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:border-cyan-400 group-hover:shadow-[0_0_25px_rgba(0,207,255,0.4)] transition-all duration-300">
                    <Gavel className="w-6 h-6" />
                  </div>
                </div>
                <h4 className="font-sans text-sm font-bold uppercase tracking-wider text-white group-hover:text-cyan-400 transition-colors mb-2">
                  START AUCTION
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed max-w-[180px]">
                  Bid in real-time and use smart strategy.
                </p>
              </div>

              {/* Step 04 */}
              <div
                onClick={() => openRules('squad')}
                className="flex flex-col items-center text-center cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="text-emerald-400 font-bold text-sm tracking-wider">04</span>
                  <div className="w-14 h-14 rounded-full border border-emerald-500/40 bg-[#090d1f] flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:border-emerald-400 group-hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all duration-300">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
                <h4 className="font-sans text-sm font-bold uppercase tracking-wider text-white group-hover:text-emerald-400 transition-colors mb-2">
                  BUILD YOUR SQUAD
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed max-w-[180px]">
                  Create a balanced team within budget.
                </p>
              </div>

              {/* Step 05 */}
              <div
                onClick={() => openRules('multiplayer')}
                className="flex flex-col items-center text-center cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="text-teal-400 font-bold text-sm tracking-wider">05</span>
                  <div className="w-14 h-14 rounded-full border border-teal-500/40 bg-[#090d1f] flex items-center justify-center text-teal-400 group-hover:scale-110 group-hover:border-teal-400 group-hover:shadow-[0_0_25px_rgba(45,212,191,0.4)] transition-all duration-300">
                    <Trophy className="w-6 h-6" />
                  </div>
                </div>
                <h4 className="font-sans text-sm font-bold uppercase tracking-wider text-white group-hover:text-teal-400 transition-colors mb-2">
                  WIN TOURNAMENT
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed max-w-[180px]">
                  Compete, track rankings, and make your mark.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== STATS & QUOTE BANNER ===================== */}
        <section className="relative w-full max-w-7xl mx-auto px-6 md:px-10 py-12 md:py-16">
          {/* Subtle Stadium Crowd Silhouette Backdrop */}
          <div className="absolute inset-x-0 -top-12 pointer-events-none opacity-30 overflow-hidden flex justify-center">
            <img
              src="/stadium-crowd.png"
              alt="Stadium crowd silhouette"
              className="w-full max-w-7xl h-auto object-cover"
            />
          </div>

          <div className="relative z-10 rounded-2xl border border-white/10 bg-[#070c1a]/85 backdrop-blur-2xl p-7 md:p-9 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-[0_15px_50px_rgba(0,0,0,0.6)]">
            {/* Left Quote */}
            <div className="flex items-start gap-4 max-w-xl">
              <Quote className="w-8 h-8 text-amber-400 rotate-180 flex-shrink-0 mt-1" />
              <div>
                <p className="text-slate-200 text-base md:text-lg font-medium leading-relaxed">
                  It's more than a game.
                </p>
                <p className="text-slate-200 text-base md:text-lg font-medium leading-relaxed">
                  It's your strategy, your team, your story.
                </p>
                {/* Gold Accent Underline */}
                <div className="w-14 h-1 bg-amber-400 rounded-full mt-3 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
              </div>
            </div>

            {/* Right Statistics with subtle divider borders */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-6 sm:gap-10">
              {/* 10K+ Players */}
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-extrabold text-white text-lg md:text-xl">10K+</div>
                  <div className="text-slate-400 text-xs mt-0.5">Players</div>
                </div>
              </div>

              <div className="hidden sm:block w-[1px] h-10 bg-white/10" />

              {/* 50K+ Auctions Simulated */}
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                  <Zap className="w-6 h-6 fill-amber-400/20" />
                </div>
                <div>
                  <div className="font-extrabold text-white text-lg md:text-xl">50K+</div>
                  <div className="text-slate-400 text-xs mt-0.5">Auctions Simulated</div>
                </div>
              </div>

              <div className="hidden sm:block w-[1px] h-10 bg-white/10" />

              {/* Infinity Possibilities */}
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <Gamepad2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-extrabold text-white text-lg md:text-xl">∞</div>
                  <div className="text-slate-400 text-xs mt-0.5">Possibilities</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ===================== FOOTER ===================== */}
      <footer className="relative z-10 w-full border-t border-white/[0.08] bg-[#020614]/90 backdrop-blur-xl py-8">
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left Brand Logo */}
          <Link to="/" className="flex items-center">
            <img
              src="/logo-horizontal.png"
              alt="CRICAUCTIONIPL"
              className="h-7 md:h-8 w-auto object-contain"
            />
          </Link>

          {/* Center Passion Tagline */}
          <div className="flex items-center gap-3 text-slate-400 text-xs md:text-sm font-medium">
            <span className="w-6 h-[2px] bg-amber-400 rounded-full" />
            <span>Made for cricket fans. Built with passion.</span>
          </div>

          {/* Right Links & GitHub */}
          <div className="flex items-center gap-5 text-xs md:text-sm text-slate-400 font-medium">
            <Link to="/feedback" className="hover:text-amber-400 transition-colors">
              Feedback
            </Link>
            <span className="text-slate-700">|</span>
            <button
              onClick={() => setShowPrivacyModal(true)}
              className="hover:text-amber-400 transition-colors"
            >
              Privacy
            </button>
            <span className="text-slate-700">|</span>
            <button
              onClick={() => setShowTermsModal(true)}
              className="hover:text-amber-400 transition-colors"
            >
              Terms
            </button>
            <a
              href="https://github.com/Abhinavm055/CricAuctionIPL"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors ml-2"
              title="GitHub Repository"
            >
              <GithubIcon className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>

      {/* ===================== AUTH MODAL ===================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-[#091124] p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-display text-3xl text-amber-400 mb-2">
              {isRegisterMode ? 'CREATE ACCOUNT' : 'LOGIN'}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Access your saved teams, participate in multiplayer auctions, and compete.
            </p>

            <form onSubmit={handleEmailAuth} className="space-y-3 mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full rounded-xl bg-[#0e1933] border border-white/15 px-4 py-3 text-sm focus:outline-none focus:border-amber-400 text-white placeholder:text-slate-500"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full rounded-xl bg-[#0e1933] border border-white/15 px-4 py-3 text-sm focus:outline-none focus:border-amber-400 text-white placeholder:text-slate-500"
              />
              <Button
                type="submit"
                className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold py-3 rounded-xl shadow-[0_0_20px_rgba(251,191,36,0.3)]"
              >
                {isRegisterMode ? 'Create Account' : 'Sign In'}
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#091124] px-2 text-slate-500">Or continue with</span>
              </div>
            </div>

            <Button
              onClick={handleGoogleLogin}
              variant="outline"
              className="w-full border-white/15 hover:bg-white/5 text-white font-medium py-3 rounded-xl mb-4 flex items-center justify-center gap-2"
            >
              <span>Sign in with Google</span>
            </Button>

            <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-white/10">
              <button
                onClick={() => setIsRegisterMode((prev) => !prev)}
                className="hover:text-amber-400 transition-colors"
              >
                {isRegisterMode ? 'Already have an account? Sign In' : 'New here? Create account'}
              </button>
            </div>

            {authError && <p className="text-red-400 text-xs mt-3">{authError}</p>}
          </div>
        </div>
      )}

      {/* ===================== RULES MODAL ===================== */}
      <Dialog open={rulesModalOpen} onOpenChange={setRulesModalOpen}>
        <DialogContent className="max-w-2xl border border-amber-400/40 bg-[#081022]/95 text-white backdrop-blur-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl text-amber-400 uppercase tracking-wider">
              {rulesMode === 'multiplayer' && 'Multiplayer Room Rules'}
              {rulesMode === 'ai' && 'VS AI Auction Rules'}
              {rulesMode === 'create' && 'Lobby & Team Configuration'}
              {rulesMode === 'start' && 'Live Auction Bidding Rules'}
              {rulesMode === 'squad' && 'Squad Building & Roster Rules'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed mt-4">
            {rulesMode === 'multiplayer' && (
              <>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h4 className="mb-1 text-base font-semibold text-amber-400">Room Hosting & Invites</h4>
                  <p className="text-slate-300">
                    Host a multiplayer room and share the room code with up to 9 other players to join as active franchise owners.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h4 className="mb-1 text-base font-semibold text-amber-400">Real-Time Sync</h4>
                  <p className="text-slate-300">
                    Bids are synchronized instantly. Each bid resets the countdown timer to give all managers a fair chance to react.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h4 className="mb-1 text-base font-semibold text-amber-400">RTM Cards</h4>
                  <p className="text-slate-300">
                    Franchises can activate Right-To-Match (RTM) on their retained players once the final hammer price is reached.
                  </p>
                </div>
              </>
            )}
            {rulesMode === 'ai' && (
              <>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h4 className="mb-1 text-base font-semibold text-cyan-400">AI Personalities</h4>
                  <p className="text-slate-300">
                    Challenge 9 distinct computer-controlled teams, each operating on personality-driven bidding profiles (Aggressive, Analytical, Budget-Saver, or Star-Chaser).
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h4 className="mb-1 text-base font-semibold text-cyan-400">Speed Play</h4>
                  <p className="text-slate-300">
                    Enjoy fast, fluid bidding actions without waiting for network clients. Perfect for testing team combinations quickly.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h4 className="mb-1 text-base font-semibold text-cyan-400">Intelligent RTM</h4>
                  <p className="text-slate-300">
                    AI franchises dynamically calculate whether to execute their RTM options based on player valuation and remaining budget.
                  </p>
                </div>
              </>
            )}
            {rulesMode === 'create' && (
              <>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h4 className="mb-1 text-base font-semibold text-amber-400">Lobby Settings</h4>
                  <p className="text-slate-300">
                    Configure core parameters including team purse size (default ₹120 Crore), squad limits (18-25 players), and minimum players count.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h4 className="mb-1 text-base font-semibold text-amber-400">Custom Franchises</h4>
                  <p className="text-slate-300">
                    Assign franchise names, colors, and human/AI ownership.
                  </p>
                </div>
              </>
            )}
            {rulesMode === 'start' && (
              <>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h4 className="mb-1 text-base font-semibold text-cyan-400">Auction Flow</h4>
                  <p className="text-slate-300">
                    The auction progresses set by set (Marquee, Batsmen, Bowlers, All-rounders, Wicketkeepers). Each player will be put up for bidding in turn.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h4 className="mb-1 text-base font-semibold text-cyan-400">Hammer & Sold</h4>
                  <p className="text-slate-300">
                    When the bidding stops, the host triggers the hammer action. A countdown will sound, after which the player is declared SOLD or UNSOLD.
                  </p>
                </div>
              </>
            )}
            {rulesMode === 'squad' && (
              <>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h4 className="mb-1 text-base font-semibold text-emerald-400">Squad Size Limits</h4>
                  <p className="text-slate-300">
                    A complete team must consist of a minimum of 18 players and a maximum of 25 players to complete the league requirements.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h4 className="mb-1 text-base font-semibold text-emerald-400">Overseas Cap</h4>
                  <p className="text-slate-300">
                    Strictly adhere to the league roster rule: no more than 8 overseas (non-Indian) players can be registered in your squad.
                  </p>
                </div>
              </>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              {rulesMode === 'multiplayer' && (
                <Button
                  onClick={handlePlayMultiplayer}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold"
                >
                  <PlayCircle className="h-4 w-4 mr-1.5" /> Continue to Multiplayer
                </Button>
              )}
              {rulesMode === 'ai' && (
                <Button
                  onClick={handlePlayWithAI}
                  className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold"
                >
                  <Swords className="h-4 w-4 mr-1.5" /> Start VS AI Game
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setRulesModalOpen(false)}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===================== DEMO WALKTHROUGH MODAL ===================== */}
      <Dialog open={showDemoModal} onOpenChange={setShowDemoModal}>
        <DialogContent className="max-w-2xl border border-white/15 bg-[#081022]/95 text-white backdrop-blur-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl text-amber-400 uppercase tracking-wider">
              CricAuctionIPL Experience
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-slate-300 mt-2">
            <p>
              Experience the excitement of the IPL Mega Auction right from your browser!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5">
                <h5 className="font-bold text-white mb-1">1. Live Multiplayer Rooms</h5>
                <p className="text-xs text-slate-400">
                  Host an auction room, share the 6-character code with your friends, and bid against each other with real-time sync.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
                <h5 className="font-bold text-white mb-1">2. Smart Computer AI</h5>
                <p className="text-xs text-slate-400">
                  Practice your bidding tactics against intelligent AI profiles that assess player values, budgets, and team balance.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                <h5 className="font-bold text-white mb-1">3. Realistic RTM & Purse Rules</h5>
                <p className="text-xs text-slate-400">
                  Manage your ₹120 Crore budget, apply Right-to-Match cards, and maintain squad composition constraints.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                <h5 className="font-bold text-white mb-1">4. Tournament Fixtures</h5>
                <p className="text-xs text-slate-400">
                  Take your drafted squad into the tournament mode to simulate matches, track the points table, and lift the trophy.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button
                onClick={() => {
                  setShowDemoModal(false);
                  scrollToSection('features');
                }}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold"
              >
                Get Started
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDemoModal(false)}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===================== PRIVACY MODAL ===================== */}
      <Dialog open={showPrivacyModal} onOpenChange={setShowPrivacyModal}>
        <DialogContent className="max-w-xl border border-white/15 bg-[#081022]/95 text-white backdrop-blur-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-amber-400 uppercase tracking-wider">
              Privacy Policy
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs text-slate-300 mt-2 leading-relaxed">
            <p>
              CricAuctionIPL is an open cricket fan project built for entertainment and simulation purposes.
            </p>
            <p>
              We only store basic session data (such as temporary room codes, squad selections, and user profiles) via Firebase to allow real-time multiplayer functionality. We do not sell or share personal data with third parties.
            </p>
            <p>
              If you sign in using Google, we only use your email and display name to identify your auction franchise manager profile.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===================== TERMS MODAL ===================== */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-xl border border-white/15 bg-[#081022]/95 text-white backdrop-blur-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-amber-400 uppercase tracking-wider">
              Terms of Service
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs text-slate-300 mt-2 leading-relaxed">
            <p>
              CricAuctionIPL is a non-commercial simulator created by and for cricket enthusiasts.
            </p>
            <p>
              All team names, player names, and trademarks belong to their respective owners and the BCCI/IPL. This application is not officially affiliated with or endorsed by the BCCI or Indian Premier League.
            </p>
            <p>
              Users are expected to participate with sportsmanship in multiplayer auction rooms.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Landing;
