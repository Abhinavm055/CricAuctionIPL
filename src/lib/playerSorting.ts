import type { Player } from '@/lib/samplePlayers';

type PlayerLike = Partial<Player> & Record<string, unknown>;

export type RetentionRoleKey = 'batters' | 'wicketkeepers' | 'allRounders' | 'bowlers';

export const RETENTION_ROLE_ORDER: Array<{ key: RetentionRoleKey; label: string }> = [
  { key: 'batters', label: 'Batsmen' },
  { key: 'wicketkeepers', label: 'Wicket Keepers' },
  { key: 'allRounders', label: 'All Rounders' },
  { key: 'bowlers', label: 'Bowlers' },
];

export const STAR_RATING_ORDER = [5, 4, 3, 2, 1] as const;

export const getPlayerStarRating = (player: PlayerLike) => {
  const rating = Number(player?.starRating ?? player?.rating ?? 0);
  if (!Number.isFinite(rating)) return 0;
  return Math.max(0, Math.min(5, Math.round(rating)));
};

export const resolveRetentionRoleKey = (player: PlayerLike): RetentionRoleKey => {
  const role = String(player?.role || player?.category || player?.pool || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (role.includes('wicket')) return 'wicketkeepers';
  if (role.includes('allround')) return 'allRounders';
  if (role.includes('bowl')) return 'bowlers';
  return 'batters';
};

export const sortPlayersByStarRatingDesc = <T extends PlayerLike>(players: T[]) => {
  return [...players].sort((a, b) => {
    const ratingDiff = getPlayerStarRating(b) - getPlayerStarRating(a);
    if (ratingDiff !== 0) return ratingDiff;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
};

export const groupPlayersByRetentionRoleAndStars = <T extends PlayerLike>(players: T[]) => {
  const roleGroups = RETENTION_ROLE_ORDER.reduce((acc, role) => {
    acc[role.key] = STAR_RATING_ORDER.reduce((starAcc, star) => {
      starAcc[star] = [] as T[];
      return starAcc;
    }, {} as Record<number, T[]>);
    return acc;
  }, {} as Record<RetentionRoleKey, Record<number, T[]>>);

  sortPlayersByStarRatingDesc(players).forEach((player) => {
    const roleKey = resolveRetentionRoleKey(player);
    const starRating = getPlayerStarRating(player);
    if (!roleGroups[roleKey][starRating]) roleGroups[roleKey][starRating] = [];
    roleGroups[roleKey][starRating].push(player);
  });

  return roleGroups;
};
