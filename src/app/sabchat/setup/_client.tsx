"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Inbox as InboxIcon,
  CheckCheck,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";
import { SabFileUrlInput } from "@/components/sabfiles";
import { useProject } from "@/context/project-context";
import {
  completeSabchatSetup,
  createSabchatInboxStep,
  getSabchatSetupState,
  saveSabchatProfileStep,
  type SabchatSetupState,
} from "@/app/actions/sabchat-projects.actions";

const STEPS = [
  { id: "profile", title: "Brand profile", icon: Building2 },
  { id: "inbox", title: "First inbox", icon: InboxIcon },
  { id: "review", title: "Review", icon: CheckCircle2 },
] as const;

const DEFAULT_BRAND = "#536CDD";

export function SabchatSetupClient({
  projectId,
  initial,
}: {
  projectId: string;
  initial: SabchatSetupState;
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
    if (!initial.steps.profile) return 0;
    if (!initial.steps.inbox) return 1;
    return 2;
  });
  const [state, setState] = React.useState<SabchatSetupState>(initial);
  const [busy, setBusy] = React.useState(false);
  const [finishing, setFinishing] = React.useState(false);

  const refreshState = React.useCallback(async () => {
    const s = await getSabchatSetupState(projectId);
    if (s) setState(s);
  }, [projectId]);

  /* ── step 0 — profile ──────────────────────────────────────────────── */
  const [businessName, setBusinessName] = React.useState(
    initial.businessName ?? "",
  );
  const [logoUrl, setLogoUrl] = React.useState(initial.logoUrl ?? "");
  const [brandColor, setBrandColor] = React.useState(
    initial.brandColor ?? DEFAULT_BRAND,
  );
  const [website, setWebsite] = React.useState(
    initial.businessProfile?.website ?? "",
  );
  const [industry, setIndustry] = React.useState(
    initial.businessProfile?.industry ?? "",
  );
  const [useCase, setUseCase] = React.useState(
    initial.businessProfile?.useCase ?? "",
  );

  const saveProfile = async () => {
    setBusy(true);
    const res = await saveSabchatProfileStep(projectId, {
      businessName,
      logoUrl,
      brandColor,
      businessProfile: { website, industry, useCase },
    });
    setBusy(false);
    if (!res.success) {
      toast({
        title: "Could not save",
        description: res.error,
        variant: "destructive",
      });
      return false;
    }
    await refreshState();
    return true;
  };

  /* ── step 1 — first inbox ──────────────────────────────────────────── */
  const [inboxName, setInboxName] = React.useState("Website");

  const createInbox = async () => {
    setBusy(true);
    const res = await createSabchatInboxStep(projectId, {
      inboxName,
      brandColor,
    });
    setBusy(false);
    if (!res.success) {
      toast({
        title: "Could not create inbox",
        description: res.error,
        variant: "destructive",
      });
      return;
    }
    await refreshState();
    if (res.engineOffline) {
      toast({
        title: "Engine offline — saved for later",
        description:
          "Your brand is saved. The inbox will be created when the engine is reachable; you can finish setup now.",
      });
    } else {
      toast({ title: "Inbox created" });
    }
  };

  /* ── finish ────────────────────────────────────────────────────────── */
  const finish = async () => {
    setBusy(true);
    setFinishing(true);
    const res = await completeSabchatSetup(projectId);
    if (!res.success) {
      setFinishing(false);
      setBusy(false);
      toast({
        title: "Setup not complete",
        description: res.error,
        variant: "destructive",
      });
      return;
    }
    router.push("/sabchat/inbox");
  };

  const canContinue = (): boolean => {
    switch (step) {
      case 0:
        return businessName.trim().length > 0;
      default:
        return true;
    }
  };

  const onContinue = async () => {
    if (step === 0) {
      if (await saveProfile()) setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
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
          Finish setup to go live
        </h1>
        <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
          A couple of one-time steps per project: your brand, and a first
          inbox for website conversations.
        </p>
      </header>

      {/* Step indicator */}
      <ol
        className="mb-6 flex flex-wrap items-center gap-2"
        aria-label="Setup steps"
      >
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
                {done ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden />
                )}
              </span>
              <span
                className={`hidden text-xs sm:inline ${
                  active
                    ? "font-medium text-[var(--st-text)]"
                    : "text-[var(--st-text-secondary)]"
                }`}
              >
                {s.title}
              </span>
              {i < STEPS.length - 1 ? (
                <span
                  className="mx-1 hidden h-px w-6 bg-[var(--st-border)] sm:inline-block"
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <Card className="relative p-6">
        <h2 className="mb-1 text-base font-semibold text-[var(--st-text)]">
          {Current.title}
        </h2>

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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand logo (optional)">
                <SabFileUrlInput
                  accept="image"
                  value={logoUrl}
                  onChange={(v) => setLogoUrl(v)}
                  placeholder="Pick or upload a logo"
                  pickerTitle="Pick a brand logo"
                />
              </Field>
              <Field label="Brand colour">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Brand colour"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-[var(--st-border)] bg-transparent p-1"
                  />
                  <Input
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    placeholder="#536CDD"
                    maxLength={9}
                  />
                </div>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Website (optional)">
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                />
              </Field>
              <Field label="Industry (optional)">
                <Input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. SaaS"
                />
              </Field>
            </div>
            <Field label="Primary use case (optional)">
              <Textarea
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="e.g. Pre-sales questions and customer support for our store."
                rows={2}
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-[var(--st-text-secondary)]">
              Create your first inbox — where website conversations from the
              chat widget will land. You can add more channels (email,
              WhatsApp, social) later.
            </p>
            {state.inboxCount > 0 ? (
              <Badge variant="default" className="gap-1">
                <CheckCheck className="h-3 w-3" aria-hidden /> {state.inboxCount}{" "}
                inbox{state.inboxCount === 1 ? "" : "es"} ready
              </Badge>
            ) : null}
            <div className="rounded-md border border-[var(--st-border)] p-4">
              <Field label="Inbox name">
                <Input
                  value={inboxName}
                  onChange={(e) => setInboxName(e.target.value)}
                  placeholder="Website"
                  maxLength={80}
                />
              </Field>
              <div className="mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={InboxIcon}
                  loading={busy}
                  onClick={() => void createInbox()}
                >
                  Create inbox
                </Button>
              </div>
            </div>
            <p className="text-xs text-[var(--st-text-secondary)]">
              Optional — you can skip this and create inboxes later from the
              admin area.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-[var(--st-text-secondary)]">
              Review your setup. You can change any of this later from Settings
              and the Widget Studio.
            </p>
            <ReviewRow label="Brand" value={state.businessName ?? "—"} />
            <ReviewRow
              label="Brand colour"
              value={state.brandColor ?? DEFAULT_BRAND}
            />
            <ReviewRow
              label="Inboxes"
              value={
                state.inboxCount > 0
                  ? `${state.inboxCount} ready`
                  : state.engineOffline
                    ? "Pending (engine offline)"
                    : "None yet"
              }
            />
          </div>
        )}

        {/* ── Footer ── */}
        <div className="mt-6 flex items-center justify-between border-t border-[var(--st-border)] pt-4">
          <Button
            variant="outline"
            size="sm"
            iconLeft={ArrowLeft}
            disabled={busy || step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconRight={step === STEPS.length - 1 ? undefined : ArrowRight}
            loading={busy || finishing}
            disabled={busy || finishing || !canContinue()}
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
