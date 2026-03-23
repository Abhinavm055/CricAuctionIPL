import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setData(null);
        setLoading(false);
        return;
      }
      const snap = await getDoc(doc(db, 'users', user.uid));
      setData({ uid: user.uid, email: user.email, ...(snap.data() || {}) });
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const winRate = useMemo(() => {
    const played = Number(data?.auctionsPlayed || 0);
    const won = Number(data?.auctionsWon || 0);
    if (!played) return 0;
    return Math.round((won / played) * 100);
  }, [data]);

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-4xl text-primary">PROFILE</h1>
          <Button asChild variant="outline"><Link to="/">Back</Link></Button>
        </div>

        {loading ? <p className="text-muted-foreground">Loading...</p> : !data ? <p className="text-muted-foreground">Login to view your profile.</p> : (
          <>
            <div className="rounded-2xl border border-yellow-400/30 bg-[#0f172a] p-5 mb-6">
              <p className="text-lg">Manager: <span className="text-yellow-400">{data.managerName || data.name || 'Manager'}</span></p>
              <p className="text-sm text-muted-foreground">Email: {data.email || 'N/A'}</p>
              <div className="mt-3 grid sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/10 p-3 bg-[#111b31]">Auctions Played: {Number(data.auctionsPlayed || 0)}</div>
                <div className="rounded-lg border border-white/10 p-3 bg-[#111b31]">Auctions Won: {Number(data.auctionsWon || 0)}</div>
                <div className="rounded-lg border border-white/10 p-3 bg-[#111b31]">Win Rate: {winRate}%</div>
              </div>
            </div>

            <div className="rounded-2xl border border-yellow-400/20 bg-[#0f172a] p-5">
              <h2 className="font-display text-2xl mb-4 text-primary">MY AUCTIONS</h2>
              <div className="space-y-2">
                {(data.auctionHistory || []).length ? data.auctionHistory.slice().reverse().map((item: any, index: number) => (
                  <div key={`${item.code}-${index}`} className="rounded-lg border border-white/10 bg-[#111b31] px-3 py-2 text-sm">
                    {item.code} — Winner: {item.winner}
                  </div>
                )) : <p className="text-sm text-muted-foreground">No auction history yet.</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
