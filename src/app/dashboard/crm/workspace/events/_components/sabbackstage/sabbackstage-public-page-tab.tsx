'use client';

/**
 * SabBackstage Public Page tab — enable / edit the public landing
 * page for the event. Slug + headline + description + theme colors +
 * hero image (SabFiles only) + status. Includes a "copy public URL"
 * affordance.
 */

import * as React from 'react';
import {
  Badge,
  Button,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { Copy, Loader2, Save } from 'lucide-react';

import { SabFilePickerButton } from '@/components/sabfiles';
import {
  listSabbackstagePublicPages,
  createSabbackstagePublicPage,
  updateSabbackstagePublicPage,
} from '@/app/actions/sabbackstage.actions';
import type {
  SabbackstagePublicPageDoc,
  SabbackstagePublicPageStatus,
} from '@/lib/rust-client/sabbackstage-public-pages';

interface FormState {
  slug: string;
  headline: string;
  description: string;
  status: SabbackstagePublicPageStatus;
  heroImageFileId: string;
  heroImageName: string;
  accent: string;
  background: string;
}

function defaultForm(eventName: string): FormState {
  return {
    slug: eventName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60),
    headline: eventName,
    description: '',
    status: 'draft',
    heroImageFileId: '',
    heroImageName: '',
    accent: '#7c3aed',
    background: '#0b0b10',
  };
}

export function SabbackstagePublicPageTab({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}): React.JSX.Element {
  const { toast } = useZoruToast();
  const [loading, setLoading] = React.useState(true);
  const [existing, setExisting] =
    React.useState<SabbackstagePublicPageDoc | null>(null);
  const [form, setForm] = React.useState<FormState>(() =>
    defaultForm(eventName),
  );
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const r = await listSabbackstagePublicPages({ eventId, limit: 1 });
    if (r.ok && r.data.items.length > 0) {
      const p = r.data.items[0];
      setExisting(p);
      const theme = (p.themeJson ?? {}) as {
        accent?: string;
        background?: string;
      };
      setForm({
        slug: p.slug,
        headline: p.headline,
        description: p.description ?? '',
        status: p.status,
        heroImageFileId: p.heroImageFileId ?? '',
        heroImageName: '',
        accent: theme.accent ?? '#7c3aed',
        background: theme.background ?? '#0b0b10',
      });
    } else {
      setExisting(null);
      setForm(defaultForm(eventName));
    }
    setLoading(false);
  }, [eventId, eventName]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const publicUrl = React.useMemo(() => {
    if (typeof window === 'undefined') return `/event/${form.slug}`;
    return `${window.location.origin}/event/${form.slug}`;
  }, [form.slug]);

  async function handleSave(): Promise<void> {
    if (!form.slug.trim() || !form.headline.trim()) {
      toast({ title: 'Slug + headline required', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const payload = {
      headline: form.headline.trim(),
      description: form.description || undefined,
      status: form.status,
      heroImageFileId: form.heroImageFileId || undefined,
      themeJson: { accent: form.accent, background: form.background },
    };
    let res;
    if (existing) {
      res = await updateSabbackstagePublicPage(
        existing._id,
        { ...payload, slug: form.slug.trim().toLowerCase() },
        eventId,
      );
    } else {
      res = await createSabbackstagePublicPage({
        eventId,
        slug: form.slug.trim().toLowerCase(),
        ...payload,
      });
    }
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Failed', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Saved' });
    await refresh();
  }

  function copyUrl(): void {
    if (typeof navigator === 'undefined') return;
    navigator.clipboard.writeText(publicUrl).then(
      () => toast({ title: 'Public URL copied' }),
      () => toast({ title: 'Copy failed', variant: 'destructive' }),
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant={form.status === 'live' ? 'success' : 'secondary'}>
          {existing ? `Status · ${form.status}` : 'Not yet created'}
        </Badge>
        <div className="flex items-center gap-2">
          <code className="rounded bg-[var(--st-bg-secondary)] px-2 py-1 text-[12px] text-[var(--st-text)]">
            {publicUrl}
          </code>
          <Button variant="outline" type="button" onClick={copyUrl}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Copy
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="pp-slug">Slug</Label>
          <Input
            id="pp-slug"
            value={form.slug}
            onChange={(e) =>
              setForm({
                ...form,
                slug: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, '-'),
              })
            }
          />
        </div>
        <div>
          <Label htmlFor="pp-status">Status</Label>
          <select
            id="pp-status"
            className="block h-9 w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-2 text-[13px]"
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value as SabbackstagePublicPageStatus,
              })
            }
          >
            <option value="draft">draft</option>
            <option value="live">live</option>
            <option value="paused">paused</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="pp-headline">Headline</Label>
          <Input
            id="pp-headline"
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="pp-desc">Description</Label>
          <Textarea
            id="pp-desc"
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="pp-accent">Accent color</Label>
          <Input
            id="pp-accent"
            type="color"
            value={form.accent}
            onChange={(e) => setForm({ ...form, accent: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="pp-bg">Background color</Label>
          <Input
            id="pp-bg"
            type="color"
            value={form.background}
            onChange={(e) => setForm({ ...form, background: e.target.value })}
          />
        </div>
        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <SabFilePickerButton
            accept="image"
            onPick={(p) =>
              setForm((f) => ({
                ...f,
                heroImageFileId: p.id,
                heroImageName: p.name ?? '',
              }))
            }
          >
            Pick hero image
          </SabFilePickerButton>
          {form.heroImageFileId ? (
            <span className="text-[12px] text-[var(--st-text-secondary)]">
              Hero set: {form.heroImageName || form.heroImageFileId}
            </span>
          ) : (
            <span className="text-[12px] text-[var(--st-text-secondary)]">
              No hero image yet
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={busy} type="button">
          <Save className="mr-1 h-3.5 w-3.5" /> Save
        </Button>
      </div>
    </div>
  );
}
