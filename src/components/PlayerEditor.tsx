import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface EditablePlayer {
  id?: string;
  name: string;
  role: string;
  rating: number;
  basePrice: number;
  overseas: boolean;
  pool: string;
  previousTeamId: string;
  image: string;
}

interface PlayerEditorProps {
  initial: EditablePlayer;
  onSave: (player: EditablePlayer) => Promise<void>;
  onCancel: () => void;
}

export const PlayerEditor = ({ initial, onSave, onCancel }: PlayerEditorProps) => {
  const [form, setForm] = useState<EditablePlayer>(initial);

  const update = (key: keyof EditablePlayer, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-card">
      <div className="grid grid-cols-2 gap-3">
        <Input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Name" />
        <Input value={form.role} onChange={(e) => update('role', e.target.value)} placeholder="Role" />
        <Input type="number" value={form.rating} onChange={(e) => update('rating', Number(e.target.value))} placeholder="Rating" />
        <Input type="number" value={form.basePrice} onChange={(e) => update('basePrice', Number(e.target.value))} placeholder="Base Price" />
        <Input value={form.pool} onChange={(e) => update('pool', e.target.value)} placeholder="Pool" />
        <Input value={form.previousTeamId} onChange={(e) => update('previousTeamId', e.target.value)} placeholder="Previous Team ID" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!form.overseas} onChange={(e) => update('overseas', e.target.checked)} /> Overseas
      </label>

      <Input value={form.image} onChange={(e) => update('image', e.target.value)} placeholder="Image URL" />
      {form.image && <img src={form.image} alt="preview" className="w-24 h-24 object-cover rounded-md border" />}

      <div className="flex gap-2">
        <Button onClick={() => onSave(form)}>Save</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};
