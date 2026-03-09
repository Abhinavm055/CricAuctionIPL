import { RETENTION_COSTS, SQUAD_CONSTRAINTS, TEAM_NEEDS_TEMPLATE } from './constants';

interface RetentionPlayer {
  id: string;
  role?: string;
  rating?: number;
  starRating?: number;
  previousTeamId?: string;
  previousTeam?: string;
  overseas?: boolean;
  isOverseas?: boolean;
  isCapped?: boolean;
}

const normalizeTeamMatch = (player: RetentionPlayer, teamId: string, shortName: string) => {
  const previousTeamId = String(player.previousTeamId || '').toLowerCase();
  const previousTeam = String(player.previousTeam || '').toLowerCase();
  return previousTeamId === teamId.toLowerCase() || previousTeam === shortName.toLowerCase();
};

const roleKey = (role = ''): keyof typeof TEAM_NEEDS_TEMPLATE => {
  const key = role.toLowerCase();
  if (key.includes('wicket')) return 'wicketkeeper';
  if (key.includes('all')) return 'allRounder';
  if (key.includes('bowl')) return 'bowler';
  return 'batter';
};

const rolePriority = (role = '') => {
  const key = role.toLowerCase();
  if (key.includes('all')) return 8;
  if (key.includes('wicket')) return 7;
  if (key.includes('bowl')) return 6;
  return 5;
};

const ratingOf = (player: RetentionPlayer) => Number(player.rating ?? player.starRating ?? 3);
const overseasOf = (player: RetentionPlayer) => Boolean(player.overseas ?? player.isOverseas);

export const runAIRetentionEngine = (
  teamId: string,
  teamShortName: string,
  players: RetentionPlayer[],
): {
  retainedIds: string[];
  cappedCount: number;
  uncappedCount: number;
  spend: number;
  overseasCount: number;
  priceMap: Record<string, number>;
} => {
  const eligible = players.filter((player) => normalizeTeamMatch(player, teamId, teamShortName));

  const roleCounts = eligible.reduce<Record<keyof typeof TEAM_NEEDS_TEMPLATE, number>>(
    (acc, player) => {
      const key = roleKey(player.role);
      acc[key] += 1;
      return acc;
    },
    { batter: 0, bowler: 0, allRounder: 0, wicketkeeper: 0 },
  );

  const scored = eligible
    .map((player) => {
      const rating = ratingOf(player);
      const key = roleKey(player.role);
      const scarcityBoost = roleCounts[key] <= 2 ? 4 : roleCounts[key] <= 4 ? 2 : 0;
      const teamNeedBonus = Math.max(0, TEAM_NEEDS_TEMPLATE[key] - roleCounts[key]) + scarcityBoost;
      const score = rating * 10 + rolePriority(player.role) + teamNeedBonus;
      return { player, score };
    })
    .sort((a, b) => b.score - a.score);

  const targetRetentionCount = Math.max(
    3,
    Math.min(5, Math.round(scored.length >= 9 ? 5 : scored.length >= 6 ? 4 : 3)),
  );

  const retainedIds: string[] = [];
  let cappedCount = 0;
  let uncappedCount = 0;
  let overseasCount = 0;

  for (const { player } of scored) {
    if (retainedIds.length >= targetRetentionCount) break;

    const isCapped = Boolean(player.isCapped ?? ratingOf(player) >= 4);
    const isOverseas = overseasOf(player);

    if (isCapped && cappedCount >= 5) continue;
    if (!isCapped && uncappedCount >= 2) continue;
    if (isOverseas && overseasCount >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) continue;

    retainedIds.push(player.id);
    if (isCapped) cappedCount += 1;
    else uncappedCount += 1;
    if (isOverseas) overseasCount += 1;
  }

  let cappedSlot = 0;
  let spend = 0;
  const priceMap: Record<string, number> = {};

  retainedIds.forEach((playerId) => {
    const chosen = scored.find((item) => item.player.id === playerId)?.player;
    const isCapped = Boolean(chosen?.isCapped ?? (ratingOf(chosen || {}) >= 4));
    const cost = isCapped
      ? (RETENTION_COSTS.CAPPED_SLOTS[Math.min(cappedSlot, RETENTION_COSTS.CAPPED_SLOTS.length - 1)] || RETENTION_COSTS.CAPPED_SLOTS[RETENTION_COSTS.CAPPED_SLOTS.length - 1])
      : RETENTION_COSTS.UNCAPPED;

    if (isCapped) cappedSlot += 1;
    priceMap[playerId] = cost;
    spend += cost;
  });

  return { retainedIds, cappedCount, uncappedCount, spend, overseasCount, priceMap };
};
