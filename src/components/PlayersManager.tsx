import { useMemo, useState } from 'react';
import { collection, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { EditablePlayer, PlayerEditor } from './PlayerEditor';
import { PlayersTable } from './PlayersTable';

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

interface PlayersManagerProps {
  players: EditablePlayer[];
}

export const PlayersManager = ({ players }: PlayersManagerProps) => {
  const [editing, setEditing] = useState<EditablePlayer | null>(null);
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

    if (player.id) await setDoc(doc(db, 'players', player.id), payload, { merge: true });
    else await addDoc(collection(db, 'players'), payload);

    setEditing(null);
  };

  const handleDeletePlayer = async (playerId: string) => {
    await deleteDoc(doc(db, 'players', playerId));
  };

  return (
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
  );
};
