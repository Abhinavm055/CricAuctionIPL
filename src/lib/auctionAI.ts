import { AI_STRATEGIES, SQUAD_CONSTRAINTS, TEAM_NEEDS_TEMPLATE, getNextBid } from './constants';

export type AIStrategy = typeof AI_STRATEGIES[number];

export interface AuctionPlayer {
  id: string;
  role: string;
  rating?: number;
  starRating?: number;
  basePrice: number;
  overseas?: boolean;
  isOverseas?: boolean;
}

export interface AuctionAITeam {
  id: string;
  shortName: string;
  purseRemaining: number;
  players: string[];
  retainedPlayers?: string[];
  squadSize?: number;
  overseasCount?: number;
  isAI: boolean;
  aiStrategy?: AIStrategy;
  teamNeeds?: {
    batter: number;
    bowler: number;
    allRounder: number;
    wicketkeeper: number;
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeRoleKey = (role: string) => {
  const key = role.toLowerCase();
  if (key.includes('wicket')) return 'wicketkeeper';
  if (key.includes('all')) return 'allRounder';
  if (key.includes('bowl')) return 'bowler';
  return 'batter';
};

const getRating = (player: AuctionPlayer) => Number(player.rating ?? player.starRating ?? 3);
const isOverseasPlayer = (player: AuctionPlayer) => Boolean(player.overseas ?? player.isOverseas);

const strategyMultiplier = (strategy: AIStrategy, rating: number) => {
  if (strategy === 'aggressive') return rating >= 4 ? 1.4 : 1.2;
  if (strategy === 'budget') return 0.85;
  if (strategy === 'starHunter') return rating >= 4 ? 1.55 : 0.75;
  if (strategy === 'roleFocused') return 1.05;
  return 1;
};

const getRoleDemandMultiplier = (team: AuctionAITeam, player: AuctionPlayer) => {
  const roleKey = normalizeRoleKey(player.role) as keyof typeof TEAM_NEEDS_TEMPLATE;
  const needCount = Number(team.teamNeeds?.[roleKey] ?? TEAM_NEEDS_TEMPLATE[roleKey]);
  return needCount > 0 ? 1.2 : 1;
};

export const getAIMaxBid = (player: AuctionPlayer, team: AuctionAITeam): number => {
  const rating = clamp(getRating(player), 1, 5);
  const strategy = team.aiStrategy || 'balanced';
  const demandMultiplier = getRoleDemandMultiplier(team, player);
  const personalityMultiplier = strategyMultiplier(strategy, rating);

  let maxBid = player.basePrice * rating * demandMultiplier * personalityMultiplier;

  if (team.purseRemaining < 150000000) maxBid *= 0.75; // < 15Cr conservative
  if (strategy === 'budget' && team.purseRemaining < 200000000) maxBid *= 0.8;

  if (rating >= 4 && Math.random() < 0.35) {
    maxBid = Math.max(maxBid, 100000000 + Math.random() * 100000000); // 10Cr - 20Cr war range
  }

  return Math.floor(Math.min(maxBid, team.purseRemaining));
};

export const getAIBidDecision = (
  teams: AuctionAITeam[],
  player: AuctionPlayer | null,
  currentBid: number,
  currentBidderId: string | null,
): { teamId: string; bid: number; delayMs: number } | null => {
  if (!player) return null;

  const nextBid = getNextBid(currentBid);
  const rating = getRating(player);

  const eligible = teams.filter((team) => {
    if (!team.isAI) return false;
    if (team.id === currentBidderId) return false;
    if (Number(team.purseRemaining || 0) < nextBid) return false;
    if (Number(team.squadSize || team.players?.length || 0) >= SQUAD_CONSTRAINTS.MAX_SQUAD) return false;
    if (isOverseasPlayer(player) && Number(team.overseasCount || 0) >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) return false;
    return true;
  });

  if (!eligible.length) return null;

  const weighted = eligible
    .map((team) => {
      const strategy = team.aiStrategy || 'balanced';
      const maxBid = getAIMaxBid(player, team);

      let chance = rating < 3 ? 0.2 : rating >= 4 ? 0.72 : 0.45;
      if (strategy === 'aggressive') chance += 0.1;
      if (strategy === 'budget') chance -= 0.15;
      if (strategy === 'starHunter' && rating >= 4) chance += 0.14;
      if (strategy === 'roleFocused' && getRoleDemandMultiplier(team, player) > 1) chance += 0.12;
      if (Number(team.purseRemaining || 0) < 150000000) chance -= 0.15;

      return { team, maxBid, chance: clamp(chance, 0.05, 0.95) };
    })
    .filter((entry) => entry.maxBid >= nextBid && Math.random() < entry.chance);

  if (!weighted.length) return null;

  const chosen = weighted[Math.floor(Math.random() * weighted.length)];
  const delayMs = 1000 + Math.floor(Math.random() * 2000);

  return { teamId: chosen.team.id, bid: nextBid, delayMs };
};
