import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TeamLogo } from "@/components/TeamLogo";
import { formatPrice } from "@/lib/constants";
import { Player } from "@/lib/samplePlayers";

interface SoldModalProps {
  open: boolean;
  player: Player | null;
  teamId?: string | null;
  teamName?: string;
  teamShortName?: string;
  teamLogo?: string;
  price: number;
}

export const SoldModal = ({ open, player, teamId, teamName, teamShortName, teamLogo, price }: SoldModalProps) => {
  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="max-w-lg border border-emerald-400/25 bg-slate-950/75 p-0 text-white shadow-[0_30px_120px_rgba(15,23,42,0.72)] backdrop-blur-2xl data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900/88 to-emerald-950/75 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <img
              src={player?.image || "https://ui-avatars.com/api/?name=IPL+Player&background=0f172a&color=ffffff&size=256"}
              alt={player?.name || "Player"}
              className="h-28 w-28 rounded-2xl object-cover ring-1 ring-white/10"
            />

            <div className="flex-1 space-y-3">
              <div className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300">
                Sold
              </div>
              <div>
                <p className="text-2xl font-bold text-white sm:text-3xl">{player?.name || "Player"}</p>
                <p className="mt-1 text-base text-emerald-300 sm:text-lg">{formatPrice(price)}</p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <TeamLogo teamId={teamId || ""} logo={teamLogo} shortName={teamShortName || teamName || "TEAM"} size="md" />
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sold to</p>
                  <p className="text-lg font-semibold text-white">{teamName || teamShortName || "Team"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
