'use client';

import {
  Alert,
  Button,
  IconButton,
  Field,
  Input,
  EmptyState,
  Card,
  CardBody,
  Badge,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  cn,
  useToast,
} from '@/components/sabcrm/20ui';
import { useActionState, useEffect, useRef, useTransition, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  LoaderCircle,
  CheckCircle,
  Copy,
  Globe,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { addCustomDomain, verifyCustomDomain } from '@/app/actions/url-shortener.actions';
import type { WithId, CustomDomain } from '@/lib/definitions';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

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
                  done && 'bg-[var(--st-status-ok)] text-white',
                  active && 'bg-[var(--st-text)] text-white ring-4 ring-[var(--st-border)]/20',
                  !done && !active && 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] border border-[var(--st-border)]',
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden="true" /> : s.n}
              </div>
              <span
                className={cn(
                  'text-xs whitespace-nowrap',
                  active && 'text-[var(--st-text-secondary)] font-medium',
                  done && 'text-[var(--st-status-ok)]',
                  !done && !active && 'text-[var(--st-text-secondary)]',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'h-px flex-1 mx-3 mb-5 transition-all',
                  current > s.n ? 'bg-[var(--st-status-ok)]' : 'bg-[var(--st-border)]',
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
    <Button
      type="submit"
      variant="primary"
      loading={pending}
      iconRight={pending ? undefined : ArrowRight}
    >
      Continue
    </Button>
  );
}

function DnsRecordRow({
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
    <Tr>
      <Td>
        <Badge tone="neutral" kind="outline" className="font-mono">{type}</Badge>
      </Td>
      <Td>
        <span className="text-sm font-mono text-[var(--st-text)] break-all">{host}</span>
      </Td>
      <Td>
        <span className="text-sm font-mono text-[var(--st-text)] break-all">{value}</span>
      </Td>
      <Td align="center">
        <span className="text-xs text-[var(--st-text-secondary)]">Auto</span>
      </Td>
      <Td align="center">
        <IconButton
          label={`Copy ${type} record value`}
          icon={Copy}
          variant="ghost"
          size="sm"
          onClick={() => onCopy(value)}
        />
      </Td>
    </Tr>
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
  const { toast } = useToast();
  const step1FormRef = useRef<HTMLFormElement>(null);
  const [stepper, setStepper] = useState<StepperState>({ step: 'idle' });
  const [addState, addAction] = useActionState(addCustomDomain, addDomainInitialState);
  const [isVerifying, startVerifyTransition] = useTransition();
  const { copy } = useCopyToClipboard();

  useEffect(() => {
    if (addState.success) {
      onDomainAdded().then(() => {
        // Wait for onDomainAdded to fetch new domains; the effect observing
        // `domains` picks up the newly added domain by matching the hostname.
      });
    }
    if (addState.error) {
      toast({ title: 'Error', description: addState.error, tone: 'danger' });
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
      <Card variant="outlined" padding="lg" className="border-dashed">
        <EmptyState
          icon={Globe}
          title="Connect a custom domain"
          description="Use your own domain for branded short links."
          action={
            <Button
              type="button"
              variant="primary"
              iconRight={ArrowRight}
              onClick={() => setStepper({ step: 1, hostname: '' })}
            >
              Add Domain
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Card variant="outlined" padding="lg">
      <CardBody>
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
              <h3 className="text-lg font-medium text-[var(--st-text)] mb-1">Enter your domain</h3>
              <p className="text-sm text-[var(--st-text-secondary)]">
                Use a subdomain like links.yourbrand.com (recommended) or an apex domain.
              </p>
            </div>
            <Field label="Domain" className="max-w-md">
              <Input
                id="hostname-stepper"
                name="hostname"
                placeholder="links.yourbrand.com"
                defaultValue={stepper.hostname}
                required
                autoFocus
              />
            </Field>
            <div className="space-y-1 pt-1">
              <p className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--st-bg-muted)]" aria-hidden="true" />
                Subdomain (CNAME): links.yourbrand.com is easier to set up.
              </p>
              <p className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--st-text-secondary)]/40" aria-hidden="true" />
                Apex domain (A record): yourbrand.com requires root DNS access.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Button type="button" variant="ghost" onClick={resetStepper}>
                Cancel
              </Button>
              <ContinueButton />
            </div>
          </form>
        )}

        {stepper.step === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-medium text-[var(--st-text)] mb-1">Configure DNS</h3>
              <p className="text-sm text-[var(--st-text-secondary)]">
                Add the following records to your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.).
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
                Record 1, Domain Ownership Verification
              </p>
              <Table density="compact" hover={false}>
                <THead>
                  <Tr>
                    <Th>Type</Th>
                    <Th>Host</Th>
                    <Th>Value</Th>
                    <Th align="center">TTL</Th>
                    <Th align="center" width={56}>Copy</Th>
                  </Tr>
                </THead>
                <TBody>
                  <DnsRecordRow
                    type="TXT"
                    host={getSubdomainPart(stepper.hostname) ? `_sabnode.${getSubdomainPart(stepper.hostname)}` : '@'}
                    value={stepper.verificationCode}
                    onCopy={copy}
                  />
                </TBody>
              </Table>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
                Record 2, Routing
              </p>
              <Table density="compact" hover={false}>
                <THead>
                  <Tr>
                    <Th>Type</Th>
                    <Th>Host</Th>
                    <Th>Value</Th>
                    <Th align="center">TTL</Th>
                    <Th align="center" width={56}>Copy</Th>
                  </Tr>
                </THead>
                <TBody>
                  {getSubdomainPart(stepper.hostname) ? (
                    <DnsRecordRow
                      type="CNAME"
                      host={getSubdomainPart(stepper.hostname)!}
                      value="cname.sabnode.app"
                      onCopy={copy}
                    />
                  ) : (
                    <DnsRecordRow
                      type="A"
                      host="@"
                      value="76.76.21.21"
                      onCopy={copy}
                    />
                  )}
                </TBody>
              </Table>
            </div>

            <Alert tone="info" title="DNS Propagation">
              DNS changes typically propagate within 5 to 30 minutes. You can verify once the records are live.
            </Alert>

            <div className="flex items-center gap-3 pt-1">
              <Button
                type="button"
                variant="ghost"
                iconLeft={ArrowLeft}
                onClick={() => setStepper({ step: 1, hostname: stepper.hostname })}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                iconRight={ArrowRight}
                onClick={() =>
                  setStepper({
                    step: 3,
                    domainId: stepper.domainId,
                    hostname: stepper.hostname,
                    verificationCode: stepper.verificationCode,
                  })
                }
              >
                I have added the records
              </Button>
            </div>
          </div>
        )}

        {stepper.step === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-medium text-[var(--st-text)] mb-1">Verify ownership</h3>
              <p className="text-sm text-[var(--st-text-secondary)]">
                Click verify to confirm your DNS records are live.
              </p>
            </div>

            {stepper.verifySuccess ? (
              <EmptyState
                icon={CheckCircle}
                tone="success"
                title="Domain verified"
                description={`${stepper.hostname} is now active and ready for short links.`}
                action={
                  <Button type="button" variant="primary" onClick={resetStepper}>
                    Done
                  </Button>
                }
              />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral" kind="outline" dot>
                    <Globe className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    {stepper.hostname}
                  </Badge>
                  {isVerifying && (
                    <span className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1.5">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Checking DNS records...
                    </span>
                  )}
                </div>

                {stepper.verifyError && (
                  <Alert tone="danger" title="Verification failed">
                    DNS records may not have propagated yet. Wait a few minutes and try again.
                  </Alert>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    iconLeft={ArrowLeft}
                    onClick={() =>
                      setStepper({
                        step: 2,
                        domainId: stepper.domainId,
                        hostname: stepper.hostname,
                        verificationCode: stepper.verificationCode,
                      })
                    }
                  >
                    Back to DNS Instructions
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    loading={isVerifying}
                    onClick={handleVerify}
                  >
                    Verify Domain
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
