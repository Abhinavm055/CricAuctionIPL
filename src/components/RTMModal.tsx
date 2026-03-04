import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/constants";
import { Player } from "@/lib/samplePlayers";

interface RTMModalProps {
  open: boolean;
  player: Player | null;
  originalTeamName?: string;
  winningTeamName?: string;
  finalBid: number;
  onYes: () => void;
  onNo: () => void;
}

export const RTMModal = ({ open, player, originalTeamName, winningTeamName, finalBid, onYes, onNo }: RTMModalProps) => {
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Use RTM for this player?</DialogTitle>
          <DialogDescription>
            {originalTeamName} can match {winningTeamName}'s winning bid for {player?.name} at {formatPrice(finalBid)}.
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">RTM will transfer the player to {originalTeamName} and consume 1 RTM card.</div>
        <DialogFooter>
          <Button variant="outline" onClick={onNo}>No</Button>
          <Button onClick={onYes}>Yes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
