'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Megaphone, Plus, Trash2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  deleteTelegramAdAction,
  listTelegramAdsAction,
  upsertTelegramAdAction,
} from '@/app/actions/telegram-extra.actions';
import type { CampaignRow } from '@/lib/rust-client/telegram-ads';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

function safeDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function TelegramAdsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [busy, startBusy] = useTransition();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('draft');
  const [platformId, setPlatformId] = useState('');
  const [landingUrl, setLandingUrl] = useState('');
  const [budget, setBudget] = useState('0');
  const [impressions, setImpressions] = useState('0');
  const [clicks, setClicks] = useState('0');
  const [notes, setNotes] = useState('');

  const refresh = async () => {
    if (!projectId) return;
    setRows(await listTelegramAdsAction(projectId));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setStatus('draft');
    setPlatformId('');
    setLandingUrl('');
    setBudget('0');
    setImpressions('0');
    setClicks('0');
    setNotes('');
    setOpen(true);
  };

  const openEdit = (c: CampaignRow) => {
    setEditing(c);
    setName(c.name);
    setStatus(c.status);
    setPlatformId(c.platformId ?? '');
    setLandingUrl(c.landingUrl ?? '');
    setBudget(String(c.budgetCents ?? 0));
    setImpressions(String(c.impressions ?? 0));
    setClicks(String(c.clicks ?? 0));
    setNotes(c.notes ?? '');
    setOpen(true);
  };

  const onSave = () => {
    if (!projectId || !name.trim()) return;
    startBusy(async () => {
      const res = await upsertTelegramAdAction({
        projectId,
        campaignId: editing?._id,
        name: name.trim(),
        status,
        platformId: platformId.trim() || undefined,
        landingUrl: landingUrl.trim() || undefined,
        budgetCents: parseInt(budget || '0', 10),
        impressions: parseInt(impressions || '0', 10),
        clicks: parseInt(clicks || '0', 10),
        notes,
      });
      if (!res.success) {
        toast({ title: 'Save failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Saved' });
      setOpen(false);
      refresh();
    });
  };

  const onDelete = (id: string) => {
    if (!projectId) return;
    if (!confirm('Delete this campaign?')) return;
    startBusy(async () => {
      const res = await deleteTelegramAdAction(id, projectId);
      if (!res.success) {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
        return;
      }
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Megaphone />}
          title="No project selected"
          description="Pick a project."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
              boxShadow: '0 10px 28px rgba(0, 125, 187, 0.25)',
            }}
          >
            <Megaphone className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Ads</h1>
            <p className="mt-1 max-w-2xl text-[13.5px] text-zoru-ink-muted">
              Track Telegram Ad campaigns alongside SabNode. Campaigns themselves are
              managed on{' '}
              <Link
                className="underline decoration-zoru-line"
                href="https://ads.telegram.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                ads.telegram.org
              </Link>
              ; this page records the metadata and metrics you copy back. Backed by{' '}
              <code>telegram-ads</code>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ZoruButton asChild variant="outline" size="sm">
            <a href="https://ads.telegram.org" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              ads.telegram.org
            </a>
          </ZoruButton>
          <ZoruButton size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New campaign
          </ZoruButton>
        </div>
      </header>

      {rows.length === 0 ? (
        <ZoruEmptyState
          icon={<Megaphone />}
          title="No campaigns tracked"
          description="Add a campaign to record its budget, landing URL, and weekly metrics."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((c) => (
            <ZoruCard key={c._id} className="flex flex-col gap-2 p-5">
              <button
                type="button"
                onClick={() => openEdit(c)}
                className="flex items-start justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-base text-zoru-ink">{c.name}</p>
                  <p className="text-[11px] text-zoru-ink-muted">
                    {safeDate(c.updatedAt)}
                    {c.platformId ? ` · ${c.platformId}` : ''}
                  </p>
                </div>
                <ZoruBadge variant="ghost">{c.status}</ZoruBadge>
              </button>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-zoru-ink-muted">Budget</dt>
                  <dd className="text-zoru-ink">
                    {(c.budgetCents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </dd>
                </div>
                <div>
                  <dt className="text-zoru-ink-muted">Impr.</dt>
                  <dd className="text-zoru-ink">{c.impressions}</dd>
                </div>
                <div>
                  <dt className="text-zoru-ink-muted">Clicks</dt>
                  <dd className="text-zoru-ink">{c.clicks}</dd>
                </div>
              </dl>
              <footer className="flex items-center justify-between border-t border-zoru-line pt-3">
                {c.landingUrl ? (
                  <a
                    href={c.landingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-zoru-ink underline decoration-zoru-line"
                  >
                    {c.landingUrl}
                  </a>
                ) : (
                  <span className="text-[11px] text-zoru-ink-muted">no landing</span>
                )}
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(c._id)}
                  disabled={busy}
                >
                  <Trash2 className="h-4 w-4" />
                </ZoruButton>
              </footer>
            </ZoruCard>
          ))}
        </div>
      )}

      <ZoruDialog open={open} onOpenChange={setOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>{editing ? 'Edit campaign' : 'New campaign'}</ZoruDialogTitle>
            <ZoruDialogDescription>
              Telegram Ads doesn&rsquo;t expose a bot-side API; this is local tracking.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <ZoruLabel htmlFor="a-name">Name</ZoruLabel>
              <ZoruInput id="a-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <ZoruLabel htmlFor="a-status">Status</ZoruLabel>
                <ZoruInput
                  id="a-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="draft / active / paused"
                />
              </div>
              <div>
                <ZoruLabel htmlFor="a-pid">Platform ID</ZoruLabel>
                <ZoruInput
                  id="a-pid"
                  value={platformId}
                  onChange={(e) => setPlatformId(e.target.value)}
                  placeholder="ad_xxx"
                />
              </div>
            </div>
            <div>
              <ZoruLabel htmlFor="a-land">Landing URL</ZoruLabel>
              <ZoruInput
                id="a-land"
                value={landingUrl}
                onChange={(e) => setLandingUrl(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <ZoruLabel htmlFor="a-bud">Budget (cents)</ZoruLabel>
                <ZoruInput id="a-bud" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </div>
              <div>
                <ZoruLabel htmlFor="a-imp">Impressions</ZoruLabel>
                <ZoruInput id="a-imp" inputMode="numeric" value={impressions} onChange={(e) => setImpressions(e.target.value)} />
              </div>
              <div>
                <ZoruLabel htmlFor="a-clk">Clicks</ZoruLabel>
                <ZoruInput id="a-clk" inputMode="numeric" value={clicks} onChange={(e) => setClicks(e.target.value)} />
              </div>
            </div>
            <div>
              <ZoruLabel htmlFor="a-notes">Notes</ZoruLabel>
              <ZoruTextarea
                id="a-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={onSave} disabled={busy || !name.trim()}>
              {busy ? 'Saving…' : 'Save'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
