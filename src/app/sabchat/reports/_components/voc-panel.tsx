"use client";

import * as React from "react";
import { Sparkles, RefreshCw } from "lucide-react";

import { Button, Badge, useToast } from "@/components/sabcrm/20ui";
import {
  listVocRuns,
  runVoc,
  listVocTopics,
} from "@/app/actions/sabchat-ops.actions";
import type { SabChatVocRun, SabChatVocTopic } from "@/lib/rust-client/sabchat-ai-voc";

function statusTone(s: SabChatVocRun["status"]): "success" | "warning" | "danger" | "neutral" {
  if (s === "done") return "success";
  if (s === "failed") return "danger";
  if (s === "running" || s === "pending") return "warning";
  return "neutral";
}

function rel(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function VocPanel() {
  const { toast } = useToast();
  const [runs, setRuns] = React.useState<SabChatVocRun[]>([]);
  const [topics, setTopics] = React.useState<SabChatVocTopic[]>([]);
  const [activeRun, setActiveRun] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    const r = await listVocRuns();
    setRuns(r);
    const latestDone = r.find((x) => x.status === "done") ?? r[0];
    if (latestDone) {
      setActiveRun(latestDone._id);
      setTopics(await listVocTopics(latestDone._id));
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const onRun = async () => {
    setBusy(true);
    const res = await runVoc({});
    setBusy(false);
    if (res.ok) {
      toast({ title: "Analysis started", description: "Topics appear when the run completes." });
      void refresh();
    } else {
      toast({ title: "Couldn't start analysis", description: res.error, variant: "destructive" });
    }
  };

  const pickRun = async (id: string) => {
    setActiveRun(id);
    setTopics(await listVocTopics(id));
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--st-text)]">
          Voice of Customer{" "}
          <span className="text-xs font-normal text-[var(--st-text-secondary)]">
            · AI topic clustering
          </span>
        </h2>
        <Button variant="primary" size="sm" iconLeft={Sparkles} loading={busy} onClick={() => void onRun()}>
          Run analysis
        </Button>
      </div>

      {runs.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {runs.slice(0, 8).map((r) => (
            <button
              key={r._id}
              onClick={() => void pickRun(r._id)}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                activeRun === r._id
                  ? "border-[var(--st-primary,var(--st-accent))] text-[var(--st-text)]"
                  : "border-[var(--st-border)] text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]"
              }`}
            >
              {rel(r.completedAt ?? r.createdAt)}{" "}
              <Badge tone={statusTone(r.status)} className="ml-1">
                {r.status}
              </Badge>
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-lg border border-[var(--st-border)]">
        {loading ? (
          <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-[var(--st-text-secondary)]">
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </p>
        ) : topics.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--st-text-secondary)]">
            No topics yet. Run an analysis to cluster recent conversations into themes.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {topics.map((t) => (
              <li key={t._id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-[var(--st-text)]">{t.label}</span>
                  <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                    {typeof t.sentimentMean === "number" ? (
                      <Badge
                        tone={
                          t.sentimentMean >= 0.2
                            ? "success"
                            : t.sentimentMean <= -0.2
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {t.sentimentMean >= 0.2 ? "positive" : t.sentimentMean <= -0.2 ? "negative" : "neutral"}
                      </Badge>
                    ) : null}
                    <span>{t.messageCount} msgs</span>
                  </div>
                </div>
                {t.summary ? (
                  <p className="mt-0.5 text-sm text-[var(--st-text-secondary)]">{t.summary}</p>
                ) : null}
                {t.keywords?.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.keywords.slice(0, 8).map((k) => (
                      <span
                        key={k}
                        className="rounded bg-[var(--st-bg-muted)] px-1.5 py-0.5 text-[11px] text-[var(--st-text-secondary)]"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
