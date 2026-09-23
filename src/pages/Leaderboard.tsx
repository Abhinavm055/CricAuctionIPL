import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, Award, Flame, TrendingUp, User, ShieldCheck, Crown, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface LeaderboardRow {
  id: string;
  name: string;
  auctionsWon: number;
  auctionsPlayed: number;
}

const Leaderboard = () => {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    // Query users with at least 1 win (auctionsWon >= 1) ordered by wins desc
    const q = query(
      collection(db, 'users'),
      where('auctionsWon', '>=', 1),
      orderBy('auctionsWon', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const parsed = snap.docs
          .map((doc) => ({
            id: doc.id,
            name: String(doc.data().name || doc.data().managerName || 'Manager'),
            auctionsWon: Number(doc.data().auctionsWon || 0),
            auctionsPlayed: Number(doc.data().auctionsPlayed || 0),
          }))
          .filter((row) => row.auctionsWon >= 1);
        setRows(parsed);
        setLoading(false);
      },
      (error) => {
        console.warn('Leaderboard query with inequality filter failed, falling back to ordered in-memory filter:', error);
        // Fallback in case Firestore composite index is missing: fetch ordered and filter strictly
        const fallbackQuery = query(collection(db, 'users'), orderBy('auctionsWon', 'desc'));
        onSnapshot(
          fallbackQuery,
          (snap) => {
            const parsed = snap.docs
              .map((doc) => ({
                id: doc.id,
                name: String(doc.data().name || doc.data().managerName || 'Manager'),
                auctionsWon: Number(doc.data().auctionsWon || 0),
                auctionsPlayed: Number(doc.data().auctionsPlayed || 0),
              }))
              .filter((row) => row.auctionsWon >= 1);
            setRows(parsed);
            setLoading(false);
          },
          (err) => {
            console.error('Leaderboard fallback fetch failed: ', err);
            setLoading(false);
          }
        );
      }
    );

    return () => unsubscribe();
  }, []);

  const topThree = rows.slice(0, 3);
  const remainingRows = rows.slice(3);

  return (
    <div className="min-h-screen bg-[#020817] text-white flex flex-col selection:bg-yellow-500/20 selection:text-yellow-300">
      {/* Top Header Navigation (No Landing Tagbar) */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 flex items-center justify-between">
        <Button asChild variant="outline" size="sm" className="border-white/[0.12] hover:border-yellow-500/40 text-slate-300">
          <Link to="/" className="flex items-center gap-1.5 text-xs font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Arena
          </Link>
        </Button>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Page Hero Title */}
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-semibold tracking-wider uppercase mb-4">
            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
            Global Tactical Standings
          </div>
          <h1 className="text-3xl sm:text-5xl font-display uppercase tracking-wider text-white">
            Hall of <span className="text-[#F5B82E]">Champions</span>
          </h1>
          <p className="mt-3 text-slate-400 text-sm sm:text-base leading-relaxed">
            The most elite cricket franchise tacticians ranked by tournament victories, auction efficiency, and squad dominance.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 border-[#F5B82E] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs uppercase tracking-widest text-slate-400">Loading standings...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#09152A] p-12 text-center max-w-lg mx-auto">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white">No Auction Champions Yet</h3>
            <p className="text-slate-400 text-sm mt-1">
              Be the first manager to win an auction floor and claim the #1 rank on the leaderboard!
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Top 3 Podium Cards */}
            {topThree.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto items-end">
                {/* 2nd Place */}
                {topThree[1] && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="order-2 md:order-1 rounded-2xl border border-slate-400/30 bg-[#09152A] p-5 md:p-6 text-center relative shadow-lg shadow-black/40"
                  >
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-slate-700/80 border border-slate-400/40 text-slate-200 text-xs font-bold tracking-wider uppercase shadow-md">
                      <Medal className="w-3.5 h-3.5 text-slate-300" />
                      Rank #2
                    </div>
                    <div className="w-16 h-16 rounded-full bg-slate-800/80 border-2 border-slate-400/40 mx-auto mt-2 flex items-center justify-center text-slate-200 font-display text-xl font-bold">
                      {topThree[1].name.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-white truncate">{topThree[1].name}</h3>
                    <p className="text-xs text-slate-400 font-medium">Silver Contender</p>

                    <div className="mt-4 pt-4 border-t border-white/[0.08] grid grid-cols-2 gap-2 text-left">
                      <div className="bg-slate-900/50 rounded-lg p-2 text-center border border-white/[0.04]">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Titles</span>
                        <span className="text-lg font-display font-bold text-white">{topThree[1].auctionsWon}</span>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-2 text-center border border-white/[0.04]">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Win Rate</span>
                        <span className="text-lg font-display font-bold text-slate-300">
                          {topThree[1].auctionsPlayed > 0
                            ? Math.round((topThree[1].auctionsWon / topThree[1].auctionsPlayed) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 1st Place (Apex Champion) */}
                {topThree[0] && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="order-1 md:order-2 rounded-2xl border-2 border-[#F5B82E]/60 bg-gradient-to-b from-[#0e2246] to-[#09152A] p-6 md:p-8 text-center relative shadow-xl shadow-yellow-500/10 md:-translate-y-3"
                  >
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-[#F5B82E] text-slate-950 text-xs font-black tracking-widest uppercase shadow-lg shadow-yellow-500/30">
                      <Crown className="w-4 h-4 fill-slate-950" />
                      Grand Champion
                    </div>
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-yellow-500/30 to-yellow-300/10 border-2 border-[#F5B82E] mx-auto mt-2 flex items-center justify-center text-[#F5B82E] font-display text-2xl font-black shadow-[0_0_20px_rgba(245,184,46,0.25)]">
                      {topThree[0].name.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="mt-3 text-xl font-bold text-white truncate">{topThree[0].name}</h3>
                    <p className="text-xs text-[#F5B82E] font-semibold tracking-wide">Rank #1 Leader</p>

                    <div className="mt-5 pt-4 border-t border-yellow-500/20 grid grid-cols-2 gap-2 text-left">
                      <div className="bg-yellow-500/10 rounded-lg p-2.5 text-center border border-yellow-500/20">
                        <span className="text-[10px] text-yellow-300/80 uppercase tracking-wider block font-medium">Victories</span>
                        <span className="text-2xl font-display font-bold text-[#F5B82E]">{topThree[0].auctionsWon}</span>
                      </div>
                      <div className="bg-yellow-500/10 rounded-lg p-2.5 text-center border border-yellow-500/20">
                        <span className="text-[10px] text-yellow-300/80 uppercase tracking-wider block font-medium">Win Rate</span>
                        <span className="text-2xl font-display font-bold text-white">
                          {topThree[0].auctionsPlayed > 0
                            ? Math.round((topThree[0].auctionsWon / topThree[0].auctionsPlayed) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 3rd Place */}
                {topThree[2] && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="order-3 rounded-2xl border border-amber-700/40 bg-[#09152A] p-5 md:p-6 text-center relative shadow-lg shadow-black/40"
                  >
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-amber-950 border border-amber-600/40 text-amber-300 text-xs font-bold tracking-wider uppercase shadow-md">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      Rank #3
                    </div>
                    <div className="w-16 h-16 rounded-full bg-amber-950/60 border-2 border-amber-600/40 mx-auto mt-2 flex items-center justify-center text-amber-300 font-display text-xl font-bold">
                      {topThree[2].name.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-white truncate">{topThree[2].name}</h3>
                    <p className="text-xs text-amber-400 font-medium">Bronze Tactician</p>

                    <div className="mt-4 pt-4 border-t border-white/[0.08] grid grid-cols-2 gap-2 text-left">
                      <div className="bg-slate-900/50 rounded-lg p-2 text-center border border-white/[0.04]">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Titles</span>
                        <span className="text-lg font-display font-bold text-white">{topThree[2].auctionsWon}</span>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-2 text-center border border-white/[0.04]">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Win Rate</span>
                        <span className="text-lg font-display font-bold text-slate-300">
                          {topThree[2].auctionsPlayed > 0
                            ? Math.round((topThree[2].auctionsWon / topThree[2].auctionsPlayed) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* Standings Table */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#09152A] overflow-hidden shadow-xl shadow-black/40">
              <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#F5B82E]" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">Full League Standings</h2>
                </div>
                <span className="text-xs text-slate-400">{rows.length} Verified Managers</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 px-6 w-16">Rank</th>
                      <th className="py-3.5 px-6">Franchise Manager</th>
                      <th className="py-3.5 px-6 text-center">Auctions Won</th>
                      <th className="py-3.5 px-6 text-center">Auctions Played</th>
                      <th className="py-3.5 px-6 text-right">Win Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {rows.map((row, index) => {
                      const rank = index + 1;
                      const winPercentage = row.auctionsPlayed > 0 ? Math.round((row.auctionsWon / row.auctionsPlayed) * 100) : 0;
                      const isCurrentUser = currentUserId === row.id;

                      return (
                        <tr
                          key={row.id}
                          className={`transition-colors ${
                            isCurrentUser
                              ? 'bg-yellow-500/10 hover:bg-yellow-500/15'
                              : 'hover:bg-slate-800/30'
                          }`}
                        >
                          <td className="py-4 px-6 font-display font-bold">
                            {rank === 1 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-500 text-slate-950 text-xs font-black shadow-sm shadow-yellow-500/40">
                                1
                              </span>
                            ) : rank === 2 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-950 text-xs font-black">
                                2
                              </span>
                            ) : rank === 3 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-white text-xs font-black">
                                3
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs pl-2">#{rank}</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-300">
                                {row.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className={`font-semibold ${isCurrentUser ? 'text-[#F5B82E]' : 'text-white'}`}>
                                  {row.name}
                                </span>
                                {isCurrentUser && (
                                  <span className="ml-2 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                    You
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center font-display font-bold text-white text-base">
                            {row.auctionsWon}
                          </td>
                          <td className="py-4 px-6 text-center text-slate-400 font-mono">
                            {row.auctionsPlayed}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex items-center gap-2">
                              <div className="w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                <div
                                  className="h-full bg-gradient-to-r from-yellow-500 to-[#F5B82E] rounded-full"
                                  style={{ width: `${Math.min(winPercentage, 100)}%` }}
                                />
                              </div>
                              <span className="font-display font-semibold text-slate-200 text-sm">
                                {winPercentage}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Leaderboard;

