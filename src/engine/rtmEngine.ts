import { getNextBid, RTM_TIMER } from "@/lib/constants";

export type RtmStage = "NONE" | "AVAILABLE" | "COUNTER_BID" | "FINAL";
export type RtmAction = "USE" | "DECLINE" | "COUNTER" | "MATCH";

interface TriggerInput {
  previousTeamId: string;
  winningTeamId: string;
  playerRating: number;
  rtmCards: number;
}

interface InitStateInput {
  playerId: string;
  playerName: string;
  winningTeamId: string;
  winningTeamName: string;
  originalTeamId: string;
  originalTeamName: string;
  finalBid: number;
}

interface TransitionInput {
  stage: RtmStage;
  action: RtmAction;
  actingTeamId: string;
  rtmTeamId: string;
  winningTeamId: string;
  finalBid: number;
  counterBid: number;
  playerName: string;
}

export class RtmEngine {
  shouldTrigger(input: TriggerInput) {
    return Boolean(
      input.previousTeamId &&
      input.previousTeamId !== input.winningTeamId &&
      Number(input.playerRating || 0) >= 4 &&
      Number(input.rtmCards || 0) > 0,
    );
  }

  createInitialState(input: InitStateInput) {
    return {
      rtmStage: "AVAILABLE" as RtmStage,
      rtmTeamId: input.originalTeamId,
      rtmWinningTeamId: input.winningTeamId,
      rtmPlayerId: input.playerId,
      rtmFinalBid: Number(input.finalBid || 0),
      rtmCounterBid: getNextBid(Number(input.finalBid || 0)),
      rtmExpiresAtMs: Date.now() + RTM_TIMER * 1000,
      commentary: [
        `${input.winningTeamName} wins ${input.playerName} for ₹${(input.finalBid / 10000000).toFixed(2)} Cr`,
        `${input.originalTeamName} has the option to use RTM`,
      ],
    };
  }

  timeoutAction(stage: RtmStage): RtmAction {
    if (stage === "AVAILABLE") return "DECLINE";
    if (stage === "COUNTER_BID") return "DECLINE";
    return "DECLINE";
  }

  transition(input: TransitionInput) {
    if (input.stage === "AVAILABLE") {
      if (input.actingTeamId !== input.rtmTeamId) throw new Error("Only RTM team can decide availability stage");
      if (input.action === "DECLINE") return { done: true, winnerTeamId: input.winningTeamId, finalBid: input.finalBid, rtmUsed: false, commentary: [] as string[] };
      if (input.action !== "USE") throw new Error("Invalid RTM action at availability stage");
      return {
        done: false,
        nextStage: "COUNTER_BID" as RtmStage,
        finalBid: input.finalBid,
        counterBid: input.counterBid,
        commentary: [`RTM used for ${input.playerName}`],
      };
    }

    if (input.stage === "COUNTER_BID") {
      if (input.actingTeamId !== input.winningTeamId) throw new Error("Only provisional winner can counter bid");
      if (input.action === "DECLINE") return { done: true, winnerTeamId: input.rtmTeamId, finalBid: input.finalBid, rtmUsed: true, commentary: [] as string[] };
      if (input.action !== "COUNTER") throw new Error("Invalid RTM action at counter stage");
      return {
        done: false,
        nextStage: "FINAL" as RtmStage,
        finalBid: input.counterBid,
        counterBid: getNextBid(input.counterBid),
        commentary: [`Counter bid set for ${input.playerName}`],
      };
    }

    if (input.stage === "FINAL") {
      if (input.actingTeamId !== input.rtmTeamId) throw new Error("Only RTM team can decide final stage");
      if (input.action === "MATCH") return { done: true, winnerTeamId: input.rtmTeamId, finalBid: input.finalBid, rtmUsed: true, commentary: [] as string[] };
      if (input.action === "DECLINE") return { done: true, winnerTeamId: input.winningTeamId, finalBid: input.finalBid, rtmUsed: true, commentary: [] as string[] };
      throw new Error("Invalid RTM action at final stage");
    }

    throw new Error("Invalid RTM stage");
  }
}
