import { Player } from './samplePlayers';
import { SQUAD_CONSTRAINTS, TEAM_NEEDS_TEMPLATE, getNextBid } from './constants';
import { type AIBidTeam } from './aiBidEngine';

export type AITeam = AIBidTeam;

interface BidContext {
  remainingPlayersInAuction: number;
  remainingRoleCounts: Record<string, number>;
  teamPlayersByTeamId?: Record<string, Player[]>;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const ratingOf = (player: Player | null) => Number((player as any)?.rating ?? (player as any)?.starRating ?? 3);
const isOverseas = (player: Player | null) => Boolean((player as any)?.overseas ?? (player as any)?.isOverseas);

const roleKey = (role?: string): keyof typeof TEAM_NEEDS_TEMPLATE => {
  const key = String(role || '').toLowerCase();
  if (key.includes('wicket')) return 'wicketkeeper';
  if (key.includes('all')) return 'allRounder';
  if (key.includes('bowl')) return 'bowler';
  return 'batter';
};

const playersNeededToMin = (team: AITeam) => Math.max(0, SQUAD_CONSTRAINTS.MIN_SQUAD - Number(team.squadSize || team.players?.length || 0));

const hasReservePurse = (team: AITeam, amountToBid: number) => {
  const needed = playersNeededToMin(team);
  const minReserve = needed * 2000000;
  return Number(team.purseRemaining || 0) - amountToBid >= minReserve;
};

const getRoleNeed = (team: AITeam, player: Player | null, teamSquad: Player[]) => {
  const role = roleKey((player as any)?.role);
  const existingByRole = teamSquad.filter((p) => roleKey((p as any)?.role) === role).length;
  const defaultNeed = TEAM_NEEDS_TEMPLATE[role];
  const remainingNeed = Math.max(0, defaultNeed - existingByRole);
  const configuredNeed = Number(team.teamNeeds?.[role] ?? remainingNeed);
  return Math.max(0, Math.max(remainingNeed, configuredNeed));
};

const STAR_PLAYERS = [
  'Virat Kohli',
  'Rohit Sharma',
  'Jasprit Bumrah',
  'Hardik Pandya',
  'Shubman Gill',
  'Rishabh Pant',
  'Suryakumar Yadav',
  'Heinrich Klaasen',
];

const TEAM_PERSONALITIES: Record<string, string> = {
  mi: 'aggressive',
  rcb: 'aggressive',
  csk: 'calculated', 
  rr: 'conservative', 
  srh: 'roleFocused',
  gt: 'balanced',
  lsg: 'aggressive',
  dc: 'balanced',
  pbks: 'conservative',
  kkr: 'aggressive'
};

const pseudoRandom = (seedStr: string) => {
  let h = 0xdeadbeef;
  for(let i = 0; i < seedStr.length; i++)
      h = Math.imul(h ^ seedStr.charCodeAt(i), 2654435761);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
};

const estimateMaxBid = (
  team: AITeam,
  player: Player,
  nextBid: number,
  context: BidContext,
) => {
  const rating = clamp(ratingOf(player), 1, 5);
  const teamSquad = context.teamPlayersByTeamId?.[team.id] || [];
  const need = getRoleNeed(team, player, teamSquad);
  
  const basePrice = player.basePrice;

  let minRange = basePrice;
  let maxRange = basePrice;

  if (rating === 1) {
    maxRange = basePrice + 20000000;
  } else if (rating === 2) {
    maxRange = basePrice + 40000000;
  } else if (rating === 3) {
    minRange = basePrice + 10000000;
    maxRange = basePrice + 80000000;
  } else if (rating === 4) {
    minRange = basePrice + 40000000;
    maxRange = basePrice + 150000000;
  } else if (rating >= 5) {
    minRange = basePrice + 80000000;
    maxRange = basePrice + 200000000;
  }

  const randomFactor = pseudoRandom(`${team.id}-${(player as any).id || player.name}`);
  let targetPrice = minRange + Math.floor(randomFactor * (maxRange - minRange));

  const strategy = team.aiStrategy || TEAM_PERSONALITIES[team.id] || 'balanced';

  if (strategy === 'aggressive') {
    targetPrice = Math.floor(targetPrice * 1.25);
  } else if (strategy === 'conservative' || strategy === 'budget') {
    targetPrice = Math.floor(targetPrice * 0.85);
  } else if (strategy === 'calculated') {
    if (need > 0) targetPrice = Math.floor(targetPrice * 1.15);
    else targetPrice = Math.floor(targetPrice * 0.7);
  } else if (strategy === 'roleFocused') {
    if (need > 0) targetPrice = Math.floor(targetPrice * 1.4);
    else targetPrice = Math.floor(targetPrice * 0.5);
  }

  if (need > 0) {
    targetPrice += 20000000; // Adding 2 Cr if role is needed
  }

  const purse = Number(team.purseRemaining || 0);
  targetPrice = Math.min(targetPrice, purse);

  // Stop bidding if it prevents completing squad mathematically
  while (targetPrice >= nextBid && !hasReservePurse(team, targetPrice)) {
    targetPrice -= 500000;
  }

  if (targetPrice < nextBid) return 0;
  return targetPrice;
};

export const getAIBid = (
  teams: AITeam[],
  player: Player | null,
  currentBid: number,
  currentBidderId: string | null,
  context: BidContext,
): { teamId: string; bid: number; delayMs: number } | null => {
  if (!player) return null;

  const nextBid = getNextBid(currentBid);

  const contenders = teams
    .filter((team) => team.isAI)
    .filter((team) => team.id !== currentBidderId)
    .filter((team) => Number(team.purseRemaining || 0) >= nextBid)
    .filter((team) => hasReservePurse(team, nextBid))
    .filter((team) => Number(team.squadSize || team.players?.length || 0) < SQUAD_CONSTRAINTS.MAX_SQUAD)
    .filter((team) => !isOverseas(player) || Number(team.overseasCount || 0) < SQUAD_CONSTRAINTS.MAX_OVERSEAS)
    .map((team) => {
      const maxBid = estimateMaxBid(team, player, nextBid, context);
      const teamSquad = context.teamPlayersByTeamId?.[team.id] || [];
      const need = getRoleNeed(team, player, teamSquad);
      const role = roleKey((player as any)?.role);
      const roleRemaining = Number(context.remainingRoleCounts[role] || 0);
      const neededToMin = playersNeededToMin(team);

      let bidChance = 0.2 + (ratingOf(player) - 3) * 0.15;
      if (need > 0) bidChance += 0.18;
      if (roleRemaining > 0 && roleRemaining < 3) bidChance += 0.12;
      if (context.remainingPlayersInAuction < neededToMin) bidChance += 0.2;

      const strategy = team.aiStrategy || TEAM_PERSONALITIES[team.id] || 'balanced';
      if (strategy === 'aggressive') bidChance += 0.15;
      if (strategy === 'conservative' || strategy === 'budget') bidChance -= 0.15;
      if (strategy === 'calculated') {
        if (need > 0) bidChance += 0.15;
        else bidChance -= 0.1;
      }
      if (strategy === 'roleFocused' && need > 0) bidChance += 0.2;

      return {
        team,
        maxBid,
        bidChance: clamp(bidChance, 0.05, 0.96),
      };
    })
    .filter((entry) => entry.maxBid >= nextBid)
    .filter((entry) => Math.random() <= entry.bidChance);

  if (!contenders.length) return null;

  contenders.sort((a, b) => b.maxBid - a.maxBid);
  const chosen = contenders[0];

  return {
    teamId: chosen.team.id,
    bid: nextBid,
    delayMs: 600 + Math.floor(Math.random() * 1400), // Random 0.6s to 2s
  };
};

export const getAIMaxBid = (
  teams: AITeam[],
  teamId: string,
  player: Player,
  currentBid: number,
  context: BidContext,
) => {
  const team = teams.find((item) => item.id === teamId);
  if (!team) return 0;
  return estimateMaxBid(team, player, getNextBid(currentBid), context);
};
