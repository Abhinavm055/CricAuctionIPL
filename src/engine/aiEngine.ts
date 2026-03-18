import { SQUAD_CONSTRAINTS, getNextBid } from '@/lib/constants';

export interface EnginePlayer {
  id: string;
  role?: string;
  rating?: number;
  overseas?: boolean;
  basePrice?: number;
  demandLevel?: 'low' | 'medium' | 'high';
  interestedTeams?: string[];
}

export interface EngineTeam {
  id: string;
  isAI: boolean;
  squadSize: number;
  purseRemaining: number;
  overseasCount: number;
  roleNeeds?: Record<string, number>;
}

const CR = 10_000_000;
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const normalizeDemand = (demand: string | undefined, rating: number) => {
  if (demand === 'low' || demand === 'medium' || demand === 'high') return demand;
  if (rating >= 80) return 'high';
  if (rating >= 55) return 'medium';
  return 'low';
};

export class AIEngine {
  private getTargetPrice(team: EngineTeam, player: EnginePlayer) {
    const basePrice = Math.max(0, Number(player.basePrice || 0));
    const rating = clamp(Number(player.rating || 50), 0, 100);
    const demand = normalizeDemand(player.demandLevel, rating);

    let multiplier = 1;

    if (demand === 'high' && basePrice <= 2 * CR) multiplier = randomBetween(4, 6);
    else if (demand === 'high') multiplier = randomBetween(2.2, 3.8);
    else if (demand === 'medium') multiplier = randomBetween(1.5, 3);
    else multiplier = randomBetween(1, 1.25);

    if (rating >= 85) multiplier += randomBetween(0.8, 1.4);
    else if (rating >= 60) multiplier += randomBetween(0.35, 0.9);
    else if (rating < 35) multiplier -= randomBetween(0.05, 0.3);

    const interested = Array.isArray(player.interestedTeams) && player.interestedTeams.includes(team.id);
    if (interested) multiplier += randomBetween(0.15, 0.45);

    multiplier += randomBetween(-0.2, 0.4);

    const aggression = Number.isFinite(team.aggressionLevel) ? Number(team.aggressionLevel) : 1;
    multiplier *= clamp(aggression, 0.85, 1.25);

    const target = basePrice * clamp(multiplier, 1, 6.2);
    const hardCap = rating >= 90 ? 25 * CR : 18 * CR;

    return clamp(target, basePrice, hardCap);
  }

  decideBid(team: EngineTeam, player: EnginePlayer, currentBid: number): number | null {
    if (!team.isAI) return null;
    if (team.squadSize >= SQUAD_CONSTRAINTS.MAX_SQUAD) return null;
    if (player.overseas && team.overseasCount >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) return null;

    const nextBid = getNextBid(currentBid);
    const playersNeeded = Math.max(0, SQUAD_CONSTRAINTS.MIN_SQUAD - team.squadSize);
    const minReserve = playersNeeded * 2_000_000;
    if (team.purseRemaining < minReserve || team.purseRemaining < nextBid) return null;

    const rating = clamp(Number(player.rating || 50), 0, 100);
    const demand = normalizeDemand(player.demandLevel, rating);
    const targetPrice = this.getTargetPrice(team, player);
    const maxBid = Math.min(targetPrice, Math.max(0, team.purseRemaining - minReserve));

    if (nextBid > maxBid) return null;

    let bidIntent = 0.42;
    if (rating >= 85) bidIntent += 0.28;
    else if (rating >= 60) bidIntent += 0.14;
    else if (rating < 35) bidIntent -= 0.1;

    if (demand === 'high') bidIntent += 0.2;
    if (demand === 'low') bidIntent -= 0.12;
    if (Array.isArray(player.interestedTeams) && player.interestedTeams.includes(team.id)) bidIntent += 0.12;
    if (rating < 30 && Math.random() > 0.45) return null;

    if (Math.random() > clamp(bidIntent, 0.2, 0.94)) return null;
    return nextBid;
  }

  decideForAuction(teams: EngineTeam[], player: EnginePlayer, currentBid: number, currentBidderId?: string | null) {
    const candidates = teams
      .filter((team) => team.isAI && team.id !== currentBidderId)
      .map((team) => ({ teamId: team.id, bid: this.decideBid(team, player, currentBid) }))
      .filter((choice): choice is { teamId: string; bid: number } => Number.isFinite(choice.bid as number));

    if (!candidates.length) return null;

    const weighted = candidates.sort(() => Math.random() - 0.5);
    const pick = weighted[0];
    return { ...pick, delayMs: 800 + Math.floor(Math.random() * 1700) };
  }

  simulateSkipOutcome(player: EnginePlayer, teams: EngineTeam[]) {
    const aiTeams = teams.filter((team) => team.isAI);
    if (!aiTeams.length) return { sold: false as const };

    const interested = (player.interestedTeams || []).filter((id) => aiTeams.some((t) => t.id === id));
    const pool = interested.length ? aiTeams.filter((t) => interested.includes(t.id)) : aiTeams;
    const winner = pool[Math.floor(Math.random() * pool.length)] || aiTeams[0];

    if (!winner) return { sold: false as const };

    const target = this.getTargetPrice(winner, player);
    const price = Math.round(Math.max(Number(player.basePrice || 0), target) / 500_000) * 500_000;
    return { sold: true as const, teamId: winner.id, price };
  }
}
