"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Sparkles } from "lucide-react";

import {
  Badge,
  Button,
  Card,
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
  gradeConversation,
  manualGradeConversation,
} from "@/app/actions/sabchat-ops.actions";
import type { SabChatQaRubric, SabChatQaScore } from "@/lib/rust-client/sabchat-ai-qa";

function pct(total: number, max: number): string {
  return max ? `${Math.round((total / max) * 100)}%` : "—";
}

export function QualityClient({
  rubrics,
  initialScores,
  conversations,
}: {
  rubrics: SabChatQaRubric[];
  initialScores: SabChatQaScore[];
  conversations: { id: string; label: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = React.useTransition();
  const refresh = React.useCallback(() => startTransition(() => router.refresh()), [router]);

  const activeRubrics = rubrics.filter((r) => r.active);
  const [rubricId, setRubricId] = React.useState(activeRubrics[0]?._id ?? rubrics[0]?._id ?? "");
  const rubric = rubrics.find((r) => r._id === rubricId);
  const [convId, setConvId] = React.useState(conversations[0]?.id ?? "");
  const [scores, setScores] = React.useState<Record<string, number>>({});
  const [coaching, setCoaching] = React.useState("");
  const [busy, setBusy] = React.useState<"manual" | "ai" | null>(null);

  // Reset the per-criterion inputs when the rubric changes.
  React.useEffect(() => {
    setScores({});
  }, [rubricId]);

  const maxPerCriterion = 5;
  const submitManual = async () => {
    if (!rubric || !convId) return;
    setBusy("manual");
    const res = await manualGradeConversation(
      convId,
      rubricId,
      rubric.criteria.map((c) => ({ key: c.key, score: scores[c.key] ?? 0 })),
      coaching,
    );
    setBusy(null);
    if (res.ok) {
      toast({ title: "Graded", description: `Score ${res.score.total}/${res.score.max}` });
      setScores({});
      setCoaching("");
      refresh();
    } else {
      toast({ title: "Grading failed", description: res.error, variant: "destructive" });
    }
  };

  const runAi = async () => {
    if (!rubricId || !convId) return;
    setBusy("ai");
    const res = await gradeConversation(convId, rubricId);
    setBusy(null);
    if (res.ok) {
      toast({ title: "AI graded", description: `Score ${res.score.total}/${res.score.max}` });
      refresh();
    } else {
      toast({ title: "AI grading failed", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Quality review</PageTitle>
          <PageDescription>
            Score conversations against a rubric — manually or with AI — and
            compare for calibration. Add coaching notes for the agent.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {rubrics.length === 0 ? (
        <Card className="mt-6 p-6 text-center text-sm text-[var(--st-text-secondary)]">
          No rubrics yet. Create one under <strong>Admin › Quality (QA)</strong> to start reviewing.
        </Card>
      ) : (
        <>
          {/* Grade form */}
          <Card className="mt-6 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Rubric">
                <select
                  value={rubricId}
                  onChange={(e) => setRubricId(e.target.value)}
                  className="h-9 w-full rounded-md border border-[var(--st-border)] bg-transparent px-3 text-sm text-[var(--st-text)] outline-none focus:border-[var(--st-primary,var(--st-accent))]"
                >
                  {rubrics.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name}
                      {r.active ? "" : " (inactive)"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Conversation">
                <select
                  value={convId}
                  onChange={(e) => setConvId(e.target.value)}
                  className="h-9 w-full rounded-md border border-[var(--st-border)] bg-transparent px-3 text-sm text-[var(--st-text)] outline-none focus:border-[var(--st-primary,var(--st-accent))]"
                >
                  {conversations.length === 0 ? (
                    <option value="">No resolved conversations</option>
                  ) : (
                    conversations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label.slice(0, 60)}
                      </option>
                    ))
                  )}
                </select>
              </Field>
            </div>

            {rubric ? (
              <div className="mt-3 space-y-2">
                {rubric.criteria.map((c) => (
                  <div key={c.key} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-[var(--st-text)]">
                      {c.label}
                      <span className="ml-1 text-xs text-[var(--st-text-secondary)]">
                        ×{c.weight}
                      </span>
                    </span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: maxPerCriterion }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          onClick={() => setScores((s) => ({ ...s, [c.key]: n }))}
                          className={`h-7 w-7 rounded-md border text-xs transition-colors ${
                            (scores[c.key] ?? 0) >= n
                              ? "border-[var(--st-primary,var(--st-accent))] bg-[var(--st-primary,var(--st-accent))] text-white"
                              : "border-[var(--st-border)] text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <Field label="Coaching note (optional)">
                  <Textarea
                    value={coaching}
                    onChange={(e) => setCoaching(e.target.value)}
                    rows={2}
                    placeholder="What did the agent do well / could improve?"
                  />
                </Field>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={ClipboardCheck}
                    loading={busy === "manual"}
                    disabled={busy !== null || !convId || rubric.criteria.every((c) => !scores[c.key])}
                    onClick={() => void submitManual()}
                  >
                    Submit manual grade
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={Sparkles}
                    loading={busy === "ai"}
                    disabled={busy !== null || !convId}
                    onClick={() => void runAi()}
                  >
                    AI grade (compare)
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          {/* Scores history */}
          <h2 className="mt-8 mb-2 text-sm font-semibold text-[var(--st-text)]">Recent grades</h2>
          <Card className="p-0">
            {initialScores.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
                No grades yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--st-border)] text-left text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                      <th className="px-4 py-2 font-medium">By</th>
                      <th className="px-4 py-2 font-medium">Agent</th>
                      <th className="px-4 py-2 font-medium">Score</th>
                      <th className="px-4 py-2 font-medium">%</th>
                      <th className="px-4 py-2 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialScores.map((s) => (
                      <tr key={s._id} className="border-b border-[var(--st-border)] last:border-0">
                        <td className="px-4 py-2">
                          <Badge tone={s.gradedBy === "ai" ? "info" : "success"}>{s.gradedBy}</Badge>
                        </td>
                        <td className="px-4 py-2 text-[var(--st-text)]">{s.agentId ?? "—"}</td>
                        <td className="px-4 py-2 text-[var(--st-text)]">
                          {s.total}/{s.max}
                        </td>
                        <td className="px-4 py-2 text-[var(--st-text)]">{pct(s.total, s.max)}</td>
                        <td className="px-4 py-2 text-[var(--st-text-secondary)]">
                          {s.gradedAt ? new Date(s.gradedAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
