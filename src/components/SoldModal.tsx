import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { TeamLogo } from '@/components/TeamLogo';
import { formatPrice, IPL_TEAM_COLORS } from '@/lib/constants';
import { Player } from '@/lib/samplePlayers';
import { cn } from '@/lib/utils';
import { PlayerInitialsAvatar } from './PlayerInitialsAvatar';

interface SoldModalProps {
  open: boolean;
  player: Player | null;
  teamId?: string | null;
  teamName?: string;
  teamShortName?: string;
  teamLogo?: string;
  price: number;
}

export const SoldModal = ({
  open,
  player,
  teamId,
  teamName,
  teamShortName,
  teamLogo,
  price,
}: SoldModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (open) {
      setImageLoaded(false);
      setImageFailed(false);
    }
  }, [open, player?.id]);

  // Set up custom team colors
  const teamColor = teamId ? IPL_TEAM_COLORS[teamId] : null;
  const primaryColor = teamColor?.primary || '#FFD700'; // Fallback to Gold
  const secondaryColor = teamColor?.secondary || '#0B1C3D';

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth || 500);
    let height = (canvas.height = canvas.offsetHeight || 420);

    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth || 500;
      height = canvas.height = canvas.offsetHeight || 420;
    };
    window.addEventListener('resize', handleResize);

    // Multi-colored confetti particle generator
    const colors = [primaryColor, '#FFD700', '#00CFFF', '#FF4D4D', '#10B981', '#A855F7', '#F43F5E'];
    const particles = Array.from({ length: 130 }, () => ({
      x: Math.random() * width,
      y: Math.random() * -height - 20,
      r: Math.random() * 5 + 3,
      d: Math.random() * height,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.08 + 0.03,
      tiltAngle: 0,
      shape: Math.random() > 0.45 ? 'circle' : 'square',
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2.2;
        p.x += Math.sin(p.tiltAngle) * 1.5;
        p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 8;

        ctx.beginPath();
        if (p.shape === 'circle') {
          ctx.arc(p.x + p.tilt, p.y, p.r / 1.5, 0, 2 * Math.PI);
          ctx.fillStyle = p.color;
          ctx.fill();
        } else {
          ctx.lineWidth = p.r;
          ctx.strokeStyle = p.color;
          ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
          ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
          ctx.stroke();
        }

        // Recycle particle to the top once it hits bottom
        if (p.y > height) {
          p.x = Math.random() * width;
          p.y = -20;
          p.tilt = Math.random() * 10 - 5;
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, primaryColor]);

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="max-w-lg border-none bg-transparent p-0 text-white shadow-none backdrop-blur-sm overflow-visible"
      >
        <div
          className="relative overflow-hidden rounded-3xl p-6 text-center transition-all duration-500 animate-[resultPop_0.4s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards] select-none"
          style={{
            background: `linear-gradient(135deg, #020617 0%, #051226 50%, ${secondaryColor}a0 100%)`,
            border: `2px solid ${primaryColor}aa`,
            boxShadow: `0 0 50px ${primaryColor}50, inset 0 0 25px ${primaryColor}20`,
          }}
        >
          {/* Confetti Particle Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none w-full h-full z-10"
          />

          {/* Sweep scanning broadcast line */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[rgba(255,255,255,0.03)] to-transparent pointer-events-none z-10 animate-[scanline_4s_linear_infinite]" />

          <div className="relative z-20 space-y-5">
            <div className="flex flex-col items-center">
              <div
                className="inline-flex items-center gap-1.5 rounded-full border px-4.5 py-1 text-[10px] font-black uppercase tracking-[0.35em] mb-3 animate-[bounce_2s_infinite]"
                style={{
                  borderColor: `${primaryColor}aa`,
                  backgroundColor: `${primaryColor}15`,
                  color: primaryColor,
                  textShadow: `0 0 8px ${primaryColor}60`,
                }}
              >
                SOLD
              </div>
              <h2
                className="text-4xl md:text-5xl font-display uppercase tracking-widest leading-none"
                style={{ textShadow: `0 0 20px ${primaryColor}cc` }}
              >
                SOLD TO {teamShortName || teamName || 'TEAM'}
              </h2>
            </div>

            {/* Player Showcase Image */}
            <div
              className="relative mx-auto h-40 w-40 overflow-hidden rounded-2xl border-2 bg-slate-950/70 p-1.5 shadow-2xl"
              style={{ borderColor: `${primaryColor}80`, boxShadow: `0 8px 30px ${primaryColor}25` }}
            >
              {player?.image || player?.imageUrl ? (
                !imageFailed ? (
                  <>
                    <img
                      src={player.image || player.imageUrl}
                      alt={player.name}
                      className={cn(
                        "h-full w-full object-contain object-center rounded-xl transition-opacity duration-300",
                        imageLoaded ? "opacity-100" : "opacity-0"
                      )}
                      onLoad={() => setImageLoaded(true)}
                      onError={() => setImageFailed(true)}
                    />
                    {!imageLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 rounded-xl">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400" />
                      </div>
                    )}
                  </>
                ) : (
                  <PlayerInitialsAvatar
                    name={player.name}
                    role={player.role}
                    isOverseas={player.isOverseas}
                    size="xl"
                  />
                )
              ) : player ? (
                <PlayerInitialsAvatar
                  name={player.name}
                  role={player.role}
                  isOverseas={player.isOverseas}
                  size="xl"
                />
              ) : (
                <div className="h-full w-full bg-slate-900 rounded-xl" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 to-transparent pt-4 pb-1.5 flex flex-col items-center">
                <span className="text-[10px] uppercase font-black text-yellow-400 tracking-wider">
                  {player?.role || 'Player'}
                </span>
              </div>
            </div>

            {/* Price Details Card */}
            <div className="space-y-0.5 bg-slate-950/75 rounded-2xl py-3.5 px-6 border border-white/5 inline-block mx-auto min-w-[250px] shadow-lg">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Sold Price</p>
              <p className="text-3xl font-display font-black tracking-wide" style={{ color: primaryColor, textShadow: `0 0 10px ${primaryColor}50` }}>
                {formatPrice(price)}
              </p>
            </div>

            {/* Winning Team details with Logo */}
            <div className="flex items-center justify-center gap-4 border-t border-white/10 pt-4 mt-2">
              <div className="rounded-full bg-slate-950/60 p-1.5 border border-white/10 shadow-inner">
                <TeamLogo
                  teamId={teamId || ''}
                  logo={teamLogo}
                  shortName={teamShortName || teamName || 'TEAM'}
                  size="md"
                  className="h-10 w-10 rounded-full"
                />
              </div>
              <div className="text-left">
                <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Franchise Owner</p>
                <p className="text-lg font-display tracking-wider text-white font-semibold">{teamName || teamShortName || 'Team'}</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
