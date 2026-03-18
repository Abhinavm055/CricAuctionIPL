import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { Howl } from "howler";
import { Menu, Pause, Play, SkipForward, Users, LogOut, PlusCircle, Wifi, WifiOff } from "lucide-react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type AuctionMode = "AI" | "MULTI";
type DemandLevel = "low" | "medium" | "high";
type TeamController = "AI" | "USER";
type AuctionStatus = "idle" | "running" | "sold" | "unsold" | "ended" | "paused";
type RtmCase = "AI_VS_AI" | "PLAYER_VS_AI" | "PLAYER_VS_PLAYER" | "AI_VS_PLAYER";

interface AuctionPlayer {
  id: string;
  name: string;
  role: string;
  country: string;
  basePrice: number;
  rating: number;
  demandLevel: DemandLevel;
  previousTeam: string;
  previousTeamId?: string;
  image: string;
  interestedTeams: string[];
}

interface AuctionSet {
  id: string;
  role: string;
  label: string;
  players: AuctionPlayer[];
}

interface TeamState {
  id: string;
  name: string;
  shortName: string;
  color: string;
  purse: number;
  spent: number;
  players: AuctionPlayer[];
  controller: TeamController;
  ownerName?: string;
  badge: string;
  bidCount: number;
  rtm: number;
}

interface SoldPlayerRecord {
  player: AuctionPlayer;
  teamId: string;
  teamName: string;
  price: number;
  viaRtm?: boolean;
}

interface PendingRtm {
  playerId: string;
  originalTeamId: string;
  winningTeamId: string;
  price: number;
  caseType: RtmCase;
}

interface AiSimulationScene {
  playerId: string;
  queuedTeams: string[];
  activeTeams: string[];
  enteredTeams: string[];
  exitedTeams: string[];
  maxBids: Record<string, number>;
}

interface AuctionState {
  mode: AuctionMode;
  roomCode?: string;
  currentPlayer: AuctionPlayer | null;
  currentBid: number;
  biddingTeam: string | null;
  timer: number;
  currentSet: string;
  remainingPlayers: AuctionSet[];
  teams: TeamState[];
  soldPlayers: SoldPlayerRecord[];
  hasBiddingStarted: boolean;
  ticker: string[];
  recentPurchases: SoldPlayerRecord[];
  status: AuctionStatus;
  isPaused: boolean;
  joinClosed: boolean;
  hostId?: string;
  hostName?: string;
  winnerTeamId?: string;
  pendingRtm?: PendingRtm | null;
}

const TEAM_BLUEPRINTS = [
  ["csk", "Chennai Super Kings", "CSK", "from-yellow-400 via-amber-300 to-yellow-600", "🦁"],
  ["mi", "Mumbai Indians", "MI", "from-sky-500 via-blue-500 to-indigo-600", "🌊"],
  ["rcb", "Royal Challengers Bengaluru", "RCB", "from-rose-600 via-red-500 to-red-700", "👑"],
  ["kkr", "Kolkata Knight Riders", "KKR", "from-violet-500 via-purple-500 to-fuchsia-700", "🛡️"],
  ["dc", "Delhi Capitals", "DC", "from-sky-400 via-blue-500 to-cyan-500", "🐯"],
  ["pbks", "Punjab Kings", "PBKS", "from-red-500 via-rose-500 to-orange-500", "🔥"],
  ["rr", "Rajasthan Royals", "RR", "from-pink-500 via-fuchsia-500 to-rose-500", "💎"],
  ["srh", "Sunrisers Hyderabad", "SRH", "from-orange-500 via-amber-500 to-red-500", "🦅"],
  ["gt", "Gujarat Titans", "GT", "from-slate-500 via-slate-400 to-blue-400", "⚡"],
  ["lsg", "Lucknow Super Giants", "LSG", "from-cyan-400 via-sky-400 to-blue-500", "🛫"],
] as const;

const ROLE_SETS: AuctionSet[] = [
  {
    id: "bat-1",
    role: "Batter",
    label: "Batter Set 1",
    players: [
      createPlayer("Virat Kohli", "Batter", "India", 2, 95, "high", "RCB", "rcb", ["rcb", "csk", "mi", "gt"]),
      createPlayer("Ruturaj Gaikwad", "Batter", "India", 1.5, 88, "high", "CSK", "csk", ["csk", "rr", "dc"]),
      createPlayer("Devon Conway", "Batter", "New Zealand", 1, 84, "medium", "CSK", "csk", ["csk", "gt", "lsg"]),
      createPlayer("Yashasvi Jaiswal", "Batter", "India", 1, 90, "high", "RR", "rr", ["rr", "mi", "pbks"]),
      createPlayer("Shubman Gill", "Batter", "India", 2, 93, "high", "GT", "gt", ["gt", "kkr", "dc", "mi"]),
      createPlayer("Faf du Plessis", "Batter", "South Africa", 1.5, 82, "medium", "RCB", "rcb", ["rcb", "dc", "srh"]),
      createPlayer("Prithvi Shaw", "Batter", "India", 0.75, 69, "low", "DC", "dc", ["dc", "pbks"]),
      createPlayer("Sai Sudharsan", "Batter", "India", 0.75, 82, "medium", "GT", "gt", ["gt", "lsg", "rr"]),
    ],
  },
  {
    id: "bat-2",
    role: "Batter",
    label: "Batter Set 2",
    players: [
      createPlayer("Suryakumar Yadav", "Batter", "India", 1.5, 92, "high", "MI", "mi", ["mi", "kkr", "srh"]),
      createPlayer("Rinku Singh", "Batter", "India", 1, 85, "high", "KKR", "kkr", ["kkr", "pbks", "rr"]),
      createPlayer("David Warner", "Batter", "Australia", 1.25, 78, "medium", "DC", "dc", ["dc", "srh", "pbks"]),
      createPlayer("Rahul Tripathi", "Batter", "India", 0.75, 74, "medium", "SRH", "srh", ["srh", "pbks", "rr"]),
      createPlayer("Tilak Varma", "Batter", "India", 1, 87, "high", "MI", "mi", ["mi", "dc", "gt"]),
      createPlayer("Harry Brook", "Batter", "England", 1, 76, "medium", "DC", "dc", ["dc", "srh", "lsg"]),
      createPlayer("Abdul Samad", "Batter", "India", 0.3, 62, "low", "SRH", "srh", ["srh", "pbks"]),
      createPlayer("Anmolpreet Singh", "Batter", "India", 0.2, 58, "low", "SRH", "srh", ["pbks", "srh"]),
    ],
  },
  {
    id: "ar-1",
    role: "All-Rounder",
    label: "All-Rounder Set 1",
    players: [
      createPlayer("Hardik Pandya", "All-Rounder", "India", 2, 91, "high", "MI", "mi", ["mi", "gt", "csk"]),
      createPlayer("Andre Russell", "All-Rounder", "West Indies", 2, 89, "high", "KKR", "kkr", ["kkr", "pbks", "mi"]),
      createPlayer("Ravindra Jadeja", "All-Rounder", "India", 2, 90, "high", "CSK", "csk", ["csk", "rr", "dc"]),
      createPlayer("Marcus Stoinis", "All-Rounder", "Australia", 1.5, 82, "medium", "LSG", "lsg", ["lsg", "srh", "dc"]),
      createPlayer("Liam Livingstone", "All-Rounder", "England", 1.25, 84, "high", "PBKS", "pbks", ["pbks", "rr", "rcb"]),
      createPlayer("Shahbaz Ahmed", "All-Rounder", "India", 0.5, 66, "low", "SRH", "srh", ["srh", "rcb"]),
      createPlayer("Washington Sundar", "All-Rounder", "India", 0.75, 73, "medium", "SRH", "srh", ["srh", "csk", "gt"]),
      createPlayer("Romario Shepherd", "All-Rounder", "West Indies", 0.5, 65, "medium", "MI", "mi", ["mi", "dc"]),
    ],
  },
  {
    id: "wk-1",
    role: "Wicket-Keeper",
    label: "Wicket-Keeper Set 1",
    players: [
      createPlayer("MS Dhoni", "Wicket-Keeper", "India", 1, 80, "medium", "CSK", "csk", ["csk", "rr"]),
      createPlayer("KL Rahul", "Wicket-Keeper", "India", 1.75, 88, "high", "LSG", "lsg", ["lsg", "rcb", "pbks"]),
      createPlayer("Rishabh Pant", "Wicket-Keeper", "India", 1.5, 90, "high", "DC", "dc", ["dc", "mi", "csk"]),
      createPlayer("Jitesh Sharma", "Wicket-Keeper", "India", 0.75, 77, "medium", "PBKS", "pbks", ["pbks", "rr", "dc"]),
      createPlayer("Ishan Kishan", "Wicket-Keeper", "India", 1.25, 85, "high", "MI", "mi", ["mi", "gt", "srh"]),
      createPlayer("Quinton de Kock", "Wicket-Keeper", "South Africa", 1.25, 82, "medium", "LSG", "lsg", ["lsg", "dc", "mi"]),
      createPlayer("Anuj Rawat", "Wicket-Keeper", "India", 0.2, 58, "low", "RCB", "rcb", ["rcb"]),
    ],
  },
  {
    id: "bowl-1",
    role: "Bowler",
    label: "Bowler Set 1",
    players: [
      createPlayer("Jasprit Bumrah", "Bowler", "India", 2, 94, "high", "MI", "mi", ["mi", "gt", "dc"]),
      createPlayer("Mohammed Shami", "Bowler", "India", 1.5, 87, "high", "GT", "gt", ["gt", "pbks", "dc"]),
      createPlayer("Rashid Khan", "Bowler", "Afghanistan", 2, 93, "high", "GT", "gt", ["gt", "srh", "mi"]),
      createPlayer("Yuzvendra Chahal", "Bowler", "India", 1, 85, "high", "RR", "rr", ["rr", "rcb", "pbks"]),
      createPlayer("Arshdeep Singh", "Bowler", "India", 0.75, 82, "medium", "PBKS", "pbks", ["pbks", "dc", "lsg"]),
      createPlayer("T Natarajan", "Bowler", "India", 0.75, 78, "medium", "SRH", "srh", ["srh", "csk"]),
      createPlayer("Mukesh Kumar", "Bowler", "India", 0.5, 63, "low", "DC", "dc", ["dc", "pbks"]),
      createPlayer("Noor Ahmad", "Bowler", "Afghanistan", 0.5, 74, "medium", "GT", "gt", ["gt", "rr", "mi"]),
    ],
  },
];

const DEFAULT_TIMER = 12;
const BID_TIMING = [800, 1500] as const;
const ROOM_PREFIX = "IPL";
const STORAGE_KEY = "cricauctionipl-user";
const TEAM_LIMIT = 9;
const speechSounds = {
  tick: new Howl({ src: [tinyTone("tick")], volume: 0.3 }),
  cheer: new Howl({ src: [tinyTone("cheer")], volume: 0.45 }),
  ooo: new Howl({ src: [tinyTone("ooo")], volume: 0.4 }),
  sold: new Howl({ src: [tinyTone("sold")], volume: 0.45 }),
};

function createPlayer(
  name: string,
  role: string,
  country: string,
  basePrice: number,
  rating: number,
  demandLevel: DemandLevel,
  previousTeam: string,
  previousTeamId: string,
  interestedTeams: string[],
): AuctionPlayer {
  const imageId = encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"));
  return {
    id: `${imageId}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    role,
    country,
    basePrice,
    rating,
    demandLevel,
    previousTeam,
    previousTeamId,
    interestedTeams,
    image: `https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80&sig=${imageId}`,
  };
}

function tinyTone(kind: "tick" | "cheer" | "ooo" | "sold") {
  const tones: Record<typeof kind, string> = {
    tick: "data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YTAAAAAAgICAf39/f4CAgH9/f39/gICAf39/f4CAgA==",
    cheer: "data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YTAAAAAAgYGBn5+foKCgoJ+fn5+goKCgn5+fn6CgoA==",
    ooo: "data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YTAAAAAAgICAgoKCgYGBgICAgIGBgYKCgoKBgYEA",
    sold: "data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YTAAAAAAf39/gICAgYGBgH9/f4CAgIGBgYB/f38=",
  };
  return tones[kind];
}

function generateTeams(mode: AuctionMode): TeamState[] {
  return TEAM_BLUEPRINTS.map(([id, name, shortName, color, badge]) => ({
    id,
    name,
    shortName,
    color,
    purse: 100,
    spent: 0,
    players: [],
    controller: mode === "AI" ? "AI" : TEAM_LIMIT >= 0 ? "AI" : "USER",
    badge,
    bidCount: 0,
    rtm: 1,
  }));
}

function createInitialAuctionState(mode: AuctionMode, roomCode?: string, hostId?: string, hostName?: string): AuctionState {
  const remainingPlayers = ROLE_SETS.map((set) => ({ ...set, players: [...set.players] }));
  const teams = generateTeams(mode);
  const next = shiftNextPlayer(remainingPlayers);
  return {
    mode,
    roomCode,
    currentPlayer: next.player,
    currentBid: next.player?.basePrice ?? 0,
    biddingTeam: null,
    timer: DEFAULT_TIMER,
    currentSet: next.currentSet,
    remainingPlayers: next.remainingPlayers,
    teams,
    soldPlayers: [],
    hasBiddingStarted: false,
    ticker: next.player ? [`Next player ${next.player.name} enters ${next.currentSet}.`] : ["Auction completed."],
    recentPurchases: [],
    status: next.player ? "running" : "ended",
    isPaused: false,
    joinClosed: false,
    hostId,
    hostName,
    winnerTeamId: undefined,
    pendingRtm: null,
  };
}

function shiftNextPlayer(sets: AuctionSet[]) {
  const cloned = sets.map((set) => ({ ...set, players: [...set.players] }));
  while (cloned.length > 0 && cloned[0].players.length === 0) {
    cloned.shift();
  }
  if (!cloned.length) {
    return { player: null, currentSet: "Auction Complete", remainingPlayers: [] as AuctionSet[] };
  }
  const [activeSet, ...rest] = cloned;
  const [player, ...players] = activeSet.players;
  return {
    player,
    currentSet: activeSet.label,
    remainingPlayers: [{ ...activeSet, players }, ...rest],
  };
}

function getIncrement(currentBid: number) {
  if (currentBid < 1) return 0.1;
  if (currentBid < 2) return 0.2;
  if (currentBid < 5) return 0.25;
  if (currentBid < 10) return 0.5;
  return 1;
}

function formatCrores(value: number) {
  return `₹${value.toFixed(2)} CR`;
}

function appendTicker(state: AuctionState, line: string) {
  return [line, ...state.ticker].slice(0, 12);
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function computeTargetPrice(player: AuctionPlayer) {
  const demandFactor = player.demandLevel === "high" ? 2.8 : player.demandLevel === "medium" ? 1.6 : 1.05;
  const ratingFactor = 0.65 + player.rating / 100;
  const volatility = 0.8 + Math.random() * 0.7;
  const raw = player.basePrice * demandFactor * ratingFactor * volatility;
  const floor = player.basePrice * (player.demandLevel === "low" ? 0.95 : 1.2);
  const ceiling = Math.max(player.basePrice + 0.2, raw);
  return Number(Math.max(floor, ceiling).toFixed(2));
}

function autoResolvePlayer(state: AuctionState): AuctionState {
  const player = state.currentPlayer;
  if (!player) return state;
  const unsoldProbability = player.rating < 65 ? 0.34 : player.demandLevel === "low" ? 0.2 : 0.08;
  if (Math.random() < unsoldProbability) {
    return {
      ...state,
      status: "unsold",
      ticker: appendTicker(state, `${player.name} remains UNSOLD at ${formatCrores(state.currentBid)}.`),
    };
  }

  const candidateTeams = pickInterestedTeams(state.teams, player, null);
  const winningTeam = balanceTeams(candidateTeams)[0] ?? state.teams[0];
  const finalPrice = computeTargetPrice(player);
  return sellPlayer({ ...state, currentBid: finalPrice, biddingTeam: winningTeam.id, winnerTeamId: winningTeam.id }, winningTeam.id, false);
}

function pickInterestedTeams(teams: TeamState[], player: AuctionPlayer, currentBidder: string | null) {
  const filtered = teams.filter((team) => team.purse >= player.basePrice && team.id !== currentBidder);
  const interested = filtered.filter((team) => player.interestedTeams.includes(team.id));
  return interested.length ? interested : filtered;
}

function balanceTeams(teams: TeamState[]) {
  return [...teams].sort((a, b) => {
    const aScore = a.players.length * 0.65 + a.spent * 0.35;
    const bScore = b.players.length * 0.65 + b.spent * 0.35;
    return aScore - bScore;
  });
}

function sellPlayer(state: AuctionState, teamId: string, viaRtm: boolean) {
  const player = state.currentPlayer;
  if (!player) return state;
  const price = state.currentBid;
  const teams = state.teams.map((team) =>
    team.id === teamId
      ? {
          ...team,
          purse: Number((team.purse - price).toFixed(2)),
          spent: Number((team.spent + price).toFixed(2)),
          players: [...team.players, player],
        }
      : team,
  );
  const winner = teams.find((team) => team.id === teamId)!;
  const record: SoldPlayerRecord = { player, teamId, teamName: winner.shortName, price, viaRtm };
  return {
    ...state,
    teams,
    soldPlayers: [record, ...state.soldPlayers],
    recentPurchases: [record, ...state.recentPurchases].slice(0, 5),
    status: "sold",
    ticker: appendTicker(state, `${player.name} sold to ${winner.shortName} for ${formatCrores(price)}${viaRtm ? " via RTM" : ""}.`),
    winnerTeamId: teamId,
    pendingRtm: null,
  };
}

function shouldOfferRtm(state: AuctionState, teamId: string) {
  const player = state.currentPlayer;
  if (!player?.previousTeamId || player.previousTeamId === teamId) return false;
  const original = state.teams.find((team) => team.id === player.previousTeamId);
  return Boolean(original && original.rtm > 0);
}

function createPendingRtm(state: AuctionState, winningTeamId: string): PendingRtm | null {
  const player = state.currentPlayer;
  if (!player?.previousTeamId || player.previousTeamId === winningTeamId) return null;
  const original = state.teams.find((team) => team.id === player.previousTeamId);
  const winner = state.teams.find((team) => team.id === winningTeamId);
  if (!original || !winner || original.rtm <= 0) return null;
  const caseType: RtmCase = original.controller === "AI"
    ? winner.controller === "AI" ? "AI_VS_AI" : "AI_VS_PLAYER"
    : winner.controller === "AI" ? "PLAYER_VS_AI" : "PLAYER_VS_PLAYER";
  return { playerId: player.id, originalTeamId: original.id, winningTeamId, price: state.currentBid, caseType };
}

function resolveHumanBid(state: AuctionState, teamId: string): AuctionState {
  const team = state.teams.find((entry) => entry.id === teamId);
  if (!state.currentPlayer || !team || team.id === state.biddingTeam || team.purse < state.currentBid + getIncrement(state.currentBid)) {
    return state;
  }
  const nextBid = Number((state.currentBid + getIncrement(state.currentBid)).toFixed(2));
  return {
    ...state,
    currentBid: nextBid,
    biddingTeam: teamId,
    timer: DEFAULT_TIMER,
    hasBiddingStarted: true,
    teams: state.teams.map((entry) => entry.id === teamId ? { ...entry, bidCount: entry.bidCount + 1 } : entry),
    ticker: appendTicker(state, `${team.shortName} bids ${formatCrores(nextBid)} for ${state.currentPlayer.name}.`),
    status: "running",
  };
}

function resolveSaleOrUnsold(state: AuctionState): AuctionState {
  if (!state.currentPlayer) return state;
  if (!state.biddingTeam) {
    return {
      ...state,
      status: "unsold",
      ticker: appendTicker(state, `${state.currentPlayer.name} goes unsold.`),
    };
  }

  const pendingRtm = createPendingRtm(state, state.biddingTeam);
  if (pendingRtm) {
    return {
      ...state,
      pendingRtm,
      status: "paused",
      ticker: appendTicker(state, `RTM check for ${state.currentPlayer.name}: ${pendingRtm.caseType.replaceAll("_", " vs ")}.`),
    };
  }

  return sellPlayer(state, state.biddingTeam, false);
}

function resolveRtm(state: AuctionState, useRtm: boolean): AuctionState {
  if (!state.pendingRtm) return state;
  const originalTeam = state.teams.find((team) => team.id === state.pendingRtm?.originalTeamId);
  if (!originalTeam) return sellPlayer(state, state.pendingRtm.winningTeamId, false);
  if (!useRtm) {
    return sellPlayer(state, state.pendingRtm.winningTeamId, false);
  }
  const teams = state.teams.map((team) => team.id === originalTeam.id ? { ...team, rtm: Math.max(0, team.rtm - 1) } : team);
  return sellPlayer({ ...state, teams }, originalTeam.id, true);
}

function moveToNextPlayer(state: AuctionState, sold: boolean): AuctionState {
  const next = shiftNextPlayer(state.remainingPlayers);
  if (!next.player) {
    return {
      ...state,
      currentPlayer: null,
      currentBid: 0,
      biddingTeam: null,
      timer: 0,
      currentSet: "Auction Complete",
      remainingPlayers: [],
      status: "ended",
      joinClosed: true,
      pendingRtm: null,
      ticker: appendTicker(state, sold ? "Auction complete after latest sale." : "Auction complete after final player."),
    };
  }
  return {
    ...state,
    currentPlayer: next.player,
    currentBid: next.player.basePrice,
    biddingTeam: null,
    timer: DEFAULT_TIMER,
    currentSet: next.currentSet,
    remainingPlayers: next.remainingPlayers,
    hasBiddingStarted: false,
    status: "running",
    winnerTeamId: undefined,
    pendingRtm: null,
    ticker: appendTicker(state, `Next player ${next.player.name}. ${next.currentSet} now live.`),
  };
}

function skipSet(state: AuctionState) {
  if (state.hasBiddingStarted || !state.remainingPlayers.length) return state;
  const [, ...rest] = state.remainingPlayers;
  const next = shiftNextPlayer(rest);
  if (!next.player) {
    return { ...state, currentPlayer: null, currentBid: 0, biddingTeam: null, timer: 0, currentSet: "Auction Complete", remainingPlayers: [], status: "ended", joinClosed: true };
  }
  return {
    ...state,
    currentPlayer: next.player,
    currentBid: next.player.basePrice,
    biddingTeam: null,
    timer: DEFAULT_TIMER,
    currentSet: next.currentSet,
    remainingPlayers: next.remainingPlayers,
    hasBiddingStarted: false,
    status: "running",
    ticker: appendTicker(state, `Skipping to ${next.currentSet}. ${next.player.name} comes up next.`),
  };
}

function addMidAuctionPlayer(state: AuctionState, player: AuctionPlayer, mode: "CURRENT" | "SUPPLEMENTARY") {
  if (mode === "CURRENT" && state.remainingPlayers.length) {
    const [currentSet, ...rest] = state.remainingPlayers;
    return {
      ...state,
      remainingPlayers: [{ ...currentSet, players: [...currentSet.players, player] }, ...rest],
      ticker: appendTicker(state, `${player.name} added to ${currentSet.label}.`),
    };
  }
  const supplementary: AuctionSet = {
    id: `supp-${Date.now()}`,
    role: player.role,
    label: "Supplementary Set",
    players: [player],
  };
  return {
    ...state,
    remainingPlayers: [...state.remainingPlayers, supplementary],
    ticker: appendTicker(state, `${player.name} added into Supplementary Set.`),
  };
}

function buildAiScene(state: AuctionState): AiSimulationScene | null {
  if (!state.currentPlayer) return null;
  const candidates = balanceTeams(pickInterestedTeams(state.teams, state.currentPlayer, null))
    .filter((team) => team.controller === "AI")
    .slice(0, Math.max(2, Math.min(4, state.currentPlayer.interestedTeams.length || 3)));

  if (!candidates.length) return null;

  const maxBids = Object.fromEntries(
    candidates.map((team) => {
      const appetite = 0.88 + Math.random() * 0.32;
      return [team.id, Number((computeTargetPrice(state.currentPlayer!) * appetite).toFixed(2))];
    }),
  );

  return {
    playerId: state.currentPlayer.id,
    queuedTeams: candidates.map((team) => team.id),
    activeTeams: [],
    enteredTeams: [],
    exitedTeams: [],
    maxBids,
  };
}

function serialiseState(state: AuctionState) {
  return JSON.parse(JSON.stringify(state));
}

function getStoredIdentity() {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) return JSON.parse(cached) as { id: string; name: string };
  const identity = { id: crypto.randomUUID(), name: `Manager-${Math.floor(Math.random() * 900 + 100)}` };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

function App() {
  const identity = useMemo(() => getStoredIdentity(), []);
  const [mode, setMode] = useState<AuctionMode>("AI");
  const [auctionState, setAuctionState] = useState<AuctionState>(() => createInitialAuctionState("AI"));
  const [selectedTeamId, setSelectedTeamId] = useState<string>("mi");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [managerName, setManagerName] = useState(identity.name);
  const [pendingJoinState, setPendingJoinState] = useState<AuctionState | null>(null);
  const [pendingJoinRoomCode, setPendingJoinRoomCode] = useState("");
  const [joinTeamChoice, setJoinTeamChoice] = useState<string | null>(null);
  const [firebaseOnline, setFirebaseOnline] = useState(true);
  const [remainingOpen, setRemainingOpen] = useState(false);
  const [addPlayerName, setAddPlayerName] = useState("");
  const [addPlayerCountry, setAddPlayerCountry] = useState("India");
  const [addPlayerRole, setAddPlayerRole] = useState("Batter");
  const [addPlayerMode, setAddPlayerMode] = useState<"CURRENT" | "SUPPLEMENTARY">("CURRENT");
  const pendingAiTimer = useRef<number | null>(null);
  const aiSceneRef = useRef<AiSimulationScene | null>(null);
  const stateRef = useRef<AuctionState>(auctionState);
  const countdownMarks = useRef<Set<number>>(new Set());
  const roomUnsubscribe = useRef<null | (() => void)>(null);
  const selectedTeam = useMemo(() => auctionState.teams.find((team) => team.id === selectedTeamId) ?? auctionState.teams[0], [auctionState.teams, selectedTeamId]);
  const isHost = auctionState.mode === "AI" || auctionState.hostId === identity.id;
  const skipLocked = auctionState.mode === "MULTI" && auctionState.hasBiddingStarted;
  const bidAmount = useMemo(() => Number((auctionState.currentBid + getIncrement(auctionState.currentBid)).toFixed(2)), [auctionState.currentBid]);
  const canBid = Boolean(auctionState.currentPlayer && selectedTeam && selectedTeam.purse >= bidAmount && auctionState.status === "running" && !auctionState.isPaused && selectedTeam.id !== auctionState.biddingTeam);

  useEffect(() => {
    stateRef.current = auctionState;
  }, [auctionState]);

  const speak = useCallback((line: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.rate = 1;
    utterance.pitch = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const syncToFirebase = useCallback(async (nextState: AuctionState) => {
    if (nextState.mode !== "MULTI" || !nextState.roomCode) return;
    try {
      await updateDoc(doc(db, "auctionRooms", nextState.roomCode), {
        state: serialiseState(nextState),
        updatedAt: serverTimestamp(),
      });
      setFirebaseOnline(true);
    } catch {
      setFirebaseOnline(false);
    }
  }, []);

  const applyState = useCallback((updater: AuctionState | ((current: AuctionState) => AuctionState), sync = true) => {
    setAuctionState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (sync) {
        queueMicrotask(() => {
          void syncToFirebase(next);
        });
      }
      return next;
    });
  }, [syncToFirebase]);

  const createAiRoom = useCallback(() => {
    setMode("AI");
    aiSceneRef.current = null;
    setPendingJoinState(null);
    setPendingJoinRoomCode("");
    setJoinTeamChoice(null);
    applyState(createInitialAuctionState("AI"), false);
  }, [applyState]);

  const createMultiplayerRoom = useCallback(async () => {
    const roomCode = `${ROOM_PREFIX}${Math.floor(1000 + Math.random() * 9000)}`;
    const state = createInitialAuctionState("MULTI", roomCode, identity.id, managerName);
    aiSceneRef.current = null;
    state.teams = state.teams.map((team, index) => index === 0 ? { ...team, controller: "USER", ownerName: managerName } : team);
    setSelectedTeamId(state.teams[0].id);
    setMode("MULTI");
    setPendingJoinState(null);
    setPendingJoinRoomCode("");
    setJoinTeamChoice(null);
    applyState(state, false);
    try {
      await setDoc(doc(db, "auctionRooms", roomCode), {
        state: serialiseState(state),
        hostId: identity.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setFirebaseOnline(true);
      roomUnsubscribe.current?.();
      roomUnsubscribe.current = onSnapshot(doc(db, "auctionRooms", roomCode), (snapshot) => {
        const data = snapshot.data() as { state?: AuctionState } | undefined;
        if (data?.state) {
          setAuctionState(data.state);
          setMode("MULTI");
        }
      });
    } catch {
      setFirebaseOnline(false);
    }
  }, [applyState, identity.id, managerName]);

  const joinRoom = useCallback(async () => {
    const roomCode = roomCodeInput.trim().toUpperCase();
    if (!roomCode) return;
    try {
      const snapshot = await getDoc(doc(db, "auctionRooms", roomCode));
      if (!snapshot.exists()) {
        setFirebaseOnline(false);
        return;
      }
      const remote = snapshot.data() as { state: AuctionState };
      const canJoin = !remote.state.joinClosed && remote.state.status !== "ended" && !(remote.state.hasBiddingStarted && remote.state.timer <= 3);
      if (!canJoin) return;
      const openTeams = remote.state.teams.filter((team) => team.controller === "AI");
      if (!openTeams.length) return;
      setPendingJoinState(remote.state);
      setPendingJoinRoomCode(roomCode);
      setJoinTeamChoice(openTeams[0].id);
      aiSceneRef.current = null;
      setFirebaseOnline(true);
    } catch {
      setFirebaseOnline(false);
    }
  }, [roomCodeInput]);

  const confirmJoinRoom = useCallback(async () => {
    if (!pendingJoinState || !pendingJoinRoomCode || !joinTeamChoice) return;
    const nextState = {
      ...pendingJoinState,
      teams: pendingJoinState.teams.map((team) =>
        team.id === joinTeamChoice ? { ...team, controller: "USER", ownerName: managerName } : team,
      ),
    };
    try {
      setSelectedTeamId(joinTeamChoice);
      setMode("MULTI");
      aiSceneRef.current = null;
      applyState(nextState, false);
      await updateDoc(doc(db, "auctionRooms", pendingJoinRoomCode), {
        state: serialiseState(nextState),
        updatedAt: serverTimestamp(),
      });
      roomUnsubscribe.current?.();
      roomUnsubscribe.current = onSnapshot(doc(db, "auctionRooms", pendingJoinRoomCode), (docSnap) => {
        const data = docSnap.data() as { state?: AuctionState } | undefined;
        if (data?.state) {
          setAuctionState(data.state);
          setMode("MULTI");
        }
      });
      setPendingJoinState(null);
      setPendingJoinRoomCode("");
      setJoinTeamChoice(null);
      setFirebaseOnline(true);
    } catch {
      setFirebaseOnline(false);
    }
  }, [applyState, joinTeamChoice, managerName, pendingJoinRoomCode, pendingJoinState]);

  const leaveRoom = useCallback(() => {
    roomUnsubscribe.current?.();
    roomUnsubscribe.current = null;
    createAiRoom();
  }, [createAiRoom]);

  const togglePause = useCallback(() => {
    if (!isHost) return;
    applyState((current) => ({
      ...current,
      isPaused: !current.isPaused,
      status: current.isPaused ? "running" : "paused",
      ticker: appendTicker(current, current.isPaused ? "Auction resumes live." : "Auction paused by host."),
    }));
  }, [applyState, isHost]);

  const handleBid = useCallback(() => {
    if (!canBid || !selectedTeam) return;
    applyState((current) => resolveHumanBid(current, selectedTeam.id));
  }, [applyState, canBid, selectedTeam]);

  const handleSkipPlayer = useCallback(() => {
    if (!isHost || (auctionState.mode === "MULTI" && skipLocked)) return;
    applyState((current) => current.mode === "AI" ? autoResolvePlayer(current) : moveToNextPlayer({ ...current, ticker: appendTicker(current, `${current.currentPlayer?.name ?? "Player"} skipped by host.`) }, false));
  }, [applyState, auctionState.mode, isHost, skipLocked]);

  const handleSkipSet = useCallback(() => {
    if (!isHost || (auctionState.mode === "MULTI" && skipLocked)) return;
    applyState((current) => skipSet(current));
  }, [applyState, auctionState.mode, isHost, skipLocked]);

  const handleAddMidAuctionPlayer = useCallback(() => {
    if (!addPlayerName.trim()) return;
    const player = createPlayer(addPlayerName.trim(), addPlayerRole, addPlayerCountry, 0.2, 64, "medium", "Free Agent", "", TEAM_BLUEPRINTS.map(([id]) => id));
    applyState((current) => addMidAuctionPlayer(current, player, addPlayerMode));
    setAddPlayerName("");
  }, [addPlayerCountry, addPlayerMode, addPlayerName, addPlayerRole, applyState]);

  const resolvePendingRtmDecision = useCallback((useRtm: boolean) => {
    applyState((current) => resolveRtm(current, useRtm));
  }, [applyState]);

  useEffect(() => {
    document.title = auctionState.mode === "AI" ? "Auction" : `Room ${auctionState.roomCode ?? "IPL"}`;
  }, [auctionState.mode, auctionState.roomCode]);

  useEffect(() => {
    if (auctionState.isPaused || auctionState.status === "ended" || auctionState.status === "sold" || auctionState.status === "unsold") return;
    if (auctionState.pendingRtm) return;
    const timer = window.setTimeout(() => {
      applyState((current) => {
        if (current.isPaused || current.status === "ended") return current;
        if (current.timer <= 1) return resolveSaleOrUnsold({ ...current, timer: 0 });
        return { ...current, timer: current.timer - 1 };
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [applyState, auctionState.isPaused, auctionState.pendingRtm, auctionState.status, auctionState.timer]);

  useEffect(() => {
    if (auctionState.timer <= 4 && auctionState.timer > 0 && !countdownMarks.current.has(auctionState.timer)) {
      countdownMarks.current.add(auctionState.timer);
      speechSounds.tick.play();
      if (auctionState.timer === 4) speak("Going once");
      if (auctionState.timer === 2) speak("Going twice");
    }
    if (auctionState.timer > 4) countdownMarks.current.clear();
  }, [auctionState.timer, speak]);

  useEffect(() => {
    if (auctionState.status === "sold" && auctionState.winnerTeamId) {
      const winner = auctionState.teams.find((team) => team.id === auctionState.winnerTeamId);
      speak(`Sold to ${winner?.shortName ?? "team"}`);
      speechSounds.sold.play();
      speechSounds.cheer.play();
    }
    if (auctionState.status === "unsold") {
      speak("Unsold");
      speechSounds.ooo.play();
    }
    if ((auctionState.status === "sold" || auctionState.status === "unsold") && auctionState.currentPlayer) {
      const timeout = window.setTimeout(() => applyState((current) => current.status === "sold" || current.status === "unsold" ? moveToNextPlayer(current, current.status === "sold") : current), 1600);
      return () => clearTimeout(timeout);
    }
  }, [applyState, auctionState.currentPlayer, auctionState.mode, auctionState.status, auctionState.teams, auctionState.winnerTeamId, speak]);

  useEffect(() => {
    if (auctionState.status !== "running" || auctionState.isPaused || auctionState.pendingRtm || !auctionState.currentPlayer) return;

    if (aiSceneRef.current?.playerId !== auctionState.currentPlayer.id) {
      aiSceneRef.current = buildAiScene(auctionState);
    }

    const scene = aiSceneRef.current;
    if (!scene) return;

    if (pendingAiTimer.current) window.clearTimeout(pendingAiTimer.current);

    pendingAiTimer.current = window.setTimeout(() => {
      const current = stateRef.current;
      const activeScene = aiSceneRef.current;

      if (!activeScene || !current.currentPlayer || activeScene.playerId !== current.currentPlayer.id || current.status !== "running" || current.isPaused || current.pendingRtm) {
        return;
      }

      const nextBid = Number((current.currentBid + getIncrement(current.currentBid)).toFixed(2));

      if (activeScene.enteredTeams.length < 2 && activeScene.queuedTeams.length) {
        const teamId = activeScene.queuedTeams.shift()!;
        activeScene.enteredTeams.push(teamId);
        activeScene.activeTeams.push(teamId);
        applyState((state) => {
          const team = state.teams.find((entry) => entry.id === teamId);
          if (!team) return state;
          return {
            ...state,
            ticker: appendTicker(state, `${team.shortName} enter the bidding for ${state.currentPlayer?.name ?? "this player"}.`),
          };
        });
        return;
      }

      const viableTeams = activeScene.activeTeams.filter((teamId) => activeScene.maxBids[teamId] >= nextBid);
      activeScene.activeTeams = viableTeams;

      if (activeScene.queuedTeams.length && (viableTeams.length < 2 || Math.random() < 0.35)) {
        const teamId = activeScene.queuedTeams.shift()!;
        activeScene.enteredTeams.push(teamId);
        activeScene.activeTeams.push(teamId);
        applyState((state) => {
          const team = state.teams.find((entry) => entry.id === teamId);
          if (!team) return state;
          return {
            ...state,
            ticker: appendTicker(state, `${team.shortName} join late at ${formatCrores(state.currentBid)}.`),
          };
        });
        return;
      }

      const exitCandidates = activeScene.activeTeams.filter((teamId) => teamId !== current.biddingTeam && activeScene.maxBids[teamId] < nextBid * 1.05);
      if (exitCandidates.length) {
        const teamId = exitCandidates[0];
        activeScene.activeTeams = activeScene.activeTeams.filter((entry) => entry !== teamId);
        activeScene.exitedTeams.push(teamId);
        applyState((state) => {
          const team = state.teams.find((entry) => entry.id === teamId);
          if (!team) return state;
          return {
            ...state,
            ticker: appendTicker(state, `${team.shortName} exit the race at ${formatCrores(state.currentBid)}.`),
          };
        });
        return;
      }

      const bidders = activeScene.activeTeams.filter((teamId) => teamId !== current.biddingTeam && activeScene.maxBids[teamId] >= nextBid);
      if (!bidders.length) return;

      const bidderId = balanceTeams(current.teams.filter((team) => bidders.includes(team.id)))[0]?.id ?? bidders[0];
      applyState((state) => resolveHumanBid(state, bidderId));
    }, randomBetween(BID_TIMING[0], BID_TIMING[1]));

    return () => {
      if (pendingAiTimer.current) window.clearTimeout(pendingAiTimer.current);
    };
  }, [applyState, auctionState, auctionState.biddingTeam, auctionState.currentPlayer, auctionState.isPaused, auctionState.pendingRtm, auctionState.status, auctionState.teams]);

  useEffect(() => {
    if (!auctionState.pendingRtm) return;
    const pending = auctionState.pendingRtm;
    if (pending.caseType === "PLAYER_VS_AI" || pending.caseType === "PLAYER_VS_PLAYER") return;
    const timeout = window.setTimeout(() => {
      const probability = pending.caseType === "AI_VS_AI" ? 0.45 : 0.35;
      resolvePendingRtmDecision(Math.random() < probability);
    }, 1800);
    return () => clearTimeout(timeout);
  }, [auctionState.pendingRtm, resolvePendingRtmDecision]);

  useEffect(() => {
    if (auctionState.currentPlayer?.name) {
      speak(`Next player ${auctionState.currentPlayer.name}`);
    }
  }, [auctionState.currentPlayer?.id, auctionState.currentPlayer?.name, speak]);

  useEffect(() => () => roomUnsubscribe.current?.(), []);

  const upcomingPlayers = auctionState.remainingPlayers.flatMap((set) => set.players.map((player) => ({ set: set.label, player })));
  const progress = auctionState.currentPlayer ? (auctionState.timer / DEFAULT_TIMER) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-3 pb-8 pt-3 md:px-5">
        <section className="rounded-[28px] border border-yellow-500/20 bg-[#050b18]/90 shadow-[0_0_60px_rgba(234,179,8,0.08)] backdrop-blur">
          <header className="relative flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.28em] text-slate-300 md:flex-nowrap md:px-6">
            <div className="font-semibold text-yellow-300">CricAuctionIPL</div>
            {auctionState.mode === "MULTI" ? <div className="rounded-full border border-yellow-400/30 px-3 py-1 text-yellow-200">{auctionState.roomCode}</div> : null}
            <div className="rounded-full border border-white/10 px-3 py-1">{auctionState.currentSet}</div>
            <div className="ml-auto hidden rounded-full border border-white/10 px-3 py-1 md:block">Timer</div>
            <Button variant="ghost" size="sm" onClick={handleSkipSet} disabled={!isHost || (auctionState.mode === "MULTI" && skipLocked)} className="h-8 rounded-full border border-white/10 px-3 text-[10px] text-white hover:bg-white/10">
              <SkipForward className="mr-1 size-3" /> {auctionState.mode === "AI" ? "Skip Set" : "Skip Set (Host Only)"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSkipPlayer} disabled={!isHost || (auctionState.mode === "MULTI" && skipLocked)} className="h-8 rounded-full border border-white/10 px-3 text-[10px] text-white hover:bg-white/10">
              <SkipForward className="mr-1 size-3" /> {auctionState.mode === "AI" ? "Skip Player" : "Skip Player (Host Only)"}
            </Button>
            <Button variant="ghost" size="sm" onClick={togglePause} disabled={!isHost} className="h-8 rounded-full border border-white/10 px-3 text-[10px] text-white hover:bg-white/10">
              {auctionState.isPaused ? <Play className="mr-1 size-3" /> : <Pause className="mr-1 size-3" />} {auctionState.isPaused ? "Resume" : "Pause"}
            </Button>
            <Button variant="ghost" size="sm" onClick={leaveRoom} className="h-8 rounded-full border border-white/10 px-3 text-[10px] text-white hover:bg-white/10">
              <LogOut className="mr-1 size-3" /> Leave
            </Button>
          </header>

          <div className="relative border-b border-white/10 bg-gradient-to-r from-yellow-500/10 via-transparent to-yellow-500/10 py-3 pr-4">
            <div className="pointer-events-none absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
              <div className="relative size-24 rounded-full border border-yellow-400/30 bg-[#060d1c] shadow-[0_0_35px_rgba(234,179,8,0.28)] md:size-28">
                <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" />
                  <circle cx="50" cy="50" r="44" stroke="#facc15" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={276.46} strokeDashoffset={276.46 - (276.46 * progress) / 100} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-3xl font-black text-white md:text-4xl">{auctionState.timer}</div>
              </div>
            </div>
            <div className="overflow-hidden whitespace-nowrap pl-4 pt-8 text-xs uppercase tracking-[0.3em] text-yellow-100/80 md:pt-1">
              <div className="ticker-marquee inline-flex gap-12">
                {auctionState.ticker.concat(auctionState.ticker).map((item, index) => (
                  <span key={`${item}-${index}`} className="inline-flex items-center gap-3">
                    <span className="size-1.5 rounded-full bg-yellow-400" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="border-b border-white/10 px-4 py-4 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button className="w-full justify-between rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10">
                  <span className="flex items-center gap-2"><Menu className="size-4" /> Teams drawer</span>
                  <Users className="size-4 text-yellow-300" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[88vw] border-white/10 bg-[#07101d] text-white">
                <SheetHeader><SheetTitle className="text-white">Teams</SheetTitle></SheetHeader>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {auctionState.teams.map((team) => <TeamTile key={team.id} team={team} active={team.id === auctionState.biddingTeam} mine={team.id === selectedTeamId} onSelect={setSelectedTeamId} />)}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <main className="grid gap-4 p-4 md:grid-cols-[340px_minmax(0,1fr)_330px] md:p-6">
            <aside className="hidden space-y-4 md:block">
              <div className="grid grid-cols-3 gap-3">
                {auctionState.teams.slice(0, 9).map((team) => <TeamTile key={team.id} team={team} active={team.id === auctionState.biddingTeam} mine={team.id === selectedTeamId} onSelect={setSelectedTeamId} />)}
              </div>
              <div className="rounded-[24px] border border-yellow-400/20 bg-white/5 p-4">
                <div className="mb-3 text-xs uppercase tracking-[0.3em] text-yellow-300">My Team</div>
                {selectedTeam ? <MyTeamCard team={selectedTeam} /> : null}
              </div>
            </aside>

            <section className="order-1 min-w-0">
              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1322] shadow-2xl">
                {auctionState.currentPlayer ? (
                  <>
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${auctionState.currentPlayer.image})` }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/35 to-[#020617]/80" />
                    <div className="relative flex min-h-[560px] flex-col justify-between p-6 md:p-8">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.35em] text-yellow-200/75">Prev Team: {auctionState.currentPlayer.previousTeam}</div>
                          <div className="mt-3 text-4xl font-black tracking-tight text-white md:text-6xl">{auctionState.currentPlayer.name}</div>
                          <div className="mt-3 text-sm uppercase tracking-[0.35em] text-slate-200 md:text-base">{auctionState.currentPlayer.role} / {auctionState.currentPlayer.country}</div>
                        </div>
                        <div className="rounded-full border border-white/15 bg-black/30 px-4 py-2 text-right text-xs uppercase tracking-[0.28em] text-white/70">
                          <div>{auctionState.mode === "AI" ? "AI MODE" : `Host ${auctionState.hostName ?? "Desk"}`}</div>
                          <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-slate-300">
                            {firebaseOnline ? <Wifi className="size-3 text-emerald-400" /> : <WifiOff className="size-3 text-rose-400" />} Sync
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 text-center">
                        <div className="text-xs uppercase tracking-[0.45em] text-yellow-300">Current Bid</div>
                        <div className={`text-5xl font-black md:text-7xl ${auctionState.biddingTeam ? "auction-price-glow text-yellow-300" : "text-white"}`}>{formatCrores(auctionState.currentBid)}</div>
                        <div className="text-sm uppercase tracking-[0.35em] text-slate-200">{auctionState.biddingTeam ? `${auctionState.teams.find((team) => team.id === auctionState.biddingTeam)?.name} in the race` : "Opening bid live"}</div>
                      </div>

                      <div className="flex items-end justify-between gap-4">
                        <div className="rounded-3xl border border-white/10 bg-black/30 px-4 py-3 text-left text-sm text-slate-100 backdrop-blur">
                          <div className="text-[11px] uppercase tracking-[0.3em] text-yellow-300">Scouting signal</div>
                          <div className="mt-1">Rating {auctionState.currentPlayer.rating} / 100 • Demand {auctionState.currentPlayer.demandLevel}</div>
                        </div>
                        <div className="flex size-24 items-center justify-center rounded-full border-[6px] border-yellow-300/80 bg-black/45 text-4xl shadow-[0_0_30px_rgba(250,204,21,0.4)] backdrop-blur md:size-28">
                          {auctionState.biddingTeam ? auctionState.teams.find((team) => team.id === auctionState.biddingTeam)?.badge ?? "🏏" : "🏏"}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[560px] flex-col items-center justify-center gap-4 p-8 text-center">
                    <div className="text-xs uppercase tracking-[0.35em] text-yellow-300">Auction Finished</div>
                    <div className="text-5xl font-black">All sets complete</div>
                    <div className="max-w-xl text-slate-300">The unified engine has processed every set. Join a new room or switch back to AI mode to start another IPL-style auction.</div>
                  </div>
                )}
              </div>
            </section>

            <aside className="order-2 space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="mb-3 text-xs uppercase tracking-[0.35em] text-yellow-300">Bid Button</div>
                <Button onClick={handleBid} disabled={!canBid} className="h-20 w-full rounded-[24px] bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 text-xl font-black text-slate-900 shadow-[0_0_25px_rgba(250,204,21,0.35)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40">
                  BID {formatCrores(bidAmount)}
                </Button>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                  <Badge variant="outline" className="border-white/10 bg-white/5 text-white">Instant response</Badge>
                  <Badge variant="outline" className="border-white/10 bg-white/5 text-white">Increment {formatCrores(getIncrement(auctionState.currentBid))}</Badge>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="mb-3 text-xs uppercase tracking-[0.35em] text-yellow-300">Recent Purchases</div>
                <div className="space-y-3">
                  {auctionState.recentPurchases.length ? auctionState.recentPurchases.map((purchase) => (
                    <div key={`${purchase.player.id}-${purchase.teamId}-${purchase.price}`} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
                      <div className="font-semibold text-white">{purchase.player.name}</div>
                      <div className="mt-1 text-slate-300">{purchase.teamName} → {formatCrores(purchase.price)}</div>
                    </div>
                  )) : <div className="rounded-2xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-slate-400">No purchases yet.</div>}
                </div>
              </div>

              <Dialog open={remainingOpen} onOpenChange={setRemainingOpen}>
                <DialogTrigger asChild>
                  <Button className="h-16 w-full rounded-[24px] border border-yellow-400/30 bg-yellow-400/10 text-lg font-semibold text-yellow-200 hover:bg-yellow-400/20">
                    View Remaining Players ({upcomingPlayers.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl border-white/10 bg-[#08111f] text-white">
                  <DialogHeader>
                    <DialogTitle>Upcoming players</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="h-[60vh] pr-4">
                    <div className="space-y-3">
                      {upcomingPlayers.map(({ set, player }) => (
                        <div key={player.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div>
                            <div className="font-semibold">{player.name}</div>
                            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{set} • {player.role} • {player.country}</div>
                          </div>
                          <div className="text-sm text-yellow-300">{formatCrores(player.basePrice)}</div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.35em] text-yellow-300">
                  <span>Room & join</span>
                  <span>{auctionState.mode === "AI" ? "AI" : auctionState.roomCode}</span>
                </div>
                <div className="space-y-3">
                  <Input value={managerName} onChange={(event) => setManagerName(event.target.value)} placeholder="Manager name" className="border-white/10 bg-black/20 text-white" />
                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={createAiRoom} className="rounded-2xl bg-white/10 text-white hover:bg-white/15">AI Mode</Button>
                    <Button onClick={createMultiplayerRoom} className="rounded-2xl bg-yellow-400 text-slate-900 hover:bg-yellow-300">Create Room</Button>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <Input value={roomCodeInput} onChange={(event) => setRoomCodeInput(event.target.value)} placeholder="Enter IPL room code" className="border-white/10 bg-black/20 text-white uppercase" />
                    <Button onClick={joinRoom} className="rounded-2xl bg-white/10 text-white hover:bg-white/15">Join</Button>
                  </div>
                  <div className="text-xs text-slate-400">Join mid-auction converts the next available AI team into your controlled team, unless the auction has ended.</div>
                  {pendingJoinState ? (
                    <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-3">
                      <div className="text-[11px] uppercase tracking-[0.3em] text-yellow-200">Select AI-controlled team</div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {pendingJoinState.teams.filter((team) => team.controller === "AI").map((team) => (
                          <Button
                            key={team.id}
                            variant={joinTeamChoice === team.id ? "default" : "outline"}
                            onClick={() => setJoinTeamChoice(team.id)}
                            className="rounded-2xl"
                          >
                            {team.shortName}
                          </Button>
                        ))}
                      </div>
                      <Button onClick={confirmJoinRoom} disabled={!joinTeamChoice} className="mt-3 w-full rounded-2xl bg-yellow-400 text-slate-900 hover:bg-yellow-300">
                        Confirm Team Replacement
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.35em] text-yellow-300">
                  <span>Add player mid-auction</span>
                  <PlusCircle className="size-4" />
                </div>
                <div className="space-y-3">
                  <Input value={addPlayerName} onChange={(event) => setAddPlayerName(event.target.value)} placeholder="Player name" className="border-white/10 bg-black/20 text-white" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={addPlayerCountry} onChange={(event) => setAddPlayerCountry(event.target.value)} placeholder="Country" className="border-white/10 bg-black/20 text-white" />
                    <Input value={addPlayerRole} onChange={(event) => setAddPlayerRole(event.target.value)} placeholder="Role" className="border-white/10 bg-black/20 text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                    <Button variant={addPlayerMode === "CURRENT" ? "default" : "outline"} onClick={() => setAddPlayerMode("CURRENT")} className="rounded-2xl">Current Set</Button>
                    <Button variant={addPlayerMode === "SUPPLEMENTARY" ? "default" : "outline"} onClick={() => setAddPlayerMode("SUPPLEMENTARY")} className="rounded-2xl">Supplementary</Button>
                  </div>
                  <Button onClick={handleAddMidAuctionPlayer} className="w-full rounded-2xl bg-yellow-400 text-slate-900 hover:bg-yellow-300">Inject Player</Button>
                </div>
              </div>
            </aside>
          </main>
        </section>
      </div>

      {auctionState.pendingRtm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-yellow-400/30 bg-[#08111f] p-6 shadow-2xl">
            <div className="text-xs uppercase tracking-[0.35em] text-yellow-300">RTM Logic</div>
            <div className="mt-3 text-3xl font-black">Use RTM?</div>
            <div className="mt-3 text-slate-300">{auctionState.currentPlayer?.name} was with {auctionState.teams.find((team) => team.id === auctionState.pendingRtm?.originalTeamId)?.name}. Final price is {formatCrores(auctionState.pendingRtm.price)}.</div>
            <div className="mt-2 text-sm text-slate-400">Case: {auctionState.pendingRtm.caseType.replaceAll("_", " vs ")}</div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button onClick={() => resolvePendingRtmDecision(false)} className="rounded-2xl bg-white/10 text-white hover:bg-white/15">No RTM</Button>
              <Button onClick={() => resolvePendingRtmDecision(true)} className="rounded-2xl bg-yellow-400 text-slate-900 hover:bg-yellow-300">Use RTM</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamTile({ team, active, mine, onSelect }: { team: TeamState; active: boolean; mine: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(team.id)}
      className={`group rounded-[22px] border p-3 text-left transition ${active ? "border-yellow-300 bg-yellow-400/15 shadow-[0_0_24px_rgba(250,204,21,0.26)]" : "border-white/10 bg-white/5 hover:bg-white/10"} ${mine ? "ring-1 ring-white/30" : ""}`}
    >
      <div className={`h-1.5 rounded-full bg-gradient-to-r ${team.color}`} />
      <div className="mt-3 flex items-center justify-between">
        <div className="text-2xl">{team.badge}</div>
        {mine ? <Badge className="bg-white/10 text-white">Mine</Badge> : null}
      </div>
      <div className="mt-3 text-sm font-semibold">{team.shortName}</div>
      <div className="mt-1 text-xs text-slate-400">Purse {formatCrores(team.purse)}</div>
      <div className="text-xs text-slate-500">Squad {team.players.length} • {team.controller}</div>
    </button>
  );
}

function MyTeamCard({ team }: { team: TeamState }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-black">{team.name}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.28em] text-slate-400">{team.ownerName ?? "AI controlled"}</div>
        </div>
        <div className="text-4xl">{team.badge}</div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Purse" value={formatCrores(team.purse)} />
        <Stat label="Bought" value={String(team.players.length)} />
        <Stat label="Spent" value={formatCrores(team.spent)} />
        <Stat label="RTM" value={String(team.rtm)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{label}</div>
      <div className="mt-2 text-base font-bold text-white">{value}</div>
    </div>
  );
}

export default App;
