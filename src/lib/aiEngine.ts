import { Player } from './samplePlayers';
import { getAIBidDecision } from './auctionAI';

export interface AITeam {
  id: string;
  shortName: string;
  purseRemaining: number;
  players: string[];
  retainedPlayers?: string[];
  squadSize?: number;
  overseasCount?: number;
  isAI: boolean;
  aiStrategy?: 'aggressive' | 'balanced' | 'budget' | 'starHunter' | 'roleFocused';
  teamNeeds?: {
    batter: number;
    bowler: number;
    allRounder: number;
    wicketkeeper: number;
  };
}

export const getAIBid = (
  teams: AITeam[],
  player: Player | null,
  currentBid: number,
  currentBidderId: string | null,
): { teamId: string; bid: number; delayMs: number } | null => {
  return getAIBidDecision(teams, player as unknown as Parameters<typeof getAIBidDecision>[1], currentBid, currentBidderId);
};

export { getAIMaxBid } from './auctionAI';
