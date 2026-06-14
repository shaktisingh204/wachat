"use client";

import * as React from "react";
import {
  MessageSquare,
  Pause,
  Play,
  Plus,
  Target,
  Timer,
  Trash2,
  UserPlus,
  Zap,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";
import {
  createJourney,
  deleteJourney,
  enrollContacts,
  getJourney,
  saveJourney,
  tickJourneys,
} from "@/app/actions/sabchat-journeys.actions";
import type {
  SabChatJourney,
  SabChatJourneyRun,
  SabChatJourneyStep,
  SabChatJourneyStepKind,
} from "@/lib/rust-client/sabchat-journeys";

const CHANNELS = ["chat", "email", "sms", "push"] as const;

function newStep(kind: SabChatJourneyStepKind): SabChatJourneyStep {
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `s${Math.round(Math.random() * 1e9)}`;
  if (kind === "message") return { id, kind, channel: "chat", text: "" };
  if (kind === "wait") return { id, kind, waitMinutes: 60 };
  return { id, kind };
}

function statusTone(s: SabChatJourney["status"]): "success" | "warning" | "neutral" {
  if (s === "active") return "success";
  if (s === "paused") return "warning";
  return "neutral";
}

export function JourneysClient({
  initialJourneys,
}: {
  initialJourneys: SabChatJourney[];
}) {
  const { toast } = useToast();
  const [journeys, setJourneys] = React.useState(initialJourneys);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialJourneys[0]?._id ?? null);
  const [steps, setSteps] = React.useState<SabChatJourneyStep[]>([]);
  const [runs, setRuns] = React.useState<SabChatJourneyRun[]>([]);
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");

  const [enrollOpen, setEnrollOpen] = React.useState(false);
  const [enrollTag, setEnrollTag] = React.useState("");

  const selected = journeys.find((j) => j._id === selectedId) ?? null;

  const loadDetail = React.useCallback(async (id: string) => {
    const detail = await getJourney(id);
    if (detail) {
      setSteps(detail.journey.steps ?? []);
      setRuns(detail.runs);
      setDirty(false);
      setJourneys((prev) => prev.map((j) => (j._id === id ? detail.journey : j)));
    }
  }, []);

  React.useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const refreshList = async () => {
    // cheap: re-fetch detail to update counts; full list comes from nav refresh
    if (selectedId) await loadDetail(selectedId);
  };

  const create = async () => {
    setBusy(true);
    const res = await createJourney(newName);
    setBusy(false);
    if (res.ok) {
      toast({ title: "Journey created" });
      setCreateOpen(false);
      setNewName("");
      const fresh = { _id: res.id, name: newName.trim(), status: "draft", steps: [], enrolledCount: 0, completedCount: 0, tenantId: "", createdAt: "", updatedAt: "" } as SabChatJourney;
      setJourneys((prev) => [fresh, ...prev]);
      setSelectedId(res.id);
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const setStep = (i: number, patch: Partial<SabChatJourneyStep>) => {
    setSteps((s) => s.map((st, j) => (j === i ? { ...st, ...patch } : st)));
    setDirty(true);
  };
  const addStep = (kind: SabChatJourneyStepKind) => {
    setSteps((s) => [...s, newStep(kind)]);
    setDirty(true);
  };
  const removeStep = (i: number) => {
    setSteps((s) => s.filter((_, j) => j !== i));
    setDirty(true);
  };

  const saveSteps = async () => {
    if (!selected) return;
    setBusy(true);
    const res = await saveJourney(selected._id, { steps });
    setBusy(false);
    if (res.ok) {
      toast({ title: "Saved" });
      setDirty(false);
      void refreshList();
    } else {
      toast({ title: "Save failed", description: res.error, variant: "destructive" });
    }
  };

  const toggleStatus = async () => {
    if (!selected) return;
    const next = selected.status === "active" ? "paused" : "active";
    const res = await saveJourney(selected._id, { status: next });
    if (res.ok) {
      setJourneys((prev) => prev.map((j) => (j._id === selected._id ? { ...j, status: next } : j)));
      toast({ title: next === "active" ? "Journey activated" : "Journey paused" });
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const remove = async () => {
    if (!selected) return;
    const res = await deleteJourney(selected._id);
    if (res.ok) {
      setJourneys((prev) => prev.filter((j) => j._id !== selected._id));
      setSelectedId(null);
      setSteps([]);
      setRuns([]);
      toast({ title: "Journey deleted" });
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const enroll = async () => {
    if (!selected) return;
    setBusy(true);
    const res = await enrollContacts(selected._id, { tag: enrollTag });
    setBusy(false);
    if (res.ok) {
      toast({ title: `Enrolled ${res.enrolled} contact${res.enrolled === 1 ? "" : "s"}` });
      setEnrollOpen(false);
      setEnrollTag("");
      void refreshList();
    } else {
      toast({ title: "Enroll failed", description: res.error, variant: "destructive" });
    }
  };

  const runTick = async () => {
    setBusy(true);
    const res = await tickJourneys();
    setBusy(false);
    if (res.ok) {
      toast({
        title: "Tick complete",
        description: `${res.advanced} advanced · ${res.messagesEnqueued} queued · ${res.completed} done`,
      });
      void refreshList();
    } else {
      toast({ title: "Tick failed", description: res.error, variant: "destructive" });
    }
  };

  const stepIcon = (k: SabChatJourneyStepKind) =>
    k === "message" ? MessageSquare : k === "wait" ? Timer : Target;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Journeys</PageTitle>
          <PageDescription>
            Multi-step outbound sequences — message, wait, goal. Enroll contacts
            by tag; an active journey advances on the scheduler tick.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="mt-5 flex items-center justify-between">
        <Button variant="outline" size="sm" iconLeft={Zap} loading={busy} onClick={() => void runTick()}>
          Run tick now
        </Button>
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setCreateOpen(true)}>
          New journey
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Journey list */}
        <Card className="divide-y divide-[var(--st-border)] p-0">
          {journeys.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
              No journeys yet.
            </p>
          ) : (
            journeys.map((j) => (
              <button
                key={j._id}
                onClick={() => setSelectedId(j._id)}
                className={`flex w-full items-center justify-between gap-2 p-3 text-left ${
                  selectedId === j._id ? "bg-[var(--st-bg-muted)]" : "hover:bg-[var(--st-bg-muted)]/60"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--st-text)]">
                    {j.name}
                  </span>
                  <span className="text-xs text-[var(--st-text-secondary)]">
                    {j.enrolledCount} enrolled · {j.completedCount} done
                  </span>
                </span>
                <Badge tone={statusTone(j.status)}>{j.status}</Badge>
              </button>
            ))
          )}
        </Card>

        {/* Detail / builder */}
        {!selected ? (
          <Card className="flex min-h-[200px] items-center justify-center p-6 text-center text-sm text-[var(--st-text-secondary)]">
            Select or create a journey to edit its steps.
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-[var(--st-text)]">{selected.name}</h2>
                  <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={selected.status === "active" ? Pause : Play}
                    onClick={() => void toggleStatus()}
                  >
                    {selected.status === "active" ? "Pause" : "Activate"}
                  </Button>
                  <Button variant="outline" size="sm" iconLeft={UserPlus} onClick={() => setEnrollOpen(true)}>
                    Enroll
                  </Button>
                  <Button variant="ghost" size="sm" iconLeft={Trash2} onClick={() => void remove()} />
                </div>
              </div>

              {/* Steps */}
              <div className="mt-4 space-y-2">
                {steps.length === 0 ? (
                  <p className="text-sm text-[var(--st-text-secondary)]">
                    No steps yet — add a message, a wait, or a goal.
                  </p>
                ) : (
                  steps.map((st, i) => {
                    const Icon = stepIcon(st.kind);
                    return (
                      <div
                        key={st.id || i}
                        className="rounded-lg border border-[var(--st-border)] p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
                            <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden />
                            {i + 1}. {st.kind}
                          </span>
                          <button
                            onClick={() => removeStep(i)}
                            className="text-[var(--st-text-secondary)] hover:text-red-500"
                            aria-label="Remove step"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                        {st.kind === "message" ? (
                          <div className="mt-2 space-y-2">
                            <select
                              value={st.channel ?? "chat"}
                              onChange={(e) => setStep(i, { channel: e.target.value as SabChatJourneyStep["channel"] })}
                              className="h-8 rounded-md border border-[var(--st-border)] bg-transparent px-2 text-xs text-[var(--st-text)] outline-none"
                            >
                              {CHANNELS.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <Textarea
                              value={st.text ?? ""}
                              onChange={(e) => setStep(i, { text: e.target.value })}
                              rows={2}
                              placeholder="Message text…"
                            />
                          </div>
                        ) : st.kind === "wait" ? (
                          <div className="mt-2 flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                            Wait
                            <Input
                              type="number"
                              min={1}
                              value={String(st.waitMinutes ?? 60)}
                              onChange={(e) => setStep(i, { waitMinutes: Number(e.target.value) || 1 })}
                              className="w-24"
                            />
                            minutes
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                            Marks the run complete when reached.
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" iconLeft={MessageSquare} onClick={() => addStep("message")}>
                  Message
                </Button>
                <Button variant="outline" size="sm" iconLeft={Timer} onClick={() => addStep("wait")}>
                  Wait
                </Button>
                <Button variant="outline" size="sm" iconLeft={Target} onClick={() => addStep("goal")}>
                  Goal
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="ml-auto"
                  loading={busy}
                  disabled={!dirty || busy}
                  onClick={() => void saveSteps()}
                >
                  Save steps
                </Button>
              </div>
            </Card>

            {/* Runs */}
            <Card className="p-0">
              <p className="border-b border-[var(--st-border)] px-4 py-2 text-sm font-semibold text-[var(--st-text)]">
                Runs <span className="font-normal text-[var(--st-text-secondary)]">· {runs.length}</span>
              </p>
              {runs.length === 0 ? (
                <p className="p-4 text-center text-sm text-[var(--st-text-secondary)]">
                  No contacts enrolled yet.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--st-border)]">
                  {runs.slice(0, 30).map((r) => (
                    <li key={r._id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span className="font-mono text-xs text-[var(--st-text-secondary)]">
                        {r.contactId ? r.contactId.slice(-8) : "—"}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-[var(--st-text-secondary)]">step {r.currentStep}</span>
                        <Badge tone={r.status === "completed" ? "success" : r.status === "failed" ? "danger" : "neutral"}>
                          {r.status}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New journey</DialogTitle>
          </DialogHeader>
          <Field label="Name">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Onboarding nudge" autoFocus />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={busy} disabled={busy || !newName.trim()} onClick={() => void create()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll contacts</DialogTitle>
          </DialogHeader>
          <Field label="By tag (segment)">
            <Input value={enrollTag} onChange={(e) => setEnrollTag(e.target.value)} placeholder="vip" autoFocus />
          </Field>
          <p className="text-xs text-[var(--st-text-secondary)]">
            Every contact carrying this tag is enrolled at step 1.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEnrollOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={busy} disabled={busy || !enrollTag.trim()} onClick={() => void enroll()}>
              Enroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
