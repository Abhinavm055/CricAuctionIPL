import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { PlayersTable } from '@/components/PlayersTable';
import { EditablePlayer, PlayerEditor } from '@/components/PlayerEditor';
import { SessionViewer } from '@/components/SessionViewer';

const emptyPlayer: EditablePlayer = {
  name: '',
  role: 'Batsman',
  rating: 3,
  basePrice: 2000000,
  overseas: false,
  pool: 'Batters',
  previousTeamId: '',
  image: '',
};

const AdminPage = () => {
  const [tab, setTab] = useState<'players' | 'sessions'>('players');
  const [players, setPlayers] = useState<EditablePlayer[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [editing, setEditing] = useState<EditablePlayer | null>(null);

  useEffect(() => {
    const unsubPlayers = onSnapshot(collection(db, 'players'), (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });

    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubPlayers();
      unsubSessions();
    };
  }, []);

  const sortedPlayers = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name)), [players]);

  const handleSavePlayer = async (player: EditablePlayer) => {
    const payload = {
      name: player.name,
      role: player.role,
      rating: Number(player.rating),
      basePrice: Number(player.basePrice),
      overseas: !!player.overseas,
      pool: player.pool,
      previousTeamId: player.previousTeamId,
      image: player.image,
    };

    if (player.id) {
      await setDoc(doc(db, 'players', player.id), payload, { merge: true });
    } else {
      await addDoc(collection(db, 'players'), payload);
    }

    setEditing(null);
  };

  const handleDeletePlayer = async (playerId: string) => {
    await deleteDoc(doc(db, 'players', playerId));
  };

  return (
    <div className="min-h-screen p-6 bg-background">
      <h1 className="text-3xl font-display mb-6">Admin Panel</h1>

      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        <aside className="border rounded-xl p-3 h-fit">
          <Button variant={tab === 'players' ? 'default' : 'ghost'} className="w-full justify-start mb-2" onClick={() => setTab('players')}>
            Players
          </Button>
          <Button variant={tab === 'sessions' ? 'default' : 'ghost'} className="w-full justify-start" onClick={() => setTab('sessions')}>
            Sessions
          </Button>
        </aside>

        <section className="border rounded-xl p-4">
          {tab === 'players' && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Players Manager</h2>
                <Button onClick={() => setEditing({ ...emptyPlayer })}>Add Player</Button>
              </div>

              {editing && (
                <div className="mb-4">
                  <PlayerEditor initial={editing} onSave={handleSavePlayer} onCancel={() => setEditing(null)} />
                </div>
              )}

              <PlayersTable players={sortedPlayers} onEdit={setEditing} onDelete={handleDeletePlayer} />
            </>
          )}

          {tab === 'sessions' && (
            <>
              <h2 className="text-xl font-semibold mb-4">Sessions Viewer (Read-only)</h2>
              <SessionViewer sessions={sessions} />
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminPage;
