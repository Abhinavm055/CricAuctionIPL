import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Player } from '@/lib/samplePlayers';
import { listenPlayers } from '@/lib/sessionService';
import { IPL_TEAMS } from '@/lib/constants';

export interface TeamData {
  id: string;
  name: string;
  shortName: string;
  purseRemaining: number;
  squad: Player[];
  overseasCount: number;
}

export interface GameSession {
  id: string;
  code: string;
  status: 'LOBBY' | 'ACTIVE' | 'RTM_PENDING' | 'ACCELERATED' | 'FINISHED';
  createdAt: Date;
  hostTeamId: string;
  teams: TeamData[];
  currentPlayerIndex: number;
  currentBid: number;
  currentBidder: string | null;
  soldPlayers: Array<{ player: Player; team: string; price: number }>;
  unsoldQueue: Player[];
  playerQueue: Player[];
  currentPool: string;
}

interface GameDataContextType {
  sessions: GameSession[];
  masterPlayerList: Player[];
  addSession: (session: GameSession) => void;
  updateSession: (sessionId: string, updates: Partial<GameSession>) => void;
  deleteSession: (sessionId: string) => void;
  updateTeamPurse: (sessionId: string, teamId: string, newPurse: number) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  movePlayerToPool: (playerId: string, newPool: Player['pool']) => void;
  resetSessionToLobby: (sessionId: string) => void;
  forcePlayerSold: (sessionId: string, teamId: string, price: number) => void;
  skipToNextPlayer: (sessionId: string) => void;
  triggerAcceleratedRound: (sessionId: string) => void;
}

const GameDataContext = createContext<GameDataContextType | null>(null);

export const GameDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [masterPlayerList, setMasterPlayerList] = useState<Player[]>([]);

  // listen to players collection and keep master list updated
  useEffect(() => {
    const unsub = listenPlayers((players) => {
      setMasterPlayerList(players as Player[]);
    });
    return () => unsub();
  }, []);

  const addSession = useCallback((session: GameSession) => {
    setSessions(prev => [...prev, session]);
  }, []);

  const updateSession = useCallback((sessionId: string, updates: Partial<GameSession>) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updates } : s));
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  const updateTeamPurse = useCallback((sessionId: string, teamId: string, newPurse: number) => {
    setSessions(prev => prev.map(session => {
      if (session.id !== sessionId) return session;
      return {
        ...session,
        teams: session.teams.map(team => 
          team.id === teamId ? { ...team, purseRemaining: newPurse } : team
        )
      };
    }));
  }, []);

  const updatePlayer = useCallback((playerId: string, updates: Partial<Player>) => {
    setMasterPlayerList(prev => prev.map(p => 
      p.id === playerId ? { ...p, ...updates } : p
    ));
  }, []);

  const movePlayerToPool = useCallback((playerId: string, newPool: Player['pool']) => {
    setMasterPlayerList(prev => prev.map(p => 
      p.id === playerId ? { ...p, pool: newPool } : p
    ));
  }, []);

  const resetSessionToLobby = useCallback((sessionId: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id !== sessionId) return session;
      return {
        ...session,
        status: 'LOBBY',
        currentPlayerIndex: 0,
        currentBid: 0,
        currentBidder: null,
        soldPlayers: [],
        unsoldQueue: [],
        teams: session.teams.map(team => ({
          ...team,
          purseRemaining: IPL_TEAMS.find(t => t.id === team.id)?.purse || 1200000000,
          squad: [],
          overseasCount: 0
        }))
      };
    }));
  }, []);

  const forcePlayerSold = useCallback((sessionId: string, teamId: string, price: number) => {
    setSessions(prev => prev.map(session => {
      if (session.id !== sessionId) return session;
      const currentPlayer = session.playerQueue[session.currentPlayerIndex];
      if (!currentPlayer) return session;

      const team = session.teams.find(t => t.id === teamId);
      if (!team) return session;

      return {
        ...session,
        currentPlayerIndex: session.currentPlayerIndex + 1,
        currentBid: 0,
        currentBidder: null,
        soldPlayers: [...session.soldPlayers, { player: currentPlayer, team: teamId, price }],
        teams: session.teams.map(t => 
          t.id === teamId 
            ? { 
                ...t, 
                purseRemaining: t.purseRemaining - price,
                squad: [...t.squad, currentPlayer],
                overseasCount: t.overseasCount + (currentPlayer.isOverseas ? 1 : 0)
              }
            : t
        )
      };
    }));
  }, []);

  const skipToNextPlayer = useCallback((sessionId: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id !== sessionId) return session;
      const currentPlayer = session.playerQueue[session.currentPlayerIndex];
      
      return {
        ...session,
        currentPlayerIndex: session.currentPlayerIndex + 1,
        currentBid: 0,
        currentBidder: null,
        unsoldQueue: currentPlayer ? [...session.unsoldQueue, currentPlayer] : session.unsoldQueue
      };
    }));
  }, []);

  const triggerAcceleratedRound = useCallback((sessionId: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id !== sessionId) return session;
      return {
        ...session,
        status: 'ACCELERATED',
        playerQueue: session.unsoldQueue,
        unsoldQueue: [],
        currentPlayerIndex: 0,
        currentBid: 0,
        currentBidder: null
      };
    }));
  }, []);

  return (
    <GameDataContext.Provider value={{
      sessions,
      masterPlayerList,
      addSession,
      updateSession,
      deleteSession,
      updateTeamPurse,
      updatePlayer,
      movePlayerToPool,
      resetSessionToLobby,
      forcePlayerSold,
      skipToNextPlayer,
      triggerAcceleratedRound
    }}>
      {children}
    </GameDataContext.Provider>
  );
};

export const useGameData = () => {
  const context = useContext(GameDataContext);
  if (!context) {
    throw new Error('useGameData must be used within GameDataProvider');
  }
  return context;
};
