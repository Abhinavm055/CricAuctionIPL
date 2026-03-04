import { useEffect, useState } from 'react';
import { collection, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { EditablePlayer } from '@/components/PlayerEditor';
import { PlayersManager } from '@/components/PlayersManager';
import { TeamsManager } from '@/components/TeamsManager';

const defaultPlayerImage = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'IPL Player')}&background=0f172a&color=ffffff&size=256`;

const AdminPage = () => {
  const [tab, setTab] = useState<'players' | 'teams'>('players');
  const [players, setPlayers] = useState<EditablePlayer[]>([]);

  useEffect(() => {
    const unsubPlayers = onSnapshot(collection(db, 'players'), (snap) => {
      const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setPlayers(mapped);

      // auto-populate missing player images with public URLs
      mapped.forEach((p) => {
        if (!p.image) {
          setDoc(doc(db, 'players', p.id!), { image: defaultPlayerImage(p.name) }, { merge: true });
        }
      });
    });

    return () => unsubPlayers();
  }, []);

  return (
    <div className="min-h-screen p-6 bg-background">
      <h1 className="text-3xl font-display mb-6">Admin Panel</h1>

      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        <aside className="border rounded-xl p-3 h-fit">
          <Button variant={tab === 'players' ? 'default' : 'ghost'} className="w-full justify-start mb-2" onClick={() => setTab('players')}>
            PLAYERS
          </Button>
          <Button variant={tab === 'teams' ? 'default' : 'ghost'} className="w-full justify-start" onClick={() => setTab('teams')}>
            TEAMS
          </Button>
        </aside>

        <section className="border rounded-xl p-4">
          {tab === 'players' && <PlayersManager players={players} />}
          {tab === 'teams' && <TeamsManager players={players} />}
        </section>
      </div>
    </div>
  );
};

export default AdminPage;
