import { ImageOff } from 'lucide-react';
import { TEAM_LOGOS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface TeamLogoProps {
  teamId?: string | null;
  logo?: string;
  shortName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClass = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
};

export const TeamLogo = ({ teamId, logo, shortName = 'Team', size = 'md', className }: TeamLogoProps) => {
  const key = String(teamId || '').toLowerCase() as keyof typeof TEAM_LOGOS;
  const resolvedLogo = logo || TEAM_LOGOS[key];

  return (
    <div className={cn('rounded-md bg-secondary/60 border border-white/10 overflow-hidden flex items-center justify-center', sizeClass[size], className)}>
      {resolvedLogo ? (
        <img src={resolvedLogo} alt={`${shortName} logo`} className="w-[90%] h-[90%] object-contain" />
      ) : (
        <ImageOff className="w-4 h-4 text-muted-foreground" />
      )}
    </div>
  );
};
