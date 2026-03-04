import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export interface EditablePlayer {
  id?: string;
  name: string;
  role: string;
  rating: number;
  basePrice: number;
  overseas: boolean;
  image: string;
  previousTeamId: string;
  pool: string;
}

interface TeamOption {
  id: string;
  name: string;
  shortName?: string;
}

interface PlayerFormProps {
  initial: EditablePlayer;
  teams: TeamOption[];
  onSave: (player: EditablePlayer) => Promise<void>;
  onCancel: () => void;
}

const ROLE_OPTIONS = ["Batsman", "Bowler", "All-Rounder", "Wicket-Keeper"];
const POOL_OPTIONS = ["Marquee", "Batters", "All-Rounders", "Wicketkeepers", "Bowlers", "Uncapped", "Accelerated"];

export const PlayerForm = ({ initial, teams, onSave, onCancel }: PlayerFormProps) => {
  const [form, setForm] = useState<EditablePlayer>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const imagePreview = useMemo(() => form.image?.trim() || "", [form.image]);

  const update = <K extends keyof EditablePlayer>(key: K, value: EditablePlayer[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ ...form, rating: Number(form.rating), basePrice: Number(form.basePrice) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 border rounded-xl p-4 bg-card">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Player name" />
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(value) => update("role", value)}>
            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Rating (0-5)</Label>
          <Input type="number" min={0} max={5} step={0.1} value={form.rating} onChange={(e) => update("rating", Number(e.target.value))} />
        </div>

        <div className="space-y-2">
          <Label>Base Price</Label>
          <Input type="number" min={0} value={form.basePrice} onChange={(e) => update("basePrice", Number(e.target.value))} />
        </div>

        <div className="space-y-2">
          <Label>Pool</Label>
          <Select value={form.pool} onValueChange={(value) => update("pool", value)}>
            <SelectTrigger><SelectValue placeholder="Select pool" /></SelectTrigger>
            <SelectContent>
              {POOL_OPTIONS.map((pool) => <SelectItem key={pool} value={pool}>{pool}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Previous Team</Label>
          <Select value={form.previousTeamId || "none"} onValueChange={(value) => update("previousTeamId", value === "none" ? "" : value)}>
            <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.shortName || team.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Image URL</Label>
        <Input value={form.image} onChange={(e) => update("image", e.target.value)} placeholder="https://..." />
        {imagePreview ? (
          <img src={imagePreview} alt={`${form.name || "Player"} preview`} className="w-24 h-24 rounded-md object-cover border" onError={(e) => ((e.currentTarget.style.opacity = "0.35"))} />
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={!!form.overseas} onCheckedChange={(value) => update("overseas", !!value)} />
        <Label>Overseas Player</Label>
      </div>

      <div className="flex gap-2">
        <Button onClick={submit} disabled={saving || !form.name.trim()}>{saving ? "Saving..." : "Save"}</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};
