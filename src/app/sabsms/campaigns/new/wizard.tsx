"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  ZoruKbd,
  Label,
  Separator,
} from "@/components/zoruui";
import { SabsmsKbdHint } from "@/components/sabsms/page-toolkit";

import {
  abortDraft,
  launchCampaign,
  saveDraft,
  testSend,
} from "./actions";
import { StepAudience, type ContactOption, type SegmentOption } from "./steps/step-audience";
import { StepCompliance } from "./steps/step-compliance";
import { StepReview } from "./steps/step-review";
import { StepSchedule } from "./steps/step-schedule";
import { StepSender, type SenderNumberOption } from "./steps/step-sender";
import { StepTemplate, type TemplateOption } from "./steps/step-template";
import { StepThrottle } from "./steps/step-throttle";
import {
  WIZARD_STEPS,
  makeEmptyDraft,
  validateDraftForLaunch,
  type CampaignDraft,
  type WizardStepId,
} from "./types";

export interface CampaignWizardProps {
  workspaceId: string;
  initialDraft?: CampaignDraft;
  templates: TemplateOption[];
  segments: SegmentOption[];
  contacts: ContactOption[];
  numbers: SenderNumberOption[];
  drips: { id: string; name: string }[];
}

const AUTOSAVE_DEBOUNCE_MS = 1000;

function lsKey(workspaceId: string) {
  return `sabsms:campaign-draft:${workspaceId}`;
}

export function CampaignWizard({
  workspaceId,
  initialDraft,
  templates,
  segments,
  contacts,
  numbers,
  drips,
}: CampaignWizardProps) {
  const router = useRouter();

  const [draft, setDraft] = React.useState<CampaignDraft>(() => {
    if (initialDraft) return initialDraft;
    // Try restoring from localStorage on first mount.
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(lsKey(workspaceId));
        if (raw) {
          const parsed = JSON.parse(raw) as CampaignDraft;
          // Sanity-check workspace match before restoring.
          if (parsed.workspaceId === workspaceId) return parsed;
        }
      } catch {
        /* ignore */
      }
    }
    return makeEmptyDraft(workspaceId);
  });

  const [stepId, setStepId] = React.useState<WizardStepId>("template");
  const [busy, setBusy] = React.useState<null | "save" | "launch" | "test" | "abort">(null);
  const [banner, setBanner] = React.useState<
    | { kind: "ok"; message: string }
    | { kind: "err"; message: string; issues?: string[] }
    | null
  >(null);
  const [testTo, setTestTo] = React.useState("");

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === stepId);

  function patchDraft(patch: Partial<CampaignDraft>) {
    setDraft((d) => ({ ...d, ...patch, updatedAt: new Date().toISOString() }));
  }

  // Debounced localStorage autosave.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(lsKey(workspaceId), JSON.stringify(draft));
      } catch {
        /* ignore quota errors */
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draft, workspaceId]);

  // Cmd/Ctrl-Arrow keyboard step nav.
  const goTo = React.useCallback((next: WizardStepId) => {
    setBanner(null);
    setStepId(next);
  }, []);

  const goPrev = React.useCallback(() => {
    setStepId((cur) => {
      const i = WIZARD_STEPS.findIndex((s) => s.id === cur);
      return i > 0 ? WIZARD_STEPS[i - 1]!.id : cur;
    });
  }, []);
  const goNext = React.useCallback(() => {
    setStepId((cur) => {
      const i = WIZARD_STEPS.findIndex((s) => s.id === cur);
      return i < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[i + 1]!.id : cur;
    });
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inField =
        (e.target as HTMLElement | null)?.tagName === "INPUT" ||
        (e.target as HTMLElement | null)?.tagName === "TEXTAREA" ||
        (e.target as HTMLElement | null)?.isContentEditable;
      if (inField) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  const selectedTemplate = React.useMemo(
    () => templates.find((t) => t.id === draft.templateId),
    [templates, draft.templateId],
  );
  const templateBody =
    selectedTemplate?.bodies.find((b) => b.locale === draft.templateLocale)
      ?.body ?? selectedTemplate?.bodies[0]?.body ?? "";

  const issues = validateDraftForLaunch(draft);

  async function handleSaveDraft() {
    setBusy("save");
    setBanner(null);
    const res = await saveDraft(draft);
    setBusy(null);
    if (!res.ok) {
      setBanner({ kind: "err", message: res.error });
      return;
    }
    setDraft((d) => ({ ...d, id: res.id }));
    setBanner({ kind: "ok", message: `Draft saved (${res.id}).` });
  }

  async function handleLaunch() {
    setBusy("launch");
    setBanner(null);
    const res = await launchCampaign(draft);
    setBusy(null);
    if (!res.ok) {
      setBanner({
        kind: "err",
        message: res.error,
        issues: "issues" in res ? res.issues : undefined,
      });
      return;
    }
    // Drop the localStorage draft on successful launch.
    try {
      window.localStorage.removeItem(lsKey(workspaceId));
    } catch {
      /* ignore */
    }
    setBanner({
      kind: "ok",
      message: res.scheduled
        ? `Campaign ${res.id} scheduled.`
        : `Campaign ${res.id} running.`,
    });
    router.push(`/sabsms/campaigns/${res.id}`);
  }

  async function handleTestSend() {
    if (!testTo) {
      setBanner({ kind: "err", message: "Enter a test recipient." });
      return;
    }
    setBusy("test");
    setBanner(null);
    const res = await testSend({ draft, to: testTo });
    setBusy(null);
    if (!res.ok) {
      setBanner({ kind: "err", message: res.error });
      return;
    }
    setBanner({
      kind: "ok",
      message: `Test send queued: ${res.id} (${res.status}).`,
    });
  }

  async function handleAbort() {
    if (!draft.id) {
      try {
        window.localStorage.removeItem(lsKey(workspaceId));
      } catch {
        /* ignore */
      }
      setDraft(makeEmptyDraft(workspaceId));
      setBanner({ kind: "ok", message: "Local draft cleared." });
      return;
    }
    setBusy("abort");
    const res = await abortDraft(draft.id);
    setBusy(null);
    if (!res.ok) {
      setBanner({ kind: "err", message: res.error });
      return;
    }
    try {
      window.localStorage.removeItem(lsKey(workspaceId));
    } catch {
      /* ignore */
    }
    setDraft(makeEmptyDraft(workspaceId));
    setBanner({ kind: "ok", message: "Draft aborted." });
  }

  return (
    <div className="space-y-5">
      <Stepper stepId={stepId} onJump={goTo} />

      {banner && (
        <div
          className={`rounded border p-3 text-sm ${
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <div>{banner.message}</div>
          {banner.kind === "err" && banner.issues && (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {banner.issues.map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ZoruCard>
        <ZoruCardContent className="pt-6">
          {stepId === "template" && (
            <StepTemplate
              draft={draft}
              templates={templates}
              onChange={patchDraft}
            />
          )}
          {stepId === "audience" && (
            <StepAudience
              draft={draft}
              segments={segments}
              contacts={contacts}
              onChange={patchDraft}
            />
          )}
          {stepId === "sender" && (
            <StepSender
              draft={draft}
              numbers={numbers}
              onChange={patchDraft}
            />
          )}
          {stepId === "schedule" && (
            <StepSchedule draft={draft} drips={drips} onChange={patchDraft} />
          )}
          {stepId === "throttle" && (
            <StepThrottle draft={draft} onChange={patchDraft} />
          )}
          {stepId === "compliance" && (
            <StepCompliance
              draft={draft}
              templateBody={templateBody}
              templateVariables={selectedTemplate?.variables ?? []}
              onChange={patchDraft}
            />
          )}
          {stepId === "review" && (
            <StepReview
              draft={draft}
              templateName={selectedTemplate?.name}
              issues={issues}
              onJump={goTo}
            />
          )}
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">Test send</ZoruCardTitle>
          <ZoruCardDescription>
            Push one interpolated message to a real recipient or your sandbox
            number before launching the full audience.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 space-y-1">
              <ZoruLabel htmlFor="test-to">Recipient (E.164)</ZoruLabel>
              <ZoruInput
                id="test-to"
                placeholder="+15551234567"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
            </div>
            <ZoruButton
              type="button"
              variant="outline"
              onClick={handleTestSend}
              disabled={busy === "test" || !draft.templateId || !testTo}
            >
              {busy === "test" ? "Sending…" : "Send test"}
            </ZoruButton>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruSeparator />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ZoruButton
            type="button"
            variant="outline"
            onClick={goPrev}
            disabled={stepIndex === 0}
          >
            Back
          </ZoruButton>
          <ZoruButton
            type="button"
            variant="outline"
            onClick={goNext}
            disabled={stepIndex === WIZARD_STEPS.length - 1}
          >
            Next
          </ZoruButton>
          <span className="text-xs text-slate-500">
            <ZoruKbd>⌘</ZoruKbd>
            <ZoruKbd>←</ZoruKbd> /
            <ZoruKbd>⌘</ZoruKbd>
            <ZoruKbd>→</ZoruKbd> to navigate
          </span>
          <SabsmsKbdHint
            shortcuts={[
              { keys: ["⌘", "←"], description: "Previous step" },
              { keys: ["⌘", "→"], description: "Next step" },
              { keys: ["?"], description: "Show shortcuts" },
            ]}
            triggerLabel="Shortcuts"
          />
        </div>
        <div className="flex items-center gap-2">
          {draft.id && (
            <ZoruBadge variant="outline">draft: {draft.id}</ZoruBadge>
          )}
          <ZoruButton
            type="button"
            variant="ghost"
            onClick={handleAbort}
            disabled={busy === "abort"}
          >
            {busy === "abort" ? "Aborting…" : "Abort"}
          </ZoruButton>
          <ZoruButton
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={busy === "save"}
          >
            {busy === "save" ? "Saving…" : "Save draft"}
          </ZoruButton>
          <ZoruButton
            type="button"
            onClick={handleLaunch}
            disabled={busy === "launch" || issues.length > 0}
          >
            {busy === "launch"
              ? "Launching…"
              : draft.schedule?.kind === "immediate" || !draft.schedule
                ? "Launch"
                : "Schedule"}
          </ZoruButton>
        </div>
      </div>
    </div>
  );
}

interface StepperProps {
  stepId: WizardStepId;
  onJump: (id: WizardStepId) => void;
}

function Stepper({ stepId, onJump }: StepperProps) {
  return (
    <nav
      aria-label="Wizard steps"
      className="flex flex-wrap items-center gap-2"
    >
      {WIZARD_STEPS.map((s, i) => {
        const active = s.id === stepId;
        return (
          <React.Fragment key={s.id}>
            {i > 0 && (
              <span
                aria-hidden
                className="h-px w-6 bg-slate-300"
              />
            )}
            <button
              type="button"
              onClick={() => onJump(s.id)}
              className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
              }`}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  active
                    ? "bg-white text-slate-900"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {s.index}
              </span>
              <span>{s.label}</span>
              {active && (
                <ZoruBadge variant="secondary" className="ml-1 text-[10px]">
                  current
                </ZoruBadge>
              )}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
