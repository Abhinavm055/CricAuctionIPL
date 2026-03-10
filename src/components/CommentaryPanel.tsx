interface CommentaryPanelProps {
  commentary: string[];
}

export const CommentaryPanel = ({ commentary }: CommentaryPanelProps) => {
  return (
    <div className="h-full rounded-xl border border-yellow-500/40 bg-[#071a3a] p-3">
      <p className="text-xs uppercase tracking-widest text-yellow-300 mb-2">Live Commentary</p>
      <div className="h-[120px] overflow-y-auto space-y-1 text-xs text-slate-200 pr-1">
        {commentary.length ? commentary.map((line, idx) => <p key={`${line}-${idx}`}>{line}</p>) : <p>No bids yet…</p>}
      </div>
    </div>
  );
};
