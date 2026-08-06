import { SQUAD_CONSTRAINTS, getNextBid, formatPrice } from '@/lib/constants';

interface BidValidationInput {
  amount: number;
  currentBid: number;
  currentBidderId: string | null;
  teamId: string;
  purseRemaining: number;
  squadSize: number;
  overseasCount: number;
  isPlayerOverseas: boolean;
}

interface AuctionEndInput {
  queueIndex: number;
  queueLength: number;
  teamSquadSizes: number[];
}

export class AuctionEngine {
  validateBid(input: BidValidationInput) {
    const currentBid = Number(input.currentBid || 0);
    const minNextBid = getNextBid(currentBid);

    if (input.currentBidderId === input.teamId) {
      throw new Error('You are already the highest bidder');
    }

    if (input.amount <= currentBid) {
      throw new Error(`Bid amount (${formatPrice(input.amount)}) must be higher than current bid (${formatPrice(currentBid)})`);
    }

    if (input.amount < minNextBid) {
      throw new Error(`Bid amount (${formatPrice(input.amount)}) is below the required next increment (${formatPrice(minNextBid)})`);
    }

    if (Number(input.purseRemaining || 0) < input.amount) {
      throw new Error(`Insufficient purse remaining (${formatPrice(input.purseRemaining)} available, ${formatPrice(input.amount)} needed)`);
    }

    if (Number(input.squadSize || 0) >= SQUAD_CONSTRAINTS.MAX_SQUAD) {
      throw new Error(`Squad is full (${SQUAD_CONSTRAINTS.MAX_SQUAD} players max limit reached)`);
    }

    if (input.isPlayerOverseas && Number(input.overseasCount || 0) >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) {
      throw new Error(`Overseas player limit reached (${SQUAD_CONSTRAINTS.MAX_OVERSEAS} overseas players max)`);
    }
  }

  canResolveTimer(status: string) {
    return status === "RUNNING";
  }

  shouldEndAuction(input: AuctionEndInput) {
    const queueProcessed = input.queueIndex >= input.queueLength;
    const allTeamsFull = input.teamSquadSizes.every((size) => size >= SQUAD_CONSTRAINTS.MAX_SQUAD);
    return queueProcessed || allTeamsFull;
  }

  isEliminated(squadSize: number) {
    return Number(squadSize || 0) < SQUAD_CONSTRAINTS.MIN_SQUAD;
  }
}
