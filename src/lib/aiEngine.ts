import { getNextBid, SQUAD_CONSTRAINTS } from "./constants";
import { Player } from "./samplePlayers";

export interface AITeam {
  id: string;
  shortName: string;
  purseRemaining: number;
  players: any[];
  overseasCount?: number;
  isAI: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getPlayerRating = (player: any) => Number(player?.rating ?? player?.starRating ?? 3);
const isOverseasPlayer = (player: any) => Boolean(player?.overseas ?? player?.isOverseas);

const getMaxBidForPlayer = (player: Player) => {
  const rating = getPlayerRating(player);
  const ratingWeight = 0.7 + rating * 0.2;
  const cappedBoost = (player as any).isCapped ? 1.15 : 1;
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
  const rating = getPlayerRating(player);
  const overseas = isOverseasPlayer(player);

  const eligibleTeams = teams.filter((team) => {
    if (!team.isAI) return false;
    if (team.id === currentBidderId) return false;
    if (team.purseRemaining < nextBid) return false;
    if ((team.players?.length || 0) >= SQUAD_CONSTRAINTS.MAX_SQUAD) return false;
    if (overseas && Number(team.overseasCount || 0) >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) return false;
    return true;
  });

  if (!eligibleTeams.length) return null;

  const weighted = eligibleTeams
    .map((team) => {
      const slotsLeft = SQUAD_CONSTRAINTS.MAX_SQUAD - (team.players?.length || 0);
      const maxBid = getMaxBidForPlayer(player);
      const purseConservatism = team.purseRemaining < 100000000 ? 0.75 : 1; // <10Cr => conservative
      const roleNeedBoost = slotsLeft <= 5 ? 0.85 : 1;
      const aggression = rating > 4.5 ? 1.15 : 1;
      const stayInChance = clamp(0.3 + (rating / 5) * 0.45, 0.2, 0.92) * purseConservatism * roleNeedBoost * aggression;
      return { team, maxBid, stayInChance };
    })
    .filter((entry) => entry.maxBid >= nextBid && Math.random() < entry.stayInChance);

  if (!weighted.length) return null;

  const chosen = weighted[Math.floor(Math.random() * weighted.length)];
  const overpayRatio = currentBid / Math.max(chosen.maxBid, 1);
  if (overpayRatio > 0.95 || Math.random() < clamp(overpayRatio - 0.55, 0, 0.6)) return null;

  return { teamId: chosen.team.id, bid: nextBid };
};
