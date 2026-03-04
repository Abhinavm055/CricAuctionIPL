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
  stage: "AWAIT_ORIGINAL" | "AWAIT_WINNER_COUNTER" | "AWAIT_ORIGINAL_MATCH";
  onPrimary: () => void;
  onSecondary: () => void;
}

export const RTMModal = ({
  open,
  player,
  originalTeamName,
  winningTeamName,
  finalBid,
  stage,
  onPrimary,
  onSecondary,
}: RTMModalProps) => {
  const contentByStage = {
    AWAIT_ORIGINAL: {
      title: "Use RTM for this player?",
      description: `${originalTeamName} can match ${winningTeamName}'s winning bid for ${player?.name} at ${formatPrice(finalBid)}.`,
      primary: "YES (Use RTM)",
      secondary: "NO",
    },
    AWAIT_WINNER_COUNTER: {
      title: "Counter RTM Bid",
      description: `${winningTeamName}, do you want to increase the bid above ${formatPrice(finalBid)}?`,
      primary: "YES (Counter Bid)",
      secondary: "NO (Let RTM stand)",
    },
    AWAIT_ORIGINAL_MATCH: {
      title: "Match Counter Bid?",
      description: `${originalTeamName}, match updated bid for ${player?.name} at ${formatPrice(finalBid)}?`,
      primary: "YES (Match)",
      secondary: "NO",
    },
  } as const;

  const copy = contentByStage[stage];

  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onSecondary}>{copy.secondary}</Button>
          <Button onClick={onPrimary}>{copy.primary}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
