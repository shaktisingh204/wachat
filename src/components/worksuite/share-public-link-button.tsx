'use client';

import { Alert, Button, Input, Modal, Spinner, useToast } from '@/components/sabcrm/20ui';
import { useState } from 'react';
import { Copy, Link2 } from 'lucide-react';
import { generatePublicToken } from '@/app/actions/worksuite/public.actions';
import type { WsPublicResourceType } from '@/lib/worksuite/public-types';

/**
 * "Share" button that generates a public-portal URL for a resource and
 * displays it in a 20ui Modal with a copy button. The trigger is a compact
 * pill suitable for inclusion in detail-page action rows.
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
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    // If we already have a live URL (e.g. dialog re-opened in same mount),
    // skip the server round-trip. The server action is idempotent anyway.
    if (url) return;
    setBusy(true);
    setError(null);
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
  };
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied. Share it with your client.');
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={open_} iconLeft={Link2}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={close}
        size="sm"
        title="Shareable link"
        description={`Anyone with this link can view this ${resourceType} without logging in.`}
      >
        {busy ? (
          <div className="flex items-center gap-2 text-[13px] text-[var(--st-text-secondary)]">
            <Spinner size="sm" label="Generating link" /> Generating link.
          </div>
        ) : error ? (
          <Alert tone="danger">{error}</Alert>
        ) : url ? (
          <div className="flex flex-col gap-3">
            <Input value={url} readOnly aria-label="Shareable link" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                Copy and share with your client.
              </span>
              <Button variant="primary" size="sm" onClick={copy} iconLeft={Copy}>
                Copy
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
