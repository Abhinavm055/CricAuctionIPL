import { Gavel } from "lucide-react";

interface HammerSoldEffectProps {
  open: boolean;
  text: string;
}

export const HammerSoldEffect = ({ open, text }: HammerSoldEffectProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-yellow-500/20">
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-full bg-amber-400 text-black p-4 shadow-2xl animate-bounce">
          <Gavel className="h-12 w-12" />
        </div>
        <div className="px-8 py-6 rounded-2xl text-3xl font-display shadow-2xl bg-yellow-500 text-black animate-pulse">
          SOLD
          <p className="text-lg font-semibold mt-1">{text}</p>
        </div>
      </div>
    </div>
  );
};
