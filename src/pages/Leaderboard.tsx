import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';

interface LeaderboardRow {
  id: string;
  name: string;
  auctionsWon: number;
  auctionsPlayed: number;
}

const Leaderboard = () => {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(query(collection(db, 'leaderboard'), orderBy('auctionsWon', 'desc')));
      const parsed = snap.docs.map((doc) => ({
        id: doc.id,
        name: String(doc.data().name || 'Manager'),
        auctionsWon: Number(doc.data().auctionsWon || 0),
        auctionsPlayed: Number(doc.data().auctionsPlayed || 0),
      }));
      setRows(parsed);
      setLoading(false);
    };

    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-4xl text-primary">LEADERBOARD</h1>
          <Button asChild variant="outline"><Link to="/">Back</Link></Button>
        </div>

        <div className="rounded-2xl border border-yellow-400/30 bg-[#0f172a] overflow-hidden">
          <div className="grid grid-cols-4 px-4 py-3 text-sm text-yellow-400 border-b border-white/10 font-semibold">
            <div>Rank</div>
            <div>Manager</div>
            <div>Auctions Won</div>
            <div>Auctions Played</div>
          </div>

          {loading ? (
            <div className="p-6 text-muted-foreground">Loading leaderboard...</div>
          ) : rows.length ? rows.map((row, index) => (
            <div key={row.id} className="grid grid-cols-4 px-4 py-3 border-b border-white/5 text-sm">
              <div>{index + 1}</div>
              <div>{row.name}</div>
              <div>{row.auctionsWon}</div>
              <div>{row.auctionsPlayed}</div>
            </div>
          )) : (
            <div className="p-6 text-muted-foreground">No leaderboard data yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
