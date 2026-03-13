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
  const [counts, setCounts] = useState({ liveAuctions: 0, playersOnline: 0 });
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const howItWorksRef = useRef<HTMLElement | null>(null);

  const stats = useMemo(
    () => ({ liveAuctions: 12, playersOnline: 68 }),
    [],
  );

  useEffect(() => {
    const audio = new Audio('/crowd.mp3');
    audio.volume = 0.03;
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
    const duration = 1100;
    const stepTime = 25;
    const steps = duration / stepTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep += 1;
      const progress = Math.min(currentStep / steps, 1);
      setCounts({
        liveAuctions: Math.floor(stats.liveAuctions * progress),
        playersOnline: Math.floor(stats.playersOnline * progress),
      });

      if (progress === 1) clearInterval(timer);
    }, stepTime);

    return () => clearInterval(timer);
  }, [stats]);


  useEffect(() => {
    const section = howItWorksRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowHowItWorks(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

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
    <div className="landing-page min-h-screen relative flex flex-col overflow-hidden">
      <div className="absolute inset-0 bg-[#020617]/60 backdrop-blur-[1.2px]" />

      <header className="relative z-10 p-6">
        <div className="flex items-center gap-2">
          <Gavel className="w-8 h-8 text-primary" />
          <h1 className="font-display text-3xl text-primary">
            CricAuction<span className="text-foreground">IPL</span>
          </h1>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-10 w-full max-w-6xl mx-auto">
        <section className="text-center mb-12 slide-up">
          <h2 className="font-display text-6xl md:text-8xl text-foreground mb-4 tracking-wide">
            IPL AUCTION
            <span className="block text-primary text-shadow-glow glow-title">SIMULATOR</span>
          </h2>
        </section>

        <section className="grid md:grid-cols-2 gap-6 w-full max-w-5xl slide-up" style={{ animationDelay: '0.15s' }}>
          <article className="group p-6 rounded-2xl border border-primary/25 bg-[#0f172a]/90 transition-all duration-300 hover:-translate-y-2 hover:scale-105 hover:border-primary/80 hover:shadow-[0_0_30px_rgba(251,191,36,0.6)]">
            <Users className="w-10 h-10 text-primary mb-3 transition-transform duration-300 group-hover:scale-110" />
            <h3 className="font-display text-2xl mb-2">VS Multiplayer Auction</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Host or join a live IPL auction with friends.
            </p>
            <Button
              variant="gold"
              size="lg"
              onClick={handlePlayMultiplayer}
              className="w-full button-attention bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-semibold hover:scale-105 hover:shadow-[0_0_20px_rgba(251,191,36,0.9)] transition-all duration-300"
            >
              Play Multiplayer
            </Button>
          </article>

          <article className="group p-6 rounded-2xl border border-primary/25 bg-[#0f172a]/90 transition-all duration-300 hover:-translate-y-2 hover:scale-105 hover:border-primary/80 hover:shadow-[0_0_30px_rgba(251,191,36,0.6)]">
            <Bot className="w-10 h-10 text-primary mb-3 transition-transform duration-300 group-hover:scale-110" />
            <h3 className="font-display text-2xl mb-2">VS AI Auction</h3>
            <p className="text-sm text-muted-foreground mb-4">
              1 human team vs 9 AI teams with personality-driven bidding.
            </p>
            <Button
              variant="broadcast"
              size="lg"
              onClick={handlePlayWithAI}
              className="w-full button-attention bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-semibold hover:scale-105 hover:shadow-[0_0_20px_rgba(251,191,36,0.9)] transition-all duration-300"
            >
              Play VS AI
            </Button>
          </article>
        </section>

        <section className="flex justify-center gap-6 md:gap-10 mt-12 text-yellow-400 text-base md:text-lg fade-in" style={{ animationDelay: '0.35s' }}>
          <div className="flex items-center gap-2">🔥 <span>Live Auctions: {counts.liveAuctions}</span></div>
          <div className="flex items-center gap-2">👥 <span>Players Online: {counts.playersOnline}</span></div>
        </section>

        <section ref={howItWorksRef} className={`grid md:grid-cols-3 gap-6 md:gap-10 mt-16 text-center w-full max-w-5xl ${showHowItWorks ? 'fade-in' : 'opacity-0'}`}>
          <div className="rounded-xl border border-border/70 bg-[#0f172a]/85 p-5">
            <h3 className="font-display text-2xl text-primary mb-1">🎮 Create Lobby</h3>
            <p className="text-sm text-muted-foreground">Invite friends or start multiplayer auction</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-[#0f172a]/85 p-5">
            <h3 className="font-display text-2xl text-primary mb-1">⚡ Start Auction</h3>
            <p className="text-sm text-muted-foreground">Teams bid live for players</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-[#0f172a]/85 p-5">
            <h3 className="font-display text-2xl text-primary mb-1">🏆 Build Squad</h3>
            <p className="text-sm text-muted-foreground">Create the strongest IPL team</p>
          </div>
        </section>
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
