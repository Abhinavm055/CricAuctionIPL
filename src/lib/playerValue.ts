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

const hashToUnit = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
};

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
  return 0.8 + hashToUnit(String(player.id || player.role || 'player')) * 0.4;
};

export const calculatePlayerValue = (player: DynamicPlayer, roleCounts: Record<string, number>) => {
  const rating = clamp(Number(player.rating ?? player.starRating ?? 3), 1, 5);
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
  if (currentBid < CR) return 500_000;
  if (currentBid < 2 * CR) return 1_000_000;
  if (currentBid < 5 * CR) return 2_000_000;
  return 2_500_000;
};
