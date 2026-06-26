import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Trophy, 
  Users, 
  UserPlus, 
  Gavel, 
  Calendar, 
  ListOrdered, 
  Award, 
  Lock, 
  ArrowLeft,
  ChevronRight,
  Sparkles,
  type LucideIcon
} from 'lucide-react';
import { IPL_TEAMS } from '@/lib/constants';

interface TournamentStep {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  badge: string;
}

const TOURNAMENT_STEPS: TournamentStep[] = [
  {
    id: 'create',
    title: 'Create Tournament',
    icon: Trophy,
    description: 'Configure your local championship name, budget limits, number of participants, and playoff formats.',
    badge: 'Step 1'
  },
  {
    id: 'teams',
    title: 'Add Teams',
    icon: Users,
    description: 'Select existing IPL franchises or register custom squads. Assign human owners or computer AI managers.',
    badge: 'Step 2'
  },
  {
    id: 'players',
    title: 'Add Players',
    icon: UserPlus,
    description: 'Import master player CSV or use default pools. Distribute initial player ratings, bases, and retention tags.',
    badge: 'Step 3'
  },
  {
    id: 'auction',
    title: 'Conduct Auction',
    icon: Gavel,
    description: 'Launch the live interactive auction room. Bid, resolve retentions, and secure your squads.',
    badge: 'Step 4'
  },
  {
    id: 'fixtures',
    title: 'Generate Fixtures',
    icon: Calendar,
    description: 'Schedule round-robin matches. Automatically generate group stages, qualifiers, and final play-off fixtures.',
    badge: 'Step 5'
  },
  {
    id: 'standings',
    title: 'Track Standings',
    icon: ListOrdered,
    description: 'Simulate matches or input scores to auto-update points table, net run rates, and team standings in real-time.',
    badge: 'Step 6'
  },
  {
    id: 'champion',
    title: 'Declare Champion',
    icon: Award,
    description: 'Crown the champions with a custom podium ceremony, award the Orange/Purple caps, and track historical seasons.',
    badge: 'Step 7'
  }
];

const Tournament = () => {
  const navigate = useNavigate();
  const [activeStepId, setActiveStepId] = useState<string>('create');

  const activeStepIndex = TOURNAMENT_STEPS.findIndex(step => step.id === activeStepId);
  const activeStep = TOURNAMENT_STEPS[activeStepIndex];

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden flex flex-col">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-[#020617]/70 backdrop-blur-[1.5px] z-0" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] bg-yellow-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-4 bg-[#020617]/50 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')} 
            className="text-slate-400 hover:text-white hover:bg-white/5"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-yellow-400 text-lg font-display font-black tracking-widest uppercase flex items-center gap-2">
            <span>CRIC</span><span className="text-emerald-400">TOURNAMENT</span><span>IPL</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            Tournament Beta Roadmap
          </span>
        </div>
      </header>

      {/* Main Roadmap Workspace */}
      <main className="relative z-10 flex-1 flex flex-col md:flex-row gap-6 p-6 max-w-7xl w-full mx-auto min-h-0 overflow-hidden">
        {/* Sidebar Stepper */}
        <section className="w-full md:w-80 shrink-0 flex flex-col gap-2 min-h-0 overflow-y-auto pr-1">
          <h2 className="font-display font-black uppercase text-slate-400 text-xs tracking-wider mb-2 px-2">Roadmap Stages</h2>
          {TOURNAMENT_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = step.id === activeStepId;
            const isCompleted = idx < activeStepIndex;

            return (
              <button
                key={step.id}
                onClick={() => setActiveStepId(step.id)}
                className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between transition-all duration-300 ${
                  isActive 
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-[0_4px_20px_rgba(16,185,129,0.15)] scale-[1.02]' 
                    : isCompleted
                    ? 'bg-slate-900/30 border-white/5 text-emerald-500 hover:bg-slate-900/50'
                    : 'bg-slate-900/20 border-white/5 text-slate-400 hover:bg-slate-900/40 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${
                    isActive 
                      ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400' 
                      : isCompleted
                      ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500'
                      : 'bg-slate-950/40 border-white/5 text-slate-500'
                  }`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="truncate">
                    <p className="text-[10px] font-mono tracking-wider font-bold opacity-60 uppercase">{step.badge}</p>
                    <h3 className="text-xs font-bold font-display uppercase tracking-wide">{step.title}</h3>
                  </div>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </section>

        {/* High-Fidelity Mock Screen Workspace */}
        <section className="flex-1 flex flex-col border border-white/5 rounded-3xl bg-[#0f172a]/30 backdrop-blur-lg relative overflow-hidden min-h-[400px]">
          {/* Top golden progress indicators */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-yellow-500 z-10" />

          {/* Stepper info banner */}
          <div className="p-6 border-b border-white/5 bg-slate-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25 uppercase">{activeStep.badge}</span>
              <h2 className="text-2xl font-display font-black uppercase tracking-wide text-white mt-1.5">{activeStep.title}</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">{activeStep.description}</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={activeStepIndex === 0}
                onClick={() => setActiveStepId(TOURNAMENT_STEPS[activeStepIndex - 1].id)}
                className="text-xs font-bold border-white/10 hover:bg-white/5"
              >
                Previous Step
              </Button>
              <Button 
                variant="gold" 
                size="sm"
                disabled={activeStepIndex === TOURNAMENT_STEPS.length - 1}
                onClick={() => setActiveStepId(TOURNAMENT_STEPS[activeStepIndex + 1].id)}
                className="text-xs font-bold"
              >
                Next Step
              </Button>
            </div>
          </div>

          {/* Mock Stage Display Screen */}
          <div className="flex-1 p-6 relative flex flex-col justify-center items-center overflow-y-auto">
            {/* Stage Mock-ups */}
            <div className="w-full max-w-2xl h-full flex flex-col justify-center min-h-[300px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStepId}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className="w-full"
                >
                  {/* Step 1: Create Tournament Mock */}
                  {activeStepId === 'create' && (
                    <Card className="bg-[#020714]/65 border-white/5 text-white shadow-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-display text-yellow-400 uppercase tracking-widest">Tournament Parameters</CardTitle>
                        <CardDescription className="text-[10px] text-slate-400">Setup local league constraints</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-slate-400 font-bold uppercase text-[9px]">Tournament Name</label>
                            <input disabled value="IPL Local Championship 2026" className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-400" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-slate-400 font-bold uppercase text-[9px]">Auction Purse per Team</label>
                            <select disabled className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-400">
                              <option>₹120.00 Crore</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-slate-400 font-bold uppercase text-[9px]">Franchise Teams</label>
                            <input disabled value="10 Teams" className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-400 text-center" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-slate-400 font-bold uppercase text-[9px]">Squad Max Limit</label>
                            <input disabled value="25 Players" className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-400 text-center" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-slate-400 font-bold uppercase text-[9px]">Playoff Format</label>
                            <input disabled value="Page Play-offs" className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-400 text-center" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Step 2: Add Teams Mock */}
                  {activeStepId === 'teams' && (
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                      {IPL_TEAMS.slice(0, 10).map((team) => (
                        <div key={team.id} className="bg-[#020714]/65 border border-white/5 rounded-xl p-3 text-center flex flex-col items-center gap-1.5 opacity-60">
                          <div className="w-10 h-10 rounded-full border border-white/10 bg-slate-950 flex items-center justify-center font-display font-black text-xs" style={{ color: team.color }}>
                            {team.shortName}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-full text-slate-300">{team.name}</span>
                          <span className="text-[8px] font-bold text-yellow-400 uppercase tracking-widest">AI Managed</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step 3: Add Players Mock */}
                  {activeStepId === 'players' && (
                    <Card className="bg-[#020714]/65 border-white/5 text-white shadow-2xl overflow-hidden">
                      <div className="p-3 bg-slate-950/30 border-b border-white/5 flex justify-between items-center text-[10px] font-bold">
                        <span className="text-yellow-400 uppercase tracking-widest">Registered Player Pool</span>
                        <span className="text-slate-400">Total: 420 Players</span>
                      </div>
                      <div className="divide-y divide-white/5 text-[10px]">
                        {[
                          { name: 'Virat Kohli', role: 'Batsman', base: '₹2.00 Cr', nationality: 'IND' },
                          { name: 'Jasprit Bumrah', role: 'Bowler', base: '₹2.00 Cr', nationality: 'IND' },
                          { name: 'Heinrich Klaasen', role: 'Wicketkeeper', base: '₹2.00 Cr', nationality: 'OS' },
                          { name: 'Rashid Khan', role: 'All-Rounder', base: '₹2.00 Cr', nationality: 'OS' }
                        ].map((p, i) => (
                          <div key={i} className="flex justify-between items-center px-4 py-2 opacity-65 text-slate-300">
                            <span className="font-bold text-white uppercase">{p.name}</span>
                            <span className="text-[9px] uppercase font-semibold text-slate-400">{p.role}</span>
                            <span className="font-mono text-[9px]">{p.base}</span>
                            <span className="text-[8px] px-1 rounded bg-white/5 font-bold">{p.nationality}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Step 4: Conduct Auction Mock */}
                  {activeStepId === 'auction' && (
                    <div className="border border-dashed border-emerald-500/30 rounded-2xl bg-emerald-500/5 p-8 text-center space-y-4 max-w-md mx-auto opacity-70">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                        <Gavel className="w-6 h-6 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-display text-sm font-bold uppercase text-white tracking-widest">Live Auction Interface</h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed">Runs the CricAuctionIPL real-time auction engine for the selected tournament franchise pool.</p>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Generate Fixtures Mock */}
                  {activeStepId === 'fixtures' && (
                    <Card className="bg-[#020714]/65 border-white/5 text-white shadow-2xl">
                      <div className="p-3 bg-slate-950/30 border-b border-white/5 text-center text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Fixture Generator</div>
                      <div className="p-4 space-y-2.5 text-[10px] opacity-75">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="font-bold text-cyan-400">MI</span>
                          <span className="text-slate-400 font-bold">VS</span>
                          <span className="font-bold text-yellow-400">CSK</span>
                          <span className="text-slate-500">Match 1 • Wankhede Stadium</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="font-bold text-red-500">RCB</span>
                          <span className="text-slate-400 font-bold">VS</span>
                          <span className="font-bold text-orange-400">SRH</span>
                          <span className="text-slate-500">Match 2 • M. Chinnaswamy Stadium</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-purple-500">KKR</span>
                          <span className="text-slate-400 font-bold">VS</span>
                          <span className="font-bold text-sky-400">DC</span>
                          <span className="text-slate-500">Match 3 • Eden Gardens</span>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Step 6: Track Standings Mock */}
                  {activeStepId === 'standings' && (
                    <Card className="bg-[#020714]/65 border-white/5 text-white shadow-2xl overflow-hidden">
                      <div className="p-3 bg-slate-950/30 border-b border-white/5 flex justify-between items-center text-[10px] font-bold text-yellow-400 uppercase tracking-widest">
                        <span>IPL Points Table</span>
                        <span className="text-slate-400 lowercase font-normal text-[9px]">Mock simulation standings</span>
                      </div>
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="border-b border-white/10 text-[8px] uppercase tracking-wider text-slate-400 font-bold bg-slate-950/20">
                            <th className="p-2">Pos</th>
                            <th className="p-2">Team</th>
                            <th className="p-2 text-center">P</th>
                            <th className="p-2 text-center">W</th>
                            <th className="p-2 text-center">L</th>
                            <th className="p-2 text-right">Pts</th>
                            <th className="p-2 text-right">NRR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300 opacity-70">
                          {[
                            { pos: 1, team: 'CSK', p: 14, w: 10, l: 4, pts: 20, nrr: '+0.540' },
                            { pos: 2, team: 'MI', p: 14, w: 9, l: 5, pts: 18, nrr: '+0.312' },
                            { pos: 3, team: 'RCB', p: 14, w: 8, l: 6, pts: 16, nrr: '+0.125' },
                            { pos: 4, team: 'SRH', p: 14, w: 8, l: 6, pts: 16, nrr: '-0.040' }
                          ].map((t) => (
                            <tr key={t.pos}>
                              <td className="p-2 font-bold text-white">{t.pos}</td>
                              <td className="p-2 font-bold text-white">{t.team}</td>
                              <td className="p-2 text-center">{t.p}</td>
                              <td className="p-2 text-center">{t.w}</td>
                              <td className="p-2 text-center">{t.l}</td>
                              <td className="p-2 text-right font-bold text-yellow-400">{t.pts}</td>
                              <td className="p-2 text-right font-mono text-[9px]">{t.nrr}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  )}

                  {/* Step 7: Declare Champion Mock */}
                  {activeStepId === 'champion' && (
                    <div className="border border-yellow-500/20 rounded-2xl bg-yellow-500/5 p-6 text-center space-y-4 max-w-sm mx-auto opacity-70">
                      <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mx-auto text-yellow-400">
                        <Trophy className="w-7 h-7 text-yellow-400 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-display text-sm font-bold uppercase text-white tracking-widest">🏆 Champion Podium 🏆</h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed">Declares the winner of the league, records historical franchise statistics, and celebrates with dynamic trophy lift displays.</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Overwhelming Beta Lock Overlay */}
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2.5px] z-20 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 animate-[pulse_2s_infinite]">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl font-black uppercase tracking-wider text-white">Feature Coming Soon</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-2 leading-relaxed">
                Tournament Mode is currently under active development. Keep an eye out in upcoming versions for local championship coordination, custom leagues, fixtures generation, and championship trophy lifts!
              </p>
              <Button 
                variant="gold" 
                size="sm" 
                onClick={() => navigate('/')} 
                className="mt-6 font-bold text-slate-950 px-6"
              >
                Back to Home
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Tournament;
