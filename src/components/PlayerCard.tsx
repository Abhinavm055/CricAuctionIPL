import { useEffect, useState } from 'react';
import { Player } from '@/lib/samplePlayers';
import { formatPrice, isImagePreloaded } from '@/lib/constants';
import { TeamLogo } from './TeamLogo';
import { StarRating } from './StarRating';
import { cn } from '@/lib/utils';
import Tilt from 'react-parallax-tilt';
import { Sparkles, Target, Zap, Award, Shield } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  currentBid: number;
  currentBidderId?: string | null;
  currentBidderName?: string | null;
  onImageLoad?: () => void;
}

const normalizeRoleLabel = (role: string) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized.includes('wicket')) return 'Wicket Keeper';
  if (normalized.includes('all')) return 'All-Rounder';
  if (normalized.includes('bowl')) return 'Bowler';
  return 'Batsman';
};

const getRoleIcon = (role: string) => {
  const r = role.toLowerCase();
  if (r.includes('wicket')) return <Award className="h-3 w-3 mr-1 shrink-0" />;
  if (r.includes('all')) return <Sparkles className="h-3 w-3 mr-1 shrink-0" />;
  if (r.includes('bowl')) return <Target className="h-3 w-3 mr-1 shrink-0" />;
  return <Zap className="h-3 w-3 mr-1 shrink-0" />;
};

const getRoleBadgeStyle = (role: string) => {
  const r = role.toLowerCase();
  if (r.includes('wicket')) return 'from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-400';
  if (r.includes('all')) return 'from-purple-500/20 to-indigo-500/20 border-purple-500/30 text-purple-400';
  if (r.includes('bowl')) return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-cyan-400';
  return 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400';
};

const getCountryFlag = (nationality: string) => {
  const nat = String(nationality || '').toLowerCase();
  if (nat.includes('ind')) return '🇮🇳';
  if (nat.includes('aus')) return '🇦🇺';
  if (nat.includes('eng')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (nat.includes('sa') || nat.includes('south africa')) return '🇿🇦';
  if (nat.includes('wi') || nat.includes('west indies')) return '🌴';
  if (nat.includes('nz') || nat.includes('new zealand')) return '🇳🇿';
  if (nat.includes('sl') || nat.includes('sri lanka')) return '🇱🇰';
  if (nat.includes('afg') || nat.includes('afghanistan')) return '🇦🇫';
  if (nat.includes('ban') || nat.includes('bangladesh')) return '🇧🇩';
  if (nat.includes('nep')) return '🇳🇵';
  if (nat.includes('usa')) return '🇺🇸';
  if (nat.includes('ire')) return '🇮🇪';
  if (nat.includes('zim')) return '🇿🇼';
  if (nat.includes('nam')) return '🇳🇦';
  if (nat.includes('scot')) return '🏴󠁧󠁢󠁳󠁣󠁴󠁿';
  if (nat.includes('ned') || nat.includes('netherlands')) return '🇳🇱';
  if (nat.includes('uae')) return '🇦🇪';
  if (nat.includes('oma')) return '🇴🇲';
  return '🏳️';
};

const getTeamIdFromAnyName = (name: string | null | undefined): string | null => {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  if (n === 'csk' || n.includes('chennai') || n.includes('super kings')) return 'csk';
  if (n === 'mi' || n.includes('mumbai') || n.includes('indians')) return 'mi';
  if (n === 'rcb' || n.includes('bangalore') || n.includes('bengaluru') || n.includes('royal challengers')) return 'rcb';
  if (n === 'kkr' || n.includes('kolkata') || n.includes('knight riders')) return 'kkr';
  if (n === 'dc' || n.includes('delhi') || n.includes('capitals')) return 'dc';
  if (n === 'pbks' || n.includes('punjab') || n.includes('kings')) return 'pbks';
  if (n === 'rr' || n.includes('rajasthan') || n.includes('royals')) return 'rr';
  if (n === 'srh' || n.includes('hyderabad') || n.includes('sunrisers')) return 'srh';
  if (n === 'gt' || n.includes('gujarat') || n.includes('titans')) return 'gt';
  if (n === 'lsg' || n.includes('lucknow') || n.includes('giants')) return 'lsg';
  return null;
};

const getFullTeamName = (shortName: string | null | undefined) => {
  if (!shortName) return 'Opening Bid';
  const name = shortName.toUpperCase();
  if (name === 'CSK') return 'Chennai Super Kings';
  if (name === 'DC') return 'Delhi Capitals';
  if (name === 'GT') return 'Gujarat Titans';
  if (name === 'KKR') return 'Kolkata Knight Riders';
  if (name === 'LSG') return 'Lucknow Super Giants';
  if (name === 'MI') return 'Mumbai Indians';
  if (name === 'PBKS') return 'Punjab Kings';
  if (name === 'RR') return 'Rajasthan Royals';
  if (name === 'RCB') return 'Royal Challengers Bengaluru';
  if (name === 'SRH') return 'Sunrisers Hyderabad';
  return shortName;
};

const animationsAndStyles = `
  @keyframes float-avatar {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }
  .animate-float-avatar {
    animation: float-avatar 3.5s ease-in-out infinite;
  }
  @keyframes bidPulse {
    0%, 100% { border-color: rgba(234, 179, 8, 0.2); box-shadow: 0 0 5px rgba(234, 179, 8, 0.05); }
    50% { border-color: rgba(234, 179, 8, 0.35); box-shadow: 0 0 10px rgba(234, 179, 8, 0.12); }
  }
`;

const PlayerSilhouette = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/15 backdrop-blur-sm rounded-xl overflow-hidden animate-pulse">
    <div className="absolute inset-0 bg-gradient-to-t from-cyan-950/20 via-transparent to-transparent z-10 pointer-events-none" />
    <svg className="h-24 w-24 text-slate-800/40 z-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5">
      <div className="h-1 w-12 bg-cyan-500/20 rounded-full overflow-hidden">
        <div className="h-full w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent animate-pulse" />
      </div>
    </div>
  </div>
);

export const PlayerCard = ({ player, currentBid, currentBidderId, currentBidderName, onImageLoad }: PlayerCardProps) => {
  const playerImage = (player as any).image || player.imageUrl;
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(() => {
    if (playerImage && isImagePreloaded(playerImage)) {
      return true;
    }
    return false;
  });
  const rating = Number((player as any).starRating ?? player.rating ?? 3) as 1 | 2 | 3 | 4 | 5;
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const preloaded = playerImage ? isImagePreloaded(playerImage) : false;
    setImageLoaded(preloaded);
    setImageFailed(false);
  }, [player.id, playerImage]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    onImageLoad?.();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const prevTeamId = getTeamIdFromAnyName(player.previousTeam);
  const bidActive = Boolean(currentBidderId);

  return (
    <Tilt
      glareEnable={true}
      glareMaxOpacity={0.1}
      glareColor="#ffffff"
      glarePosition="all"
      tiltMaxAngleX={4}
      tiltMaxAngleY={4}
      perspective={1200}
      className="h-full w-full select-none"
    >
      <style>{animationsAndStyles}</style>
      <div 
        onMouseMove={handleMouseMove}
        style={{ '--x': `${coords.x}px`, '--y': `${coords.y}px` } as React.CSSProperties}
        className={cn(
          "relative h-full w-full overflow-hidden rounded-2xl border text-white spotlight-hover glass-panel-premium transition-all duration-300",
          "border-white/10 shadow-[0_12px_30px_rgba(0,0,0,0.5)] flex flex-col p-3 md:p-4 min-h-0 justify-between"
        )}
      >
        {/* Background gradient grid for sci-fi sports feel */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(11,29,58,0.25)_0%,rgba(2,6,23,0.85)_100%)] z-0 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,207,255,0.06)_0%,transparent_70%)] z-0 pointer-events-none" />

        {/* 1. TOP SHOWCASE (Horizontal Layout - Left 45% Image, Right 55% Info) */}
        <div className="flex-1 relative min-h-[160px] md:min-h-[220px] overflow-visible z-10 my-1 md:my-2 w-full">
          {/* Soft stadium spotlight glow behind the player */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,207,255,0.15)_0%,transparent_60%)] pointer-events-none z-0" />
          
          <div className="w-full h-full grid grid-cols-[45%_55%] gap-2 items-center relative z-10">
            {/* Left Column: Player Image (Moved upward by ~50-80px via negative top margins/offsets) */}
            <div className="relative h-full w-full flex items-center justify-center min-w-0 overflow-visible mt-[-25px] md:mt-[-45px] z-10">
              {playerImage && !imageFailed ? (
                <div className="relative h-[125%] w-[125%] flex items-center justify-center animate-float-avatar">
                  <img
                    src={playerImage}
                    alt={player.name}
                    className={cn(
                      "max-h-full max-w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] transition-all duration-500 z-10",
                      imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
                    )}
                    onLoad={handleImageLoad}
                    onError={() => setImageFailed(true)}
                  />
                  {!imageLoaded && (
                    <>
                      <PlayerSilhouette />
                      <div className="absolute inset-0 flex items-center justify-center z-20">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyan-400" />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="relative h-full w-full flex items-center justify-center">
                  <PlayerSilhouette />
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20">
                    <span className="text-[7px] uppercase font-black tracking-widest text-slate-500 bg-slate-950/65 px-1.5 py-0.5 rounded border border-white/5 whitespace-nowrap">
                      No Image Available
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Player Info & Current Bidder */}
            <div className="flex flex-col justify-center space-y-2.5 pl-1.5 h-full z-10">
              {/* Player Name, Role, Rating */}
              <div className="space-y-1 text-left">
                <h2 className="text-2xl font-display uppercase tracking-wider text-shadow-glow text-white font-black leading-tight drop-shadow-[0_1px_5px_rgba(255,255,255,0.08)]">
                  {player.name}
                </h2>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Role Badge */}
                  <span className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[8px] font-black tracking-wider uppercase backdrop-blur-md shadow-sm bg-gradient-to-r",
                    getRoleBadgeStyle(player.role)
                  )}>
                    {getRoleIcon(player.role)}
                    {normalizeRoleLabel(player.role)}
                  </span>
                  {/* Star Rating */}
                  <div className="flex items-center rounded-full bg-black/35 border border-white/5 px-2 py-0.5 backdrop-blur-md shadow-sm">
                    <StarRating rating={rating} size="sm" />
                  </div>
                </div>
              </div>

              {/* Current Bidder Box */}
              <div className="bg-[#051126]/85 border border-yellow-500/30 rounded-xl p-2.5 flex flex-col justify-between backdrop-blur-md shadow-[0_8px_20px_rgba(0,0,0,0.5)] space-y-1.5">
                <div>
                  <span className="text-[7.5px] uppercase tracking-widest text-slate-400 font-bold block mb-0.5">
                    Current Bidder
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-6 w-6 rounded-full bg-black/50 border border-white/10 p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      <TeamLogo
                        teamId={currentBidderId || null}
                        shortName={currentBidderName || 'BID'}
                        size="sm"
                        className="h-full w-full object-contain bg-transparent border-none"
                      />
                    </div>
                    <span className="font-extrabold text-white text-[10px] md:text-[11px] truncate uppercase tracking-wider leading-tight">
                      {getFullTeamName(currentBidderName)}
                    </span>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-white/5 flex flex-col justify-between">
                  <span className="text-[7.5px] uppercase tracking-widest text-yellow-400/80 font-bold block mb-0.5">
                    Current Bid
                  </span>
                  <span className="font-black text-yellow-300 text-base md:text-lg leading-none tracking-wide drop-shadow-[0_0_4px_rgba(234,179,8,0.15)]">
                    {formatPrice(currentBid)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. BOTTOM DETAILS AREA (Two-row layout: Country | Prev Team, and Base Price | Current Bid) */}
        <div className="space-y-2 shrink-0 z-10 w-full mt-auto">
          {/* Row 1: Country Card | Previous Team Card */}
          <div className="grid grid-cols-2 gap-2">
            {/* Country Card */}
            <div className="flex items-center gap-2 rounded-xl bg-[#09152b]/40 border border-white/5 px-2.5 py-1 backdrop-blur-md shadow-inner min-w-0">
              <span className="text-base shrink-0 leading-none" role="img" aria-label="flag">
                {getCountryFlag(player.nationality)}
              </span>
              <div className="flex flex-col min-w-0 leading-none">
                <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Country</span>
                <span className="text-[10px] text-white font-semibold truncate">
                  {player.nationality}
                </span>
              </div>
            </div>

            {/* Previous Team Card */}
            <div className="flex items-center gap-2 rounded-xl bg-[#09152b]/40 border border-white/5 px-2.5 py-1 backdrop-blur-md shadow-inner min-w-0">
              <div className="h-5.5 w-5.5 rounded bg-black/40 border border-white/10 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                <TeamLogo 
                  teamId={prevTeamId} 
                  shortName={player.previousTeam || 'None'} 
                  size="sm" 
                  className="h-full w-full object-contain bg-transparent border-none"
                />
              </div>
              <div className="flex flex-col min-w-0 leading-none">
                <span className="text-[7px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Prev Team</span>
                <span className="text-[10px] text-white font-semibold truncate">
                  {player.previousTeam || 'None'}
                </span>
              </div>
            </div>
          </div>

          {/* Row 2: Base Price Card | Current Bid Card */}
          <div className="grid grid-cols-2 gap-2">
            {/* Base Price Card */}
            <div className="flex flex-col justify-between rounded-xl bg-slate-950/40 border border-white/5 px-3 py-1.5 backdrop-blur-md shadow-inner">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[7.5px] mb-0.5 leading-none">Base Price</span>
              <span className="font-extrabold text-white text-[12.5px] leading-tight">{formatPrice(player.basePrice)}</span>
            </div>

            {/* Current Bid Card (Subtle pulse glow) */}
            <div className={cn(
              "flex flex-col justify-between rounded-xl border p-1.5 backdrop-blur-md relative overflow-hidden transition-all duration-300 shadow-sm",
              bidActive 
                ? "from-[#eab308]/6 via-[#ca8a04]/2 to-[#020617]/70 border-yellow-500/35 shadow-[0_0_8px_rgba(234,179,8,0.12)] animate-[bidPulse_2.5s_infinite]" 
                : "from-[#071329]/20 to-[#020617]/50 border-white/5"
            )}>
              <div className="absolute top-0 right-0 w-12 h-12 bg-yellow-500/1 rounded-full blur-lg pointer-events-none" />
              <span className={cn(
                "font-semibold uppercase tracking-wider text-[7.5px] mb-0.5 leading-none",
                bidActive ? "text-yellow-400/80" : "text-slate-400"
              )}>Current Bid</span>
              <span className={cn(
                "font-black text-[12.5px] leading-tight",
                bidActive ? "text-yellow-300 drop-shadow-[0_0_4px_rgba(234,179,8,0.15)]" : "text-white"
              )}>{formatPrice(currentBid)}</span>
            </div>
          </div>
        </div>
      </div>
    </Tilt>
  );
};
