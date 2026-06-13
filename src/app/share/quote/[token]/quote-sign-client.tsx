'use client';

/**
 * Public quote sign client — renders the print-ready quote document in a
 * sandboxed iframe, and (when still open) a signature pad + accept button.
 *
 * On accept it calls `signQuotePublic` (the validated, ungated public action)
 * with a hidden honeypot field; on success it shows the SabPay pay link.
 */

import * as React from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@/components/sabcrm/20ui';
import { renderIcon } from '@/components/sabcrm/20ui/_icon';
import { CheckCircle2, CreditCard, Printer } from 'lucide-react';
import { SignaturePad } from '@/components/share/signature-pad';
import { signQuotePublic } from '@/app/actions/sabcrm-quotedoc.actions';

type Props = {
  token: string;
  quotationNo: string;
  currency: string;
  amount: number;
  clientName?: string;
  html: string;
  accepted: boolean;
  acceptedAt?: string;
  acceptedBy?: string;
  payUrl?: string;
};

function formatMoney(amount: number, currency: string): string {
  const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  const code = (currency || 'INR').toUpperCase();
  const sym = symbols[code] ?? '';
  const n = (Number.isFinite(amount) ? amount : 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return sym ? `${sym}${n}` : `${n} ${code}`;
}

export function QuoteSignClient(props: Props) {
  const [signerName, setSignerName] = React.useState(props.clientName ?? '');
  const [signatureData, setSignatureData] = React.useState<string | null>(null);
  const [hp, setHp] = React.useState(''); // honeypot
  const [banner, setBanner] = React.useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);
  const [payUrl, setPayUrl] = React.useState<string | undefined>(props.payUrl);
  const [accepted, setAccepted] = React.useState(props.accepted);
  const [pending, startTransition] = React.useTransition();

  const handleSign = () => {
    if (signerName.trim().length < 2) {
      setBanner({ kind: 'error', message: 'Please enter your full name.' });
      return;
    }
    if (!signatureData) {
      setBanner({ kind: 'error', message: 'Please draw your signature to accept.' });
      return;
    }
    startTransition(async () => {
      const res = await signQuotePublic(props.token, signerName, signatureData, hp);
      if (res.ok) {
        setAccepted(true);
        setPayUrl(res.payUrl);
        setBanner({
          kind: 'success',
          message: 'Quote accepted. Thank you!',
        });
      } else {
        setBanner({ kind: 'error', message: res.error });
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Quote {props.quotationNo}</CardTitle>
            <p className="mt-1 text-sm text-[var(--st-text)]">
              {props.clientName ? `Prepared for ${props.clientName} · ` : ''}
              {formatMoney(props.amount, props.currency)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={accepted ? 'default' : 'secondary'}>
              {accepted ? 'Accepted' : 'Awaiting signature'}
            </Badge>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--st-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--st-text)] shadow-sm hover:bg-[var(--st-bg-muted)]"
            >
              {renderIcon(Printer, { className: 'h-3.5 w-3.5' })}
              Print
            </button>
          </div>
        </CardHeader>
        <CardBody>
          {/* The quote HTML is a full, self-styled document — sandbox it so
              its <style> never leaks into the share-page chrome. */}
          <iframe
            title={`Quote ${props.quotationNo}`}
            srcDoc={props.html}
            sandbox="allow-same-origin"
            className="h-[900px] w-full rounded-md border border-[var(--st-border)] bg-white"
          />
        </CardBody>
      </Card>

      {accepted ? (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2 text-[color:var(--ui20-success,#16a34a)]">
              {renderIcon(CheckCircle2, { className: 'h-5 w-5' })}
              <span className="text-sm font-medium">
                This quote has been accepted
                {props.acceptedBy ? ` by ${props.acceptedBy}` : ''}
                {props.acceptedAt
                  ? ` on ${new Date(props.acceptedAt).toLocaleString()}`
                  : ''}
                .
              </span>
            </div>
            {payUrl ? (
              <div className="space-y-2">
                <p className="text-sm text-[var(--st-text)]">
                  Complete your payment to confirm the order.
                </p>
                <a href={payUrl} target="_blank" rel="noopener noreferrer">
                  <Button>
                    {renderIcon(CreditCard, { className: 'mr-2 h-4 w-4' })}
                    Pay {formatMoney(props.amount, props.currency)}
                  </Button>
                </a>
              </div>
            ) : (
              <p className="text-sm text-[var(--st-text)]">
                The seller will follow up with payment details shortly.
              </p>
            )}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Accept &amp; sign</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            {banner ? (
              <Alert variant={banner.kind === 'success' ? 'default' : 'destructive'}>
                <AlertDescription>{banner.message}</AlertDescription>
              </Alert>
            ) : null}

            {/* Honeypot — hidden from humans, attractive to bots. */}
            <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="quote-company-url">Company URL</label>
              <input
                id="quote-company-url"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="quote-signer">Full name</Label>
              <Input
                id="quote-signer"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                autoComplete="name"
                disabled={pending}
                placeholder="Your full legal name"
              />
            </div>

            <SignaturePad onChange={setSignatureData} />

            <p className="text-xs text-[var(--st-text)]">
              By signing you agree to the terms of this quote. Your name, IP
              address and the time of signing are recorded.
            </p>

            <Button onClick={handleSign} disabled={pending}>
              {pending ? 'Submitting…' : 'Accept & sign quote'}
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
