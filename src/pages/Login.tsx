import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { auth } from '@/lib/firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, ArrowLeft, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

const GoogleIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const Login = () => {
  const { user, isAdmin, isLoading } = useAdmin();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect immediately:
  // Admin -> /admin, Non-admin -> /
  useEffect(() => {
    if (!isLoading && user) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, isAdmin, isLoading, navigate]);

  const handleGoogleSignIn = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // Navigation is handled automatically by the useEffect above once auth state updates
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed');
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isRegisterMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // Navigation is handled automatically by the useEffect above once auth state updates
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your credentials.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020817] flex flex-col items-center justify-center text-primary font-display text-2xl gap-3">
        <div className="w-10 h-10 border-2 border-[#F5B82E] border-t-transparent rounded-full animate-spin" />
        <span className="animate-pulse tracking-widest text-xs text-[#F5B82E]/80 uppercase">
          Initializing Authentication...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020817] text-white flex flex-col selection:bg-yellow-500/20 selection:text-yellow-300 relative overflow-hidden">
      {/* Background Lighting */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-radial-gradient from-[#08152c]/50 via-[#020817] to-[#01040d]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full bg-yellow-500/5 blur-[140px]" />
      </div>

      {/* Top Header Navigation */}
      <header className="relative z-20 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between">
        <Button asChild variant="outline" size="sm" className="border-white/[0.12] hover:border-yellow-500/40 text-slate-300">
          <Link to="/" className="flex items-center gap-1.5 text-xs font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Arena
          </Link>
        </Button>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#09152A]/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/60">
          {/* Card Title */}
          <div className="text-center pb-6 border-b border-white/[0.08]">
            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center shadow-lg shadow-yellow-500/10">
              <Shield className="w-7 h-7 text-[#F5B82E]" />
            </div>
            <h1 className="text-2xl font-display uppercase tracking-wider text-white">
              Tactical Command Portal
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Sign in to manage your franchise or access administration
            </p>
          </div>

          <div className="space-y-4 pt-6">
            {/* Google Sign In Button */}
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={handleGoogleSignIn}
              className="w-full h-11 border-white/[0.12] hover:border-yellow-500/40 bg-white/[0.03] hover:bg-white/[0.08] text-white font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2.5 rounded-xl transition-all"
            >
              <GoogleIcon className="w-4 h-4" />
              <span>Continue with Google</span>
            </Button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.08]" />
              </div>
              <span className="relative px-3 bg-[#09152A] text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Or with Email
              </span>
            </div>

            {/* Email & Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-10 bg-[#050B16] border-white/[0.12] text-white text-xs placeholder:text-slate-600 focus:border-[#F5B82E] rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-10 bg-[#050B16] border-white/[0.12] text-white text-xs placeholder:text-slate-600 focus:border-[#F5B82E] rounded-xl"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || !email || !password}
                className="w-full h-11 bg-[#F5B82E] hover:bg-yellow-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(245,184,46,0.25)] flex items-center justify-center gap-2 mt-2"
              >
                <span>{isSubmitting ? 'Authenticating...' : isRegisterMode ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </form>

            {/* Toggle Login / Register */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode((prev) => !prev);
                  setError('');
                }}
                className="text-xs text-slate-400 hover:text-[#F5B82E] transition-colors"
              >
                {isRegisterMode ? (
                  <span>Already have an account? <strong className="text-white font-semibold underline">Sign In</strong></span>
                ) : (
                  <span>Need an account? <strong className="text-white font-semibold underline">Register</strong></span>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
