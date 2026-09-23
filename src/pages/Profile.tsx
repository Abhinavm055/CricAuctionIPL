import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/contexts/AdminContext';
import {
  ShieldCheck,
  Trophy,
  Gamepad2,
  TrendingUp,
  History,
  User,
  Mail,
  Award,
  Lock,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { motion } from 'framer-motion';

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const { isAdmin } = useAdmin();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setData(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        setData({ uid: user.uid, email: user.email, ...(snap.data() || {}) });
      } catch (err) {
        console.error('Failed to fetch user data:', err);
        setData({ uid: user.uid, email: user.email });
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const winRate = useMemo(() => {
    const played = Number(data?.auctionsPlayed || 0);
    const won = Number(data?.auctionsWon || 0);
    if (!played) return 0;
    return Math.round((won / played) * 100);
  }, [data]);

  const tacticalRank = useMemo(() => {
    const won = Number(data?.auctionsWon || 0);
    if (won >= 15) return { title: 'Grandmaster Strategist', color: 'text-[#F5B82E]', border: 'border-yellow-500/40' };
    if (won >= 8) return { title: 'Senior Tactician', color: 'text-purple-400', border: 'border-purple-500/40' };
    if (won >= 3) return { title: 'Auction Specialist', color: 'text-cyan-400', border: 'border-cyan-500/40' };
    return { title: 'Rookie Tactician', color: 'text-slate-400', border: 'border-slate-600/40' };
  }, [data]);

  return (
    <div className="min-h-screen bg-[#020817] text-white flex flex-col selection:bg-yellow-500/20 selection:text-yellow-300">
      {/* Top Header Navigation (No Landing Tagbar) */}
      <header className="relative z-20 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 flex items-center justify-between">
        <Button asChild variant="outline" size="sm" className="border-white/[0.12] hover:border-yellow-500/40 text-slate-300">
          <Link to="/" className="flex items-center gap-1.5 text-xs font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Arena
          </Link>
        </Button>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-[#F5B82E] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs uppercase tracking-widest text-slate-400">Loading manager credentials...</p>
          </div>
        ) : !data ? (
          <div className="max-w-md mx-auto my-12 rounded-2xl border border-white/[0.08] bg-[#09152A] p-8 text-center shadow-xl shadow-black/40">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-white/10 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold uppercase tracking-wider text-white">Authentication Required</h2>
            <p className="text-slate-400 text-sm mt-2 mb-6">
              Sign in or create a manager profile to inspect career statistics, campaign history, and leaderboard standing.
            </p>
            <Button asChild variant="gold" className="w-full">
              <Link to="/multiplayer">Sign In / Join Arena</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header Title / Admin Access */}
            <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-white/[0.08]">
              <div>
                <span className="text-xs uppercase tracking-widest font-semibold text-[#F5B82E]">
                  Franchise Control
                </span>
                <h1 className="text-3xl sm:text-4xl font-display uppercase tracking-wider text-white">
                  Manager Dossier
                </h1>
              </div>

              {isAdmin && (
                <Button
                  asChild
                  variant="outline"
                  className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300"
                >
                  <Link to="/admin" className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-yellow-400" />
                    Admin Command Console
                  </Link>
                </Button>
              )}
            </div>

            {/* Manager Identity Card */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#09152A] p-6 sm:p-8 shadow-xl shadow-black/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-yellow-500/[0.03] rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-yellow-500/20 to-yellow-300/10 border-2 border-[#F5B82E]/60 flex items-center justify-center text-[#F5B82E] font-display text-3xl font-black shadow-lg shadow-yellow-500/10 shrink-0">
                  {(data.managerName || data.name || 'M').charAt(0).toUpperCase()}
                </div>

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold text-white tracking-wide truncate">
                      {data.managerName || data.name || 'Manager'}
                    </h2>
                    <span
                      className={`text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border bg-slate-900/60 ${tacticalRank.color} ${tacticalRank.border}`}
                    >
                      {tacticalRank.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span className="truncate">{data.email || 'Email not linked'}</span>
                  </div>
                </div>
              </div>

              {/* Career Performance Cards */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/[0.08] pt-6">
                <div className="rounded-xl border border-white/[0.06] bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Trophies Won</span>
                    <Trophy className="w-4 h-4 text-[#F5B82E]" />
                  </div>
                  <span className="text-3xl font-display font-bold text-[#F5B82E]">
                    {Number(data.auctionsWon || 0)}
                  </span>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Campaigns</span>
                    <Gamepad2 className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="text-3xl font-display font-bold text-white">
                    {Number(data.auctionsPlayed || 0)}
                  </span>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Win Efficiency</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-display font-bold text-emerald-400">{winRate}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Auction History Section */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#09152A] p-6 sm:p-8 shadow-xl shadow-black/40">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-[#F5B82E]" />
                  <h2 className="text-lg font-display uppercase tracking-wider text-white">Campaign Log</h2>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {(data.auctionHistory || []).length} Recorded Battles
                </span>
              </div>

              <div className="space-y-3">
                {(data.auctionHistory || []).length ? (
                  data.auctionHistory
                    .slice()
                    .reverse()
                    .map((item: any, index: number) => (
                      <div
                        key={`${item.code}-${index}`}
                        className="rounded-xl border border-white/[0.06] bg-slate-950/50 hover:bg-slate-800/40 transition-colors p-4 flex items-center justify-between flex-wrap gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-xs font-mono font-bold text-[#F5B82E]">
                            #{item.code}
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Room Code: {item.code}</p>
                            <p className="text-sm font-semibold text-white mt-0.5">
                              Champion Franchise:{' '}
                              <span className="text-[#F5B82E] font-display">{item.winner || 'Undecided'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Completed
                          </span>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-10">
                    <p className="text-sm text-slate-400">No recorded auction history yet.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Participate in multiplayer or AI auction rooms to build your permanent battle record.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Profile;

