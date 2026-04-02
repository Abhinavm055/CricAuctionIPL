import { SQUAD_CONSTRAINTS, getNextBid } from '@/lib/constants';

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

interface RtmInput {
  previousTeamId: string;
  winningTeamId: string;
  playerRating: number;
  rtmCards: number;
}

export class AuctionEngine {
  validateBid(input: BidValidationInput) {
    const nextBid = getNextBid(Number(input.currentBid || 0));
    if (input.amount !== nextBid) throw new Error('Bid must match next increment');
    if (input.currentBidderId === input.teamId) throw new Error('Consecutive bids not allowed');
    if (Number(input.purseRemaining || 0) < input.amount) throw new Error('Insufficient purse');
    if (Number(input.squadSize || 0) >= SQUAD_CONSTRAINTS.MAX_SQUAD) throw new Error('Squad full');
    if (input.isPlayerOverseas && Number(input.overseasCount || 0) >= SQUAD_CONSTRAINTS.MAX_OVERSEAS) {
      throw new Error('Overseas limit reached');
    }
  }

  shouldTriggerRtm(input: RtmInput) {
    return Boolean(
      input.previousTeamId &&
      input.previousTeamId !== input.winningTeamId &&
      Number(input.playerRating || 0) >= 4 &&
      Number(input.rtmCards || 0) > 0,
    );
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
