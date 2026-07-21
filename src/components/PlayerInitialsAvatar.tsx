import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PlayerInitialsAvatarProps {
  name: string;
  role: string;
  isOverseas?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  image?: string;
}

const roleGradients: Record<string, string> = {
  'batsman': 'from-amber-500 via-orange-600 to-red-800',
  'bowler': 'from-violet-500 via-purple-600 to-indigo-900',
  'all-rounder': 'from-emerald-400 via-teal-500 to-cyan-800',
  'wicket-keeper': 'from-sky-400 via-blue-500 to-blue-800',
  'default': 'from-slate-500 via-slate-600 to-slate-800'
};

const roleBorderGlows: Record<string, string> = {
  'batsman': 'border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]',
  'bowler': 'border-violet-400/40 shadow-[0_0_15px_rgba(139,92,246,0.25)]',
  'all-rounder': 'border-emerald-400/40 shadow-[0_0_15px_rgba(16,185,129,0.25)]',
  'wicket-keeper': 'border-sky-400/40 shadow-[0_0_15px_rgba(56,189,248,0.25)]',
  'default': 'border-slate-400/40 shadow-[0_0_15px_rgba(148,163,184,0.25)]'
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return parts.map(p => p[0]).join('').toUpperCase().slice(0, 3);
};

export const PlayerInitialsAvatar = ({ name, role, isOverseas, className, size = 'lg', image }: PlayerInitialsAvatarProps) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [image]);

  const normalizedRole = role.toLowerCase().replace(/[^a-z]/g, '');
  const gradient = roleGradients[normalizedRole] || roleGradients.default;
  const glow = roleBorderGlows[normalizedRole] || roleBorderGlows.default;
  const initials = getInitials(name);

  const sizeClasses = {
    sm: 'w-10 h-10 text-xs border',
    md: 'w-16 h-16 text-lg border-[2px]',
    lg: 'w-24 h-24 text-2xl border-[2px] md:w-28 md:h-28 md:text-3xl',
    xl: 'w-32 h-32 text-3xl border-[3px] md:w-36 md:h-36 md:text-4xl'
  };

  return (
    <div className={cn("relative flex items-center justify-center select-none overflow-visible", className)}>
      {image && !imageFailed ? (
        <div className={cn(
          "rounded-full flex items-center justify-center bg-slate-900 border-white/20 transition-transform duration-300 hover:scale-105 overflow-hidden",
          glow,
          sizeClasses[size]
        )}>
          <img
            src={image}
            alt={name}
            className="w-full h-full object-contain"
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : (
        /* Premium Circular Avatar Container */
        <div className={cn(
          "rounded-full flex items-center justify-center bg-gradient-to-br font-black tracking-tight text-white font-display border-white/20 transition-transform duration-300 hover:scale-105",
          gradient,
          glow,
          sizeClasses[size]
        )}
        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
          {initials}
        </div>
      )}

      {/* Role Tag overlay at the bottom */}
      <div className={cn(
        "absolute -bottom-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-white border border-white/10 shadow-sm z-20",
        normalizedRole === 'batsman' && 'bg-amber-600',
        normalizedRole === 'bowler' && 'bg-violet-600',
        normalizedRole === 'allrounder' && 'bg-emerald-600',
        normalizedRole === 'wicketkeeper' && 'bg-sky-600',
        normalizedRole !== 'batsman' && normalizedRole !== 'bowler' && normalizedRole !== 'allrounder' && normalizedRole !== 'wicketkeeper' && 'bg-slate-600'
      )}>
        {role.slice(0, 3)}
      </div>

      {/* Overseas indicator */}
      {isOverseas && (
        <div className="absolute top-0 right-0 bg-yellow-500 border border-yellow-400 text-slate-950 rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black shadow-md" title="Overseas Player">
          ✈
        </div>
      )}
    </div>
  );
};
