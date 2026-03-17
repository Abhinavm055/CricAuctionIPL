export interface Player {
  id: string;
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper';
  nationality: string;
  isOverseas: boolean;
  isCapped: boolean;
  basePrice: number;
  previousTeam: string | null;
  pool: 'Marquee' | 'Batsmen' | 'Bowlers' | 'All-Rounders' | 'Wicket-Keepers';
  starRating: 1 | 2 | 3 | 4 | 5;
  imageUrl?: string;
  rating?: number;
  demandLevel?: 'low' | 'medium' | 'high';
  interestedTeams?: string[];
}

// Utility to shuffle array
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const POOL_ORDER: Player['pool'][] = ['Marquee', 'Batsmen', 'Bowlers', 'All-Rounders', 'Wicket-Keepers'];

export const getPlayersByPool = (players: Player[]) => {
  const pools: Record<string, Player[]> = {
    Marquee: [],
    Batsmen: [],
    Bowlers: [],
    'All-Rounders': [],
    'Wicket-Keepers': [],
  };
  players.forEach((p) => {
    if (p.pool && pools[p.pool]) {
      pools[p.pool].push(p);
    }
  });
  Object.keys(pools).forEach((k) => {
    pools[k] = shuffleArray(pools[k]);
  });
  return pools as Record<Player['pool'], Player[]>;
};

export const createAuctionQueueFrom = (players: Player[]): Player[] => {
  const pools = getPlayersByPool(players);
  return POOL_ORDER.flatMap((pool) => pools[pool]);
};
