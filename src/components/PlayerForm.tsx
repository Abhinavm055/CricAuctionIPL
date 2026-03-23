import { FormEvent, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AUCTION_POOLS, PLAYER_IMAGE_PLACEHOLDER, PLAYER_ROLES } from '@/lib/constants';

export interface EditablePlayer {
  id?: string;
  name: string;
  role: string;
  rating: number;
  basePrice: number;
  overseas: boolean;
  pool: string;
  previousTeamId: string;
  nationality: string;
  image: string;
  isCapped: boolean;
}

interface TeamOption {
  id: string;
  name: string;
}

interface PlayerFormProps {
  initial: EditablePlayer;
  teams: TeamOption[];
  onSave: (player: EditablePlayer) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export const PlayerForm = ({ initial, teams, onSave, onCancel, submitLabel = 'Save Player' }: PlayerFormProps) => {
  const [form, setForm] = useState<EditablePlayer>({
    id: initial.id,
    name: initial.name || '',
    role: initial.role || 'Batsman',
    rating: Number(initial.rating ?? 3),
    basePrice: Number(initial.basePrice ?? 0),
    overseas: Boolean(initial.overseas),
    pool: initial.pool || 'Batters',
    previousTeamId: initial.previousTeamId || '',
    nationality: initial.nationality || '',
    image: initial.image || '',
    isCapped: Boolean(initial.isCapped),
  });
  const [saving, setSaving] = useState(false);

  const imagePreview = useMemo(() => form.image.trim(), [form.image]);
  const previousTeamValue = form.previousTeamId?.trim() || 'none';

  const update = <K extends keyof EditablePlayer>(key: K, value: EditablePlayer[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Player name" />
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(value) => update('role', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {PLAYER_ROLES.map((role) => (
                <SelectItem key={role} value={role}>{role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Rating (1-5)</Label>
          <Input
            type="number"
            min={1}
            max={5}
            step={0.1}
            required
            value={form.rating}
            onChange={(e) => update('rating', Number(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label>Base Price</Label>
          <Input
            type="number"
            min={0}
            required
            value={form.basePrice}
            onChange={(e) => update('basePrice', Number(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label>Pool</Label>
          <Select value={form.pool} onValueChange={(value) => update('pool', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select pool" />
            </SelectTrigger>
            <SelectContent>
              {AUCTION_POOLS.map((pool) => (
                <SelectItem key={pool} value={pool}>{pool}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Previous Team</Label>
          <Select value={previousTeamValue} onValueChange={(value) => update('previousTeamId', value === 'none' ? '' : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No team</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Nationality</Label>
          <Input value={form.nationality} onChange={(e) => update('nationality', e.target.value)} placeholder="India / Australia / ..." />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Image URL</Label>
        <Input value={form.image} onChange={(e) => update('image', e.target.value)} placeholder="https://..." />
      </div>

      {imagePreview && (
        <div className="space-y-2">
          <Label>Image Preview</Label>
          <img
            src={imagePreview}
            alt={`${form.name || 'player'} preview`}
            className="w-20 h-20 object-cover rounded"
            onError={(event) => { event.currentTarget.src = PLAYER_IMAGE_PLACEHOLDER; }}
          />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={!!form.overseas} onCheckedChange={(value) => update('overseas', value)} id="overseas-switch" />
          <Label htmlFor="overseas-switch">Overseas Player</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={!!form.isCapped} onCheckedChange={(value) => update('isCapped', value)} id="capped-switch" />
          <Label htmlFor="capped-switch">Capped Player</Label>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{submitLabel}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
};
