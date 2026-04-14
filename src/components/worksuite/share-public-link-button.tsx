'use client';

import { useState } from 'react';
import { Copy, Link2, LoaderCircle, X } from 'lucide-react';
import { ClayButton, ClayCard, ClayInput } from '@/components/clay';
import { generatePublicToken } from '@/app/actions/worksuite/public.actions';
import type { WsPublicResourceType } from '@/lib/worksuite/public-types';

/**
 * "Share" button that generates a public-portal URL for a resource and
 * displays it in a dialog with a copy button. The button is a small
 * Clay pill suitable for inclusion in detail-page action rows.
 */
export function SharePublicLinkButton({
  resourceType,
  resourceId,
  label = 'Share',
}: {
  resourceType: WsPublicResourceType;
  resourceId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setUrl(null);
    setCopied(false);
    const res = await generatePublicToken(resourceType, resourceId, {});
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    setUrl(`${origin}${res.url}`);
  };

  const open_ = () => {
    setOpen(true);
    generate();
  };
  const close = () => {
    setOpen(false);
    setUrl(null);
    setError(null);
    setCopied(false);
  };
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <ClayButton
        variant="pill"
        onClick={open_}
        leading={<Link2 className="h-4 w-4" />}
      >
        {label}
      </ClayButton>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <ClayCard className="w-full max-w-md" variant="floating">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-clay-ink">
                  Shareable link
                </h3>
                <p className="mt-1 text-[12.5px] text-clay-ink-muted">
                  Anyone with this link can view this {resourceType} without
                  logging in.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-clay-md p-1 text-clay-ink-muted hover:bg-clay-surface-2"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              {busy ? (
                <div className="flex items-center gap-2 text-[13px] text-clay-ink-muted">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Generating
                  link…
                </div>
              ) : error ? (
                <p className="text-[12.5px] text-clay-rose-ink">{error}</p>
              ) : url ? (
                <div className="flex flex-col gap-2">
                  <ClayInput value={url} readOnly />
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] text-clay-ink-muted">
                      {copied ? 'Copied!' : 'Copy and share with your client.'}
                    </span>
                    <ClayButton
                      variant="obsidian"
                      size="sm"
                      onClick={copy}
                      leading={<Copy className="h-3.5 w-3.5" />}
                    >
                      Copy
                    </ClayButton>
                  </div>
                </div>
              ) : null}
            </div>
          </ClayCard>
        </div>
      ) : null}
    </>
  );
}
