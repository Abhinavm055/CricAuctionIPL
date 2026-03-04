import { cn } from '@/lib/utils';

interface TeamLogoProps {
  logo?: string;
  shortName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClass = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
};

export const TeamLogo = ({ logo, shortName, size = 'md', className }: TeamLogoProps) => {
  return (
    <div className={cn('rounded-md bg-secondary/60 border border-white/10 overflow-hidden flex items-center justify-center', sizeClass[size], className)}>
      {logo ? (
        <img src={logo} alt={`${shortName} logo`} className="w-[90%] h-[90%] object-contain" />
      ) : (
        <span className="font-bold text-xs">{shortName}</span>
      )}
    </div>
  );
};
