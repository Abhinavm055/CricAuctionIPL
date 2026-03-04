import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { generateGameCode } from '@/lib/constants';
import { Gavel, Users, Bot, Trophy, Zap, Shield } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  const handleCreateGame = () => navigate(`/multiplayer`);
  const handlePlayWithAI = () => {
    const code = generateGameCode();
    navigate(`/lobby/${code}?host=true&ai=true`);
  };

  const features = [
    { icon: Gavel, title: 'Real Auction Rules', desc: 'Official IPL price slabs & RTM' },
    { icon: Users, title: 'Multiplayer', desc: 'Play with up to 10 friends' },
    { icon: Bot, title: 'AI Opponents', desc: 'Smart bots when teams are unclaimed' },
    { icon: Trophy, title: 'Full Squads', desc: '250+ real players with ratings' },
    { icon: Zap, title: 'Real-Time', desc: 'Live bidding with 30s timer' },
    { icon: Shield, title: 'Squad Rules', desc: 'Min 18, Max 25, 8 overseas' },
  ];

  return (
    <div className="min-h-screen broadcast-container flex flex-col">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 p-6">
        <div className="flex items-center gap-2">
          <Gavel className="w-8 h-8 text-primary" />
          <h1 className="font-display text-3xl text-primary">
            CricAuction<span className="text-foreground">IPL</span>
          </h1>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="text-center mb-12 slide-up">
          <h2 className="font-display text-6xl md:text-8xl text-foreground mb-4 tracking-wide">
            IPL AUCTION
            <span className="block text-primary text-shadow-glow">SIMULATOR</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience the thrill of the IPL Mega Auction. Build your dream team with real players,
            compete with friends or AI, and master the art of auction strategy.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10 w-full max-w-6xl">
          <div className="p-6 card-gradient rounded-2xl border border-border/50">
            <Users className="w-10 h-10 text-primary mb-3" />
            <h3 className="font-display text-2xl mb-2">VS Multiplayer Auction</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Host or join a live IPL auction with friends. Human players control selected teams while unselected teams are handled by the AI engine.
            </p>
            <Button variant="gold" size="lg" onClick={handleCreateGame} className="w-full">VS Multiplayer</Button>
          </div>

          <div className="p-6 card-gradient rounded-2xl border border-border/50">
            <Bot className="w-10 h-10 text-primary mb-3" />
            <h3 className="font-display text-2xl mb-2">Solo Auction Simulator</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Practice the IPL auction solo against AI-controlled teams. Build the strongest squad within purse limits and squad rules.
            </p>
            <Button variant="broadcast" size="lg" onClick={handlePlayWithAI} className="w-full">Play Solo</Button>
          </div>

          <div className="p-6 card-gradient rounded-2xl border border-border/50">
            <Trophy className="w-10 h-10 text-primary mb-3" />
            <h3 className="font-display text-2xl mb-2">Retention + Auction Mode</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start with the retention phase before entering the auction. Retained players reduce purse and affect RTM availability.
            </p>
            <Button variant="secondary" size="lg" onClick={handleCreateGame} className="w-full">Start Mode</Button>
          </div>
        </div>

        <div className="w-full max-w-6xl p-4 rounded-xl border border-primary/30 bg-primary/5 mb-12">
          <h4 className="font-semibold mb-2">Rules</h4>
          <p className="text-sm text-muted-foreground">
            Purse: ₹120 Cr • Squad size: 18–25 players • Overseas limit: max 8 • Auction pools: Marquee → Batters → All-rounders → Bowlers → Uncapped
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl fade-in" style={{ animationDelay: '0.4s' }}>
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="p-4 card-gradient rounded-xl border border-border/30 text-center hover:border-primary/50 transition-colors"
              style={{ animationDelay: `${0.5 + index * 0.1}s` }}
            >
              <feature.icon className="w-8 h-8 text-primary mx-auto mb-2" />
              <h4 className="font-semibold text-foreground text-sm mb-1">{feature.title}</h4>
              <p className="text-xs text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 p-6 text-center text-sm text-muted-foreground">
        <p>Built for cricket fans. Not affiliated with IPL or BCCI.</p>
      </footer>
    </div>
  );
};

export default Landing;
