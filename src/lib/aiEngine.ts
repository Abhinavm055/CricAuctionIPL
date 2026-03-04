import { getNextBid, SQUAD_CONSTRAINTS } from "./constants";
import { Player } from "./samplePlayers";

export type AIPersonality = "Aggressive" | "Balanced" | "Budget Saver" | "Role Focused";

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

const personalities: AIPersonality[] = ["Aggressive", "Balanced", "Budget Saver", "Role Focused"];
const getPersonality = (teamId: string): AIPersonality => personalities[Math.abs(teamId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % personalities.length];

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
      const personality = getPersonality(team.id);
      const baseAggression = personality === "Aggressive" ? 1.2 : personality === "Budget Saver" ? 0.75 : personality === "Role Focused" ? 1.0 : 0.95;
      const budgetFactor = team.purseRemaining < 100000000 ? 0.72 : 1; // <10Cr
      const starBoost = rating > 4.5 ? 1.2 : 1;
      const maxBid = Math.floor(player.basePrice * (0.8 + rating * 0.25) * baseAggression);
      const stayInChance = clamp((0.28 + (rating / 5) * 0.45) * budgetFactor * starBoost * baseAggression, 0.18, 0.95);
      return { team, maxBid, stayInChance };
    })
    .filter((entry) => entry.maxBid >= nextBid && Math.random() < entry.stayInChance);

  if (!weighted.length) return null;

  const chosen = weighted[Math.floor(Math.random() * weighted.length)];
  const overpayRatio = currentBid / Math.max(chosen.maxBid, 1);
  if (overpayRatio > 0.95 || Math.random() < clamp(overpayRatio - 0.55, 0, 0.6)) return null;

  return { teamId: chosen.team.id, bid: nextBid };
};
