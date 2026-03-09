export const IPL_TEAMS = [
  { id: 'csk', name: 'Chennai Super Kings', shortName: 'CSK', color: 'team-csk', purse: 1200000000, logo: 'https://upload.wikimedia.org/wikipedia/en/2/2f/Chennai_Super_Kings_Logo.svg' },
  { id: 'mi', name: 'Mumbai Indians', shortName: 'MI', color: 'team-mi', purse: 1200000000, logo: 'https://upload.wikimedia.org/wikipedia/en/c/cd/Mumbai_Indians_Logo.svg' },
  { id: 'rcb', name: 'Royal Challengers Bengaluru', shortName: 'RCB', color: 'team-rcb', purse: 1200000000, logo: 'https://upload.wikimedia.org/wikipedia/en/d/d4/Royal_Challengers_Bengaluru_Logo.svg' },
  { id: 'kkr', name: 'Kolkata Knight Riders', shortName: 'KKR', color: 'team-kkr', purse: 1200000000, logo: 'https://upload.wikimedia.org/wikipedia/en/9/9a/Kolkata_Knight_Riders_Logo.svg' },
  { id: 'dc', name: 'Delhi Capitals', shortName: 'DC', color: 'team-dc', purse: 1200000000, logo: 'https://upload.wikimedia.org/wikipedia/en/f/f5/Delhi_Capitals_Logo.svg' },
  { id: 'pbks', name: 'Punjab Kings', shortName: 'PBKS', color: 'team-pbks', purse: 1200000000, logo: 'https://upload.wikimedia.org/wikipedia/en/d/d4/Punjab_Kings_Logo.svg' },
  { id: 'rr', name: 'Rajasthan Royals', shortName: 'RR', color: 'team-rr', purse: 1200000000, logo: 'https://upload.wikimedia.org/wikipedia/en/6/60/Rajasthan_Royals_Logo.svg' },
  { id: 'srh', name: 'Sunrisers Hyderabad', shortName: 'SRH', color: 'team-srh', purse: 1200000000, logo: 'https://upload.wikimedia.org/wikipedia/en/8/81/Sunrisers_Hyderabad.svg' },
  { id: 'gt', name: 'Gujarat Titans', shortName: 'GT', color: 'team-gt', purse: 1200000000, logo: 'https://upload.wikimedia.org/wikipedia/en/0/09/Gujarat_Titans_Logo.svg' },
  { id: 'lsg', name: 'Lucknow Super Giants', shortName: 'LSG', color: 'team-lsg', purse: 1200000000, logo: 'https://upload.wikimedia.org/wikipedia/en/3/35/Lucknow_Super_Giants_IPL_Logo.svg' },
] as const;

export const PLAYER_ROLES = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'] as const;

export const AUCTION_POOLS = ['Marquee', 'Batters', 'All-Rounders', 'Wicketkeepers', 'Bowlers', 'Uncapped', 'Accelerated'] as const;

// Official IPL bid increments
export const PRICE_INCREMENTS = [
  { threshold: 0, increment: 500000 },         // Up to 1Cr: +5L
  { threshold: 10000000, increment: 1000000 }, // 1Cr to <2Cr: +10L
  { threshold: 20000000, increment: 2000000 }, // 2Cr to <5Cr: +20L
  { threshold: 50000000, increment: 2500000 }, // 5Cr onward: +25L
] as const;

export const RETENTION_COSTS = {
  CAPPED_SLOTS: [180000000, 140000000, 110000000, 180000000, 140000000],
  UNCAPPED: 40000000,
} as const;

export const IPL_TEAM_COLORS: Record<string, { primary: string; secondary: string; name: string }> = {
  csk: { primary: '#FFC107', secondary: '#003366', name: 'Chennai Super Kings' },
  mi: { primary: '#004BA0', secondary: '#D4AF37', name: 'Mumbai Indians' },
  rcb: { primary: '#D4111E', secondary: '#000000', name: 'Royal Challengers Bengaluru' },
  kkr: { primary: '#3A225D', secondary: '#D4AF37', name: 'Kolkata Knight Riders' },
  dc: { primary: '#004C93', secondary: '#EF1C23', name: 'Delhi Capitals' },
  pbks: { primary: '#DD1F2D', secondary: '#AF9456', name: 'Punjab Kings' },
  rr: { primary: '#EA1A85', secondary: '#254AA5', name: 'Rajasthan Royals' },
  srh: { primary: '#FF822A', secondary: '#000000', name: 'Sunrisers Hyderabad' },
  gt: { primary: '#1C1C1C', secondary: '#00B5E2', name: 'Gujarat Titans' },
  lsg: { primary: '#A72056', secondary: '#FFCC00', name: 'Lucknow Super Giants' },
};

export const SQUAD_CONSTRAINTS = {
  MIN_SQUAD: 18,
  MAX_SQUAD: 25,
  MAX_OVERSEAS: 8,
} as const;


export const AI_STRATEGIES = ['aggressive', 'balanced', 'budget', 'starHunter', 'roleFocused'] as const;

export const TEAM_NEEDS_TEMPLATE = {
  batter: 6,
  bowler: 6,
  allRounder: 4,
  wicketkeeper: 2,
} as const;

export const AUCTION_TIMER = 30;
export const BID_RESET_TIMER = 10;
export const RTM_TIMER = 20;

export const formatPrice = (price: number): string => {
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
  return `₹${price.toLocaleString('en-IN')}`;
};

export const getNextBid = (currentBid: number): number => {
  const slab = PRICE_INCREMENTS.slice().reverse().find((p) => currentBid >= p.threshold);
  return currentBid + (slab?.increment || 500000);
};

export const generateGameCode = (): string => {
  const numbers = '0123456789';
  const randomDigits = Array.from({ length: 4 }, () => numbers[Math.floor(Math.random() * numbers.length)]).join('');
  return `CAIPL${randomDigits}`;
};
