'use client';

import * as React from 'react';
import { Loader2, CheckCircle2, Trash2 } from 'lucide-react';

import { SabFilePickerButton } from '@/components/sabfiles';
import type { SabFilePick } from '@/components/sabfiles';
import { saveSabsignBranding } from '@/app/actions/sabsign-settings.actions';
import type { SabsignBranding } from '@/lib/sabsign/branding';

export function BrandingClient({ initial }: { initial: SabsignBranding | null }) {
  const [logoId, setLogoId] = React.useState(initial?.logoId ?? '');
  const [logoUrl, setLogoUrl] = React.useState(initial?.logoUrl ?? '');
  const [color, setColor] = React.useState(initial?.color ?? '#7c3aed');
  const [senderName, setSenderName] = React.useState(initial?.senderName ?? '');
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await saveSabsignBranding({
      logoId: logoId || undefined,
      logoUrl: logoUrl || undefined,
      color,
      senderName: senderName || undefined,
    });
    if (!res.ok) setError(res.error || 'Save failed.');
    else setSaved(true);
    setBusy(false);
  }

  const inputCls =
    'w-full rounded-[var(--st-radius,8px)] border border-[var(--st-border,#e5e5e5)] bg-[var(--st-surface,#fff)] px-3 py-2 text-sm text-[var(--st-text,#111)] outline-none focus:border-[var(--st-accent,#7c3aed)]';

  return (
    <main className="flex w-full max-w-2xl flex-col gap-5 p-1">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-tertiary,#999)]">
          SabSign · Settings
        </p>
        <h1 className="text-xl font-semibold text-[var(--st-text,#111)]">White-label &amp; branding</h1>
        <p className="text-sm text-[var(--st-text-secondary,#666)]">
          Your logo, accent colour and sender name appear on signing invites,
          reminders and the signer portal.
        </p>
      </div>

      <div className="flex flex-col gap-5 rounded-xl border border-[var(--st-border,#e5e5e5)] bg-[var(--st-surface,#fff)] p-4">
        <div>
          <span className="mb-2 block text-sm font-medium text-[var(--st-text,#111)]">Logo</span>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <span className="flex h-12 w-28 items-center justify-center overflow-hidden rounded-lg border border-[var(--st-border,#e5e5e5)] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Logo preview" className="max-h-10 max-w-24 object-contain" />
              </span>
            ) : (
              <span className="flex h-12 w-28 items-center justify-center rounded-lg border border-dashed border-[var(--st-border,#e5e5e5)] text-xs text-[var(--st-text-tertiary,#999)]">
                No logo
              </span>
            )}
            <SabFilePickerButton
              accept="image"
              onPick={(p: SabFilePick) => {
                setLogoId(p.id);
                setLogoUrl(p.url);
                setSaved(false);
              }}
            >
              {logoUrl ? 'Replace logo' : 'Choose from SabFiles'}
            </SabFilePickerButton>
            {logoUrl ? (
              <button
                type="button"
                onClick={() => {
                  setLogoId('');
                  setLogoUrl('');
                  setSaved(false);
                }}
                className="inline-flex items-center gap-1 text-sm text-[var(--st-text-secondary,#666)] hover:text-[var(--st-status-danger,#dc2626)]"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            ) : null}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--st-text,#111)]">Accent colour</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#7c3aed'}
              onChange={(e) => {
                setColor(e.target.value);
                setSaved(false);
              }}
              className="h-9 w-12 cursor-pointer rounded border border-[var(--st-border,#e5e5e5)]"
            />
            <input
              className={inputCls}
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setSaved(false);
              }}
              placeholder="#7c3aed"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--st-text,#111)]">Sender name</span>
          <input
            className={inputCls}
            value={senderName}
            onChange={(e) => {
              setSenderName(e.target.value);
              setSaved(false);
            }}
            placeholder="Acme Inc."
          />
        </label>

        {error ? (
          <p className="text-sm text-[var(--st-status-danger,#dc2626)]">{error}</p>
        ) : null}
        {saved ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Branding saved.
          </p>
        ) : null}

        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-[var(--st-accent,#7c3aed)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save branding
        </button>
      </div>
    </main>
  );
}
