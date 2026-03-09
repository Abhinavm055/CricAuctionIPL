import { Player } from '@/lib/samplePlayers';
import { formatPrice } from '@/lib/constants';
import { User, MapPin } from 'lucide-react';
import { TeamLogo } from './TeamLogo';

interface PlayerCardProps {
  player: Player;
  currentBid: number;
  currentBidder: string | null;
  currentBidderId?: string | null;
  teamColor?: string;
}

const countryFlag = (nationality: string) => {
  const map: Record<string, string> = {
    india: '🇮🇳',
    australia: '🇦🇺',
    england: '🇬🇧',
    southafrica: '🇿🇦',
    newzealand: '🇳🇿',
    afghanistan: '🇦🇫',
    westindies: '🏴‍☠️',
    'sri lanka': '🇱🇰',
    srilanka: '🇱🇰',
    bangladesh: '🇧🇩',
    pakistan: '🇵🇰',
    netherlands: '🇳🇱',
    ireland: '🇮🇪',
    zimbabwe: '🇿🇼',
  };

  return map[String(nationality || '').toLowerCase()] || '🏳️';
};

export const PlayerCard = ({ player, currentBid, currentBidder, currentBidderId, teamColor }: PlayerCardProps) => {
  const roleColors: Record<string, string> = {
    Batsman: 'from-blue-500 to-blue-600',
    Bowler: 'from-green-500 to-green-600',
    'All-Rounder': 'from-purple-500 to-purple-600',
    'Wicket-Keeper': 'from-amber-500 to-amber-600',
  };

  const playerImage = (player as any).image || player.imageUrl;
  const playerRating = Number((player as any).rating ?? player.starRating ?? 0);
  const isOverseas = Boolean((player as any).overseas ?? player.isOverseas);
  const previousTeamId = String((player as any).previousTeamId || '').toLowerCase() || null;

  return (
    <div className="relative card-gradient rounded-2xl border border-border/50 overflow-hidden scale-in">
      <div className="absolute inset-0 broadcast-overlay pointer-events-none opacity-30" />

      <div className="absolute top-4 left-4 z-10">
        <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-primary/20 text-primary rounded-full border border-primary/30">
          {player.pool}
        </span>
      </div>

      {isOverseas && (
        <div className="absolute top-4 right-4 z-10">
          <span className="text-lg text-yellow-400 drop-shadow-md" title="Overseas">✈️</span>
        </div>
      )}

      {playerRating >= 4 && (
        <div className="absolute top-14 right-4 z-10">
          <span className="px-2 py-0.5 text-xs font-bold bg-yellow-500/90 text-black rounded-full">⭐ Star</span>
        </div>
      )}

      <div className="p-8 flex flex-col items-center">
        <div className="relative mb-6">
          <div className="w-48 h-48 rounded-xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center border-4 border-primary/30 shadow-lg overflow-hidden">
            {playerImage ? (
              <img
                src={playerImage}
                alt={player.name}
                className="w-full h-full object-cover"
                onError={(event) => { event.currentTarget.src = 'https://ui-avatars.com/api/?name=IPL+Player&background=0f172a&color=ffffff&size=256'; }}
              />
            ) : (
              <User className="w-16 h-16 text-muted-foreground" />
            )}
          </div>
          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r ${roleColors[player.role]} text-white text-xs font-bold shadow-lg`}>
            {player.role}
          </div>
        </div>

        <h2 className="font-display text-4xl text-foreground mb-2 text-center tracking-wide">{player.name}</h2>

        <div className="flex items-center gap-4 text-muted-foreground text-sm mb-6">
          <span className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {countryFlag((player as any).nationality || player.nationality)} {(player as any).nationality || player.nationality}
          </span>
          {previousTeamId && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-secondary rounded text-xs">
              <TeamLogo teamId={previousTeamId} shortName={(player as any).previousTeam || 'Prev'} size="sm" />
            </span>
          )}
        </div>

        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Base Price</p>
          <p className="text-2xl font-bold text-foreground">{formatPrice(player.basePrice)}</p>
        </div>

        <div className="w-full p-4 rounded-xl bg-secondary/50 border border-border">
          <div className="text-center">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Current Bid</p>
            <p className="font-display text-5xl text-primary text-shadow-glow mb-2">{formatPrice(currentBid)}</p>
            {currentBidder && (
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full pulse-bid"
                style={{ backgroundColor: teamColor ? `hsl(var(--${teamColor}))` : 'hsl(var(--secondary))' }}
              >
                <TeamLogo teamId={currentBidderId || null} shortName={currentBidder} size="sm" className="border-0 bg-transparent" />
                <span className="text-sm font-bold text-white drop-shadow-md">{currentBidder}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
