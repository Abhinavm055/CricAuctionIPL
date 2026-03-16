import { SQUAD_CONSTRAINTS, getNextBid } from '@/lib/constants';

export interface EnginePlayer {
  id: string;
  name?: string;
  role?: string;
  rating?: number;
  overseas?: boolean;
  basePrice?: number;
}

export interface EngineTeam {
  id: string;
  isAI: boolean;
  squadSize: number;
  purseRemaining: number;
  overseasCount: number;
  roleNeeds?: Record<string, number>;
  aggressionLevel?: number;
}

const normalizeRole = (role?: string) => {
  const key = String(role || '').toLowerCase();
  if (key.includes('wicket')) return 'wicketkeeper';
  if (key.includes('all')) return 'allRounder';
  if (key.includes('bowl')) return 'bowler';
  return 'batter';
};

const CR = 10_000_000;
const STAR_PLAYER_NAMES = new Set([
  'virat kohli',
  'rohit sharma',
  'jasprit bumrah',
  'hardik pandya',
  'shubman gill',
  'rishabh pant',
]);

const ratingBandOffsets: Record<number, { min: number; max: number }> = {
  1: { min: 0, max: 2 * CR },
  2: { min: 0, max: 4 * CR },
  3: { min: 1 * CR, max: 9 * CR },
  4: { min: 4 * CR, max: 15 * CR },
  5: { min: 8 * CR, max: 20 * CR },
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

export class AIEngine {
  private getTargetPrice(team: EngineTeam, player: EnginePlayer) {
    const rating = Math.max(1, Math.min(5, Math.round(Number(player.rating || 1))));
    const basePrice = Math.max(0, Number(player.basePrice || 0));
    const range = ratingBandOffsets[rating] || ratingBandOffsets[3];

    let targetPrice = basePrice + randomBetween(range.min, range.max);

    const roleNeed = Math.max(0, Number(team.roleNeeds?.[normalizeRole(player.role)] || 0));
    if (roleNeed > 0) {
      targetPrice += 2 * CR;
      targetPrice += Math.min(2, roleNeed - 1) * 0.5 * CR;
    }

    const aggression = Number.isFinite(team.aggressionLevel) ? Number(team.aggressionLevel) : 1;
    targetPrice *= Math.max(0.85, Math.min(1.25, aggression));

    targetPrice += randomBetween(-1 * CR, 1.5 * CR);

    const isStarPlayer = STAR_PLAYER_NAMES.has(String(player.name || '').trim().toLowerCase());
    const hardCap = isStarPlayer ? 20 * CR : 16 * CR;

    return Math.max(basePrice, Math.min(targetPrice, hardCap));
  }

  decideBid(team: EngineTeam, player: EnginePlayer, currentBid: number): number | null {
    if (!team.isAI) return null;
    if (team.squadSize >= SQUAD_CONSTRAINTS.MAX_SQUAD) return null;
    if (player.overseas && team.overseasCount >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) return null;

    const playersNeeded = Math.max(0, SQUAD_CONSTRAINTS.MIN_SQUAD - team.squadSize);
    const minReserve = playersNeeded * 2_000_000;
    const nextBid = getNextBid(currentBid);

    if (team.purseRemaining < minReserve || team.purseRemaining < nextBid) return null;

    const targetPrice = this.getTargetPrice(team, player);
    const maxBid = Math.min(targetPrice, Math.max(0, team.purseRemaining - minReserve));

    if (nextBid > maxBid) return null;

    const roleNeed = Math.max(0, Number(team.roleNeeds?.[normalizeRole(player.role)] || 0));
    const bidIntent = 0.45 + Math.min(roleNeed, 3) * 0.12;
    if (Math.random() > Math.min(0.92, bidIntent)) return null;

    return nextBid;
  }

  decideForAuction(teams: EngineTeam[], player: EnginePlayer, currentBid: number, currentBidderId?: string | null) {
    const candidates = teams
      .filter((team) => team.isAI && team.id !== currentBidderId)
      .map((team) => ({ teamId: team.id, bid: this.decideBid(team, player, currentBid) }))
      .filter((choice): choice is { teamId: string; bid: number } => Number.isFinite(choice.bid as number));

    if (!candidates.length) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return { ...pick, delayMs: 800 + Math.floor(Math.random() * 2200) };
  }
}
