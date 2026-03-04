import { Player } from "./samplePlayers";
import { getNextBid } from "./constants";

// Simple AI decision maker for auction
// Returns {teamShortName, bid} or null if no AI wants to bid
// minimal team type used by AI engine
export interface AITeam {
  id: string;
  shortName: string;
  purseRemaining: number;
  players: any[];
  isAI: boolean;
}

export function getAIBid(
  teams: AITeam[],
  player: Player | null,
  currentBid: number
): { teamShortName: string; bid: number } | null {
  if (!player) return null;

  // pick random AI team that can afford the next bid and has space
  const eligible = teams.filter((t) => {
    if (!t.isAI) return false;
    if (t.purseRemaining < currentBid + getNextBid(currentBid)) return false;
    if (t.players.length >= 25) return false; // using max squad constant loosely
    return true;
  });

  if (eligible.length === 0) return null;

  const team = eligible[Math.floor(Math.random() * eligible.length)];
  const bidAmount = currentBid + getNextBid(currentBid);
  return { teamShortName: team.shortName, bid: bidAmount };
}
