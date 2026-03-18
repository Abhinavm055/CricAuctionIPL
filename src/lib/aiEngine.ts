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

const estimateMaxBid = (
  team: AITeam,
  player: Player,
  nextBid: number,
  context: BidContext,
) => {
  const rating = clamp(ratingOf(player), 1, 5);
  const teamSquad = context.teamPlayersByTeamId?.[team.id] || [];
  const need = getRoleNeed(team, player, teamSquad);
  const role = roleKey((player as any)?.role);
  const roleRemaining = Number(context.remainingRoleCounts[role] || 0);
  const squadSize = Number(team.squadSize || team.players?.length || 0);
  const neededToMin = Math.max(0, SQUAD_CONSTRAINTS.MIN_SQUAD - squadSize);

  let multiplier = 0.9 + (rating / 5) * 0.8;
  if (need > 0) multiplier += 0.24 + Math.min(0.24, need * 0.07);
  if (roleRemaining > 0 && roleRemaining < 3) multiplier += 0.2;
  if (context.remainingPlayersInAuction < 20) multiplier += 0.08;

  // If AI risks elimination due to lack of remaining players, force aggression
  if (context.remainingPlayersInAuction < neededToMin) multiplier += 0.35;

  const strategy = team.aiStrategy || 'balanced';
  if (strategy === 'aggressive') multiplier += 0.22;
  if (strategy === 'budget') multiplier -= 0.2;
  if (strategy === 'starHunter' && rating >= 4) multiplier += 0.26;
  if (strategy === 'roleFocused' && need > 0) multiplier += 0.18;
  if (strategy === 'balanced' && need > 0) multiplier += 0.1;

  if (strategy === 'starHunter' && rating < 4) multiplier -= 0.15;

  let maxBid = Math.floor(player.basePrice * multiplier * 2.2);
  if (rating >= 4) {
    // allow marquee prices for stars
    maxBid = Math.max(maxBid, Math.floor(player.basePrice * 6.5));
  }

  if (Number(team.purseRemaining || 0) < 150000000) maxBid = Math.floor(maxBid * 0.84);
  maxBid = Math.min(maxBid, Number(team.purseRemaining || 0));

  // keep reserve purse for minimum squad completion
  while (maxBid >= nextBid && !hasReservePurse(team, maxBid)) {
    maxBid -= 500000;
  }

  if (maxBid < nextBid) return 0;
  return maxBid;
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

      const strategy = team.aiStrategy || 'balanced';
      if (strategy === 'aggressive') bidChance += 0.12;
      if (strategy === 'budget') bidChance -= 0.14;
      if (strategy === 'starHunter' && ratingOf(player) >= 4) bidChance += 0.2;
      if (strategy === 'roleFocused' && need > 0) bidChance += 0.14;

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
    delayMs: 800 + Math.floor(Math.random() * 1700),
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
