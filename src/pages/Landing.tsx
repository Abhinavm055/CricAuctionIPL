import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { generateGameCode } from '@/lib/constants';
import { Gavel, Users, Bot, Shield } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  const handlePlayMultiplayer = () => navigate('/multiplayer');
  const handlePlayWithAI = () => {
    const code = generateGameCode();
    navigate(`/lobby/${code}?host=true&ai=true`);
  };

  return (
    <div className="min-h-screen broadcast-container flex flex-col">
      <header className="relative z-10 p-6">
        <div className="flex items-center gap-2">
          <Gavel className="w-8 h-8 text-primary" />
          <h1 className="font-display text-3xl text-primary">CricAuction<span className="text-foreground">IPL</span></h1>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="font-display text-6xl md:text-8xl text-foreground mb-4 tracking-wide">
            IPL AUCTION
            <span className="block text-primary text-shadow-glow">SIMULATOR</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 w-full max-w-5xl">
          <div className="p-6 card-gradient rounded-2xl border border-border/50">
            <Users className="w-10 h-10 text-primary mb-3" />
            <h3 className="font-display text-2xl mb-2">VS Multiplayer Auction</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Host or join a live IPL auction with friends. Human players control selected teams while unselected teams are handled by the AI engine.
            </p>
            <Button variant="gold" size="lg" onClick={handlePlayMultiplayer} className="w-full">Play Multiplayer</Button>
          </div>

          <div className="p-6 card-gradient rounded-2xl border border-border/50">
            <Bot className="w-10 h-10 text-primary mb-3" />
            <h3 className="font-display text-2xl mb-2">Solo Auction Simulator</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Practice the IPL auction solo against AI-controlled teams. Build the strongest squad within purse limits and squad rules.
            </p>
            <Button variant="broadcast" size="lg" onClick={handlePlayWithAI} className="w-full">Play Solo</Button>
          </div>
        </div>
      </main>

      <Link
        to="/admin"
        className="fixed bottom-5 right-5 z-50 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        aria-label="Open admin panel"
      >
        <Shield className="w-5 h-5" />
      </Link>
    </div>
  );
};

export default Landing;
