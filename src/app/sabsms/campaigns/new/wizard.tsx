"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Input, Kbd, Label, Separator } from '@/components/sabcrm/20ui/compat';
import { SabsmsKbdHint } from "@/components/sabsms/page-toolkit";

import {
  abortDraft,
  launchCampaign,
  saveDraft,
  testSend,
} from "./actions";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  const [steps, setSteps] = React.useState(WIZARD_STEPS);
  const [busy, setBusy] = React.useState<null | "save" | "launch" | "test" | "abort">(null);
  const [banner, setBanner] = React.useState<
    | { kind: "ok"; message: string }
    | { kind: "err"; message: string; issues?: string[] }
    | null
  >(null);
  const [testTo, setTestTo] = React.useState("");

  const stepIndex = steps.findIndex((s) => s.id === stepId);

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
      const i = steps.findIndex((s) => s.id === cur);
      return i > 0 ? steps[i - 1]!.id : cur;
    });
  }, [steps]);
  const goNext = React.useCallback(() => {
    setStepId((cur) => {
      const i = steps.findIndex((s) => s.id === cur);
      return i < steps.length - 1 ? steps[i + 1]!.id : cur;
    });
  }, [steps]);

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
      <Stepper stepId={stepId} steps={steps} setSteps={setSteps} onJump={goTo} />

      {banner && (
        <div
          className={`rounded border p-3 text-sm ${
            banner.kind === "ok"
              ? "border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]"
              : "border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]"
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

      <Card>
        <CardBody className="pt-6">
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
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test send</CardTitle>
          <CardDescription>
            Push one interpolated message to a real recipient or your sandbox
            number before launching the full audience.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="test-to">Recipient (E.164)</Label>
              <Input
                id="test-to"
                placeholder="+15551234567"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleTestSend}
              disabled={busy === "test" || !draft.templateId || !testTo}
            >
              {busy === "test" ? "Sending…" : "Send test"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={goPrev}
            disabled={stepIndex === 0}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={goNext}
            disabled={stepIndex === steps.length - 1}
          >
            Next
          </Button>
          <span className="text-xs text-[var(--st-text)]">
            <Kbd>⌘</Kbd>
            <Kbd>←</Kbd> /
            <Kbd>⌘</Kbd>
            <Kbd>→</Kbd> to navigate
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
            <Badge variant="outline">draft: {draft.id}</Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={handleAbort}
            disabled={busy === "abort"}
          >
            {busy === "abort" ? "Aborting…" : "Abort"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={busy === "save"}
          >
            {busy === "save" ? "Saving…" : "Save draft"}
          </Button>
          <Button
            type="button"
            onClick={handleLaunch}
            disabled={busy === "launch" || issues.length > 0}
          >
            {busy === "launch"
              ? "Launching…"
              : draft.schedule?.kind === "immediate" || !draft.schedule
                ? "Launch"
                : "Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface StepperProps {
  stepId: WizardStepId;
  steps: typeof WIZARD_STEPS;
  setSteps: React.Dispatch<React.SetStateAction<typeof WIZARD_STEPS>>;
  onJump: (id: WizardStepId) => void;
}

function SortableStep({
  s,
  active,
  onJump,
}: {
  s: (typeof WIZARD_STEPS)[0];
  active: boolean;
  onJump: (id: WizardStepId) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: s.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex items-center gap-2">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onJump(s.id);
        }}
        className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm transition ${
          active
            ? "border-[var(--st-border)] bg-[var(--st-text)] text-white"
            : "border-[var(--st-border)] bg-white text-[var(--st-text)] hover:border-[var(--st-border)]"
        } cursor-grab active:cursor-grabbing`}
        aria-current={active ? "step" : undefined}
      >
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
            active ? "bg-white text-[var(--st-text)]" : "bg-[var(--st-bg-muted)] text-[var(--st-text)]"
          }`}
        >
          {s.index}
        </span>
        <span>{s.label}</span>
        {active && (
          <Badge variant="secondary" className="ml-1 text-[10px]">
            current
          </Badge>
        )}
      </button>
    </div>
  );
}

function Stepper({ stepId, steps, setSteps, onJump }: StepperProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  return (
    <nav aria-label="Wizard steps">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={steps.map((s) => s.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex flex-wrap items-center gap-2">
            {steps.map((s, i) => {
              const isActive = s.id === stepId;
              return (
                <React.Fragment key={s.id}>
                  {i > 0 && (
                    <span aria-hidden className="h-px w-6 bg-[var(--st-bg-muted)]" />
                  )}
                  <SortableStep s={s} active={isActive} onJump={onJump} />
                </React.Fragment>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </nav>
  );
}
