import { FormEvent, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/constants";
import { Player } from "@/lib/samplePlayers";

interface BidInputModalProps {
  open: boolean;
  player: Player | null;
  previousBid: number;
  minBid: number;
  countdownSeconds: number;
  disabled?: boolean;
  onSubmit: (amount: number) => void;
  onCancel: () => void;
  cancelLabel?: string;
}

export const BidInputModal = ({
  open,
  player,
  previousBid,
  minBid,
  countdownSeconds,
  disabled = false,
  onSubmit,
  onCancel,
  cancelLabel = "Cancel",
}: BidInputModalProps) => {
  const [value, setValue] = useState<string>(String(minBid || ""));
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (open) {
      setValue(String(minBid || ""));
      setError("");
    }
  }, [open, minBid]);

  const parsedValue = useMemo(() => Number(value), [value]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isFinite(parsedValue) || parsedValue <= previousBid) {
      setError(`Bid must be greater than ${formatPrice(previousBid)}.`);
      return;
    }

    onSubmit(parsedValue);
  };

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="max-w-md border border-amber-400/25 bg-slate-950/95 text-white shadow-[0_25px_80px_rgba(15,23,42,0.65)] backdrop-blur-xl">
        <DialogHeader className="text-left">
          <div className="inline-flex w-fit items-center rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-300">
            Final Bid
          </div>
          <DialogTitle className="text-2xl font-bold text-white">Enter your final price to retain player</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-300">
            Submit a bid higher than {formatPrice(previousBid)} for {player?.name || "this player"}. Timer expires in {countdownSeconds}s.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Final amount</span>
            <Input
              type="number"
              min={minBid}
              step={1}
              value={value}
              disabled={disabled}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError("");
              }}
              className="h-12 border-white/15 bg-white/5 text-lg text-white placeholder:text-slate-500"
              placeholder="Enter amount in ₹"
            />
          </label>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
            <p>Current winning bid: <span className="font-semibold text-white">{formatPrice(previousBid)}</span></p>
            <p>Minimum allowed: <span className="font-semibold text-amber-300">{formatPrice(minBid)}</span></p>
          </div>

          {error && <p className="text-sm font-medium text-rose-400">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" disabled={disabled} className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={disabled} className="bg-amber-400 text-slate-950 hover:bg-amber-300">
              Confirm
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
