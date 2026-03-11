interface HeaderProps {
  gameCode: string;
  timerSeconds: number;
  currentPool?: string;
  playersRemaining: number;
  totalPlayers: number;
}

export const Header = ({ gameCode, timerSeconds, currentPool, playersRemaining, totalPlayers }: HeaderProps) => {
  return (
    <header className="border-b border-yellow-500/40 bg-[#061734] px-5 py-3 text-yellow-100">
      <div className="flex items-center justify-between gap-4 text-sm font-semibold">
        <p className="font-display text-xl tracking-wider"><span className="text-yellow-300">CricAuction</span><span className="text-white">IPL</span></p>

        <div className="flex items-center gap-3">
          <span>{gameCode}</span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-yellow-300 text-[11px] text-yellow-200">
              {timerSeconds.toString().padStart(2, '0')}
            </span>
            <span>{timerSeconds.toString().padStart(2, '0')}s</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span>{String(currentPool || 'POOL').toUpperCase()}</span>
          <span>{playersRemaining}/{totalPlayers}</span>
          <span className="flex items-center gap-1 text-red-400"><span className="text-base">●</span> LIVE</span>
        </div>
      </div>
    </header>
  );
};
