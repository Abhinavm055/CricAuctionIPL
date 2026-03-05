import { AI_STRATEGIES, SQUAD_CONSTRAINTS, TEAM_NEEDS_TEMPLATE, getNextBid } from './constants';

export type AIStrategy = typeof AI_STRATEGIES[number];

export interface AIBidPlayer {
  id: string;
  role: string;
  rating?: number;
  starRating?: number;
  basePrice: number;
  overseas?: boolean;
  isOverseas?: boolean;
}

export interface AIBidTeam {
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
const getRating = (player: AIBidPlayer) => Number(player.rating ?? player.starRating ?? 3);
const isOverseas = (player: AIBidPlayer) => Boolean(player.overseas ?? player.isOverseas);

const roleKey = (role: string): keyof typeof TEAM_NEEDS_TEMPLATE => {
  const key = role.toLowerCase();
  if (key.includes('wicket')) return 'wicketkeeper';
  if (key.includes('all')) return 'allRounder';
  if (key.includes('bowl')) return 'bowler';
  return 'batter';
};

const strategyFactor = (strategy: AIStrategy, rating: number) => {
  if (strategy === 'aggressive') return rating >= 4 ? 1.45 : 1.2;
  if (strategy === 'budget') return 0.82;
  if (strategy === 'starHunter') return rating >= 4 ? 1.55 : 0.8;
  if (strategy === 'roleFocused') return 1.08;
  return 1;
};

export const getAIMaxBid = (player: AIBidPlayer, team: AIBidTeam): number => {
  const rating = clamp(getRating(player), 1, 5);
  const strategy = team.aiStrategy || 'balanced';
  const need = Number(team.teamNeeds?.[roleKey(player.role)] ?? TEAM_NEEDS_TEMPLATE[roleKey(player.role)]);
  const demandMultiplier = need > 0 ? 1.2 : 1;

  let maxBid = player.basePrice * rating * demandMultiplier * strategyFactor(strategy, rating);

  if (Number(team.purseRemaining || 0) < 150000000) maxBid *= 0.75;
  if (strategy === 'budget' && Number(team.purseRemaining || 0) < 200000000) maxBid *= 0.8;

  if (rating >= 4 && Math.random() < 0.3) {
    maxBid = Math.max(maxBid, 100000000 + Math.random() * 100000000);
  }

  return Math.floor(Math.min(maxBid, Number(team.purseRemaining || 0)));
};

export const getAIBidDecision = (
  teams: AIBidTeam[],
  player: AIBidPlayer | null,
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
    if (isOverseas(player) && Number(team.overseasCount || 0) >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) return false;
    return true;
  });

  if (!eligible.length) return null;

  const candidates = eligible
    .map((team) => {
      const strategy = team.aiStrategy || 'balanced';
      const maxBid = getAIMaxBid(player, team);
      let chance = rating < 3.5 ? 0.15 : rating >= 4 ? 0.7 : 0.45;
      if (strategy === 'aggressive') chance += 0.12;
      if (strategy === 'budget') chance -= 0.18;
      if (strategy === 'starHunter' && rating >= 4) chance += 0.12;
      if (strategy === 'roleFocused' && (team.teamNeeds?.[roleKey(player.role)] || 0) > 0) chance += 0.1;
      if (Number(team.purseRemaining || 0) < 150000000) chance -= 0.15;

      return { team, maxBid, chance: clamp(chance, 0.05, 0.95) };
    })
    .filter((entry) => entry.maxBid >= nextBid && Math.random() < entry.chance);

  if (!candidates.length) return null;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  return { teamId: chosen.team.id, bid: nextBid, delayMs: 1000 + Math.floor(Math.random() * 2000) };
};
