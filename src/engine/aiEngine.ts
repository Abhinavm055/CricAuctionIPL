import { SQUAD_CONSTRAINTS } from '@/lib/constants';
import { getSmartIncrement } from '@/lib/playerValue';

export interface EnginePlayer {
  id: string;
  role?: string;
  rating?: number;
  starRating?: number;
  overseas?: boolean;
  basePrice?: number;
  demandLevel?: 'low' | 'medium' | 'high';
  interestedTeams?: string[];
  dynamicValue?: number;
}

export interface EngineTeam {
  id: string;
  isAI: boolean;
  squadSize: number;
  purseRemaining: number;
  overseasCount: number;
  roleNeeds?: Record<string, number>;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class AIEngine {
  getAIBid(team: EngineTeam, player: EnginePlayer, currentBid: number): number | null {
    if (!team.isAI) return null;
    if (team.squadSize >= SQUAD_CONSTRAINTS.MAX_SQUAD) return null;
    if (player.overseas && team.overseasCount >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) return null;

    const playersNeeded = Math.max(0, SQUAD_CONSTRAINTS.MIN_SQUAD - team.squadSize);
    const minReserve = playersNeeded * 2_000_000;
    const maxBudget = Math.max(0, Number(team.purseRemaining || 0) - minReserve);
    const maxValue = Number(player.dynamicValue || player.basePrice || 0) * (1.2 + Math.random() * 0.3);

    if (currentBid >= maxValue || currentBid >= maxBudget) return null;

    const increment = getSmartIncrement(currentBid);
    const nextBid = Math.min(currentBid + increment, maxBudget);

    if (nextBid <= currentBid) return null;
    if (nextBid > maxValue) return null;

    return nextBid;
  }

  decideBid(team: EngineTeam, player: EnginePlayer, currentBid: number): number | null {
    const candidateBid = this.getAIBid(team, player, currentBid);
    if (!candidateBid) return null;

    const rating = clamp(Number(player.rating ?? player.starRating ?? 3), 1, 5);
    const interestBoost = Array.isArray(player.interestedTeams) && player.interestedTeams.includes(team.id) ? 0.12 : 0;
    const demandBoost = player.demandLevel === 'high' ? 0.18 : player.demandLevel === 'low' ? -0.08 : 0;
    const aggressionBoost = clamp(Number(team.aggressionLevel || 1) - 1, -0.1, 0.18);
    const bidIntent = clamp(0.35 + rating * 0.1 + interestBoost + demandBoost + aggressionBoost, 0.25, 0.94);

    if (Math.random() > bidIntent) return null;
    return candidateBid;
  }

  decideForAuction(teams: EngineTeam[], player: EnginePlayer, currentBid: number, currentBidderId?: string | null) {
    const candidates = teams
      .filter((team) => team.isAI && team.id !== currentBidderId)
      .map((team) => ({ teamId: team.id, bid: this.decideBid(team, player, currentBid) }))
      .filter((choice): choice is { teamId: string; bid: number } => Number.isFinite(choice.bid as number));

    if (!candidates.length) return null;

    const pick = candidates.sort(() => Math.random() - 0.5)[0];
    return { ...pick, delayMs: 900 + Math.floor(Math.random() * 1800) };
  }

  aiUseRTM(player: EnginePlayer, bid: number) {
    return bid < Number(player.dynamicValue || player.basePrice || 0) * 1.1;
  }

  aiFinalRTMDecision(player: EnginePlayer, newBid: number) {
    return newBid <= Number(player.dynamicValue || player.basePrice || 0) * 1.2;
  }

  simulateSkipOutcome(player: EnginePlayer, teams: EngineTeam[]) {
    const aiTeams = teams.filter((team) => team.isAI);
    if (!aiTeams.length) return { sold: false as const };

    const eligible = aiTeams
      .map((team) => ({ team, bid: this.getAIBid(team, player, Number(player.basePrice || 0)) }))
      .filter((entry): entry is { team: EngineTeam; bid: number } => Number.isFinite(entry.bid as number));

    if (!eligible.length) return { sold: false as const };

    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    const finalPrice = Math.round(Math.max(Number(player.basePrice || 0), pick.bid) / 500_000) * 500_000;
    return { sold: true as const, teamId: pick.team.id, price: finalPrice };
  }
}
