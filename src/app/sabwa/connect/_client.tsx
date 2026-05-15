'use client';

/**
 * ConnectClient — interactive shell for `/sabwa/connect`.
 *
 * Two-mode pairing flow (QR / phone-number → 8-char code) with a
 * first-time Terms-of-Service acknowledgement gate, status pill,
 * step indicators, and a collapsible FAQ.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  QrCode,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { pairSession } from '@/app/actions/sabwa.actions';

import { PairingFlow } from '../_components/pairing-flow';

// Compact country-code list — covers the most common SabNode markets.
// (Full libphonenumber-js validation runs on the server.)
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

// Basic E.164 sanity check — the server runs a strict libphonenumber pass.
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

export function ConnectClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeProjectId, sessionUser } = useProject();

  // ── ToS acknowledgement gate ────────────────────────────────────────────
  const [tosOpen, setTosOpen] = React.useState(false);
  const [tosAcked, setTosAcked] = React.useState(false);

  // Check localStorage on mount so server render stays consistent.
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
  const [isPending, startTransition] = React.useTransition();
  const [phoneInput, setPhoneInput] = React.useState('');
  const [countryCode, setCountryCode] = React.useState('+91');

  const phoneE164 = React.useMemo(
    () => `${countryCode}${phoneInput.replace(/\D/g, '')}`,
    [countryCode, phoneInput],
  );
  const phoneValid = E164_REGEX.test(phoneE164);

  const userId = sessionUser?._id ?? null;

  const beginPairing = (mode: 'qr' | 'code') => {
    if (!activeProjectId) {
      toast({
        title: 'Select a project first',
        description: 'Open the project switcher in the top-right to continue.',
        variant: 'destructive',
      });
      return;
    }
    if (!userId) {
      toast({
        title: 'You are signed out',
        description: 'Sign in again to link a WhatsApp number.',
        variant: 'destructive',
      });
      return;
    }
    if (mode === 'code' && !phoneValid) {
      toast({
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
          mode,
          mode === 'code' ? phoneE164 : undefined,
        );
        if (!result.ok) {
          throw new Error(result.error);
        }
        setActive({
          sessionId: result.sessionId,
          qr: result.qr,
          pairCode: result.pairCode,
          mode,
        });
      } catch (error) {
        toast({
          title: 'Could not start pairing',
          description:
            error instanceof Error ? error.message : 'The SabWa engine is unavailable right now.',
          variant: 'destructive',
        });
      }
    });
  };

  const cancelPairing = () => setActive(null);

  const handlePaired = React.useCallback(() => {
    toast({
      title: 'WhatsApp linked',
      description: 'Your session is ready. Redirecting to the inbox…',
    });
    router.push('/sabwa/inbox');
  }, [router, toast]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Hero */}
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-600/10 p-3 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
          <QrCode className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Connect WhatsApp
            </h1>
            <Badge variant="info" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              Linked Devices
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Link your personal WhatsApp number to this SabNode project. Your
            phone stays the primary device — you can revoke the link from
            either side at any time.
          </p>
        </div>
      </header>

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
      <ol className="grid grid-cols-1 gap-2 rounded-lg border bg-card/40 p-3 md:grid-cols-5">
        {STEPS.map((step, idx) => {
          const reached = active ? idx <= 3 : idx === 0;
          return (
            <li
              key={step.label}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                reached ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  reached
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/30',
                )}
                aria-hidden
              >
                {idx + 1}
              </span>
              <span className="truncate">{step.label}</span>
            </li>
          );
        })}
      </ol>

      {/* Main two-mode flow */}
      <Card>
        <CardHeader>
          <CardTitle>Choose how to link</CardTitle>
          <CardDescription>
            Use the QR if your phone is in front of you. Use the pair code if
            you cannot scan (for example linking from a remote device).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {active ? (
            <div className="flex flex-col items-center gap-6 py-2">
              <PairingFlow
                mode={active.mode}
                sessionId={active.sessionId}
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
            <Tabs defaultValue="qr" className="w-full">
              <TabsList className="grid w-full max-w-sm grid-cols-2">
                <TabsTrigger value="qr" className="gap-2">
                  <QrCode className="h-4 w-4" /> QR code
                </TabsTrigger>
                <TabsTrigger value="code" className="gap-2">
                  <Smartphone className="h-4 w-4" /> Phone number
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="qr"
                className="mt-6 flex flex-col items-center gap-4"
              >
                <p className="max-w-md text-center text-sm text-muted-foreground">
                  Generate a QR code, then on your phone go to{' '}
                  <strong>WhatsApp → Settings → Linked Devices → Link a Device</strong>{' '}
                  and scan it.
                </p>
                <Button
                  type="button"
                  size="lg"
                  disabled={!tosAcked || isPending}
                  onClick={() => beginPairing('qr')}
                  className="gap-2"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4" />
                  )}
                  Generate QR code
                </Button>
              </TabsContent>

              <TabsContent value="code" className="mt-6">
                <form
                  className="mx-auto flex max-w-md flex-col gap-4"
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
                              <span className="text-muted-foreground">
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
                    <p className="text-xs text-muted-foreground">
                      We will issue an 8-character code to enter on your phone.
                    </p>
                    {phoneInput && !phoneValid && (
                      <p className="text-xs text-destructive">
                        Phone number does not look right. Check the country code
                        and digits.
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={!tosAcked || !phoneValid || isPending}
                    className="gap-2"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Get pairing code
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently asked questions</CardTitle>
          <CardDescription>
            Quick answers to the most common questions before you link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item, idx) => (
              <AccordionItem key={item.q} value={`faq-${idx}`}>
                <AccordionTrigger className="text-left">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* ToS acknowledgement modal — first time per project */}
      <Dialog
        open={tosOpen}
        onOpenChange={(o) => {
          // Only allow closing via the Accept button.
          if (!o && !tosAcked) return;
          setTosOpen(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Before you link your WhatsApp
            </DialogTitle>
            <DialogDescription>
              Please acknowledge how SabWa handles your personal WhatsApp session.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2.5 text-sm">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                SabWa uses the official WhatsApp <strong>Linked Devices</strong>{' '}
                flow. Your phone remains primary and can revoke this link.
              </span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Messages are stored encrypted in your project workspace. Only
                members with the right RBAC permission can read them.
              </span>
            </li>
            <li className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Bulk-marketing patterns on a personal number can lead to a
                permanent WhatsApp ban. You accept that risk.
              </span>
            </li>
          </ul>
          <DialogFooter>
            <Button type="button" onClick={acceptTos}>
              I understand, continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ConnectClient;
