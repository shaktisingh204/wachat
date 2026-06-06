'use client';

/**
 * SabBackstage Sponsors tab — sponsor CRUD with SabFiles logo picker.
 * NO URL paste anywhere — `<SabFilePickerButton>` is the only path to
 * a sponsor logo. The logo's SabFile id is stored on the row.
 */

import * as React from 'react';
import {
  Badge,
  Button,
  Input,
  Label,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import { SabFilePickerButton } from '@/components/sabfiles';
import {
  listSabbackstageSponsors,
  createSabbackstageSponsor,
  updateSabbackstageSponsor,
  deleteSabbackstageSponsor,
} from '@/app/actions/sabbackstage.actions';
import type { SabbackstageSponsorDoc } from '@/lib/rust-client/sabbackstage-sponsors';

interface NewSponsorForm {
  name: string;
  tier: string;
  websiteUrl: string;
  contactEmail: string;
  logoFileId: string;
  logoFileName: string;
}

const EMPTY: NewSponsorForm = {
  name: '',
  tier: 'gold',
  websiteUrl: '',
  contactEmail: '',
  logoFileId: '',
  logoFileName: '',
};

export function SabbackstageSponsorsTab({
  eventId,
}: {
  eventId: string;
}): React.JSX.Element {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<SabbackstageSponsorDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState<NewSponsorForm>(EMPTY);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const r = await listSabbackstageSponsors({ eventId, limit: 100 });
    if (r.ok) setRows(r.data.items);
    setLoading(false);
  }, [eventId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(): Promise<void> {
    if (!form.name.trim() || !form.tier.trim()) {
      toast({ title: 'Name + tier required', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const r = await createSabbackstageSponsor({
      eventId,
      name: form.name.trim(),
      tier: form.tier.trim(),
      websiteUrl: form.websiteUrl || undefined,
      contactEmail: form.contactEmail || undefined,
      logoFileId: form.logoFileId || undefined,
    });
    setBusy(false);
    if (!r.ok) {
      toast({ title: 'Failed', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Sponsor added' });
    setForm(EMPTY);
    await refresh();
  }

  async function handleDelete(id: string): Promise<void> {
    const r = await deleteSabbackstageSponsor(id, eventId);
    if (!r.ok) {
      toast({ title: 'Failed', description: r.error, variant: 'destructive' });
      return;
    }
    await refresh();
  }

  async function handleRank(id: string, rank: number): Promise<void> {
    const r = await updateSabbackstageSponsor(id, { orderRank: rank }, eventId);
    if (!r.ok) {
      toast({ title: 'Failed', description: r.error, variant: 'destructive' });
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-2 rounded-md border border-[var(--st-border)] p-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label htmlFor="sp-name">Sponsor name</Label>
          <Input
            id="sp-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="sp-tier">Tier</Label>
          <Input
            id="sp-tier"
            value={form.tier}
            onChange={(e) => setForm({ ...form, tier: e.target.value })}
            placeholder="gold / platinum…"
          />
        </div>
        <div>
          <Label htmlFor="sp-url">Website</Label>
          <Input
            id="sp-url"
            value={form.websiteUrl}
            onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
            placeholder="https://…"
          />
        </div>
        <div>
          <Label htmlFor="sp-email">Contact email</Label>
          <Input
            id="sp-email"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={handleCreate} disabled={busy} type="button">
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        <div className="md:col-span-6 flex flex-wrap items-center gap-3">
          <SabFilePickerButton
            accept="image"
            onPick={(p) =>
              setForm((f) => ({
                ...f,
                logoFileId: p.id,
                logoFileName: p.name ?? '',
              }))
            }
          >
            Pick logo from SabFiles
          </SabFilePickerButton>
          {form.logoFileId ? (
            <span className="text-[12px] text-[var(--st-text-secondary)]">
              Selected: {form.logoFileName || form.logoFileId}
            </span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading sponsors…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[12.5px] text-[var(--st-text-secondary)]">No sponsors yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--st-border)]">
          {rows.map((s) => (
            <li
              key={s._id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div>
                <div className="text-[13px] font-medium text-[var(--st-text)]">
                  {s.name}
                </div>
                <div className="text-[12px] text-[var(--st-text-secondary)]">
                  {s.websiteUrl || s.contactEmail || '—'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{s.tier}</Badge>
                <Input
                  type="number"
                  className="h-8 w-16"
                  value={s.orderRank}
                  onChange={(e) =>
                    handleRank(s._id, Number(e.target.value) || 0)
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDelete(s._id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
