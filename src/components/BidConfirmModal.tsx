import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/constants";

interface BidConfirmModalProps {
  open: boolean;
  amount: number;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const BidConfirmModal = ({ open, amount, disabled = false, onConfirm, onCancel }: BidConfirmModalProps) => {
  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="max-w-sm border border-yellow-400/25 bg-slate-950/95 text-white backdrop-blur-xl">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-bold">Raise bid to {formatPrice(amount)}?</DialogTitle>
          <DialogDescription className="text-slate-300">
            Confirm to place your bid. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" disabled={disabled} className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={disabled} className="bg-yellow-400 text-slate-950 hover:bg-yellow-300" onClick={onConfirm}>
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
