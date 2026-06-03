import { MIN_PLAYER_BASE_PRICE, SQUAD_CONSTRAINTS } from '@/lib/constants';
import { getSmartIncrement } from '@/lib/playerValue';

export interface EnginePlayer {
  id: string;
  name?: string;
  role?: string;
  rating?: number;
  starRating?: number;
  overseas?: boolean;
  basePrice?: number;
  demandLevel?: 'low' | 'medium' | 'high';
  interestedTeams?: string[];
  dynamicValue?: number;
  formFactor?: number;
}

export interface EngineTeam {
  id: string;
  shortName?: string;
  isAI: boolean;
  squadSize: number;
  purseRemaining: number;
  overseasCount: number;
  roleNeeds?: Record<string, number>;
  aggressionLevel?: number;
  aiStrategy?: string;
}

type NormalizedRole = 'wicketkeeper' | 'batter' | 'allRounder' | 'bowler';

interface PersonalityProfile {
  aggression: number;
  starBias: number;
  valueDiscipline: number;
  roleBias: Partial<Record<NormalizedRole, number>>;
  overseasBias: number;
  veteranBias: number;
  youthBias: number;
  powerBias: number;
  risk: number;
}

const ROLE_TARGETS: Record<NormalizedRole, { min: number; ideal: number; max: number }> = {
  wicketkeeper: { min: 2, ideal: 3, max: 3 },
  batter: { min: 6, ideal: 7, max: 8 },
  allRounder: { min: 4, ideal: 5, max: 6 },
  bowler: { min: 6, ideal: 7, max: 8 },
};

const DEFAULT_PROFILE: PersonalityProfile = {
  aggression: 1,
  starBias: 1,
  valueDiscipline: 1,
  roleBias: {},
  overseasBias: 1,
  veteranBias: 1,
  youthBias: 1,
  powerBias: 1,
  risk: 1,
};

const TEAM_PROFILES: Record<string, PersonalityProfile> = {
  csk: { ...DEFAULT_PROFILE, aggression: 1.03, starBias: 1.04, valueDiscipline: 1.08, roleBias: { allRounder: 1.28, bowler: 1.12 }, veteranBias: 1.18 },
  mi: { ...DEFAULT_PROFILE, aggression: 1.16, starBias: 1.25, valueDiscipline: 0.98, roleBias: { bowler: 1.22, batter: 1.16 }, powerBias: 1.18 },
  rcb: { ...DEFAULT_PROFILE, aggression: 1.12, starBias: 1.32, valueDiscipline: 0.95, roleBias: { batter: 1.3 }, powerBias: 1.12 },
  rr: { ...DEFAULT_PROFILE, aggression: 0.95, starBias: 0.92, valueDiscipline: 1.2, roleBias: { batter: 1.08, bowler: 1.08 }, youthBias: 1.25 },
  kkr: { ...DEFAULT_PROFILE, aggression: 1.25, starBias: 1.18, valueDiscipline: 0.94, roleBias: { allRounder: 1.18, bowler: 1.08 }, risk: 1.18, powerBias: 1.16 },
  srh: { ...DEFAULT_PROFILE, aggression: 1.08, starBias: 1.15, valueDiscipline: 1, roleBias: { bowler: 1.3 }, overseasBias: 1.22, powerBias: 1.1 },
  pbks: { ...DEFAULT_PROFILE, aggression: 1.2, starBias: 1.1, valueDiscipline: 0.9, roleBias: { allRounder: 1.1, batter: 1.08 }, risk: 1.3 },
  gt: { ...DEFAULT_PROFILE, aggression: 1.02, starBias: 1.02, valueDiscipline: 1.12, roleBias: { batter: 1.08, bowler: 1.08, allRounder: 1.08, wicketkeeper: 1.08 } },
  lsg: { ...DEFAULT_PROFILE, aggression: 1.08, starBias: 1.08, valueDiscipline: 1.02, roleBias: { batter: 1.22, allRounder: 1.12 }, powerBias: 1.12 },
  dc: { ...DEFAULT_PROFILE, aggression: 1, starBias: 0.98, valueDiscipline: 1.16, roleBias: { batter: 1.1, wicketkeeper: 1.12 }, youthBias: 1.22 },
};

const STAR_PLAYER_NAMES = new Set([
  'virat kohli',
  'jasprit bumrah',
  'shubman gill',
  'yashasvi jaiswal',
  'rishabh pant',
  'rohit sharma',
  'suryakumar yadav',
  'surya',
  'ravindra jadeja',
  'sunil narine',
  'kl rahul',
]);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const roundToBidIncrement = (amount: number) => {
  const increment = getSmartIncrement(Math.max(0, amount));
  return Math.max(increment, Math.floor(amount / increment) * increment);
};

const normalizeRole = (role?: string): NormalizedRole => {
  const key = String(role || '').toLowerCase();
  if (key.includes('wicket') || key === 'wk') return 'wicketkeeper';
  if (key.includes('all') || key === 'ar') return 'allRounder';
  if (key.includes('bowl')) return 'bowler';
  return 'batter';
};

const getRoleNeed = (team: EngineTeam, role: NormalizedRole) => {
  const needs = team.roleNeeds || {};
  const explicitNeed = Number(needs[role] ?? needs[role.toLowerCase()] ?? 0);
  return Math.max(0, explicitNeed);
};

const getProfile = (team: EngineTeam): PersonalityProfile => {
  const idProfile = TEAM_PROFILES[String(team.id || '').toLowerCase()];
  const strategy = String(team.aiStrategy || '').toLowerCase();
  const base = idProfile || DEFAULT_PROFILE;

  if (strategy === 'aggressive') return { ...base, aggression: base.aggression * 1.12, valueDiscipline: base.valueDiscipline * 0.97 };
  if (strategy === 'budget') return { ...base, aggression: base.aggression * 0.86, valueDiscipline: base.valueDiscipline * 1.14 };
  if (strategy === 'starhunter') return { ...base, starBias: base.starBias * 1.22, aggression: base.aggression * 1.08 };
  if (strategy === 'rolefocused') return { ...base, aggression: base.aggression * 1.04, valueDiscipline: base.valueDiscipline * 1.05 };
  return base;
};

const hasProtectedPurseForBid = (team: EngineTeam, bidAmount: number) => {
  const squadSize = Number(team.squadSize || 0);
  const remainingSlots = Math.max(0, SQUAD_CONSTRAINTS.MAX_SQUAD - squadSize);
  const reserveNeeded = remainingSlots * MIN_PLAYER_BASE_PRICE;
  return Number(team.purseRemaining || 0) - bidAmount >= reserveNeeded;
};

const getProtectedBudget = (team: EngineTeam) => {
  const squadSize = Number(team.squadSize || 0);
  const remainingSlots = Math.max(0, SQUAD_CONSTRAINTS.MAX_SQUAD - squadSize);
  const reserveNeeded = remainingSlots * MIN_PLAYER_BASE_PRICE;
  return Math.max(0, Number(team.purseRemaining || 0) - reserveNeeded);
};

const isNamedStar = (player: EnginePlayer) => STAR_PLAYER_NAMES.has(String(player.name || '').trim().toLowerCase());
const getRating = (player: EnginePlayer) => clamp(Number(player.rating ?? player.starRating ?? 3), 1, 5);

const estimateDynamicValue = (team: EngineTeam, player: EnginePlayer, humanIsHighestBidder: boolean) => {
  const rating = getRating(player);
  const role = normalizeRole(player.role);
  const roleNeed = getRoleNeed(team, role);
  const target = ROLE_TARGETS[role];
  const profile = getProfile(team);
  const basePrice = Math.max(MIN_PLAYER_BASE_PRICE, Number(player.basePrice || MIN_PLAYER_BASE_PRICE));
  const suppliedDynamicValue = Number(player.dynamicValue || 0);
  const form = clamp(Number(player.formFactor || 1), 0.8, 1.22);
  const roleScarcity = role === 'wicketkeeper' ? 1.16 : role === 'allRounder' ? 1.14 : role === 'bowler' ? 1.08 : 1;
  const teamNeed = roleNeed > 0 ? 1 + Math.min(0.6, (roleNeed / target.min) * 0.3) : 0.88;
  const rolePersonality = profile.roleBias[role] || 1;
  const overseasBonus = player.overseas ? profile.overseasBias : 1;
  const star = rating >= 4.5 || isNamedStar(player);
  const starMultiplier = star ? 1.25 * profile.starBias : rating >= 4 ? 1.08 * profile.starBias : 1;
  const humanCounter = humanIsHighestBidder ? (star ? 1.22 : 1.1) : 1;

  const ratingValue = basePrice * (1.1 + rating * 0.82);
  const modeledValue = ratingValue * form * roleScarcity * teamNeed * rolePersonality * overseasBonus * starMultiplier * humanCounter;
  return Math.max(basePrice, suppliedDynamicValue, modeledValue);
};

const estimateMaximumBid = (team: EngineTeam, player: EnginePlayer, nextBid: number, humanIsHighestBidder: boolean) => {
  if (!hasProtectedPurseForBid(team, nextBid)) return 0;

  const squadSize = Number(team.squadSize || 0);
  const protectedBudget = getProtectedBudget(team);
  const rating = getRating(player);
  const role = normalizeRole(player.role);
  const roleNeed = getRoleNeed(team, role);
  const profile = getProfile(team);
  const star = rating >= 4.5 || isNamedStar(player);
  const completionRatio = clamp(squadSize / SQUAD_CONSTRAINTS.MAX_SQUAD, 0, 1);
  const dynamicValue = estimateDynamicValue(team, player, humanIsHighestBidder);

  let maxBid = dynamicValue * profile.aggression / profile.valueDiscipline;

  if (roleNeed > 0) maxBid *= role === 'wicketkeeper' ? 1.4 : role === 'bowler' ? 1.3 : role === 'allRounder' ? 1.26 : 1.2;
  if (star) maxBid *= humanIsHighestBidder ? 1.28 : 1.16;
  if (player.demandLevel === 'high') maxBid *= 1.08;
  if (player.demandLevel === 'low' && roleNeed <= 0 && !star) maxBid *= 0.9;
  if (Array.isArray(player.interestedTeams) && player.interestedTeams.includes(team.id)) maxBid *= 1.08;

  // As purse drops and squads are not complete, convert from superstar hunting to squad completion.
  const reservePressure = protectedBudget / Math.max(MIN_PLAYER_BASE_PRICE, Number(team.purseRemaining || 0));
  if (squadSize < 18 && roleNeed <= 0 && !star) maxBid *= 0.82;
  if (squadSize < 22 && roleNeed <= 0) maxBid *= 0.9;
  if (reservePressure < 0.35) maxBid *= 0.72;
  if (reservePressure < 0.2) maxBid *= 0.58;

  const absoluteStarCap = star ? 240_000_000 : rating >= 4 ? 160_000_000 : rating >= 3 ? 90_000_000 : 45_000_000;
  const dynamicCap = dynamicValue * (star ? 1.75 : rating >= 4 ? 1.45 : 1.25);
  const teamBuildingCap = protectedBudget * (completionRatio < 0.5 ? 0.32 : completionRatio < 0.72 ? 0.42 : 0.58);
  maxBid = Math.min(maxBid, absoluteStarCap, dynamicCap, teamBuildingCap, protectedBudget);

  const rounded = roundToBidIncrement(maxBid);
  return rounded >= nextBid && hasProtectedPurseForBid(team, rounded) ? rounded : 0;
};

export class AIEngine {
  getAIBid(team: EngineTeam, player: EnginePlayer, currentBid: number): number | null {
    if (!team.isAI) return null;
    if (team.squadSize >= SQUAD_CONSTRAINTS.MAX_SQUAD) return null;
    if (player.overseas && team.overseasCount >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) return null;

    const increment = getSmartIncrement(currentBid);
    const nextBid = currentBid + increment;
    const maxBid = estimateMaximumBid(team, player, nextBid, false);

    if (maxBid < nextBid) return null;
    return nextBid;
  }

  decideBid(team: EngineTeam, player: EnginePlayer, currentBid: number, humanIsHighestBidder = false): number | null {
    const increment = getSmartIncrement(currentBid);
    const nextBid = currentBid + increment;
    const maxBid = estimateMaximumBid(team, player, nextBid, humanIsHighestBidder);
    if (maxBid < nextBid) return null;

    const rating = getRating(player);
    const role = normalizeRole(player.role);
    const roleNeed = getRoleNeed(team, role);
    const profile = getProfile(team);
    const star = rating >= 4.5 || isNamedStar(player);
    const protectedBudget = getProtectedBudget(team);
    const reservePressure = protectedBudget / Math.max(MIN_PLAYER_BASE_PRICE, Number(team.purseRemaining || 0));

    let bidIntent = 0.28 + rating * 0.09;
    if (roleNeed > 0) bidIntent += role === 'wicketkeeper' ? 0.22 : role === 'bowler' ? 0.18 : 0.15;
    if (star) bidIntent += 0.28;
    if (humanIsHighestBidder) bidIntent += star ? 0.22 : 0.1;
    if (player.demandLevel === 'high') bidIntent += 0.08;
    if (player.demandLevel === 'low' && roleNeed <= 0 && !star) bidIntent -= 0.08;
    if (team.squadSize < 18 && roleNeed > 0) bidIntent += 0.12;
    if (team.squadSize < 22 && roleNeed > 0) bidIntent += 0.08;
    if (reservePressure < 0.35 && roleNeed <= 0 && !star) bidIntent -= 0.18;
    bidIntent *= profile.aggression;

    if (Math.random() > clamp(bidIntent, 0.08, star || roleNeed > 0 ? 0.98 : 0.86)) return null;
    return nextBid;
  }

  decideForAuction(teams: EngineTeam[], player: EnginePlayer, currentBid: number, currentBidderId?: string | null) {
    const currentBidder = teams.find((team) => team.id === currentBidderId);
    const humanIsHighestBidder = Boolean(currentBidderId && currentBidder && !currentBidder.isAI);
    const nextBid = currentBid + getSmartIncrement(currentBid);

    const candidates = teams
      .filter((team) => team.isAI && team.id !== currentBidderId)
      .map((team) => ({
        teamId: team.id,
        bid: this.decideBid(team, player, currentBid, humanIsHighestBidder),
        maxBid: estimateMaximumBid(team, player, nextBid, humanIsHighestBidder),
      }))
      .filter((choice): choice is { teamId: string; bid: number; maxBid: number } => Number.isFinite(choice.bid as number));

    if (!candidates.length) return null;

    // Highest squad-improving valuation usually responds, with slight randomness for personality variety.
    const pick = candidates.sort((a, b) => (b.maxBid - a.maxBid) || (Math.random() - 0.5))[0];
    return { teamId: pick.teamId, bid: pick.bid, delayMs: 800 + Math.floor(Math.random() * 1400) };
  }

  aiUseRTM(player: EnginePlayer, bid: number) {
    const rating = getRating(player);
    const star = rating >= 4.5 || isNamedStar(player);
    const referenceValue = Math.max(Number(player.dynamicValue || 0), Number(player.basePrice || 0) * (1.1 + rating * 0.82));
    return bid <= referenceValue * (star ? 1.45 : 1.18);
  }

  aiFinalRTMDecision(player: EnginePlayer, newBid: number) {
    const rating = getRating(player);
    const star = rating >= 4.5 || isNamedStar(player);
    const referenceValue = Math.max(Number(player.dynamicValue || 0), Number(player.basePrice || 0) * (1.1 + rating * 0.82));
    return newBid <= referenceValue * (star ? 1.55 : 1.25);
  }

  simulateSkipOutcome(player: EnginePlayer, teams: EngineTeam[]) {
    const aiTeams = teams.filter((team) => team.isAI);
    if (!aiTeams.length) return { sold: false as const };

    const baseBid = Number(player.basePrice || MIN_PLAYER_BASE_PRICE);
    const eligible = aiTeams
      .map((team) => ({ team, bid: this.getAIBid(team, player, baseBid) }))
      .filter((entry): entry is { team: EngineTeam; bid: number } => Number.isFinite(entry.bid as number));

    if (!eligible.length) return { sold: false as const };

    const pick = eligible.sort((a, b) => b.bid - a.bid)[0];
    const finalPrice = roundToBidIncrement(Math.max(baseBid, pick.bid));
    return { sold: true as const, teamId: pick.team.id, price: finalPrice };
  }
}
