import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { generateGameCode } from '@/lib/constants';
import { Gavel, Users, Bot, Shield, Volume2, VolumeX } from 'lucide-react';
import { createSession } from '@/lib/sessionService';

const getUserId = () => {
  const existing = localStorage.getItem('uid');
  if (existing) return existing;
  const id = `user-${Math.random().toString(36).slice(2, 9)}`;
  localStorage.setItem('uid', id);
  return id;
};

const Landing = () => {
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [counts, setCounts] = useState({ liveAuctions: 0, playersOnline: 0, soldToday: 0 });

  const stats = useMemo(
    () => ({ liveAuctions: 12, playersOnline: 68, soldToday: 341 }),
    [],
  );

  useEffect(() => {
    const audio = new Audio('/crowd.mp3');
    audio.volume = 0.05;
    audio.loop = true;
    audioRef.current = audio;

    audio.play().catch(() => {
      setIsMuted(true);
    });

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const duration = 1400;
    const stepTime = 24;
    const steps = duration / stepTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep += 1;
      const progress = Math.min(currentStep / steps, 1);
      setCounts({
        liveAuctions: Math.floor(stats.liveAuctions * progress),
        playersOnline: Math.floor(stats.playersOnline * progress),
        soldToday: Math.floor(stats.soldToday * progress),
      });

      if (progress === 1) clearInterval(timer);
    }, stepTime);

    return () => clearInterval(timer);
  }, [stats]);

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextMuted = !isMuted;
    audio.muted = nextMuted;
    if (!nextMuted) {
      audio.play().catch(() => {
        setIsMuted(true);
      });
    }
    setIsMuted(nextMuted);
  };

  const handlePlayMultiplayer = () => navigate('/multiplayer');

  const handlePlayWithAI = async () => {
    const code = generateGameCode();
    const userId = getUserId();
    await createSession(code, userId, 'VS_AI');
    navigate(`/lobby/${code}?host=true&ai=true`);
  };

  return (
    <div className="min-h-screen stadium-bg relative flex flex-col overflow-hidden">
      <div className="absolute inset-0 backdrop-blur-[1.5px] bg-[#020617]/55" />
      <header className="relative z-10 p-6">
        <div className="flex items-center gap-2">
          <Gavel className="w-8 h-8 text-primary" />
          <h1 className="font-display text-3xl text-primary">CricAuction<span className="text-foreground">IPL</span></h1>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-6xl w-full mx-auto">
        <div className="text-center mb-12 slide-up">
          <h2 className="font-display text-6xl md:text-8xl text-foreground mb-4 tracking-wide">
            IPL AUCTION
            <span className="block text-primary text-shadow-glow glow-title">SIMULATOR</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 w-full max-w-5xl slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="p-6 rounded-2xl border border-primary/25 bg-[#0f172a]/90 transition-all duration-300 hover:scale-105 hover:border-primary/80 hover:shadow-[0_0_25px_rgba(251,191,36,0.6)] cursor-pointer">
            <Users className="w-10 h-10 text-primary mb-3 transition-transform duration-300 hover:scale-110" />
            <h3 className="font-display text-2xl mb-2">VS Multiplayer Auction</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Host or join a live IPL auction with friends.
            </p>
            <Button
              variant="gold"
              size="lg"
              onClick={handlePlayMultiplayer}
              className="w-full button-attention bg-gradient-to-r from-yellow-400 to-yellow-500 text-slate-950 font-semibold transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(251,191,36,0.8)]"
            >
              Play Multiplayer
            </Button>
          </div>

          <div className="p-6 rounded-2xl border border-primary/25 bg-[#0f172a]/90 transition-all duration-300 hover:scale-105 hover:border-primary/80 hover:shadow-[0_0_25px_rgba(251,191,36,0.6)] cursor-pointer">
            <Bot className="w-10 h-10 text-primary mb-3 transition-transform duration-300 hover:scale-110" />
            <h3 className="font-display text-2xl mb-2">VS AI Auction</h3>
            <p className="text-sm text-muted-foreground mb-4">
              1 human team vs 9 AI teams with personality-driven bidding.
            </p>
            <Button
              variant="broadcast"
              size="lg"
              onClick={handlePlayWithAI}
              className="w-full button-attention bg-gradient-to-r from-yellow-400 to-yellow-500 text-slate-950 font-semibold transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(251,191,36,0.8)]"
            >
              Play VS AI
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-6 md:gap-10 mt-12 text-yellow-400 text-sm md:text-base fade-in" style={{ animationDelay: "0.5s" }}>
          <div>🔥 Live Auctions: {counts.liveAuctions}</div>
          <div>👥 Players Online: {counts.playersOnline}</div>
          <div>🏏 Players Sold Today: {counts.soldToday}</div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-10 mt-14 text-center w-full max-w-5xl fade-in" style={{ animationDelay: "0.7s" }}>
          <div className="rounded-xl border border-border/70 bg-[#0f172a]/85 p-5">
            <div className="text-3xl mb-2">🎮</div>
            <h4 className="font-display text-2xl text-primary">Create Lobby</h4>
            <p className="text-sm text-muted-foreground">Invite friends or play AI teams</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-[#0f172a]/85 p-5">
            <div className="text-3xl mb-2">⚡</div>
            <h4 className="font-display text-2xl text-primary">Start Auction</h4>
            <p className="text-sm text-muted-foreground">Teams bid in real time</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-[#0f172a]/85 p-5">
            <div className="text-3xl mb-2">🏆</div>
            <h4 className="font-display text-2xl text-primary">Build Squad</h4>
            <p className="text-sm text-muted-foreground">Create the best IPL team</p>
          </div>
        </div>
      </main>

      <button
        type="button"
        onClick={toggleMute}
        className="fixed bottom-5 right-20 z-50 w-10 h-10 rounded-full bg-[#0f172a] border border-primary/70 text-primary shadow-lg flex items-center justify-center hover:shadow-[0_0_14px_rgba(251,191,36,0.75)] transition-all"
        aria-label={isMuted ? 'Unmute crowd ambience' : 'Mute crowd ambience'}
      >
        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

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
