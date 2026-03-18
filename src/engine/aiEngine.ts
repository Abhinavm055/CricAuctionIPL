import { SQUAD_CONSTRAINTS, getNextBid } from '@/lib/constants';

export interface EnginePlayer {
  id: string;
  role?: string;
  rating?: number;
  overseas?: boolean;
}

export interface EngineTeam {
  id: string;
  isAI: boolean;
  squadSize: number;
  purseRemaining: number;
  overseasCount: number;
  roleNeeds?: Record<string, number>;
}

const normalizeRole = (role?: string) => {
  const key = String(role || '').toLowerCase();
  if (key.includes('wicket')) return 'wicketkeeper';
  if (key.includes('all')) return 'allRounder';
  if (key.includes('bowl')) return 'bowler';
  return 'batter';
};

export class AIEngine {
  decideBid(team: EngineTeam, player: EnginePlayer, currentBid: number): number | null {
    if (!team.isAI) return null;
    if (team.squadSize >= SQUAD_CONSTRAINTS.MAX_SQUAD) return null;
    if (player.overseas && team.overseasCount >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) return null;

    const playersNeeded = Math.max(0, SQUAD_CONSTRAINTS.MIN_SQUAD - team.squadSize);
    const minReserve = playersNeeded * 2_000_000;
    const nextBid = getNextBid(currentBid);

    if (team.purseRemaining < minReserve || team.purseRemaining < nextBid) return null;

    const rating = Number(player.rating || 0);
    const baseMax = rating >= 5 ? 200_000_000 : rating >= 4 ? 100_000_000 : 40_000_000;

    const roleNeed = Math.max(0, Number(team.roleNeeds?.[normalizeRole(player.role)] || 0));
    const needBoost = 1 + Math.min(roleNeed, 3) * 0.08;
    const maxBid = Math.min(baseMax * needBoost, Math.max(0, team.purseRemaining - minReserve));

    if (nextBid > maxBid) return null;
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
