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

  const currentRoleCounts = eligible.reduce<Record<keyof typeof TEAM_NEEDS_TEMPLATE, number>>(
    (acc, player) => {
      acc[roleKey(player.role)] += 1;
      return acc;
    },
    { batter: 0, bowler: 0, allRounder: 0, wicketkeeper: 0 },
  );

  const ranked = eligible
    .map((player) => {
      const rating = ratingOf(player);
      const key = roleKey(player.role);
      const roleNeeded = currentRoleCounts[key] <= TEAM_NEEDS_TEMPLATE[key];
      const needBonus = roleNeeded ? 4 : 0;
      const score = rating * 10 + needBonus;
      return { player, score, roleNeeded, rating };
    })
    .sort((a, b) => b.score - a.score);

  // Retain only if role needed OR star (rating >= 4), and keep count between 2 and 5.
  const targetRetentions = Math.max(2, Math.min(5, Math.round(Math.min(eligible.length, 4))));

  const retainedIds: string[] = [];
  let cappedCount = 0;
  let uncappedCount = 0;
  let overseasCount = 0;

  for (const entry of ranked) {
    if (retainedIds.length >= targetRetentions) break;
    if (!entry.roleNeeded && entry.rating < 4) continue;

    const player = entry.player;
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
    const chosen = ranked.find((item) => item.player.id === playerId)?.player;
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
