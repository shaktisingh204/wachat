import { Card, Input, Label, Textarea } from '@/components/zoruui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { BioState } from '../types';

type Props = {
  state: BioState;
  update: (patch: Partial<BioState>) => void;
};

export function BioProfileForm({ state, update }: Props) {
  const handleAvatarPick = (pick: SabFilePick) => {
    update({ avatarUrl: pick.url });
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[12.5px] text-zoru-ink-muted">Page URL</Label>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-zoru-ink-muted whitespace-nowrap">/bio/</span>
          <Input
            placeholder="your-name"
            value={state.slug}
            onChange={(e) =>
              update({ slug: e.target.value.replace(/[^a-z0-9-_]/gi, '').toLowerCase() })
            }
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[12.5px] text-zoru-ink-muted">Title</Label>
        <Input
          placeholder="Your name or brand"
          value={state.title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[12.5px] text-zoru-ink-muted">
          Bio <span className="text-zoru-ink-muted/60">({state.bio.length}/160)</span>
        </Label>
        <Textarea
          placeholder="A short description about you..."
          value={state.bio}
          maxLength={160}
          rows={3}
          onChange={(e) => update({ bio: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[12.5px] text-zoru-ink-muted">Avatar</Label>
        <div className="flex items-center gap-3">
          {state.avatarUrl ? (
            <img
              src={state.avatarUrl}
              alt="Avatar"
              className="h-10 w-10 rounded-full object-cover border border-zoru-line"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-zoru-ink border border-zoru-line" />
          )}
          <SabFilePickerButton onPick={handleAvatarPick} variant="outline">
            Choose Avatar
          </SabFilePickerButton>
        </div>
      </div>
    </Card>
  );
}
