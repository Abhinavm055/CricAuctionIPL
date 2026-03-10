import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { listenSession, startAuction } from '@/lib/sessionService';

const RetentionLobby = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [starting, setStarting] = useState(false);

  const userId = useMemo(() => {
    let uid = localStorage.getItem('uid');
    if (!uid) {
      uid = `user-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('uid', uid);
    }
    return uid;
  }, []);

  useEffect(() => {
    if (!gameCode) return;
    const unsubscribe = listenSession(gameCode, (snapshot) => setSession(snapshot));
    return () => unsubscribe();
  }, [gameCode]);

  const isHost = session?.hostId === userId;

  useEffect(() => {
    if (!session?.hostId) return;
    console.log('hostId:', session.hostId);
    console.log('userId:', userId);
  }, [session?.hostId, userId]);

  if (!session) return <p className="p-6">Loading retention lobby…</p>;

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-display mb-6">Retention Lobby</h1>
      {isHost ? (
        <Button
          variant="gold"
          size="xl"
          disabled={starting}
          onClick={async () => {
            if (!gameCode) return;
            setStarting(true);
            try {
              await startAuction(gameCode);
              navigate(`/auction/${gameCode}`);
            } finally {
              setStarting(false);
            }
          }}
        >
          {starting ? 'Starting...' : 'Start Auction'}
        </Button>
      ) : (
        <p className="text-muted-foreground">Host is preparing the auction...</p>
      )}
    </div>
  );
};

export default RetentionLobby;
