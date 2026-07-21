import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

import { listenSession, listenTeams, restartAuction, updateAuctionStats } from '@/lib/sessionService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useGameData } from '@/contexts/GameDataContext';
import { Player } from '@/lib/samplePlayers';
import { TeamLogo } from '@/components/TeamLogo';
import { Trophy, Coins, Users, Download, RotateCcw, Home, Sparkles, TrendingUp, HelpCircle } from 'lucide-react';
import { IPL_TEAMS, SQUAD_CONSTRAINTS } from '@/lib/constants';
import { motion } from 'framer-motion';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';
import { useUserId } from '@/hooks/useUserId';
import { PlayerInitialsAvatar } from '@/components/PlayerInitialsAvatar';

const SummaryPlayerImage = ({ player }: { player: Player }) => {
  const [failed, setFailed] = useState(false);
  
  useEffect(() => {
    setFailed(false);
  }, [player.id]);

  const imageUrl = player.imageUrl || (player as any).image;

  if (imageUrl && !failed) {
    return (
      <img 
        src={imageUrl} 
        alt={player.name} 
        className="h-full w-full object-contain object-center" 
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <PlayerInitialsAvatar
      name={player.name}
      role={player.role}
      isOverseas={player.isOverseas}
      size="md"
    />
  );
};

interface TeamState {
  id: string;
  name: string;
  shortName: string;
  color: string;
  logo?: string;
  purseRemaining: number;
  players: string[];
  retainedPlayers: string[];
  overseasCount: number;
  squadSize: number;
  rtmCards: number;
  playerPurchasePrices: Record<string, number>;
  isAI: boolean;
}

const formatCrPrice = (amount: number) => `₹${(Number(amount || 0) / 10000000).toFixed(2)} Cr`;

const Summary = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const userId = useUserId();
  const { masterPlayerList } = useGameData();

  const [session, setSession] = useState<any>(null);
  const [teams, setTeams] = useState<TeamState[]>([]);
  const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  // Firestore listeners
  useEffect(() => {
    if (!gameCode) return;
    const unsubSession = listenSession(gameCode, setSession);
    const unsubTeams = listenTeams(gameCode, (teamDocs) => {
      const enriched = (teamDocs as any[]).map((team) => ({
        ...IPL_TEAMS.find((t) => t.id === team.id),
        ...team,
      }));
      setTeams(enriched as TeamState[]);
    });
    return () => {
      unsubSession();
      unsubTeams();
    };
  }, [gameCode]);

  useEffect(() => {
    if (session) {
      const isComplete =
        (session.phase === "AUCTION_COMPLETE" || session.phase === "ENDED") &&
        (session.queueIndex ?? -1) >= (session.auctionQueue || []).length &&
        (session.isAcceleratedRound || session.acceleratedRoundSkipped);

      if (!isComplete) {
        navigate(`/auction/${gameCode}`);
      }
    }
  }, [session, gameCode, navigate]);

  const isHost = session?.hostId === userId;

  // Resolve player entities
  const playerById = useMemo(() => {
    return new Map(masterPlayerList.map((p) => [p.id, p]));
  }, [masterPlayerList]);

  const teamPlayersResolved = useMemo(() => {
    return teams.reduce<Record<string, { retained: Player[]; bought: Player[] }>>((acc, team) => {
      acc[team.id] = {
        retained: (team.retainedPlayers || []).map((id) => playerById.get(id)).filter(Boolean) as Player[],
        bought: (team.players || []).map((id) => playerById.get(id)).filter(Boolean) as Player[],
      };
      return acc;
    }, {});
  }, [teams, playerById]);

  // Construct Leaderboard / Standings
  const leaderboard = useMemo(() => {
    return teams
      .map((team) => {
        const resolved = teamPlayersResolved[team.id];
        const roster = [...(resolved?.retained || []), ...(resolved?.bought || [])];
        const ratings = roster
          .map((p) => Number(p?.rating ?? p?.starRating ?? 0))
          .filter((v) => Number.isFinite(v) && v > 0);
        
        const averagePlayerRating = ratings.length
          ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
          : 0;

        const roleSet = new Set(roster.map((p) => p.role.toLowerCase()));
        const squadBalanceBonus = roleSet.size * 2.5;
        const squadSize = roster.length;
        const squadSizeBonus = Math.max(0, Math.min(10, squadSize - SQUAD_CONSTRAINTS.MIN_SQUAD));
        const eliminated = squadSize < SQUAD_CONSTRAINTS.MIN_SQUAD;
        
        const teamScore = Number((averagePlayerRating * 10 + squadBalanceBonus + squadSizeBonus).toFixed(2));

        return {
          ...team,
          squadSize,
          averagePlayerRating,
          teamScore,
          eliminated,
        };
      })
      .sort((a, b) => {
        if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
        return b.teamScore - a.teamScore;
      });
  }, [teams, teamPlayersResolved]);

  // Podium contestants
  const winner = leaderboard[0] || null;
  const champion = winner;
  const runnerUp = leaderboard[1] || null;
  const thirdPlace = leaderboard[2] || null;

  const hasSyncedStatsRef = useRef(false);
  useEffect(() => {
    if (!isHost || !session || !leaderboard.length || hasSyncedStatsRef.current) return;
    const winnerTeamId = leaderboard[0]?.id;
    if (!winnerTeamId) return;

    updateAuctionStats(gameCode!, winnerTeamId, session.selectedTeams || {}, session.managerNames || {})
      .then(() => {
        hasSyncedStatsRef.current = true;
      })
      .catch(() => undefined);
  }, [isHost, session, leaderboard, gameCode]);

  const eliminatedTeams = useMemo(() => {
    return leaderboard.filter((t) => t.eliminated);
  }, [leaderboard]);

  const soldPlayersList = useMemo(() => {
    const list: Array<Player & { soldPrice: number; soldTeamShortName: string; soldTeamId: string; isRetained: boolean }> = [];
    teams.forEach((t) => {
      (t.players || []).forEach((pid) => {
        const p = playerById.get(pid);
        if (p) {
          list.push({
            ...p,
            soldPrice: t.playerPurchasePrices?.[pid] || p.basePrice || 0,
            soldTeamShortName: t.shortName,
            soldTeamId: t.id,
            isRetained: false,
          });
        }
      });
      (t.retainedPlayers || []).forEach((pid) => {
        const p = playerById.get(pid);
        if (p) {
          list.push({
            ...p,
            soldPrice: t.playerPurchasePrices?.[pid] || 0,
            soldTeamShortName: t.shortName,
            soldTeamId: t.id,
            isRetained: true,
          });
        }
      });
    });
    return list;
  }, [teams, playerById]);

  // Statistics calculations
  const stats = useMemo(() => {
    let highestPrice = 0;
    let mostExpensive: (Player & { soldPrice: number; soldTeamShortName: string }) | null = null;
    let bestValuePriceRatio = 0;
    let bestValue: (Player & { soldPrice: number; soldTeamShortName: string }) | null = null;
    let totalSpent = 0;
    let totalRatingsSum = 0;
    let totalRatingsCount = 0;
    let overseasCount = 0;
    let cappedCount = 0;
    let uncappedCount = 0;

    soldPlayersList.forEach((p) => {
      totalSpent += p.soldPrice;
      
      const rating = Number((p as any).starRating ?? p.rating ?? 0);
      if (rating > 0) {
        totalRatingsSum += rating;
        totalRatingsCount++;
      }

      if (p.isOverseas) overseasCount++;
      if (p.isCapped) cappedCount++; else uncappedCount++;

      if (p.soldPrice > highestPrice) {
        highestPrice = p.soldPrice;
        mostExpensive = {
          ...p,
          soldPrice: p.soldPrice,
          soldTeamShortName: p.soldTeamShortName,
        };
      }

      if (p.soldPrice > 0) {
        const r = rating > 0 ? rating : 3;
        const ratio = r / (p.soldPrice / 10_000_000);
        if (ratio > bestValuePriceRatio) {
          bestValuePriceRatio = ratio;
          bestValue = {
            ...p,
            soldPrice: p.soldPrice,
            soldTeamShortName: p.soldTeamShortName,
          };
        }
      }
    });

    const avgRating = totalRatingsCount ? totalRatingsSum / totalRatingsCount : 0;
    const avgPrice = soldPlayersList.length ? totalSpent / soldPlayersList.length : 0;

    return {
      totalSpent,
      avgRating,
      overseasCount,
      cappedCount,
      uncappedCount,
      avgPrice,
      mostExpensive,
      bestValue,
    };
  }, [soldPlayersList]);

  const unsoldPlayersCount = (session?.unsoldPlayers || []).length;

  const handleRestart = async () => {
    if (!gameCode || !isHost) return;
    setIsRestarting(true);
    try {
      await restartAuction(gameCode);
      navigate(`/lobby/${gameCode}`);
    } catch (err) {
      console.error("Failed to restart auction:", err);
    } finally {
      setIsRestarting(false);
      setIsRestartConfirmOpen(false);
    }
  };

  const handleDownloadCSV = () => {
    const headers = [
      "Player ID",
      "Player Name",
      "Role",
      "Nationality",
      "Overseas Status",
      "Class",
      "Base Price",
      "Auction Status",
      "Final Purchase Price",
      "Purchasing Team",
    ];

    const rows = masterPlayerList.map((player) => {
      let status = "Unsold";
      let priceStr = "0";
      let teamStr = "N/A";

      const soldRecord = soldPlayersList.find((sp) => sp.id === player.id);
      if (soldRecord) {
        status = soldRecord.isRetained ? "Retained" : "Sold";
        priceStr = formatCrPrice(soldRecord.soldPrice);
        teamStr = soldRecord.soldTeamShortName;
      } else if (session?.unsoldPlayers?.includes(player.id)) {
        status = "Unsold";
      } else if (session?.auctionQueue?.includes(player.id)) {
        status = "Upcoming / Skipped";
      } else {
        status = "Excluded";
      }

      return [
        player.id,
        player.name,
        player.role,
        player.nationality,
        player.isOverseas ? "Overseas" : "Indian",
        player.isCapped ? "Capped" : "Uncapped",
        formatCrPrice(player.basePrice),
        status,
        priceStr,
        teamStr,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","))].join(
        "\n"
      );

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `IPL_Auction_Summary_Report_${gameCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartData = useMemo(() => {
    return leaderboard.map((team) => {
      const totalPurse = 120; // 120 Cr
      const purseRemainingCr = Number(team.purseRemaining || 0) / 10000000;
      const spentCr = totalPurse - purseRemainingCr;
      return {
        name: team.shortName,
        score: team.teamScore,
        spent: Number(spentCr.toFixed(2)),
        remaining: Number(purseRemainingCr.toFixed(2)),
      };
    });
  }, [leaderboard]);

  return (
    <div className={cn("min-h-screen bg-gradient-to-br from-[#020617] via-[#051126] to-[#020617] text-white p-4 md:p-8 overflow-y-auto relative", session?.mode === 'VS_AI' ? "theme-ai" : "theme-multiplayer")}>
      {/* Stadium-inspired atmospheric lighting */}
      <div className="stadium-ambient stadium-ambient-cyan -top-40 -left-40 w-[600px] h-[600px]" />
      <div className="stadium-ambient stadium-ambient-gold -bottom-40 -right-40 w-[600px] h-[600px]" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="text-center md:text-left space-y-1">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
              <span className="text-xs font-black tracking-[0.25em] text-yellow-400 uppercase">
                IPL MOCK AUCTION
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-500 uppercase">
              Final Auction Summary
            </h1>
            <p className="text-xs text-slate-400 font-mono">Game Code: {gameCode} • Phase: COMPLETE</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={handleDownloadCSV}
              variant="outline"
              className="h-10 border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 font-bold transition-all flex items-center gap-2 cursor-pointer rounded-xl"
            >
              <Download className="h-4 w-4" /> Download Report
            </Button>
            {isHost && (
              <Button
                onClick={() => setIsRestartConfirmOpen(true)}
                className="h-10 bg-yellow-500 text-slate-950 hover:bg-yellow-400 font-extrabold flex items-center gap-2 cursor-pointer shadow-[0_4px_14px_rgba(234,179,8,0.25)] rounded-xl"
              >
                <RotateCcw className="h-4 w-4" /> Restart Auction
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="h-10 border-white/10 hover:bg-white/5 text-slate-300 font-semibold cursor-pointer rounded-xl"
            >
              <Link to="/">
                <Home className="h-4 w-4 mr-2" /> Home
              </Link>
            </Button>
          </div>
        </div>

        {/* Celebration Podium Section */}
        <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-4 pt-16 pb-8 px-4 rounded-3xl border border-white/5 bg-[#0f172a]/20 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          {/* Atmospheric spotlight beams for the podium */}
          <div className="stadium-ambient stadium-ambient-cyan left-1/4 -top-20 w-[400px] h-[400px]" />
          <div className="stadium-ambient stadium-ambient-gold right-1/4 -top-20 w-[400px] h-[400px]" />

          {/* 2nd Place */}
          {runnerUp && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col items-center w-full md:w-64"
            >
              <div className="flex flex-col items-center mb-4 space-y-2">
                <div className="relative">
                  <TeamLogo teamId={runnerUp.id} logo={runnerUp.logo} shortName={runnerUp.shortName} size="lg" className="h-16 w-16 bg-slate-900 border-2 border-slate-400 rounded-2xl shadow-2xl" />
                  <span className="absolute -top-3 -right-3 bg-slate-500 text-white font-black text-xs h-6 w-6 rounded-full flex items-center justify-center border border-slate-300 shadow-md">2</span>
                </div>
                <p className="font-extrabold text-sm text-slate-300 uppercase tracking-wide truncate max-w-[200px] text-center">{runnerUp.shortName}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{session?.managerNames?.[runnerUp.id] || 'Manager'}</p>
              </div>
              <div className="w-full h-36 bg-gradient-to-t from-slate-950/80 via-slate-800/40 to-slate-700/30 border-t border-slate-400/40 rounded-t-3xl flex flex-col items-center justify-center p-4 shadow-2xl">
                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">RUNNER UP</span>
                <span className="text-2xl font-black text-slate-200 font-mono mt-1">{runnerUp.teamScore.toFixed(2)}</span>
                <span className="text-[9px] text-slate-400 mt-1 uppercase font-semibold">Roster: {runnerUp.squadSize} Players</span>
              </div>
            </motion.div>
          )}

          {/* 1st Place (Champion) */}
          {champion && (
            <motion.div 
              initial={{ opacity: 0, y: 70 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="flex flex-col items-center w-full md:w-72 z-10"
            >
              <div className="flex flex-col items-center mb-4 space-y-2 relative">
                {/* Glowing crown/trophy above Champion logo */}
                <motion.div 
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                  className="absolute -top-10 text-yellow-400"
                >
                  <Trophy className="h-8 w-8 filter drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
                </motion.div>
                <div className="relative mt-2">
                  <TeamLogo teamId={champion.id} logo={champion.logo} shortName={champion.shortName} size="lg" className="h-20 w-20 bg-slate-900 border-2 border-yellow-400 rounded-3xl shadow-2xl" />
                  <span className="absolute -top-3 -right-3 bg-yellow-400 text-slate-950 font-black text-sm h-7 w-7 rounded-full flex items-center justify-center border border-yellow-300 shadow-md">1</span>
                </div>
                <p className="font-extrabold text-lg text-yellow-100 uppercase tracking-wide truncate max-w-[240px] text-center mt-1">{champion.shortName}</p>
                <p className="text-[10px] text-yellow-400 font-extrabold uppercase tracking-wider">{session?.managerNames?.[champion.id] || 'Manager'}</p>
              </div>
              <div className="w-full h-48 bg-gradient-to-t from-slate-950/90 via-yellow-950/20 to-yellow-500/20 border-t border-yellow-400/50 rounded-t-3xl flex flex-col items-center justify-center p-5 shadow-2xl relative">
                <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
                <span className="text-xs font-black tracking-[0.25em] text-yellow-400 uppercase flex items-center gap-1">
                  <Sparkles className="h-3 w-3 animate-pulse" /> CHAMPION
                </span>
                <span className="text-4xl font-black text-yellow-100 font-mono mt-1 text-shadow-glow">{champion.teamScore.toFixed(2)}</span>
                <span className="text-[10px] text-yellow-200 mt-1 uppercase font-bold tracking-wider">Roster: {champion.squadSize} Players</span>
              </div>
            </motion.div>
          )}

          {/* 3rd Place */}
          {thirdPlace && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col items-center w-full md:w-64"
            >
              <div className="flex flex-col items-center mb-4 space-y-2">
                <div className="relative">
                  <TeamLogo teamId={thirdPlace.id} logo={thirdPlace.logo} shortName={thirdPlace.shortName} size="lg" className="h-16 w-16 bg-slate-900 border-2 border-amber-600 rounded-2xl shadow-2xl" />
                  <span className="absolute -top-3 -right-3 bg-amber-600 text-white font-black text-xs h-6 w-6 rounded-full flex items-center justify-center border border-amber-500 shadow-md">3</span>
                </div>
                <p className="font-extrabold text-sm text-slate-300 uppercase tracking-wide truncate max-w-[200px] text-center">{thirdPlace.shortName}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{session?.managerNames?.[thirdPlace.id] || 'Manager'}</p>
              </div>
              <div className="w-full h-28 bg-gradient-to-t from-slate-950/80 via-slate-800/40 to-[#451e03]/20 border-t border-amber-600/40 rounded-t-3xl flex flex-col items-center justify-center p-4 shadow-2xl">
                <span className="text-[10px] font-black tracking-widest text-amber-500 uppercase">3RD PLACE</span>
                <span className="text-2xl font-black text-slate-200 font-mono mt-1">{thirdPlace.teamScore.toFixed(2)}</span>
                <span className="text-[9px] text-slate-400 mt-1 uppercase font-semibold">Roster: {thirdPlace.squadSize} Players</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Recharts Analytics Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-[#0f172a]/20 backdrop-blur-xl border-white/5 shadow-2xl rounded-3xl p-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-base uppercase tracking-wider text-yellow-400 font-black flex items-center gap-2">
                <TrendingUp className="h-4.5 w-4.5 text-[#00CFFF]" /> Team Score Standings
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">Final competitive ratings based on roster balance and star scores</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#07142d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? '#fbbf24' : index === 1 ? '#cbd5e1' : '#d97706'} 
                        opacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-[#0f172a]/20 backdrop-blur-xl border-white/5 shadow-2xl rounded-3xl p-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-base uppercase tracking-wider text-yellow-400 font-black flex items-center gap-2">
                <Coins className="h-4.5 w-4.5 text-yellow-400" /> Budget Utilization
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">Total spent vs remaining team purses in Crore (Cr)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} unit=" Cr" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#07142d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                  <Bar dataKey="spent" name="Spent (Cr)" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="remaining" name="Remaining (Cr)" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Champion Calculation Breakdown */}
        <div className="rounded-3xl border border-white/5 bg-[#0f172a]/20 backdrop-blur-xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-xl font-display font-black text-yellow-400 tracking-wider uppercase">🏆 CHAMPIONSHIP SCORE BREAKDOWN</h3>
              <p className="text-xs text-slate-400 mt-1">Transparency on how team ratings and scores were computed at the end of the auction.</p>
            </div>
            <div className="bg-[#030712]/50 border border-white/15 rounded-2xl px-4 py-2.5 text-xs text-yellow-400">
              <span className="font-extrabold uppercase tracking-wider block text-[9px] text-slate-500">Score Formula</span>
              <span className="font-mono font-bold text-shadow-glow">Score = (Avg Rating × 10) + (Role Balance × 2.5) + (Squad Size Bonus)</span>
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 uppercase tracking-widest font-semibold text-[10px]">
                  <th className="py-3 px-4">Rank & Team</th>
                  <th className="py-3 px-4 text-center">Avg Rating (×10)</th>
                  <th className="py-3 px-4 text-center">Total Squad Rating</th>
                  <th className="py-3 px-4 text-center">Role Balance (+Bonus)</th>
                  <th className="py-3 px-4 text-center">Squad Size (18 max)</th>
                  <th className="py-3 px-4 text-center">Overseas (8 max)</th>
                  <th className="py-3 px-4 text-center">Remaining Purse</th>
                  <th className="py-3 px-4 text-right text-yellow-400 font-bold">Total Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((team, index) => {
                  const resolved = teamPlayersResolved[team.id];
                  const roster = [...(resolved?.retained || []), ...(resolved?.bought || [])];
                  const totalRating = roster.reduce((sum, p) => sum + Number(p?.rating ?? p?.starRating ?? 0), 0);
                  
                  const roleSet = new Set(roster.map((p) => p.role.toLowerCase()));
                  const roleBonus = roleSet.size * 2.5;

                  const overseasCount = roster.filter(p => p.isOverseas).length;

                  return (
                    <tr
                      key={team.id}
                      className={`border-b border-white/5 transition-colors hover:bg-white/5 ${
                        index === 0 ? "bg-yellow-500/5 hover:bg-yellow-500/10 font-bold" : index === 1 ? "bg-slate-400/5 hover:bg-slate-400/10" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 flex items-center gap-3">
                        <span className="font-bold text-slate-500 w-4">{index + 1}.</span>
                        <TeamLogo teamId={team.id} logo={team.logo} shortName={team.shortName} size="xs" className="h-6 w-6 rounded-md bg-white/10 border-white/10" />
                        <span className="font-bold text-white tracking-wide">{team.shortName}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-sky-400">
                        {team.averagePlayerRating.toFixed(2)} ★ <span className="text-[10px] text-slate-500">({(team.averagePlayerRating * 10).toFixed(1)})</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-300">
                        {totalRating.toFixed(0)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                        {roleSet.size}/4 <span className="text-[10px] text-emerald-400 font-bold">(+{roleBonus.toFixed(1)})</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                        {team.squadSize}/18
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                        {overseasCount}/8
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-emerald-400 font-bold">
                        {formatCrPrice(team.purseRemaining)}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-mono font-extrabold text-sm ${index === 0 ? "text-yellow-400 text-shadow-glow" : "text-white"}`}>
                        {team.teamScore.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Highlight Purchases: Most Expensive & Best Value Buys */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Most Expensive Buy Card */}
          {stats.mostExpensive && (
            <div className="rounded-3xl border border-white/5 bg-[#0f172a]/20 backdrop-blur-xl p-6 shadow-2xl flex flex-col justify-between space-y-4">
              <div className="flex items-center gap-5">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-yellow-500 to-amber-500 border border-yellow-400/30 overflow-hidden relative flex items-center justify-center shadow-lg shrink-0">
                  <SummaryPlayerImage player={stats.mostExpensive} />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded text-[9px] font-black px-1.5 py-0.5 tracking-widest uppercase inline-block">
                    🔥 MOST EXPENSIVE BUY
                  </span>
                  <h3 className="text-xl font-display font-black uppercase text-yellow-100 truncate">
                    {stats.mostExpensive.name}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    Role: <span className="font-semibold text-slate-200">{stats.mostExpensive.role}</span> • Nationality: <span className="font-semibold text-slate-200">{stats.mostExpensive.nationality}</span>
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-end border-t border-white/5 pt-3">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Purchaser</span>
                  <span className="text-sm text-yellow-400 font-black">{stats.mostExpensive.soldTeamShortName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-mono text-slate-500 block">
                    Base: {formatCrPrice(stats.mostExpensive.basePrice)}
                  </span>
                  <p className="text-2xl font-display font-black text-emerald-400">
                    {formatCrPrice(stats.mostExpensive.soldPrice)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Best Value Buy Card */}
          {stats.bestValue && (
            <div className="rounded-3xl border border-white/5 bg-[#0f172a]/20 backdrop-blur-xl p-6 shadow-2xl flex flex-col justify-between space-y-4">
              <div className="flex items-center gap-5">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 border border-emerald-400/30 overflow-hidden relative flex items-center justify-center shadow-lg shrink-0">
                  <SummaryPlayerImage player={stats.bestValue} />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-black px-1.5 py-0.5 tracking-widest uppercase inline-block">
                    💎 BEST VALUE BUY
                  </span>
                  <h3 className="text-xl font-display font-black uppercase text-emerald-100 truncate">
                    {stats.bestValue.name}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    Role: <span className="font-semibold text-slate-200">{stats.bestValue.role}</span> • Rating: <span className="font-semibold text-slate-200">{Number((stats.bestValue as any).starRating ?? stats.bestValue.rating ?? 3)}★</span>
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-end border-t border-white/5 pt-3">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Purchaser</span>
                  <span className="text-sm text-emerald-400 font-black">{stats.bestValue.soldTeamShortName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-mono text-slate-500 block">
                    Base: {formatCrPrice(stats.bestValue.basePrice)}
                  </span>
                  <p className="text-2xl font-display font-black text-emerald-400">
                    {formatCrPrice(stats.bestValue.soldPrice)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#0f172a]/20 backdrop-blur-xl border-white/5 shadow-2xl rounded-2xl">
            <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Total Spend
              </CardTitle>
              <Coins className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-black text-yellow-100">{formatCrPrice(stats.totalSpent)}</div>
              <p className="text-[10px] text-slate-500 mt-1">Sum of all team rosters</p>
            </CardContent>
          </Card>

          <Card className="bg-[#0f172a]/20 backdrop-blur-xl border-white/5 shadow-2xl rounded-2xl">
            <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Sold Players
              </CardTitle>
              <Users className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-black text-yellow-100">
                {soldPlayersList.length} <span className="text-xs text-slate-400 font-medium">Players</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Indian: {stats.cappedCount + stats.uncappedCount - stats.overseasCount} | Overseas: {stats.overseasCount}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#0f172a]/20 backdrop-blur-xl border-white/5 shadow-2xl rounded-2xl">
            <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Unsold Players
              </CardTitle>
              <HelpCircle className="h-4 w-4 text-rose-400" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-black text-yellow-100">
                {unsoldPlayersCount} <span className="text-xs text-slate-400 font-medium">Players</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Went unsold in both rounds</p>
            </CardContent>
          </Card>

          <Card className="bg-[#0f172a]/20 backdrop-blur-xl border-white/5 shadow-2xl rounded-2xl">
            <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Completion Rate
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-black text-yellow-100">
                {masterPlayerList.length > 0
                  ? ((soldPlayersList.length / masterPlayerList.length) * 100).toFixed(1)
                  : "0"}%
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Avg Rating: {stats.avgRating.toFixed(1)} ★
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Leaderboard Standings Table */}
        <div className="rounded-3xl border border-white/5 bg-[#0f172a]/20 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-white/5 bg-slate-900/20 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold uppercase text-yellow-400 tracking-wider">
                Detailed Standings & Stats
              </h3>
              <p className="text-xs text-slate-400">Team score calculates roster strength, balance, and constraints</p>
            </div>
            <span className="text-[10px] bg-slate-950/40 border border-white/5 px-3 py-1 rounded-full text-slate-400 font-mono">
              Min Squad: 18
            </span>
          </div>

          <Table>
            <TableHeader className="bg-black/20">
              <TableRow className="hover:bg-transparent border-b border-white/5">
                <TableHead className="w-16 text-center">Rank</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-center">Players</TableHead>
                <TableHead className="text-right">Purse Spent</TableHead>
                <TableHead className="text-right">Purse Remaining</TableHead>
                <TableHead className="text-center">Avg Rating</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((team, index) => {
                const totalPurse = 1200000000; // 120 Crore
                const spent = totalPurse - team.purseRemaining;

                return (
                  <TableRow
                    key={team.id}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                      team.eliminated ? "bg-rose-950/10 opacity-75" : ""
                    }`}
                  >
                    <TableCell className="font-extrabold text-center text-sm text-yellow-400">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <TeamLogo teamId={team.id} logo={team.logo} shortName={team.shortName} size="sm" className="h-8 w-8 border border-white/10 bg-black/35 rounded-lg" />
                        <div>
                          <p className="font-bold text-white uppercase text-xs tracking-wider">
                            {team.name} ({team.shortName})
                          </p>
                          <span className="text-[9px] text-slate-400 uppercase font-mono">
                            {team.isAI ? "🤖 AI Managed" : "👤 Human Managed"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-slate-200">
                      {team.squadSize}
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-300">
                      {formatCrPrice(spent)}
                    </TableCell>
                    <TableCell className="text-right font-extrabold text-emerald-400">
                      {formatCrPrice(team.purseRemaining)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-slate-200">
                        {team.averagePlayerRating > 0 ? `${team.averagePlayerRating.toFixed(1)} ★` : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-black text-yellow-400 text-sm">
                      {team.teamScore.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {team.eliminated ? (
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full px-2 py-0.5 text-[8px] font-black tracking-widest uppercase">
                          Disqualified
                        </span>
                      ) : (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 text-[8px] font-black tracking-widest uppercase">
                          Qualified
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Eliminated Teams Section */}
        {eliminatedTeams.length > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/25 rounded-3xl p-5 space-y-2.5">
            <h4 className="text-rose-400 font-extrabold text-xs tracking-widest uppercase flex items-center gap-1.5">
              ⚠️ ELIMINATED TEAMS NOTICE
            </h4>
            <p className="text-xs text-slate-300 leading-normal">
              The following teams failed to secure the minimum roster size of <strong>18 players</strong> as required by IPL squad constraints, and have been disqualified:
            </p>
            <div className="flex gap-2 flex-wrap pt-1">
              {eliminatedTeams.map((t) => (
                <div
                  key={t.id}
                  className="bg-black/35 border border-rose-500/30 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs"
                >
                  <TeamLogo teamId={t.id} logo={t.logo} shortName={t.shortName} size="xs" className="h-5 w-5 bg-white/5 rounded" />
                  <span className="font-bold text-slate-200">{t.name}</span>
                  <span className="text-[10px] text-rose-400">({t.squadSize} players)</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Restart Auction Confirmation Dialog */}
      <AlertDialog open={isRestartConfirmOpen} onOpenChange={setIsRestartConfirmOpen}>
        <AlertDialogContent className="bg-[#051126] border border-yellow-500/40 text-white rounded-2xl p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-display tracking-wide uppercase text-yellow-100">
              Restart Auction Session?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 text-xs leading-normal">
              This will completely wipe all current auction history, sold and retained player rosters, and reset team budgets back to ₹120 Crore.
              <br />
              <br />
              Joined players and team controller assignments (AI vs Human) will be preserved so everyone stays in the room. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="h-9 border-slate-700 bg-transparent hover:bg-slate-800 text-xs px-4 rounded-xl cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestart}
              disabled={isRestarting}
              className="h-9 bg-yellow-500 text-slate-950 hover:bg-yellow-400 font-bold text-xs px-4 rounded-xl cursor-pointer"
            >
              {isRestarting ? "Restarting..." : "Yes, Reset Game"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Summary;
