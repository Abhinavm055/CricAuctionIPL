const CR = 10_000_000;

type DynamicPlayer = {
  id?: string;
  role?: string;
  rating?: number;
  starRating?: number;
  basePrice?: number;
  formFactor?: number;
  dynamicValue?: number;
};

const ROLE_MULTIPLIER: Record<string, number> = {
  batsman: 1,
  bowler: 1.1,
  allrounder: 1.4,
  wicketkeeper: 1.2,
};

const normalizeRole = (role: string | undefined) => {
  const key = String(role || '').toLowerCase().replace(/[^a-z]/g, '');
  if (key.includes('wicket')) return 'wicketkeeper';
  if (key.includes('all')) return 'allrounder';
  if (key.includes('bowl')) return 'bowler';
  return 'batsman';
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const getRoleCounts = (players: DynamicPlayer[]) => {
  return players.reduce<Record<string, number>>((acc, player) => {
    const role = normalizeRole(player.role);
    acc[role] = Number(acc[role] || 0) + 1;
    return acc;
  }, {
    batsman: 0,
    bowler: 0,
    allrounder: 0,
    wicketkeeper: 0,
  });
};

export const getPlayerFormFactor = (player: DynamicPlayer) => {
  if (typeof player.formFactor === 'number') return player.formFactor;
  return 0.8 + Math.random() * 0.4;
};

export const calculatePlayerValue = (player: DynamicPlayer, roleCounts: Record<string, number>) => {
  const rawRating = Number(player.rating ?? player.starRating ?? 0);
  const rating = clamp(rawRating <= 5 ? rawRating * 20 : rawRating, 0, 100);
  const role = normalizeRole(player.role);
  const base = rating / 10;
  const scarcity = 1 + (1 / (Number(roleCounts[role] || 0) + 1));
  const formFactor = getPlayerFormFactor(player);
  const valueInCrores = base * (ROLE_MULTIPLIER[role] || 1) * scarcity * formFactor;
  const valueInRupees = Math.max(Number(player.basePrice || 0), valueInCrores * CR);

  return {
    dynamicValue: Number(valueInRupees.toFixed(0)),
    formFactor,
    normalizedRole: role,
  };
};

export const enrichPlayersWithDynamicValue = <T extends DynamicPlayer>(players: T[]) => {
  const roleCounts = getRoleCounts(players);
  return players.map((player) => {
    const value = calculatePlayerValue(player, roleCounts);
    return {
      ...player,
      formFactor: value.formFactor,
      dynamicValue: value.dynamicValue,
    };
  });
};

export const getSmartIncrement = (currentBid: number) => {
  if (currentBid < 5 * CR) return 500_000;
  if (currentBid < 10 * CR) return 1_000_000;
  if (currentBid < 20 * CR) return 2_000_000;
  return 3_000_000;
};
