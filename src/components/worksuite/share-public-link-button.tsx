'use client';

import { Button, Card, Input } from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import { Copy, Link2, LoaderCircle, X } from 'lucide-react';
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
    // If we already have a live URL (e.g. dialog re-opened in same mount),
    // skip the server round-trip — the server action is idempotent anyway.
    if (url) return;
    setBusy(true);
    setError(null);
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
    // Keep url in state so re-opening skips the server call.
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
      <Button
        variant="pill"
        onClick={open_}
        leading={<Link2 className="h-4 w-4" />}
      >
        {label}
      </Button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <Card className="w-full max-w-md p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--st-text)]">
                  Shareable link
                </h3>
                <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
                  Anyone with this link can view this {resourceType} without
                  logging in.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              {busy ? (
                <div className="flex items-center gap-2 text-[13px] text-[var(--st-text-secondary)]">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Generating
                  link…
                </div>
              ) : error ? (
                <p className="text-[12.5px] text-[var(--st-text)]">{error}</p>
              ) : url ? (
                <div className="flex flex-col gap-2">
                  <Input value={url} readOnly />
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                      {copied ? 'Copied!' : 'Copy and share with your client.'}
                    </span>
                    <Button
                      variant="obsidian"
                      size="sm"
                      onClick={copy}
                      leading={<Copy className="h-3.5 w-3.5" />}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
