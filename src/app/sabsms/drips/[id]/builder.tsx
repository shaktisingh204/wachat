"use client";

/**
 * Journey builder — linear-with-branches editor (V2.9).
 *
 * A deliberately simple vertical step list (no SabFlow canvas): add-step
 * menu between cards, per-step config, live validation, trigger / exit
 * rules / goal / A/B threshold settings, and the lifecycle controls
 * (save draft, activate, pause, archive, test enrol).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ChevronDown,
  CircleCheck,
  PauseCircle,
  PlayCircle,
  Plus,
  Save,
  TriangleAlert,
  UserPlus,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  SelectField,
  Switch,
  useToast,
} from "@/components/sabcrm/20ui";
import type { JourneyStep } from "@/lib/sabsms/journeys/types";

import {
  activateJourney,
  archiveJourney,
  pauseJourney,
  saveJourneyDraft,
  testEnrolJourney,
  type JourneyDetail,
  type TemplateOption,
} from "./actions";
import { STEP_KIND_META, StepNode } from "./step-node";
import { validateJourney, type JourneyDraft } from "./validate";

let stepCounter = 0;
function newStepId(kind: string): string {
  stepCounter += 1;
  return `${kind}_${Date.now().toString(36)}_${stepCounter}`;
}

function blankStep(kind: JourneyStep["kind"]): JourneyStep {
  const id = newStepId(kind);
  switch (kind) {
    case "send":
      return { id, kind: "send", templateId: "" };
    case "wait":
      return { id, kind: "wait", durationMs: 24 * 3_600_000 };
    case "waitUntil":
      return { id, kind: "waitUntil", event: "replied", timeoutMs: 24 * 3_600_000 };
    case "branch":
      return {
        id,
        kind: "branch",
        condition: { field: "", op: "eq", value: "" },
        trueStepId: "",
        falseStepId: "",
      };
    case "exit":
      return { id, kind: "exit" };
  }
}

const STATUS_BADGE: Record<string, { label: string; variant?: "secondary" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  active: { label: "Active" },
  paused: { label: "Paused", variant: "outline" },
  archived: { label: "Archived", variant: "secondary" },
};

export interface JourneyBuilderProps {
  /** null → creating a new journey. */
  journey: JourneyDetail | null;
  templates: TemplateOption[];
}

export function JourneyBuilder({ journey, templates }: JourneyBuilderProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [draft, setDraft] = React.useState<JourneyDraft>(
    journey?.draft ?? {
      name: "",
      trigger: { kind: "manual" },
      steps: [blankStep("send")],
      exitRules: { onUnsubscribe: true },
    },
  );
  const [dirty, setDirty] = React.useState(journey === null);
  const [busy, setBusy] = React.useState(false);
  const [enrolOpen, setEnrolOpen] = React.useState(false);
  const [enrolPhone, setEnrolPhone] = React.useState("");

  const validation = React.useMemo(() => validateJourney(draft), [draft]);
  const status = journey?.status ?? "draft";

  const update = (next: Partial<JourneyDraft>) => {
    setDraft((d) => ({ ...d, ...next }));
    setDirty(true);
  };

  const updateStep = (index: number, step: JourneyStep) => {
    update({ steps: draft.steps.map((s, i) => (i === index ? step : s)) });
  };

  const insertStep = (kind: JourneyStep["kind"], at: number) => {
    const steps = [...draft.steps];
    steps.splice(at, 0, blankStep(kind));
    update({ steps });
  };

  const removeStep = (index: number) => {
    update({ steps: draft.steps.filter((_, i) => i !== index) });
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    update({ steps });
  };

  const save = async (): Promise<string | null> => {
    setBusy(true);
    const res = await saveJourneyDraft(journey?.id ?? null, draft);
    setBusy(false);
    if (!res.ok) {
      toast({ title: "Save failed", description: res.error, variant: "destructive" });
      return null;
    }
    setDirty(false);
    if (!journey) {
      router.replace(`/sabsms/drips/${res.id}`);
    } else {
      router.refresh();
    }
    toast({ title: "Draft saved" });
    return res.id;
  };

  const activate = async () => {
    if (!validation.ok) {
      toast({
        title: "Fix validation errors first",
        description: validation.errors[0],
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    const id = dirty || !journey ? await save() : journey.id;
    if (!id) {
      setBusy(false);
      return;
    }
    const res = await activateJourney(id);
    setBusy(false);
    if (res.ok) {
      toast({ title: "Journey activated" });
      router.refresh();
    } else {
      toast({
        title: "Activation refused",
        description: res.errors?.[0] ?? res.error,
        variant: "destructive",
      });
    }
  };

  const lifecycle = async (fn: (id: string) => Promise<{ ok: boolean; error?: string }>, done: string) => {
    if (!journey) return;
    setBusy(true);
    const res = await fn(journey.id);
    setBusy(false);
    if (res.ok) {
      toast({ title: done });
      router.refresh();
    } else {
      toast({ title: "Action failed", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── Step rail ──────────────────────────────────────────────── */}
      <div className="space-y-1">
        <Card className="mb-4 shadow-sm">
          <CardBody className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="journey-name">Journey name</Label>
                <Input
                  id="journey-name"
                  value={draft.name}
                  placeholder="Welcome series"
                  onChange={(e) => update({ name: e.target.value })}
                />
              </div>
              <Badge variant={STATUS_BADGE[status].variant}>{STATUS_BADGE[status].label}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Trigger</Label>
                <SelectField
                  value={draft.trigger.kind}
                  options={[
                    { value: "manual", label: "Manual enrolment" },
                    { value: "contact_added", label: "Contact added" },
                    { value: "inbound_keyword", label: "Inbound keyword" },
                    { value: "campaign_completed", label: "Campaign completed" },
                  ]}
                  onChange={(v) => {
                    if (!v) return;
                    if (v === "inbound_keyword") {
                      update({ trigger: { kind: "inbound_keyword", keyword: "" } });
                    } else if (v === "campaign_completed") {
                      update({ trigger: { kind: "campaign_completed" } });
                    } else {
                      update({ trigger: { kind: v as "manual" | "contact_added" } });
                    }
                  }}
                />
              </div>
              {draft.trigger.kind === "inbound_keyword" && (
                <div className="space-y-1.5">
                  <Label htmlFor="trigger-keyword">Keyword</Label>
                  <Input
                    id="trigger-keyword"
                    placeholder="JOIN"
                    value={draft.trigger.keyword}
                    onChange={(e) =>
                      update({ trigger: { kind: "inbound_keyword", keyword: e.target.value } })
                    }
                  />
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {draft.steps.map((step, i) => (
          <React.Fragment key={step.id}>
            <AddStepDivider onAdd={(kind) => insertStep(kind, i)} />
            <StepNode
              step={step}
              index={i}
              total={draft.steps.length}
              steps={draft.steps}
              templates={templates}
              winner={journey?.winners?.[step.id]}
              onChange={(s) => updateStep(i, s)}
              onRemove={() => removeStep(i)}
              onMove={(dir) => moveStep(i, dir)}
            />
          </React.Fragment>
        ))}
        <AddStepDivider onAdd={(kind) => insertStep(kind, draft.steps.length)} prominent />
      </div>

      {/* ── Side panel ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardBody className="space-y-2 p-4">
            <Button block disabled={busy} onClick={() => void save()}>
              <Save className="mr-1.5 h-4 w-4" />
              {journey ? (dirty ? "Save draft" : "Saved") : "Create draft"}
            </Button>
            {status !== "active" && status !== "archived" && (
              <Button block variant="secondary" disabled={busy} onClick={() => void activate()}>
                <PlayCircle className="mr-1.5 h-4 w-4" /> Activate
              </Button>
            )}
            {status === "active" && (
              <Button
                block
                variant="outline"
                disabled={busy}
                onClick={() => void lifecycle(pauseJourney, "Journey paused")}
              >
                <PauseCircle className="mr-1.5 h-4 w-4" /> Pause
              </Button>
            )}
            {journey && status !== "archived" && (
              <Button
                block
                variant="ghost"
                disabled={busy}
                onClick={() => void lifecycle(archiveJourney, "Journey archived")}
              >
                <Archive className="mr-1.5 h-4 w-4" /> Archive
              </Button>
            )}
            {journey && (
              <Button block variant="outline" disabled={busy} onClick={() => setEnrolOpen(true)}>
                <UserPlus className="mr-1.5 h-4 w-4" /> Test enrol
              </Button>
            )}
          </CardBody>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Validation</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1.5 p-4 pt-0">
            {validation.ok && validation.warnings.length === 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-[var(--st-text)]">
                <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> Ready to activate.
              </p>
            ) : (
              <>
                {validation.errors.map((e, i) => (
                  <p key={`e${i}`} className="flex items-start gap-1.5 text-xs text-[var(--st-danger,#b91c1c)]">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e}
                  </p>
                ))}
                {validation.warnings.map((w, i) => (
                  <p key={`w${i}`} className="flex items-start gap-1.5 text-xs text-amber-600">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                  </p>
                ))}
              </>
            )}
          </CardBody>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rules</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 p-4 pt-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-[var(--st-text)]">Exit on unsubscribe</p>
                <p className="text-[11px] text-[var(--st-text-secondary)]">Always on.</p>
              </div>
              <Switch checked disabled aria-label="Exit on unsubscribe (always on)" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-[var(--st-text)]">Exit on reply</p>
                <p className="text-[11px] text-[var(--st-text-secondary)]">
                  Any inbound reply removes the contact.
                </p>
              </div>
              <Switch
                checked={!!draft.exitRules.onReply}
                onCheckedChange={(v) =>
                  update({ exitRules: { onUnsubscribe: true, onReply: !!v } })
                }
                aria-label="Exit on reply"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-threshold">A/B sample per arm</Label>
              <Input
                id="ab-threshold"
                type="number"
                min={1}
                placeholder="200"
                value={draft.abSampleThreshold ? String(draft.abSampleThreshold) : ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  update({ abSampleThreshold: Number.isFinite(n) && n > 0 ? n : undefined });
                }}
              />
              <p className="text-[11px] text-[var(--st-text-secondary)]">
                Sends per variant before the auto-winner promotes (default 200).
              </p>
            </div>
          </CardBody>
        </Card>

        {journey && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Stats</CardTitle>
            </CardHeader>
            <CardBody className="grid grid-cols-2 gap-2 p-4 pt-0 text-xs">
              <Stat label="Active runs" value={journey.activeRuns} />
              <Stat label="Started" value={journey.stats.started} />
              <Stat label="Sends" value={journey.stats.sends} />
              <Stat label="Replies" value={journey.stats.replies} />
              <Stat label="Clicks" value={journey.stats.clicks} />
              <Stat label="Completed" value={journey.stats.completed} />
              <Stat label="Exited" value={journey.stats.exited} />
              <Stat label="Goals" value={journey.stats.goals} />
            </CardBody>
          </Card>
        )}
      </div>

      {/* ── Test enrol dialog ──────────────────────────────────────── */}
      <Dialog open={enrolOpen} onOpenChange={setEnrolOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test enrol</DialogTitle>
            <DialogDescription>
              Start a single run for a phone number — works on drafts too. Suppression and
              one-run-per-contact rules still apply.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="test-phone">Phone (E.164)</Label>
            <Input
              id="test-phone"
              placeholder="+15551234567"
              value={enrolPhone}
              onChange={(e) => setEnrolPhone(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEnrolOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !enrolPhone.trim()}
              onClick={async () => {
                if (!journey) return;
                setBusy(true);
                const res = await testEnrolJourney(journey.id, enrolPhone);
                setBusy(false);
                if (res.ok) {
                  toast({ title: "Run started" });
                  setEnrolOpen(false);
                  router.refresh();
                } else {
                  toast({ title: "Could not enrol", description: res.error, variant: "destructive" });
                }
              }}
            >
              Start run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 px-2.5 py-1.5">
      <p className="text-[11px] text-[var(--st-text-secondary)]">{label}</p>
      <p className="font-mono text-sm font-semibold text-[var(--st-text)]">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function AddStepDivider({
  onAdd,
  prominent,
}: {
  onAdd: (kind: JourneyStep["kind"]) => void;
  prominent?: boolean;
}) {
  return (
    <div className={`flex items-center justify-center ${prominent ? "py-3" : "py-1.5"}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {prominent ? (
            <Button variant="outline">
              <Plus className="mr-1.5 h-4 w-4" /> Add step
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-[var(--st-text-secondary)]"
              aria-label="Insert step here"
            >
              <Plus className="mr-1 h-3 w-3" /> Insert
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {(Object.keys(STEP_KIND_META) as Array<JourneyStep["kind"]>).map((kind) => (
            <DropdownMenuItem key={kind} onSelect={() => onAdd(kind)}>
              <span className="mr-2">{STEP_KIND_META[kind].icon}</span>
              <span>
                <span className="block text-sm">{STEP_KIND_META[kind].label}</span>
                <span className="block text-[11px] text-[var(--st-text-secondary)]">
                  {STEP_KIND_META[kind].blurb}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
