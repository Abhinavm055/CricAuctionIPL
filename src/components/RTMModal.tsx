import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/constants";
import { Player } from "@/lib/samplePlayers";

interface RTMModalProps {
  open: boolean;
  player: Player | null;
  title: string;
  description: string;
  amount?: number;
  countdownSeconds: number;
  disabled?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}

export const RTMModal = ({
  open,
  player,
  title,
  description,
  amount,
  countdownSeconds,
  disabled = false,
  onPrimary,
  onSecondary,
}: RTMModalProps) => {
  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="max-w-md border border-emerald-400/25 bg-slate-950/95 text-white shadow-[0_25px_80px_rgba(15,23,42,0.65)] backdrop-blur-xl">
        <DialogHeader className="space-y-3 text-left">
          <div className="inline-flex w-fit items-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-300">
            Right To Match
          </div>
          <DialogTitle className="text-2xl font-bold text-white">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-300">{description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-4">
            <img
              src={player?.image || "https://ui-avatars.com/api/?name=IPL+Player&background=0f172a&color=ffffff&size=256"}
              alt={player?.name || "Player"}
              className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/10"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-white">{player?.name || "Player"}</p>
              {typeof amount === "number" && <p className="text-sm text-emerald-300">Amount: {formatPrice(amount)}</p>}
              <p className="mt-1 text-xs uppercase tracking-[0.28em] text-slate-400">Auto declines in {countdownSeconds}s</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" disabled={disabled} className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={onSecondary}>
            No
          </Button>
          <Button type="button" disabled={disabled} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400" onClick={onPrimary}>
            Yes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
