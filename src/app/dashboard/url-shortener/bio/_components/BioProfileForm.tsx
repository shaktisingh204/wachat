'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  Field,
  Input,
  Textarea,
} from '@/components/sabcrm/20ui';
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

  const initials = ((state.title.trim() || state.slug.trim()).charAt(0) || 'B').toUpperCase();

  return (
    <Card padding="lg" className="space-y-4">
      <Field label="Page URL">
        <Input
          prefix="/bio/"
          placeholder="your-name"
          value={state.slug}
          onChange={(e) =>
            update({ slug: e.target.value.replace(/[^a-z0-9-_]/gi, '').toLowerCase() })
          }
        />
      </Field>

      <Field label="Title">
        <Input
          placeholder="Your name or brand"
          value={state.title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </Field>

      <Field label="Bio" help={`${state.bio.length}/160 characters`}>
        <Textarea
          placeholder="A short description about you..."
          value={state.bio}
          maxLength={160}
          rows={3}
          onChange={(e) => update({ bio: e.target.value })}
        />
      </Field>

      <Field label="Avatar">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {state.avatarUrl ? <AvatarImage src={state.avatarUrl} alt="Avatar preview" /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <SabFilePickerButton onPick={handleAvatarPick} variant="outline">
            Choose Avatar
          </SabFilePickerButton>
        </div>
      </Field>
    </Card>
  );
}
