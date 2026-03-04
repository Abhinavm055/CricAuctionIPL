import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { generateGameCode } from '@/lib/constants';
import { Gavel, Users, Bot, Trophy, Zap, Shield } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  const handleCreateGame = () => {
    navigate(`/multiplayer`);
  };

  const handlePlayWithAI = () => {
    const code = generateGameCode();
    navigate(`/lobby/${code}?host=true&ai=true`);
  };

  const features = [
    { icon: Gavel, title: 'Real Auction Rules', desc: 'Official IPL price slabs & RTM' },
    { icon: Users, title: 'Multiplayer', desc: 'Play with up to 10 friends' },
    { icon: Bot, title: 'AI Opponents', desc: 'Smart bots when friends are busy' },
    { icon: Trophy, title: 'Full Squads', desc: '250+ real players with ratings' },
    { icon: Zap, title: 'Real-Time', desc: 'Live bidding with 30s timer' },
    { icon: Shield, title: 'Squad Rules', desc: 'Min 18, Max 25, 8 overseas' },
  ];

  return (
    <div className="min-h-screen broadcast-container flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <div className="flex items-center gap-2">
          <Gavel className="w-8 h-8 text-primary" />
          <h1 className="font-display text-3xl text-primary">
            CricAuction<span className="text-foreground">IPL</span>
          </h1>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Hero */}
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

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-6 mb-16 fade-in" style={{ animationDelay: '0.2s' }}>
          {/* Create game */}
          <div className="flex flex-col items-center gap-4 p-8 card-gradient rounded-2xl border border-border/50 min-w-[280px]">
            <Users className="w-12 h-12 text-primary" />
            <h3 className="font-display text-2xl text-foreground">Host a Game</h3>
            <p className="text-sm text-muted-foreground text-center">
              Create a new auction and invite friends
            </p>
            <Button variant="gold" size="xl" onClick={handleCreateGame} className="w-full">
              Create Game
            </Button>
          </div>

          {/* Play with AI */}
          <div className="flex flex-col items-center gap-4 p-8 card-gradient rounded-2xl border border-border/50 min-w-[280px]">
            <Bot className="w-12 h-12 text-primary" />
            <h3 className="font-display text-2xl text-foreground">Play with AI</h3>
            <p className="text-sm text-muted-foreground text-center">
              Start a game hosted locally with AI opponents
            </p>
            <Button variant="broadcast" size="xl" onClick={handlePlayWithAI} className="w-full">
              Play with AI
            </Button>
          </div>
        </div>

        {/* Features grid */}
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

      {/* Footer */}
      <footer className="relative z-10 p-6 text-center text-sm text-muted-foreground">
        <p>Built for cricket fans. Not affiliated with IPL or BCCI.</p>
      </footer>
    </div>
  );
};

export default Landing;