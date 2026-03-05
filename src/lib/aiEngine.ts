import { Player } from './samplePlayers';
import { getAIBidDecision, getAIMaxBid, type AIBidTeam } from './aiBidEngine';

export type AITeam = AIBidTeam;

export const getAIBid = (
  teams: AITeam[],
  player: Player | null,
  currentBid: number,
  currentBidderId: string | null,
): { teamId: string; bid: number; delayMs: number } | null => {
  return getAIBidDecision(teams, player as unknown as Parameters<typeof getAIBidDecision>[1], currentBid, currentBidderId);
};

export { getAIMaxBid };
