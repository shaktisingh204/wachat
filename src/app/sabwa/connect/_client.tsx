'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Alert, AlertDescription, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn, useToast } from '@/components/sabcrm/20ui';
import {
  useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  QrCode,
  ShieldCheck,
  Smartphone,
  } from 'lucide-react';

/**
 * ConnectClient — interactive shell for `/sabwa/connect`.
 *
 * Two-mode pairing flow (QR / phone-number → 8-char code) with a
 * first-time Terms-of-Service acknowledgement gate, status pill,
 * 5-step indicator, and a collapsible FAQ.
 *
 * Rebuilt on Ui20 primitives. The QR/Phone mode picker is rendered
 * as a segmented Button group (no tab UI per the Ui20 design
 * rules).
 */

import * as React from 'react';
import Link from 'next/link';

import { useProject } from '@/context/project-context';
import { pairSession } from '@/app/actions/sabwa.actions';

import { PairingFlow } from '../_components/pairing-flow';

const COUNTRY_CODES: { code: string; iso: string; label: string }[] = [
  { code: '+91', iso: 'IN', label: 'India' },
  { code: '+1', iso: 'US', label: 'United States' },
  { code: '+44', iso: 'GB', label: 'United Kingdom' },
  { code: '+971', iso: 'AE', label: 'UAE' },
  { code: '+65', iso: 'SG', label: 'Singapore' },
  { code: '+61', iso: 'AU', label: 'Australia' },
  { code: '+49', iso: 'DE', label: 'Germany' },
  { code: '+33', iso: 'FR', label: 'France' },
  { code: '+81', iso: 'JP', label: 'Japan' },
  { code: '+86', iso: 'CN', label: 'China' },
];

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

const STEPS: { label: string }[] = [
  { label: 'Generate code' },
  { label: 'Open WhatsApp on your phone' },
  { label: 'Settings → Linked Devices' },
  { label: 'Scan QR / enter code' },
  { label: 'Done' },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is this safe to use with my personal WhatsApp?',
    a: 'SabWa uses the same Linked Devices protocol as WhatsApp Web. Your phone remains the primary device and can revoke this link at any time. We never see your phone number password — only the encrypted session token.',
  },
  {
    q: 'Can WhatsApp ban my account?',
    a: 'Personal WhatsApp is intended for personal use. We strongly discourage bulk-marketing patterns. SabWa includes an anti-ban layer with rate limits, warmups, and ban-signal monitoring, but you accept the risk by linking your number.',
  },
  {
    q: 'What if the QR keeps refreshing?',
    a: 'Each QR is valid for 30 seconds. If you miss it, just wait — a fresh one appears automatically. The page only stops generating QRs once your phone confirms the link.',
  },
  {
    q: 'How do I unlink later?',
    a: 'Either from /sabwa/devices in SabNode, or from your phone (WhatsApp → Settings → Linked Devices → tap this session → Log out).',
  },
];

const TOS_STORAGE_KEY = 'sabwa.tos.acknowledged.v1';

interface ActiveSession {
  sessionId: string;
  qr?: string;
  pairCode?: string;
  mode: 'qr' | 'code';
}

function FlowStepper({
  activeStepIndex,
  steps,
}: {
  activeStepIndex: number;
  steps: { label: string }[];
}) {
  return (
    <ol className="grid grid-cols-1 gap-2 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 md:grid-cols-5">
      {steps.map((step, idx) => {
        const isDone = idx < activeStepIndex;
        const isActive = idx === activeStepIndex;
        return (
          <li
            key={step.label}
            className={cn(
              'flex items-center gap-2 rounded-[var(--st-radius)] px-2 py-1.5 text-[12.5px]',
              isActive
                ? 'bg-[var(--st-text)] text-[var(--st-text-inverted)]'
                : isDone
                  ? 'bg-[var(--st-bg-secondary)] text-[var(--st-text)]'
                  : 'text-[var(--st-text-secondary)]',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold',
                isActive
                  ? 'bg-[var(--st-text-inverted)] text-[var(--st-text)]'
                  : isDone
                    ? 'bg-[var(--st-text)] text-[var(--st-text-inverted)]'
                    : 'border border-[var(--st-border-strong)] text-[var(--st-text-secondary)]',
              )}
            >
              {isDone ? <Check className="h-3 w-3" /> : idx + 1}
            </span>
            <span className="truncate">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ConnectClient() {
  const router = useRouter();
  const toast = useToast();
  const { activeProjectId, sessionUser, projects } = useProject();

  const activeProject = React.useMemo(
    () => projects.find((p) => p._id.toString() === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  // ── ToS acknowledgement gate ────────────────────────────────────────────
  const [tosOpen, setTosOpen] = React.useState(false);
  const [tosAcked, setTosAcked] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(
        `${TOS_STORAGE_KEY}.${activeProjectId ?? 'none'}`,
      );
      if (stored === 'true') {
        setTosAcked(true);
      } else {
        setTosOpen(true);
      }
    } catch {
      setTosOpen(true);
    }
  }, [activeProjectId]);

  const acceptTos = () => {
    try {
      localStorage.setItem(
        `${TOS_STORAGE_KEY}.${activeProjectId ?? 'none'}`,
        'true',
      );
    } catch {
      /* ignore */
    }
    setTosAcked(true);
    setTosOpen(false);
  };

  // ── Pairing state ───────────────────────────────────────────────────────
  const [active, setActive] = React.useState<ActiveSession | null>(null);
  const [mode, setMode] = React.useState<'qr' | 'code'>('qr');
  const [isPending, startTransition] = React.useTransition();
  const [phoneInput, setPhoneInput] = React.useState('');
  const [countryCode, setCountryCode] = React.useState('+91');

  const phoneE164 = React.useMemo(
    () => `${countryCode}${phoneInput.replace(/\D/g, '')}`,
    [countryCode, phoneInput],
  );
  const phoneValid = E164_REGEX.test(phoneE164);

  const userId = sessionUser?._id ?? null;

  const beginPairing = (m: 'qr' | 'code') => {
    if (!activeProjectId) {
      toast.toast({
        title: 'Select a project first',
        description:
          'Go back to /sabwa and pick (or create) a project to continue.',
        variant: 'destructive',
      });
      return;
    }
    if (!userId) {
      toast.toast({
        title: 'You are signed out',
        description: 'Sign in again to link a WhatsApp number.',
        variant: 'destructive',
      });
      return;
    }
    if (m === 'code' && !phoneValid) {
      toast.toast({
        title: 'Enter a valid phone number',
        description: 'Include country code, digits only.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await pairSession(
          activeProjectId,
          m,
          m === 'code' ? phoneE164 : undefined,
        );
        if (!result.ok) {
          throw new Error(result.error);
        }
        setActive({
          sessionId: result.sessionId,
          qr: result.qr,
          pairCode: result.pairCode,
          mode: m,
        });
      } catch (error) {
        toast.toast({
          title: 'Could not start pairing',
          description:
            error instanceof Error
              ? error.message
              : 'The SabWa engine is unavailable right now.',
          variant: 'destructive',
        });
      }
    });
  };

  const cancelPairing = () => setActive(null);

  const handlePaired = React.useCallback(() => {
    toast.toast({
      title: 'WhatsApp linked',
      description: 'Your session is ready. Taking you to the accounts page…',
    });
    // `/sabwa/overview` re-fetches the session list on mount, so we don't
    // need to refresh here. Keeping this callback dependency-light also
    // stops the SSE `onConnected` ref churn that triggered a production
    // hooks-order divergence on the connect screen.
    router.push('/sabwa/overview');
  }, [router, toast]);

  // Stepper progression — pure UI affordance.
  const activeStepIndex = active ? 3 : 0;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 pb-10 space-y-6 sm:px-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/sabwa">SabWa</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Connect</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Hero */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
            <QrCode className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] tracking-[-0.015em] text-[var(--st-text)] leading-[1.2]">
                Connect WhatsApp
              </h1>
              <Badge variant="ghost" className="gap-1 text-[10.5px]">
                <ShieldCheck className="h-3 w-3" />
                Linked Devices
              </Badge>
            </div>
            <p className="mt-1 text-[13px] text-[var(--st-text-secondary)] max-w-2xl">
              Link your personal WhatsApp number to this SabNode project. Your
              phone stays the primary device — you can revoke the link from
              either side at any time.
            </p>
          </div>
        </div>

        {activeProject && (
          <div className="flex max-w-full items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-[12.5px]">
            <Briefcase className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]" />
            <span className="shrink-0 text-[var(--st-text-secondary)]">Project:</span>
            <span className="min-w-0 truncate text-[var(--st-text)]">
              {activeProject.name ?? 'Untitled'}
            </span>
            <Link
              href="/sabwa"
              className="ml-1 text-[var(--st-text)] underline-offset-2 hover:underline"
            >
              Change
            </Link>
          </div>
        )}
      </header>

      {/* Project guard banner — only when no project is selected. */}
      {!activeProjectId && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Select a project first</AlertTitle>
          <AlertDescription>
            SabWa attaches the linked number to a SabNode project. Go to{' '}
            <Link href="/sabwa" className="underline">
              /sabwa
            </Link>{' '}
            to pick or create one before generating a pairing code.
          </AlertDescription>
        </Alert>
      )}

      {/* ToS warning banner */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Use responsibly</AlertTitle>
        <AlertDescription>
          Personal WhatsApp is for personal use. Bulk marketing patterns
          increase ban risk. SabWa includes anti-ban controls but the risk is
          yours to manage.
        </AlertDescription>
      </Alert>

      {/* Step indicators */}
      <FlowStepper activeStepIndex={activeStepIndex} steps={STEPS} />

      {/* Main two-mode flow */}
      <Card>
        <CardHeader>
          <CardTitle>Choose how to link</CardTitle>
          <CardDescription>
            Use the QR if your phone is in front of you. Use the pair code if
            you cannot scan (for example linking from a remote device).
          </CardDescription>
        </CardHeader>
        <CardBody>
          {active ? (
            <div className="flex flex-col items-center gap-6 py-2">
              <PairingFlow
                mode={active.mode}
                sessionId={active.sessionId}
                projectId={activeProjectId}
                initialQr={active.qr}
                initialPairCode={active.pairCode}
                onPaired={handlePaired}
                onRefresh={() => beginPairing(active.mode)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cancelPairing}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="w-full">
              {/* Segmented mode switcher — replaces the previous Tabs UI */}
              <div
                role="group"
                aria-label="Pairing method"
                className="inline-flex rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1"
              >
                <Button
                  type="button"
                  variant={mode === 'qr' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-[calc(var(--st-radius)-2px)]"
                  onClick={() => setMode('qr')}
                >
                  <QrCode />
                  QR code
                </Button>
                <Button
                  type="button"
                  variant={mode === 'code' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-[calc(var(--st-radius)-2px)]"
                  onClick={() => setMode('code')}
                >
                  <Smartphone />
                  Phone number
                </Button>
              </div>

              {mode === 'qr' ? (
                <div className="mt-6 flex flex-col items-center gap-4">
                  <p className="max-w-md text-center text-[13px] text-[var(--st-text-secondary)]">
                    Generate a QR code, then on your phone go to{' '}
                    <strong>
                      WhatsApp → Settings → Linked Devices → Link a Device
                    </strong>{' '}
                    and scan it.
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    disabled={!tosAcked || !activeProjectId || isPending}
                    onClick={() => beginPairing('qr')}
                    className="gap-2"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode />
                    )}
                    Generate QR code
                  </Button>
                </div>
              ) : (
                <form
                  className="mx-auto mt-6 flex max-w-md flex-col gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    beginPairing('code');
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="sabwa-phone">Phone number</Label>
                    <div className="flex gap-2">
                      <Select
                        value={countryCode}
                        onValueChange={setCountryCode}
                      >
                        <SelectTrigger
                          className="w-[110px]"
                          aria-label="Country code"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRY_CODES.map((c) => (
                            <SelectItem key={c.iso} value={c.code}>
                              <span className="font-mono">{c.code}</span>{' '}
                              <span className="text-[var(--st-text-secondary)]">
                                {c.iso}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        id="sabwa-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="98XXXXXXXX"
                        value={phoneInput}
                        onChange={(e) =>
                          setPhoneInput(e.target.value.replace(/\D/g, ''))
                        }
                      />
                    </div>
                    <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                      We will issue an 8-character code to enter on your phone.
                    </p>
                    {phoneInput && !phoneValid && (
                      <p className="text-[11.5px] text-[var(--st-danger)]">
                        Phone number does not look right. Check the country
                        code and digits.
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={
                      !tosAcked || !activeProjectId || !phoneValid || isPending
                    }
                    className="gap-2"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight />
                    )}
                    Get pairing code
                  </Button>
                </form>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently asked questions</CardTitle>
          <CardDescription>
            Quick answers to the most common questions before you link.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item, idx) => (
              <AccordionItem key={item.q} value={`faq-${idx}`}>
                <AccordionTrigger className="text-left">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-[13px] text-[var(--st-text-secondary)]">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardBody>
      </Card>

      {/* ToS acknowledgement modal — first time per project */}
      <Dialog
        open={tosOpen}
        onOpenChange={(o) => {
          if (!o && !tosAcked) return;
          setTosOpen(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[var(--st-text)]" />
              Before you link your WhatsApp
            </DialogTitle>
            <DialogDescription>
              Please acknowledge how SabWa handles your personal WhatsApp
              session.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2.5 text-[13px]">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-status-ok)]" />
              <span>
                SabWa uses the official WhatsApp <strong>Linked Devices</strong>{' '}
                flow. Your phone remains primary and can revoke this link.
              </span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-status-ok)]" />
              <span>
                Messages are stored encrypted in your project workspace. Only
                members with the right RBAC permission can read them.
              </span>
            </li>
            <li className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-warn)]" />
              <span>
                Bulk-marketing patterns on a personal number can lead to a
                permanent WhatsApp ban. You accept that risk.
              </span>
            </li>
          </ul>
          <DialogFooter>
            <Button type="button" onClick={acceptTos}>
              I understand, continue
              <ChevronRight />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ConnectClient;
