import { RETENTION_COSTS } from '@/lib/constants';

interface RetentionPlayer {
  id: string;
  rating?: number;
  role?: string;
  isCapped?: boolean;
  overseas?: boolean;
  previousTeamId?: string;
}

export class RetentionEngine {
  decideRetentions(teamId: string, players: RetentionPlayer[]) {
    const pool = players.filter((p) => String(p.previousTeamId || '').toLowerCase() === teamId.toLowerCase());

    const ranked = pool
      .map((player) => ({
        player,
        score: Number(player.rating || 0) * 10 + (String(player.role || '').toLowerCase().includes('all') ? 3 : 1),
      }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.player);

    const target = Math.max(2, Math.min(5, ranked.length));
    const selected: RetentionPlayer[] = [];
    let capped = 0;
    let uncapped = 0;

    for (const player of ranked) {
      if (selected.length >= target) break;
      if (player.isCapped && capped >= 5) continue;
      if (!player.isCapped && uncapped >= 2) continue;
      selected.push(player);
      if (player.isCapped) capped += 1;
      else uncapped += 1;
    }

    const priceMap: Record<string, number> = {};
    let cappedSlot = 0;
    let spend = 0;

    selected.forEach((player) => {
      const cost = player.isCapped
        ? RETENTION_COSTS.CAPPED_SLOTS[Math.min(cappedSlot, RETENTION_COSTS.CAPPED_SLOTS.length - 1)]
        : RETENTION_COSTS.UNCAPPED;
      priceMap[player.id] = cost;
      spend += cost;
      if (player.isCapped) cappedSlot += 1;
    });

    return {
      retainedIds: selected.map((p) => p.id),
      cappedCount: capped,
      uncappedCount: uncapped,
      spend,
      overseasCount: selected.filter((p) => Boolean(p.overseas)).length,
      priceMap,
    };
  }
}
