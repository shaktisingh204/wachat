'use client';

/**
 * SabCRM Finance — "Share & sign" action for the quotation detail bar.
 *
 * Mints (or reuses) a public, HMAC-signed e-signature link for the quote via
 * the gated `createShareableQuoteTw` action (CPQ quote-doc engine), then shows
 * the customer-facing `/share/quote/<token>` URL in a dialog with one-click
 * copy + open. The customer opens it to view, e-sign, and (on acceptance) pay
 * through the SabPay link the engine creates server-side.
 *
 * DEGRADES GRACEFULLY: a failed mint (sharing not configured, no permission,
 * quote not found, network) surfaces a toast and leaves the detail page exactly
 * as it was — no crash, nothing persisted client-side. The button is the only
 * thing this adds to the actions bar.
 */

import * as React from 'react';
import { Check, Copy, ExternalLink, Share2 } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  toast,
} from '@/components/sabcrm/20ui';
import { createShareableQuoteTw } from '@/app/actions/sabcrm-quotedoc.actions';

export interface QuoteShareButtonProps {
  quoteId: string;
  /** Quotation number — used only for the dialog copy. */
  quotationNo: string;
  /** Disable while another detail action is mid-flight. */
  disabled?: boolean;
}

export function QuoteShareButton({
  quoteId,
  quotationNo,
  disabled,
}: QuoteShareButtonProps): React.JSX.Element {
  const [pending, startTransition] = React.useTransition();
  const [url, setUrl] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const share = (): void => {
    startTransition(async () => {
      try {
        const res = await createShareableQuoteTw(quoteId);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setUrl(res.data.url);
        setCopied(false);
        setOpen(true);
      } catch {
        toast.error('Could not create the shareable link.');
      }
    });
  };

  const copy = async (): Promise<void> => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permission) — the input is
      // already selectable, so the rep can copy manually.
      toast.error('Copy failed — select the link and copy it manually.');
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        iconLeft={Share2}
        loading={pending}
        disabled={disabled}
        onClick={share}
      >
        Share &amp; sign
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share {quotationNo} for signature</DialogTitle>
            <DialogDescription>
              Send this link to your customer. They can review the quote, e-sign
              it, and pay online — no SabNode account needed.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={url ?? ''}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Shareable quote link"
            />
            <Button
              variant="secondary"
              iconLeft={copied ? Check : Copy}
              onClick={() => void copy()}
              aria-label="Copy link"
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            {url ? (
              <Button
                variant="primary"
                iconLeft={ExternalLink}
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              >
                Open link
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
