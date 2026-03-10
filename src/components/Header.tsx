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
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <p className="font-display text-xl tracking-wider text-yellow-300">CRICAUCTION</p>

        <div className="flex items-center gap-4 text-sm font-semibold">
          <span>{gameCode}</span>
          <span>⏱ {timerSeconds.toString().padStart(2, '0')}s</span>
        </div>

        <div className="flex items-center justify-end gap-4 text-sm font-semibold">
          <span>{String(currentPool || 'POOL').toUpperCase()}</span>
          <span>{playersRemaining}/{totalPlayers}</span>
          <span className="flex items-center gap-1 text-red-400"><span className="text-base">●</span> LIVE</span>
        </div>
      </div>
    </header>
  );
};
