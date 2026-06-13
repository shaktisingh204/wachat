"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Building2,
  Check,
  CheckCircle2,
  Mail,
  Trash2,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
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
  completeSabmailSetup,
  deleteSabmailAccount,
  saveSabmailProfileStep,
  type SabmailAccountRow,
  type SabmailIntent,
  type SabmailRegion,
  type SabmailSetupState,
} from "@/app/actions/sabmail-projects.actions";

import { MailboxConnectForm } from "../_components/mailbox-connect-form";
import { SuccessCheck } from "@/components/sabmail/motion";

const STEPS = [
  { id: "profile", title: "Profile", icon: Building2 },
  { id: "connection", title: "Connect a mailbox", icon: AtSign },
  { id: "review", title: "Review", icon: CheckCircle2 },
] as const;

const INTENTS: { value: SabmailIntent; label: string; hint: string }[] = [
  { value: "personal", label: "Personal inbox", hint: "Triage & reply to your own mail" },
  { value: "team", label: "Team inbox", hint: "Shared inbox for a team" },
  { value: "platform", label: "Sending platform", hint: "Transactional + marketing email" },
];

const REGIONS: { value: SabmailRegion; label: string }[] = [
  { value: "IN", label: "India" },
  { value: "US", label: "United States" },
  { value: "OTHER", label: "Other / Global" },
];

export function SabmailSetupClient({
  projectId,
  initial,
  initialAccounts,
}: {
  projectId: string;
  initial: SabmailSetupState;
  initialAccounts: SabmailAccountRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { setActiveProjectId } = useProject();

  React.useEffect(() => {
    try {
      setActiveProjectId(projectId);
    } catch {
      /* localStorage may be unavailable */
    }
  }, [projectId, setActiveProjectId]);

  const [step, setStep] = React.useState(() => {
    if (!initial.steps.profile) return 0;
    if (!initial.steps.connection) return 1;
    return 2;
  });

  // Profile form state.
  const [businessName, setBusinessName] = React.useState(initial.businessName ?? "");
  const [intent, setIntent] = React.useState<SabmailIntent | "">(initial.intent ?? "");
  const [region, setRegion] = React.useState<SabmailRegion | "">(initial.region ?? "");
  const [website, setWebsite] = React.useState(initial.businessProfile?.website ?? "");
  const [useCase, setUseCase] = React.useState(initial.businessProfile?.useCase ?? "");
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profileErr, setProfileErr] = React.useState<string | null>(null);

  const [accounts, setAccounts] = React.useState<SabmailAccountRow[]>(initialAccounts);
  const [finishing, setFinishing] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const reduce = useReducedMotion();

  const profileDone =
    !!businessName.trim() && intent !== "" && region !== "";
  const connectionDone = accounts.length > 0;

  const saveProfile = React.useCallback(async () => {
    setProfileErr(null);
    if (!profileDone) {
      setProfileErr("Fill in name, usage and region.");
      return;
    }
    setSavingProfile(true);
    const res = await saveSabmailProfileStep(projectId, {
      businessName: businessName.trim(),
      intent: intent as SabmailIntent,
      region: region as SabmailRegion,
      businessProfile: { website: website.trim() || undefined, useCase: useCase.trim() || undefined },
    });
    setSavingProfile(false);
    if (!res.success) {
      setProfileErr(res.error);
      return;
    }
    setStep(1);
  }, [profileDone, projectId, businessName, intent, region, website, useCase]);

  const removeAccount = React.useCallback(
    async (id: string) => {
      const res = await deleteSabmailAccount(id);
      if (!res.success) {
        toast({ title: "Could not remove mailbox", description: res.error, variant: "destructive" });
        return;
      }
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    },
    [toast],
  );

  const finish = React.useCallback(async () => {
    setFinishing(true);
    const res = await completeSabmailSetup(projectId);
    if (!res.success) {
      setFinishing(false);
      toast({ title: "Setup incomplete", description: res.error, variant: "destructive" });
      return;
    }
    setDone(true);
    window.setTimeout(() => router.push("/sabmail"), 1100);
  }, [projectId, router, toast]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-2 flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
        <Mail className="h-4 w-4" aria-hidden />
        <span>{initial.name}</span>
      </div>
      <h1 className="text-2xl font-semibold text-[var(--st-text)]">Set up SabMail</h1>
      <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
        A couple of quick steps and your inbox unlocks.
      </p>

      {/* Stepper */}
      <ol className="mt-6 flex items-center gap-2">
        {STEPS.map((s, i) => {
          const StepIcon = s.icon;
          const done = (i === 0 && profileDone) || (i === 1 && connectionDone);
          const current = i === step;
          return (
            <li key={s.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(i)}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  current
                    ? "bg-[var(--st-bg-muted)] font-medium text-[var(--st-text)]"
                    : "text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                }`}
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full border text-xs ${
                    done
                      ? "border-transparent bg-[var(--st-status-ok,#16a34a)] text-white"
                      : current
                        ? "border-[var(--st-text)] text-[var(--st-text)]"
                        : "border-[var(--st-border)] text-[var(--st-text-secondary)]"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <StepIcon className="h-3.5 w-3.5" aria-hidden />}
                </span>
                <span className="hidden sm:inline">{s.title}</span>
              </button>
              {i < STEPS.length - 1 ? (
                <span className="h-px flex-1 bg-[var(--st-border)]" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      <Card className="mt-6 overflow-hidden p-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 14 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
        {step === 0 ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--st-text)]">Profile</h2>
              <p className="text-sm text-[var(--st-text-secondary)]">
                How this workspace presents itself and which compliance track applies.
              </p>
            </div>
            <Field label="Display / business name" error={profileErr ?? undefined}>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Acme Support"
                maxLength={120}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="How will you use SabMail?">
                <Select value={intent} onValueChange={(v) => setIntent(v as SabmailIntent)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENTS.map((it) => (
                      <SelectItem key={it.value} value={it.value}>
                        {it.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Region">
                <Select value={region} onValueChange={(v) => setRegion(v as SabmailRegion)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Website (optional)">
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" />
            </Field>
            <Field label="What will you send / receive? (optional)">
              <Textarea
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="e.g. customer support replies and weekly newsletters"
                rows={3}
              />
            </Field>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" iconRight={ArrowRight} loading={savingProfile} onClick={() => void saveProfile()}>
                Save & continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-semibold text-[var(--st-text)]">Connect a mailbox</h2>
              <p className="text-sm text-[var(--st-text-secondary)]">
                Connect at least one mailbox over IMAP/SMTP. We verify it live before saving.
              </p>
            </div>

            {accounts.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {accounts.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-[var(--st-border)] px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <AtSign className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" aria-hidden />
                      <span className="truncate text-sm text-[var(--st-text)]">{a.email}</span>
                      <Badge variant={a.status === "active" ? "default" : "outline"} className="shrink-0 capitalize">
                        {a.status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={Trash2}
                      onClick={() => void removeAccount(a.id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            <MailboxConnectForm
              projectId={projectId}
              onConnected={(acct) => setAccounts((prev) => [acct, ...prev.filter((p) => p.id !== acct.id)])}
            />

            <div className="flex justify-between">
              <Button variant="outline" size="sm" iconLeft={ArrowLeft} onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                iconRight={ArrowRight}
                disabled={!connectionDone}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-semibold text-[var(--st-text)]">Review</h2>
              <p className="text-sm text-[var(--st-text-secondary)]">
                Everything looks good? Finish to open your inbox.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-[var(--st-border)] p-3">
                <dt className="text-xs text-[var(--st-text-secondary)]">Workspace</dt>
                <dd className="text-sm font-medium text-[var(--st-text)]">{initial.name}</dd>
              </div>
              <div className="rounded-md border border-[var(--st-border)] p-3">
                <dt className="text-xs text-[var(--st-text-secondary)]">Usage</dt>
                <dd className="text-sm font-medium capitalize text-[var(--st-text)]">{intent || "—"}</dd>
              </div>
              <div className="rounded-md border border-[var(--st-border)] p-3">
                <dt className="text-xs text-[var(--st-text-secondary)]">Profile</dt>
                <dd className="text-sm font-medium text-[var(--st-text)]">
                  {profileDone ? "Complete" : "Incomplete"}
                </dd>
              </div>
              <div className="rounded-md border border-[var(--st-border)] p-3">
                <dt className="text-xs text-[var(--st-text-secondary)]">Connected mailboxes</dt>
                <dd className="text-sm font-medium text-[var(--st-text)]">{accounts.length}</dd>
              </div>
            </dl>
            <div className="flex justify-between">
              <Button variant="outline" size="sm" iconLeft={ArrowLeft} onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                iconRight={CheckCircle2}
                loading={finishing}
                disabled={!profileDone || !connectionDone}
                onClick={() => void finish()}
              >
                Finish setup
              </Button>
            </div>
          </div>
        ) : null}
          </motion.div>
        </AnimatePresence>
      </Card>

      <AnimatePresence>
        {done ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--st-bg)_80%,transparent)] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <SuccessCheck size={64} />
              <p className="text-base font-semibold text-[var(--st-text)]">SabMail is ready</p>
              <p className="text-sm text-[var(--st-text-secondary)]">Opening your inbox…</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
