export const IPL_TEAMS = [
  { id: 'csk', name: 'Chennai Super Kings', shortName: 'CSK', color: 'team-csk', purse: 1200000000 },
  { id: 'mi', name: 'Mumbai Indians', shortName: 'MI', color: 'team-mi', purse: 1200000000 },
  { id: 'rcb', name: 'Royal Challengers Bengaluru', shortName: 'RCB', color: 'team-rcb', purse: 1200000000 },
  { id: 'kkr', name: 'Kolkata Knight Riders', shortName: 'KKR', color: 'team-kkr', purse: 1200000000 },
  { id: 'dc', name: 'Delhi Capitals', shortName: 'DC', color: 'team-dc', purse: 1200000000 },
  { id: 'pbks', name: 'Punjab Kings', shortName: 'PBKS', color: 'team-pbks', purse: 1200000000 },
  { id: 'rr', name: 'Rajasthan Royals', shortName: 'RR', color: 'team-rr', purse: 1200000000 },
  { id: 'srh', name: 'Sunrisers Hyderabad', shortName: 'SRH', color: 'team-srh', purse: 1200000000 },
  { id: 'gt', name: 'Gujarat Titans', shortName: 'GT', color: 'team-gt', purse: 1200000000 },
  { id: 'lsg', name: 'Lucknow Super Giants', shortName: 'LSG', color: 'team-lsg', purse: 1200000000 },
] as const;

export const PLAYER_ROLES = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'] as const;

export const AUCTION_POOLS = ['Marquee', 'Batsmen', 'Bowlers', 'All-Rounders', 'Wicket-Keepers'] as const;

// Official IPL Auction Price Slabs
export const PRICE_INCREMENTS = [
  { threshold: 0, increment: 500000 },           // Up to ₹1 Cr: ₹5 Lakh
  { threshold: 10000000, increment: 1000000 },   // ₹1 Cr to ₹2 Cr: ₹10 Lakh
  { threshold: 20000000, increment: 2000000 },   // ₹2 Cr to ₹5 Cr: ₹20 Lakh
  { threshold: 50000000, increment: 2500000 },   // ₹5 Cr+: ₹25 Lakh
] as const;

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

export const AUCTION_TIMER = 30;

export const formatPrice = (price: number): string => {
  if (price >= 10000000) {
    return `₹${(price / 10000000).toFixed(2)} Cr`;
  } else if (price >= 100000) {
    return `₹${(price / 100000).toFixed(2)} L`;
  }
  return `₹${price.toLocaleString('en-IN')}`;
};

export const getNextBid = (currentBid: number): number => {
  const increment = PRICE_INCREMENTS.slice().reverse().find(p => currentBid >= p.threshold);
  return currentBid + (increment?.increment || 500000);
};

export const generateGameCode = (): string => {
  const numbers = '0123456789';
  const randomDigits = Array.from({ length: 4 }, () => numbers[Math.floor(Math.random() * numbers.length)]).join('');
  
  return `CAIPL${randomDigits}`;
};
