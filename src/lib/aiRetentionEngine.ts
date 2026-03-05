import { RETENTION_COSTS, SQUAD_CONSTRAINTS } from './constants';

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

const roleWeight = (role = '') => {
  const key = role.toLowerCase();
  if (key.includes('wicket')) return 0.12;
  if (key.includes('all')) return 0.18;
  if (key.includes('bowl')) return 0.15;
  return 0.1;
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

  const ranked = [...eligible].sort((a, b) => {
    const scoreA = ratingOf(a) + roleWeight(a.role);
    const scoreB = ratingOf(b) + roleWeight(b.role);
    return scoreB - scoreA;
  });

  const retainedIds: string[] = [];
  let cappedCount = 0;
  let uncappedCount = 0;
  let overseasCount = 0;

  for (const player of ranked) {
    if (retainedIds.length >= 6) break;

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
    const player = ranked.find((item) => item.id === playerId);
    const isCapped = Boolean(player?.isCapped ?? (ratingOf(player || {}) >= 4));
    const cost = isCapped
      ? (RETENTION_COSTS.CAPPED_SLOTS[Math.min(cappedSlot, RETENTION_COSTS.CAPPED_SLOTS.length - 1)] || RETENTION_COSTS.CAPPED_SLOTS[RETENTION_COSTS.CAPPED_SLOTS.length - 1])
      : RETENTION_COSTS.UNCAPPED;

    if (isCapped) cappedSlot += 1;
    priceMap[playerId] = cost;
    spend += cost;
  });

  return { retainedIds, cappedCount, uncappedCount, spend, overseasCount, priceMap };
};
