"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Phone,
  RefreshCw,
  ServerCog,
  ShieldCheck,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";
import { useProject } from "@/context/project-context";
import {
  completeSabsmsSetup,
  getSabsmsSetupState,
  saveSabsmsComplianceStep,
  saveSabsmsProfileStep,
  saveSabsmsSenderStep,
  type SabsmsRegion,
  type SabsmsSetupState,
} from "@/app/actions/sabsms-projects.actions";
import {
  listProviderAccountsAction,
  saveProviderAccountAction,
  testProviderConnectionAction,
} from "../providers/actions";
import { CreatingOverlay, SuccessCheck } from "@/components/sabsms/motion";

type ProviderRow = {
  id: string;
  provider: string;
  region?: string;
  isDefault: boolean;
  status: string;
};

const PROVIDERS: { id: string; label: string }[] = [
  { id: "twilio", label: "Twilio" },
  { id: "msg91", label: "MSG91" },
  { id: "gupshup", label: "Gupshup" },
  { id: "vonage", label: "Vonage" },
  { id: "plivo", label: "Plivo" },
  { id: "telnyx", label: "Telnyx" },
  { id: "messagebird", label: "MessageBird / Bird" },
  { id: "sinch", label: "Sinch" },
  { id: "infobip", label: "Infobip" },
  { id: "aws_sns", label: "AWS SNS" },
  { id: "textlocal", label: "Textlocal" },
  { id: "kaleyra", label: "Kaleyra" },
  { id: "karix", label: "Karix" },
];

const PROVIDER_FIELDS: Record<
  string,
  { key: string; label: string; secret?: boolean }[]
> = {
  twilio: [
    { key: "accountSid", label: "Account SID" },
    { key: "authToken", label: "Auth Token", secret: true },
  ],
  msg91: [{ key: "authKey", label: "Auth Key", secret: true }],
  gupshup: [
    { key: "apiKey", label: "API Key", secret: true },
    { key: "appName", label: "App Name" },
  ],
  vonage: [
    { key: "apiKey", label: "API Key" },
    { key: "apiSecret", label: "API Secret", secret: true },
  ],
  plivo: [
    { key: "authId", label: "Auth ID" },
    { key: "authToken", label: "Auth Token", secret: true },
  ],
  telnyx: [{ key: "apiKey", label: "API Key", secret: true }],
  messagebird: [{ key: "accessKey", label: "Access Key", secret: true }],
  sinch: [
    { key: "servicePlanId", label: "Service Plan ID" },
    { key: "apiToken", label: "API Token", secret: true },
  ],
  infobip: [
    { key: "apiKey", label: "API Key", secret: true },
    { key: "baseUrl", label: "Base URL" },
  ],
  aws_sns: [
    { key: "accessKeyId", label: "Access Key ID" },
    { key: "secretAccessKey", label: "Secret Access Key", secret: true },
    { key: "region", label: "AWS Region" },
  ],
  textlocal: [{ key: "apiKey", label: "API Key", secret: true }],
  kaleyra: [
    { key: "apiKey", label: "API Key", secret: true },
    { key: "sid", label: "SID" },
  ],
  karix: [{ key: "apiKey", label: "API Key", secret: true }],
};

const STEPS = [
  { id: "profile", title: "Business profile", icon: Building2 },
  { id: "provider", title: "Provider", icon: ServerCog },
  { id: "sender", title: "Sender", icon: Phone },
  { id: "compliance", title: "Compliance", icon: ShieldCheck },
  { id: "review", title: "Review", icon: CheckCircle2 },
] as const;

export function SabsmsSetupClient({
  projectId,
  initial,
  initialProviders,
}: {
  projectId: string;
  initial: SabsmsSetupState;
  initialProviders: ProviderRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { setActiveProjectId } = useProject();

  // Keep the shared context aligned with the cookie so the shell header +
  // dock reflect the project being set up.
  React.useEffect(() => {
    try {
      setActiveProjectId(projectId);
    } catch {
      /* localStorage may be unavailable */
    }
  }, [projectId, setActiveProjectId]);

  const [step, setStep] = React.useState(() => {
    // Resume at the first incomplete step.
    if (!initial.steps.profile) return 0;
    if (!initial.steps.provider) return 1;
    if (!initial.steps.sender) return 2;
    if (!initial.steps.compliance) return 3;
    return 4;
  });
  const [state, setState] = React.useState<SabsmsSetupState>(initial);
  const [providers, setProviders] = React.useState<ProviderRow[]>(initialProviders);
  const [busy, setBusy] = React.useState(false);
  const [connectingProvider, setConnectingProvider] = React.useState(false);
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [finishing, setFinishing] = React.useState(false);
  const [finished, setFinished] = React.useState(false);
  const [dir, setDir] = React.useState(1);
  const reduce = useReducedMotion();

  const refreshState = React.useCallback(async () => {
    const s = await getSabsmsSetupState(projectId);
    if (s) setState(s);
  }, [projectId]);

  const refreshProviders = React.useCallback(async () => {
    const res = await listProviderAccountsAction();
    if (res.success) setProviders(res.accounts as ProviderRow[]);
  }, []);

  /* ── step 0 — profile ──────────────────────────────────────────────── */
  const [businessName, setBusinessName] = React.useState(initial.businessName ?? "");
  const [region, setRegion] = React.useState<SabsmsRegion>(initial.region ?? "IN");
  const [website, setWebsite] = React.useState(initial.businessProfile?.website ?? "");
  const [industry, setIndustry] = React.useState(initial.businessProfile?.industry ?? "");
  const [useCase, setUseCase] = React.useState(initial.businessProfile?.useCase ?? "");

  const saveProfile = async () => {
    setBusy(true);
    const res = await saveSabsmsProfileStep(projectId, {
      businessName,
      region,
      businessProfile: { website, industry, useCase },
    });
    setBusy(false);
    if (!res.success) {
      toast({ title: "Could not save", description: res.error, variant: "destructive" });
      return false;
    }
    await refreshState();
    return true;
  };

  /* ── step 1 — provider ─────────────────────────────────────────────── */
  const [providerId, setProviderId] = React.useState("twilio");
  const [creds, setCreds] = React.useState<Record<string, string>>({});
  const fields = PROVIDER_FIELDS[providerId] ?? [{ key: "apiKey", label: "API Key", secret: true }];

  const saveProvider = async () => {
    const missing = fields.some((f) => !creds[f.key]?.trim());
    if (missing) {
      toast({ title: "Enter all credentials", variant: "destructive" });
      return;
    }
    setConnectingProvider(true);
    setBusy(true);
    const res = await saveProviderAccountAction({
      provider: providerId,
      credentials: creds,
      region: state.region ?? undefined,
      isDefault: providers.length === 0,
    });
    setBusy(false);
    setConnectingProvider(false);
    if (!res.success) {
      toast({ title: "Could not save provider", description: res.error, variant: "destructive" });
      return;
    }
    setCreds({});
    await Promise.all([refreshProviders(), refreshState()]);
    toast({ title: "Provider connected" });
  };

  const testProvider = async (id: string) => {
    setTestingId(id);
    const res = await testProviderConnectionAction(id);
    setTestingId(null);
    if (res.ok) {
      toast({ title: "Connection OK", description: res.detail });
    } else if (res.error === "engine unreachable") {
      toast({
        title: "Engine offline — test skipped",
        description: "Credentials are saved. You can finish setup and test later.",
      });
    } else {
      toast({ title: "Test failed", description: res.error, variant: "destructive" });
    }
    await refreshProviders();
  };

  /* ── step 2 — sender ───────────────────────────────────────────────── */
  const [senderType, setSenderType] = React.useState<
    "alphanumeric" | "longcode" | "shortcode" | "tollfree"
  >("alphanumeric");
  const [senderValue, setSenderValue] = React.useState("");
  const [senderCountry, setSenderCountry] = React.useState("");

  const saveSender = async () => {
    setBusy(true);
    const res = await saveSabsmsSenderStep(projectId, {
      type: senderType,
      value: senderValue,
      country: senderCountry,
    });
    setBusy(false);
    if (!res.success) {
      toast({ title: "Could not add sender", description: res.error, variant: "destructive" });
      return;
    }
    setSenderValue("");
    await refreshState();
    toast({ title: "Sender added" });
  };

  /* ── step 3 — compliance ───────────────────────────────────────────── */
  const [dltEntityId, setDltEntityId] = React.useState(initial.compliance?.dltEntityId ?? "");
  const [dltHeaderId, setDltHeaderId] = React.useState(initial.compliance?.dltHeaderId ?? "");
  const [tenDlcBrandId, setTenDlcBrandId] = React.useState(initial.compliance?.tenDlcBrandId ?? "");
  const [tenDlcCampaignId, setTenDlcCampaignId] = React.useState(
    initial.compliance?.tenDlcCampaignId ?? "",
  );
  const [acknowledged, setAcknowledged] = React.useState(!!initial.compliance?.acknowledged);

  const saveCompliance = async () => {
    setBusy(true);
    const res = await saveSabsmsComplianceStep(projectId, {
      dltEntityId,
      dltHeaderId,
      tenDlcBrandId,
      tenDlcCampaignId,
      acknowledged,
    });
    setBusy(false);
    if (!res.success) {
      toast({ title: "Could not save compliance", description: res.error, variant: "destructive" });
      return false;
    }
    await refreshState();
    return true;
  };

  /* ── finish ────────────────────────────────────────────────────────── */
  const finish = async () => {
    setBusy(true);
    setFinishing(true);
    const res = await completeSabsmsSetup(projectId);
    if (!res.success) {
      setFinishing(false);
      setBusy(false);
      toast({ title: "Setup not complete", description: res.error, variant: "destructive" });
      return;
    }
    // Celebrate the (rare, first-time) completion, then open the module.
    setFinished(true);
    window.setTimeout(() => router.push("/sabsms"), reduce ? 350 : 1100);
  };

  /* ── per-step Continue gating ──────────────────────────────────────── */
  const canContinue = (): boolean => {
    switch (step) {
      case 0:
        return businessName.trim().length > 0;
      case 1:
        return providers.length > 0;
      case 2:
        return state.senderCount > 0;
      case 3:
        if (region === "IN") return dltEntityId.trim().length > 0;
        if (region === "US") return tenDlcBrandId.trim().length > 0;
        return acknowledged;
      default:
        return true;
    }
  };

  const onContinue = async () => {
    setDir(1);
    if (step === 0) {
      if (await saveProfile()) setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    if (step === 3) {
      if (await saveCompliance()) setStep(4);
      return;
    }
    await finish();
  };

  const Current = STEPS[step];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
          Set up {state.name}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[var(--st-text)]">
          Finish setup to start sending
        </h1>
        <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
          A few one-time steps per project: profile, a provider, a sender, and
          the compliance your region requires.
        </p>
      </header>

      {/* Step indicator */}
      <ol className="mb-6 flex flex-wrap items-center gap-2" aria-label="Setup steps">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          const Icon = s.icon;
          return (
            <li key={s.id} className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 place-items-center rounded-full border text-xs ${
                  active
                    ? "border-transparent bg-[var(--st-text)] text-[var(--st-bg)]"
                    : done
                      ? "border-transparent bg-[var(--st-status-ok)] text-white"
                      : "border-[var(--st-border)] text-[var(--st-text-secondary)]"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
              </span>
              <span
                className={`hidden text-xs sm:inline ${
                  active ? "font-medium text-[var(--st-text)]" : "text-[var(--st-text-secondary)]"
                }`}
              >
                {s.title}
              </span>
              {i < STEPS.length - 1 ? (
                <span className="mx-1 hidden h-px w-6 bg-[var(--st-border)] sm:inline-block" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      <Card className="relative p-6">
        <CreatingOverlay
          show={finishing && !finished}
          variant="process"
          title="Finishing setup…"
          subtitle="Validating your configuration"
        />
        <AnimatePresence>
          {finished ? (
            <motion.div
              key="sabsms-setup-done"
              className="sabsms-creating sabsms-motion"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <SuccessCheck size={56} />
                <div>
                  <p className="text-sm font-medium text-[var(--st-text)]">
                    Setup complete
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                    Opening SabSMS…
                  </p>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -14 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <h2 className="mb-1 text-base font-semibold text-[var(--st-text)]">
              {Current.title}
            </h2>

            {/* ── Step bodies ── */}
            {step === 0 && (
          <div className="mt-4 space-y-4">
            <Field label="Business / brand name">
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Acme Inc."
                autoFocus
                maxLength={120}
              />
            </Field>
            <Field label="Primary region">
              <Select value={region} onValueChange={(v: string) => setRegion(v as SabsmsRegion)}>
                <SelectTrigger className="w-full" aria-label="Primary region">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">India (DLT)</SelectItem>
                  <SelectItem value="US">United States (10DLC)</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Website (optional)">
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </Field>
              <Field label="Industry (optional)">
                <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Retail" />
              </Field>
            </div>
            <Field label="Primary use case (optional)">
              <Textarea
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="e.g. Order updates and OTPs for our store."
                rows={2}
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-[var(--st-text-secondary)]">
              Connect at least one SMS provider. Credentials are encrypted —
              they never leave the server in plaintext.
            </p>

            {providers.length > 0 && (
              <ul className="space-y-2">
                {providers.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-md border border-[var(--st-border)] px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <ServerCog className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden />
                      <span className="font-medium capitalize">{p.provider}</span>
                      <Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge>
                      {p.isDefault ? <Badge variant="secondary">default</Badge> : null}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      iconLeft={RefreshCw}
                      loading={testingId === p.id}
                      disabled={testingId !== null || connectingProvider}
                      onClick={() => void testProvider(p.id)}
                    >
                      Test
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="relative rounded-md border border-[var(--st-border)] p-4">
              <CreatingOverlay
                show={connectingProvider}
                variant="connect"
                title={`Connecting to ${
                  PROVIDERS.find((x) => x.id === providerId)?.label ?? providerId
                }…`}
                subtitle="Saving credentials securely"
              />
              <Field label="Provider">
                <Select
                  value={providerId}
                  onValueChange={(v: string) => {
                    setProviderId(v);
                    setCreds({});
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Provider">
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {fields.map((f) => (
                  <Field key={f.key} label={f.label}>
                    <Input
                      type={f.secret ? "password" : "text"}
                      value={creds[f.key] ?? ""}
                      onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                      autoComplete="off"
                    />
                  </Field>
                ))}
              </div>
              <div className="mt-3">
                <Button variant="primary" size="sm" loading={busy} onClick={() => void saveProvider()}>
                  Connect provider
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-[var(--st-text-secondary)]">
              Add at least one sender — a phone number (long/short code) or an
              alphanumeric sender ID.
            </p>
            {state.senderCount > 0 && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" aria-hidden /> {state.senderCount} sender
                {state.senderCount === 1 ? "" : "s"} added
              </Badge>
            )}
            <div className="rounded-md border border-[var(--st-border)] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Sender type">
                  <Select value={senderType} onValueChange={(v: string) => setSenderType(v as typeof senderType)}>
                    <SelectTrigger className="w-full" aria-label="Sender type">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alphanumeric">Alphanumeric sender ID</SelectItem>
                      <SelectItem value="longcode">Long code (number)</SelectItem>
                      <SelectItem value="shortcode">Short code</SelectItem>
                      <SelectItem value="tollfree">Toll-free</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Country (optional)">
                  <Input
                    value={senderCountry}
                    onChange={(e) => setSenderCountry(e.target.value.toUpperCase())}
                    placeholder="e.g. IN, US"
                    maxLength={2}
                  />
                </Field>
              </div>
              <Field
                label={senderType === "alphanumeric" ? "Sender ID" : "Number (E.164)"}
                className="mt-3"
              >
                <Input
                  value={senderValue}
                  onChange={(e) => setSenderValue(e.target.value)}
                  placeholder={senderType === "alphanumeric" ? "e.g. ACME" : "e.g. +14155550123"}
                />
              </Field>
              <div className="mt-3">
                <Button variant="primary" size="sm" loading={busy} onClick={() => void saveSender()}>
                  Add sender
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-4 space-y-4">
            {region === "IN" && (
              <>
                <p className="text-sm text-[var(--st-text-secondary)]">
                  India requires TRAI DLT registration. Enter your Principal
                  Entity ID (and optionally a registered Header / Sender ID).
                </p>
                <Field label="DLT Principal Entity ID">
                  <Input value={dltEntityId} onChange={(e) => setDltEntityId(e.target.value)} />
                </Field>
                <Field label="DLT Header / Sender ID (optional)">
                  <Input value={dltHeaderId} onChange={(e) => setDltHeaderId(e.target.value)} />
                </Field>
              </>
            )}
            {region === "US" && (
              <>
                <p className="text-sm text-[var(--st-text-secondary)]">
                  US A2P traffic requires 10DLC registration. Enter your Brand
                  ID (and optionally a Campaign ID).
                </p>
                <Field label="10DLC Brand ID">
                  <Input value={tenDlcBrandId} onChange={(e) => setTenDlcBrandId(e.target.value)} />
                </Field>
                <Field label="10DLC Campaign ID (optional)">
                  <Input value={tenDlcCampaignId} onChange={(e) => setTenDlcCampaignId(e.target.value)} />
                </Field>
              </>
            )}
            {region === "OTHER" && (
              <>
                <p className="text-sm text-[var(--st-text-secondary)]">
                  Confirm your messaging complies with local regulations before
                  you send.
                </p>
                <Checkbox
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  label="Every recipient has opted in, and messages include a valid sender ID and opt-out instructions where required."
                />
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-[var(--st-text-secondary)]">
              Review your setup. You can change any of this later from Settings,
              Providers, Numbers, and Compliance.
            </p>
            <ReviewRow label="Business" value={state.businessName ?? "—"} />
            <ReviewRow label="Region" value={state.region ?? "—"} />
            <ReviewRow label="Providers" value={`${state.providerCount} connected`} />
            <ReviewRow label="Senders" value={`${state.senderCount} added`} />
            <ReviewRow
              label="Compliance"
              value={state.steps.compliance ? "Registered" : "Incomplete"}
            />
          </div>
        )}

          </motion.div>
        </AnimatePresence>

        {/* ── Footer ── */}
        <div className="mt-6 flex items-center justify-between border-t border-[var(--st-border)] pt-4">
          <Button
            variant="outline"
            size="sm"
            iconLeft={ArrowLeft}
            disabled={busy || step === 0}
            onClick={() => {
              setDir(-1);
              setStep((s) => Math.max(0, s - 1));
            }}
          >
            Back
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconRight={step === STEPS.length - 1 ? undefined : ArrowRight}
            loading={busy}
            disabled={busy || !canContinue()}
            onClick={() => void onContinue()}
          >
            {step === STEPS.length - 1 ? "Finish setup" : "Continue"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] px-3 py-2">
      <span className="text-[var(--st-text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--st-text)]">{value}</span>
    </div>
  );
}
