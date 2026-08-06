import { useEffect, useState, memo } from 'react';
import { Player } from '@/lib/samplePlayers';
import { formatPrice, isImagePreloaded, getPlayerPreviousTeam } from '@/lib/constants';
import { TeamLogo } from './TeamLogo';
import { StarRating } from './StarRating';
import { cn } from '@/lib/utils';
import { PlayerInitialsAvatar } from './PlayerInitialsAvatar';
import { AnimatedBidValue } from './AnimatedBidValue';
import { Sparkles, Target, Zap, Award, Shield } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  currentBid: number;
  currentBidderId?: string | null;
  currentBidderName?: string | null;
  activeBidOverlay?: { teamShortName: string; amountStr: string } | null;
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
  if (r.includes('wicket')) return <Award className="h-3.5 w-3.5 mr-1 shrink-0" />;
  if (r.includes('all')) return <Sparkles className="h-3.5 w-3.5 mr-1 shrink-0" />;
  if (r.includes('bowl')) return <Target className="h-3.5 w-3.5 mr-1 shrink-0" />;
  return <Zap className="h-3.5 w-3.5 mr-1 shrink-0" />;
};

const getRoleBadgeStyle = (role: string) => {
  const r = role.toLowerCase();
  if (r.includes('wicket')) return 'bg-orange-500/15 border-orange-500/30 text-orange-400';
  if (r.includes('all')) return 'bg-purple-500/15 border-purple-500/30 text-purple-400';
  if (r.includes('bowl')) return 'bg-blue-500/15 border-blue-500/30 text-cyan-400';
  return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
};

const getCountryCode = (nationality: string) => {
  const nat = String(nationality || '').toLowerCase();
  if (nat.includes('ind')) return 'IND';
  if (nat.includes('aus')) return 'AUS';
  if (nat.includes('eng')) return 'ENG';
  if (nat.includes('sa') || nat.includes('south africa')) return 'RSA';
  if (nat.includes('wi') || nat.includes('west indies')) return 'WI';
  if (nat.includes('nz') || nat.includes('new zealand')) return 'NZ';
  if (nat.includes('sl') || nat.includes('sri lanka')) return 'SL';
  if (nat.includes('afg') || nat.includes('afghanistan')) return 'AFG';
  if (nat.includes('ban') || nat.includes('bangladesh')) return 'BAN';
  if (nat.includes('nep')) return 'NEP';
  if (nat.includes('usa')) return 'USA';
  if (nat.includes('ire')) return 'IRE';
  if (nat.includes('zim')) return 'ZIM';
  if (nat.includes('nam')) return 'NAM';
  if (nat.includes('scot')) return 'SCO';
  if (nat.includes('ned') || nat.includes('netherlands')) return 'NED';
  if (nat.includes('uae')) return 'UAE';
  if (nat.includes('oma')) return 'OMA';
  return 'INT';
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

const PlayerSilhouette = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/20 rounded-xl overflow-hidden animate-pulse">
    <svg className="h-24 w-24 text-slate-800/40 z-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  </div>
);

const PlayerCardComponent = ({ player, currentBid, currentBidderId, currentBidderName, activeBidOverlay, onImageLoad }: PlayerCardProps) => {
  const playerImage = (player as any).image || player.imageUrl;
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(() => {
    if (playerImage && isImagePreloaded(playerImage)) {
      return true;
    }
    return false;
  });
  const rating = Number((player as any).starRating ?? player.rating ?? 3) as 1 | 2 | 3 | 4 | 5;

  useEffect(() => {
    const preloaded = playerImage ? isImagePreloaded(playerImage) : false;
    setImageLoaded(preloaded);
    setImageFailed(false);
  }, [player.id, playerImage]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    onImageLoad?.();
  };

  const prevTeam = getPlayerPreviousTeam(player);
  const prevTeamId = getTeamIdFromAnyName(prevTeam);
  const bidActive = Boolean(currentBidderId);

  return (
    <div className="h-full w-full select-none transition-all duration-300">
      <div 
        className={cn(
          "relative h-full w-full overflow-hidden rounded-2xl border text-white transition-all duration-300",
          "border-white/10 bg-[#040d21] p-3 md:p-3.5 pb-2 shadow-2xl flex flex-col justify-start"
        )}
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#071838] via-[#040e24] to-[#020714] z-0 pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-[38%_62%] gap-3 md:gap-4 items-center h-full min-h-0 w-full">
          
          {/* ===================================================
              LEFT COLUMN (~38%)
              - Large player image (vertically centered)
             =================================================== */}
          <div className="flex flex-col items-center justify-center h-full min-h-[170px] md:min-h-[220px] py-0">
            {/* Vertically centered image container */}
            <div className="w-full flex items-center justify-center min-h-0 relative">
              {playerImage && !imageFailed ? (
                <div className="relative h-full w-full max-h-[190px] md:max-h-[220px] flex items-center justify-center">
                  <img
                    src={playerImage}
                    alt={player.name}
                    loading="eager"
                    decoding="sync"
                    className={cn(
                      "max-h-full max-w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] transition-all duration-300 z-10",
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
                  <PlayerInitialsAvatar
                    name={player.name}
                    role={player.role}
                    isOverseas={player.isOverseas}
                    size="xl"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ===================================================
              RIGHT COLUMN (~62%)
              Exact Order:
              1. Player Name (largest typography) + Bidding Pop Overlay on right
              2. Role + Rating badges
              3. Previous Team card
              4. Current Bidder card
              5. Bid Information section (Current Bid Visual Hero)
              6. Country (bottom, reduced importance)
             =================================================== */}
          <div className="flex flex-col justify-between space-y-2 h-full py-0 min-w-0 flex-1">
            
            {/* 1. Player Name & Active Bid Pop Overlay on right side */}
            <div className="space-y-0.5 text-left">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <h2 className="text-lg md:text-xl lg:text-2xl font-display uppercase tracking-wider text-white font-black leading-tight drop-shadow-[0_1px_5px_rgba(255,255,255,0.08)] truncate min-w-0 flex-1">
                  {player.name}
                </h2>
                
                {/* Active Bid Pop Overlay on the right side of name */}
                {activeBidOverlay && (
                  <div className="shrink-0 animate-[bidFlash_0.35s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">
                    <div className="bg-[#051126]/95 border border-yellow-400/80 px-2 py-0.5 rounded-lg shadow-[0_0_12px_rgba(250,204,21,0.5)] flex items-center gap-1">
                      <span className="font-display text-xs text-yellow-400 font-black animate-pulse">{activeBidOverlay.teamShortName}</span>
                      <span className="text-[8px] text-slate-300 font-bold uppercase">BID</span>
                      <span className="font-display text-xs text-emerald-400 font-black">{activeBidOverlay.amountStr}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase",
                  getRoleBadgeStyle(player.role)
                )}>
                  {normalizeRoleLabel(player.role)}
                </span>
                <div className="flex items-center rounded-md bg-black/40 border border-white/10 px-2 py-0.5">
                  <StarRating rating={rating} size="sm" />
                </div>
              </div>
            </div>

            {/* 3. Previous Team Card (Compact info card directly below player header) */}
            <div className="bg-[#081733] border border-white/10 rounded-lg p-2 md:p-2.5 flex items-center gap-2.5 shadow-sm min-w-0">
              <div className="h-6 w-6 rounded-md bg-black/50 border border-white/10 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                {prevTeam ? (
                  <TeamLogo 
                    teamId={prevTeamId} 
                    shortName={prevTeam} 
                    size="sm" 
                    className="h-full w-full object-contain bg-transparent border-none"
                  />
                ) : (
                  <Shield className="h-3.5 w-3.5 text-slate-500" />
                )}
              </div>
              <div className="flex flex-col min-w-0 leading-none">
                <span className="text-[7.5px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">
                  Previous Team
                </span>
                <span className="text-xs font-black text-white truncate uppercase tracking-wide">
                  {getFullTeamName(prevTeam)} ({prevTeam})
                </span>
              </div>
            </div>

            {/* 4. Current Bidder Card (Premium info card directly above bid section) */}
            <div className={cn(
              "border rounded-lg p-2 md:p-2.5 flex items-center justify-between shadow-md transition-all duration-300",
              bidActive 
                ? "bg-[#091f42] border-yellow-500/40 shadow-[0_0_12px_rgba(234,179,8,0.15)]" 
                : "bg-[#06142a] border-white/10"
            )}>
              <div className="flex flex-col min-w-0">
                <span className="text-[7.5px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">
                  Current Bidder
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-5 w-5 rounded-full bg-black/50 border border-white/10 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                    <TeamLogo
                      teamId={currentBidderId || null}
                      shortName={currentBidderName || 'BID'}
                      size="sm"
                      className="h-full w-full object-contain bg-transparent border-none"
                    />
                  </div>
                  <span className="font-black text-white text-xs truncate uppercase tracking-wider">
                    {getFullTeamName(currentBidderName)}
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Bid Information Section (Current Bid Visual Hero) */}
            <div className={cn(
              "border rounded-lg p-2.5 md:p-3 flex flex-col justify-center shadow-lg transition-all duration-300",
              bidActive 
                ? "bg-gradient-to-r from-[#0c224a] to-[#081836] border-yellow-500/50" 
                : "bg-[#071731] border-white/10"
            )}>
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-[8.5px] uppercase tracking-widest text-yellow-400 font-extrabold mb-0.5">
                    Current Bid
                  </span>
                  <AnimatedBidValue value={currentBid} className="font-black text-yellow-300 text-xl md:text-2xl lg:text-3xl leading-none tracking-wide" />
                </div>

                <div className="text-right">
                  <span className="text-[7.5px] uppercase tracking-widest text-slate-400 font-bold block mb-0.5">
                    Base Price
                  </span>
                  <span className="font-extrabold text-slate-300 text-xs">
                    {formatPrice(player.basePrice)}
                  </span>
                </div>
              </div>
            </div>

            {/* 6. Country (Left-aligned with tab space gap) */}
            <div className="flex items-center justify-start gap-4 text-xs text-slate-400 font-medium px-0.5 pt-0.5">
              <span className="text-[8.5px] uppercase tracking-wider text-slate-500 font-bold">Nationality</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-cyan-400 text-[11px]">{getCountryCode(player.nationality)}</span>
                <span className="text-slate-300 text-[11px] font-semibold">({player.nationality})</span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export const PlayerCard = memo(PlayerCardComponent);
