import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { auth, db } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  User,
  ShieldCheck,
  Menu,
  X,
  Trophy,
  MessageSquare,
  Sparkles,
  ArrowRight,
  LogOut,
} from 'lucide-react';

const GithubIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

interface AppHeaderProps {
  currentSection?: string;
  hideNavLinks?: boolean;
}

export const AppHeader = ({ currentSection, hideNavLinks = false }: AppHeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [managerName, setManagerName] = useState<string>('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(userRef);
          const existing = snap.data();
          const name = existing?.managerName || existing?.name || currentUser.displayName || currentUser.email?.split('@')[0] || 'Manager';
          setManagerName(name);

          // Update safe user session metadata for Admin Account Inspection
          const nowIso = new Date().toISOString();
          const creationDate = currentUser.metadata.creationTime || existing?.createdAt || nowIso;
          const lastSignInDate = currentUser.metadata.lastSignInTime || nowIso;

          await setDoc(
            userRef,
            {
              uid: currentUser.uid,
              email: currentUser.email || existing?.email || '',
              name: name,
              managerName: name,
              createdAt: existing?.createdAt || creationDate,
              lastLoginAt: lastSignInDate,
              status: existing?.status || 'ACTIVE',
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          setManagerName(currentUser.displayName || currentUser.email?.split('@')[0] || 'Manager');
        }
      } else {
        setManagerName('');
      }
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setAuthError('');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setShowAuthModal(false);
    } catch (err: any) {
      setAuthError(err.message || 'Google sign-in failed');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegisterMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setShowAuthModal(false);
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    }
  };

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Multiplayer', path: '/multiplayer' },
    { label: 'Tournament', path: '/tournament' },
    { label: 'Leaderboard', path: '/leaderboard' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#020817]/90 border-b border-white/[0.08] transition-all">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <img
              src="/logo-horizontal.png"
              alt="CRICAUCTIONIPL"
              className="h-8 md:h-9 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </Link>

          {/* Desktop Navigation */}
          {!hideNavLinks && (
            <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative py-1 transition-colors ${
                      isActive
                        ? 'text-amber-400 font-semibold'
                        : 'text-slate-300 hover:text-amber-400'
                    }`}
                  >
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="absolute -bottom-1.5 left-0 right-0 h-[2px] bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
                    )}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right Action Icons & Auth */}
          <div className="flex items-center gap-3">
            {/* Feedback Link */}
            <Link
              to="/feedback"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-400 font-medium px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>Feedback</span>
            </Link>

            {/* Star on GitHub */}
            <a
              href="https://github.com/Abhinavm055/CricAuctionIPL"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-semibold tracking-wide transition-all"
            >
              <GithubIcon className="w-3.5 h-3.5 text-white" />
              <span>GitHub</span>
            </a>

            {/* User Profile / Login */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu((prev) => !prev)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-400/60 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 text-xs font-semibold tracking-wide transition-all shadow-[0_0_15px_rgba(245,184,46,0.2)]"
                >
                  <User className="h-3.5 w-3.5" />
                  <span className="max-w-[120px] truncate">{managerName || user.email?.split('@')[0]}</span>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#09152A] rounded-xl shadow-2xl border border-white/15 overflow-hidden z-50 py-1 backdrop-blur-xl">
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
                      My Profile
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/leaderboard');
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-white/5 text-slate-200 text-xs"
                    >
                      Leaderboard
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
                        setShowProfileMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-white/5 text-red-400 text-xs border-t border-white/10 flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-amber-400/80 hover:border-amber-400 bg-transparent hover:bg-amber-400/10 text-amber-400 text-xs font-semibold tracking-wide transition-all shadow-[0_0_15px_rgba(245,184,46,0.15)]"
              >
                <User className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
            )}

            {/* Mobile Sheet Trigger */}
            <div className="md:hidden flex items-center">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 h-8 w-8"
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="bg-[#020817]/98 border-white/10 p-6 flex flex-col gap-5 pt-12 backdrop-blur-2xl"
                >
                  <SheetHeader className="text-left">
                    <SheetTitle className="text-amber-400 font-display text-2xl tracking-wider">
                      CRICAUCTIONIPL
                    </SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-4 text-base font-medium text-slate-200">
                    {navItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className="hover:text-amber-400 transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <Link to="/feedback" className="hover:text-amber-400 transition-colors">
                      Feedback
                    </Link>
                    {isAdmin && (
                      <Link to="/admin" className="text-amber-400 font-semibold flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Admin Panel
                      </Link>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Global Auth Modal */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="max-w-md bg-[#09152A] border border-white/15 text-white p-6 rounded-2xl backdrop-blur-2xl">
          <DialogHeader className="text-center pb-2">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/30">
              <Sparkles className="h-6 w-6 text-amber-400" />
            </div>
            <DialogTitle className="font-display text-2xl tracking-wide uppercase text-white">
              {isRegisterMode ? 'Create Account' : 'Welcome Back'}
            </DialogTitle>
            <p className="text-xs text-slate-400">
              {isRegisterMode
                ? 'Sign up to build your team and climb the leaderboard'
                : 'Login to resume your auction sessions and manage squads'}
            </p>
          </DialogHeader>

          {authError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
              {authError}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleGoogleSignIn}
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-sm font-semibold transition-all hover:border-amber-400/40"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.8s.7 5.1 1.9 7.5l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">or with email</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#050B16] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#050B16] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400"
              />
              <Button type="submit" variant="default" className="w-full h-11 text-xs uppercase tracking-wider font-bold">
                {isRegisterMode ? 'Register' : 'Sign In'}
              </Button>
            </form>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setAuthError('');
                }}
                className="text-xs text-slate-400 hover:text-amber-400 transition-colors"
              >
                {isRegisterMode
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Register"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
