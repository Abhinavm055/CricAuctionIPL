import { getNextBid, SQUAD_CONSTRAINTS } from "./constants";
import { Player } from "./samplePlayers";

export interface AITeam {
  id: string;
  shortName: string;
  purseRemaining: number;
  players: any[];
  isAI: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getMaxBidForPlayer = (player: Player) => {
  const ratingWeight = 0.85 + player.starRating * 0.25;
  const cappedBoost = player.isCapped ? 1.2 : 1;
  return Math.floor(player.basePrice * ratingWeight * cappedBoost);
};

export const getAIBid = (
  teams: AITeam[],
  player: Player | null,
  currentBid: number,
  currentBidderId: string | null
): { teamId: string; bid: number } | null => {
  if (!player) return null;

  const nextBid = getNextBid(currentBid);

  const eligibleTeams = teams.filter((team) => {
    if (!team.isAI) return false;
    if (team.id === currentBidderId) return false;
    if (team.purseRemaining < nextBid) return false;
    if (team.players.length >= SQUAD_CONSTRAINTS.MAX_SQUAD) return false;
    return true;
  });

  if (!eligibleTeams.length) return null;

  const weightedCandidates = eligibleTeams
    .map((team) => {
      const squadPressure = clamp((SQUAD_CONSTRAINTS.MAX_SQUAD - team.players.length) / SQUAD_CONSTRAINTS.MAX_SQUAD, 0.25, 1);
      const maxBid = getMaxBidForPlayer(player);
      const affordabilityRatio = clamp(team.purseRemaining / Math.max(nextBid, 1), 0.5, 3);
      const stayInChance = clamp(0.35 + player.starRating * 0.1 + (affordabilityRatio - 1) * 0.1, 0.25, 0.9) * squadPressure;

      return {
        team,
        maxBid,
        stayInChance,
      };
    })
    .filter((entry) => entry.maxBid >= nextBid && Math.random() < entry.stayInChance);

  if (!weightedCandidates.length) return null;

  const chosen = weightedCandidates[Math.floor(Math.random() * weightedCandidates.length)];

  // Strategic drop-off at higher prices
  const overpayFactor = currentBid / Math.max(chosen.maxBid, 1);
  if (overpayFactor > 0.95 || Math.random() < clamp(overpayFactor - 0.6, 0, 0.55)) {
    return null;
  }

  return {
    teamId: chosen.team.id,
    bid: nextBid,
  };
};
