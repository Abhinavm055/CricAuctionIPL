export const TEAM_LOGOS = {
  csk: 'https://documents.iplt20.com/ipl/franchises/1764224441_1731684872_1702465555_CSKroundbig.png',
  dc: 'https://documents.iplt20.com/ipl/franchises/1764224517_1731685245_1702465727_DCroundbig.png',
  gt: 'https://documents.iplt20.com/ipl/franchises/1764224585_1731685262_1702465836_GTroundbig.png',
  kkr: 'https://documents.iplt20.com/ipl/franchises/1764224710_1731685297_1702465948_KKRroundbig.png',
  lsg: 'https://documents.iplt20.com/ipl/franchises/1764224788_1731684320_1702466030_LSGroundbig.png',
  mi: 'https://documents.iplt20.com/ipl/franchises/1764224870_1731684308_1702466090_MIroundbig.png',
  pbks: 'https://documents.iplt20.com/ipl/franchises/1764224961_1731685190_1702466143_PBKSroundbig.png',
  rr: 'https://documents.iplt20.com/ipl/franchises/1764225018_1743157275_RRroundbig.png',
  rcb: 'https://documents.iplt20.com/ipl/franchises/1764225174_1731684948_1702466217_RCBroundbig.png',
  srh: 'https://documents.iplt20.com/ipl/franchises/1764225435_1731685022_1702466366_SRHroundbig.png',
} as const;

export const PLAYER_IMAGE_PLACEHOLDER = 'https://ui-avatars.com/api/?name=IPL+Player&background=0f172a&color=ffffff&size=256';

export const CSV_PLAYER_HEADERS = [
  'name',
  'role',
  'rating',
  'basePrice',
  'pool',
  'previousTeamId',
  'overseas',
  'nationality',
  'image',
  'isCapped',
] as const;

export const IPL_TEAMS = [
  { id: 'csk', name: 'Chennai Super Kings', shortName: 'CSK', color: 'team-csk', purse: 1200000000, logo: TEAM_LOGOS.csk },
  { id: 'mi', name: 'Mumbai Indians', shortName: 'MI', color: 'team-mi', purse: 1200000000, logo: TEAM_LOGOS.mi },
  { id: 'rcb', name: 'Royal Challengers Bengaluru', shortName: 'RCB', color: 'team-rcb', purse: 1200000000, logo: TEAM_LOGOS.rcb },
  { id: 'kkr', name: 'Kolkata Knight Riders', shortName: 'KKR', color: 'team-kkr', purse: 1200000000, logo: TEAM_LOGOS.kkr },
  { id: 'dc', name: 'Delhi Capitals', shortName: 'DC', color: 'team-dc', purse: 1200000000, logo: TEAM_LOGOS.dc },
  { id: 'pbks', name: 'Punjab Kings', shortName: 'PBKS', color: 'team-pbks', purse: 1200000000, logo: TEAM_LOGOS.pbks },
  { id: 'rr', name: 'Rajasthan Royals', shortName: 'RR', color: 'team-rr', purse: 1200000000, logo: TEAM_LOGOS.rr },
  { id: 'srh', name: 'Sunrisers Hyderabad', shortName: 'SRH', color: 'team-srh', purse: 1200000000, logo: TEAM_LOGOS.srh },
  { id: 'gt', name: 'Gujarat Titans', shortName: 'GT', color: 'team-gt', purse: 1200000000, logo: TEAM_LOGOS.gt },
  { id: 'lsg', name: 'Lucknow Super Giants', shortName: 'LSG', color: 'team-lsg', purse: 1200000000, logo: TEAM_LOGOS.lsg },
] as const;

export const PLAYER_ROLES = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'] as const;

export const AUCTION_POOLS = ['Marquee', 'Batters', 'All-Rounders', 'Wicketkeepers', 'Bowlers', 'Uncapped', 'Accelerated'] as const;

// Official IPL bid increments
export const PRICE_INCREMENTS = [
  { threshold: 0, increment: 500000 },
  { threshold: 10000000, increment: 500000 },
  { threshold: 20000000, increment: 1000000 },
  { threshold: 50000000, increment: 2000000 },
  { threshold: 50000001, increment: 2500000 },
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
  batter: 5,
  bowler: 5,
  allRounder: 3,
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
