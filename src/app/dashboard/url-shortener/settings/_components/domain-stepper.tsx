'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Button,
  Input,
  Label,
  useZoruToast,
} from '@/components/zoruui';
import { useActionState, useEffect, useRef, useTransition, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  LoaderCircle,
  CheckCircle,
  Copy,
  AlertTriangle,
  Globe,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { addCustomDomain, verifyCustomDomain } from '@/app/actions/url-shortener.actions';
import type { WithId, CustomDomain } from '@/lib/definitions';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/components/zoruui';

export type StepperState =
  | { step: 'idle' }
  | { step: 1; hostname: string }
  | { step: 2; domainId: string; hostname: string; verificationCode: string }
  | { step: 3; domainId: string; hostname: string; verificationCode: string; verifyError?: string; verifySuccess?: boolean };

function getSubdomainPart(hostname: string): string | null {
  const parts = hostname.split('.');
  if (parts.length > 2) return parts.slice(0, -2).join('.');
  return null;
}

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Enter Domain' },
    { n: 2, label: 'Configure DNS' },
    { n: 3, label: 'Verify' },
  ] as const;

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <div key={s.n} className="flex items-center gap-0 flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
                  done && 'bg-zoru-success text-white',
                  active && 'bg-amber-500 text-white ring-4 ring-amber-500/20',
                  !done && !active && 'bg-zoru-surface-2 text-zoru-ink-muted border border-zoru-line',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : s.n}
              </div>
              <span
                className={cn(
                  'text-xs whitespace-nowrap',
                  active && 'text-amber-400 font-medium',
                  done && 'text-zoru-success-ink',
                  !done && !active && 'text-zoru-ink-muted',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'h-px flex-1 mx-3 mb-5 transition-all',
                  current > s.n ? 'bg-zoru-success' : 'bg-zoru-line',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ContinueButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="gap-2">
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      Continue
      {!pending && <ArrowRight className="h-4 w-4" />}
    </Button>
  );
}

function DnsRecordCard({
  type,
  host,
  value,
  onCopy,
}: {
  type: string;
  host: string;
  value: string;
  onCopy: (v: string) => void;
}) {
  return (
    <div className="border border-zoru-line rounded-lg overflow-hidden bg-zoru-surface-2">
      <div className="grid grid-cols-[80px,1fr,80px,1fr,auto] divide-x divide-zoru-line">
        <div className="px-3 py-2 bg-zoru-bg">
          <p className="text-xs text-zoru-ink-muted uppercase tracking-wide mb-0.5">Type</p>
          <p className="text-sm font-mono text-zoru-ink">{type}</p>
        </div>
        <div className="px-3 py-2 bg-zoru-bg">
          <p className="text-xs text-zoru-ink-muted uppercase tracking-wide mb-0.5">Host</p>
          <p className="text-sm font-mono text-zoru-ink">{host}</p>
        </div>
        <div className="px-3 py-2 col-span-2 bg-zoru-bg">
          <p className="text-xs text-zoru-ink-muted uppercase tracking-wide mb-0.5">Value</p>
          <p className="text-sm font-mono text-zoru-ink break-all">{value}</p>
        </div>
        <div className="px-3 py-2 flex items-center justify-center bg-zoru-bg">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => onCopy(value)}
            className="h-7 w-7"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="px-3 py-1.5 border-t border-zoru-line bg-zoru-surface-2">
        <span className="text-xs text-zoru-ink-muted">TTL: Auto</span>
      </div>
    </div>
  );
}

const addDomainInitialState = { success: undefined, error: undefined };

export function DomainStepper({
  domains,
  onDomainAdded,
  onVerifySuccess,
}: {
  domains: WithId<CustomDomain>[];
  onDomainAdded: () => Promise<void>;
  onVerifySuccess: () => void;
}) {
  const { toast } = useZoruToast();
  const step1FormRef = useRef<HTMLFormElement>(null);
  const [stepper, setStepper] = useState<StepperState>({ step: 'idle' });
  const [addState, addAction] = useActionState(addCustomDomain, addDomainInitialState);
  const [isVerifying, startVerifyTransition] = useTransition();
  const { copy } = useCopyToClipboard();

  useEffect(() => {
    if (addState.success) {
      onDomainAdded().then(() => {
        // We need to wait for onDomainAdded to fetch new domains and we can pick up the new domain ID from the parent?
        // Actually, it's easier to find the newly added domain by comparing to stepper.hostname.
        // Wait, the parent component fetches domains. To avoid race condition, we can just let `useEffect` observing domains do it.
      });
    }
    if (addState.error) {
      toast({ title: 'Error', description: addState.error, variant: 'destructive' });
    }
  }, [addState, toast, onDomainAdded]);

  useEffect(() => {
    // Attempt to automatically move to step 2 if we found the added domain
    if (stepper.step === 1 && addState.success) {
      const added = domains.find(d => !d.verified && d.hostname === stepper.hostname);
      if (added) {
        setStepper({
          step: 2,
          domainId: added._id.toString(),
          hostname: added.hostname,
          verificationCode: added.verificationCode,
        });
      }
    }
  }, [domains, addState.success, stepper]);

  function handleVerify() {
    if (stepper.step !== 3) return;
    const { domainId, hostname, verificationCode } = stepper;
    startVerifyTransition(async () => {
      const result = await verifyCustomDomain(domainId);
      if (result.success) {
        setStepper({ step: 3, domainId, hostname, verificationCode, verifySuccess: true });
        onVerifySuccess();
      } else {
        setStepper({
          step: 3,
          domainId,
          hostname,
          verificationCode,
          verifyError: result.error || 'Verification failed. DNS records may not have propagated yet.',
        });
      }
    });
  }

  function resetStepper() {
    setStepper({ step: 'idle' });
  }

  if (stepper.step === 'idle') {
    return (
      <div className="border-2 border-dashed border-zoru-line rounded-xl p-8 flex flex-col items-center gap-3 text-center bg-zoru-surface-2/40">
        <div className="w-12 h-12 rounded-full bg-zoru-surface-2 flex items-center justify-center border border-zoru-line">
          <Globe className="h-6 w-6 text-zoru-ink-muted" />
        </div>
        <div>
          <p className="text-base font-medium text-zoru-ink">Connect a custom domain</p>
          <p className="text-sm text-zoru-ink-muted mt-1">Use your own domain for branded short links</p>
        </div>
        <Button
          type="button"
          onClick={() => setStepper({ step: 1, hostname: '' })}
          className="mt-1 gap-2"
        >
          Add Domain <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-zoru-line rounded-xl p-6 bg-zoru-surface-2/30">
      <StepIndicator current={stepper.step} />

      {stepper.step === 1 && (
        <form
          ref={step1FormRef}
          action={(formData) => {
            const hn = formData.get('hostname') as string;
            setStepper({ step: 1, hostname: hn });
            addAction(formData);
          }}
          className="space-y-5"
        >
          <div>
            <h3 className="text-lg font-medium text-zoru-ink mb-1">Enter your domain</h3>
            <p className="text-sm text-zoru-ink-muted">
              Use a subdomain like links.yourbrand.com (recommended) or an apex domain.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hostname-stepper">Domain</Label>
            <Input
              id="hostname-stepper"
              name="hostname"
              placeholder="links.yourbrand.com"
              defaultValue={stepper.hostname}
              required
              className="max-w-md"
              autoFocus
            />
            <div className="space-y-1 pt-1">
              <p className="text-xs text-zoru-ink-muted flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                Subdomain (CNAME): links.yourbrand.com — easier to set up
              </p>
              <p className="text-xs text-zoru-ink-muted flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-zoru-ink-muted/40" />
                Apex domain (A record): yourbrand.com — requires root DNS access
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={resetStepper}
              className="gap-1.5"
            >
              Cancel
            </Button>
            <ContinueButton />
          </div>
        </form>
      )}

      {stepper.step === 2 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-lg font-medium text-zoru-ink mb-1">Configure DNS</h3>
            <p className="text-sm text-zoru-ink-muted">
              Add the following records to your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.).
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-zoru-ink-muted uppercase tracking-wide">
              Record 1 — Domain Ownership Verification
            </p>
            <DnsRecordCard
              type="TXT"
              host={getSubdomainPart(stepper.hostname) ? `_sabnode.${getSubdomainPart(stepper.hostname)}` : '@'}
              value={stepper.verificationCode}
              onCopy={copy}
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-zoru-ink-muted uppercase tracking-wide">
              Record 2 — Routing
            </p>
            {getSubdomainPart(stepper.hostname) ? (
              <DnsRecordCard
                type="CNAME"
                host={getSubdomainPart(stepper.hostname)!}
                value="cname.sabnode.app"
                onCopy={copy}
              />
            ) : (
              <DnsRecordCard
                type="A"
                host="@"
                value="76.76.21.21"
                onCopy={copy}
              />
            )}
          </div>

          <Alert className="border-blue-500/30 bg-blue-500/10">
            <AlertTriangle className="h-4 w-4 text-blue-400" />
            <ZoruAlertTitle className="text-blue-300">DNS Propagation</ZoruAlertTitle>
            <ZoruAlertDescription className="text-blue-300/80">
              DNS changes typically propagate within 5–30 minutes. You can verify once the records are live.
            </ZoruAlertDescription>
          </Alert>

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStepper({ step: 1, hostname: stepper.hostname })}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              type="button"
              onClick={() =>
                setStepper({
                  step: 3,
                  domainId: stepper.domainId,
                  hostname: stepper.hostname,
                  verificationCode: stepper.verificationCode,
                })
              }
              className="gap-2"
            >
              I've added the records <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {stepper.step === 3 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-lg font-medium text-zoru-ink mb-1">Verify ownership</h3>
            <p className="text-sm text-zoru-ink-muted">
              Click verify to confirm your DNS records are live.
            </p>
          </div>

          {stepper.verifySuccess ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-zoru-success/20 flex items-center justify-center border border-zoru-success/40">
                <CheckCircle className="h-7 w-7 text-zoru-success-ink" />
              </div>
              <div>
                <p className="text-base font-semibold text-zoru-success-ink">Domain verified!</p>
                <p className="text-sm text-zoru-ink-muted mt-1">
                  {stepper.hostname} is now active and ready for short links.
                </p>
              </div>
              <Button type="button" onClick={resetStepper} className="mt-1">
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zoru-line bg-zoru-surface-2 text-sm text-zoru-ink">
                  <Globe className="h-4 w-4 text-zoru-ink-muted" />
                  {stepper.hostname}
                </div>
                {isVerifying && (
                  <span className="text-xs text-zoru-ink-muted flex items-center gap-1.5">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Checking DNS records...
                  </span>
                )}
              </div>

              {stepper.verifyError && (
                <Alert className="border-zoru-danger/40 bg-zoru-danger/10">
                  <AlertTriangle className="h-4 w-4 text-zoru-danger-ink" />
                  <ZoruAlertTitle className="text-zoru-danger-ink">Verification failed</ZoruAlertTitle>
                  <ZoruAlertDescription className="text-zoru-danger-ink/80">
                    DNS records may not have propagated yet. Wait a few minutes and try again.
                  </ZoruAlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setStepper({
                      step: 2,
                      domainId: stepper.domainId,
                      hostname: stepper.hostname,
                      verificationCode: stepper.verificationCode,
                    })
                  }
                  className="gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to DNS Instructions
                </Button>
                <Button
                  type="button"
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="gap-2"
                >
                  {isVerifying && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Verify Domain
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
