"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  PhoneCall,
  PhoneMissed,
  Voicemail as VoicemailIcon,
} from "lucide-react";

import {
  Badge,
  Card,
  EmptyState,
  Input,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Skeleton,
} from "@/components/sabcrm/20ui";

import { listConversations, type TimelineItem } from "./actions";
import { AiSummary } from "./_ai-summary";
import { Softphone } from "../_components/softphone";

function fmtWhen(at: string | null): string {
  if (!at) return "—";
  try {
    return new Date(at).toLocaleString();
  } catch {
    return "—";
  }
}

function fmtDuration(secs?: number): string {
  if (!secs || secs <= 0) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function ItemIcon({ item }: { item: TimelineItem }) {
  if (item.kind === "voicemail") {
    return <VoicemailIcon className="h-4 w-4" aria-hidden />;
  }
  if (item.status === "missed" || item.status === "abandoned") {
    return <PhoneMissed className="h-4 w-4" aria-hidden />;
  }
  return item.direction === "outbound" ? (
    <ArrowUpRight className="h-4 w-4" aria-hidden />
  ) : (
    <ArrowDownLeft className="h-4 w-4" aria-hidden />
  );
}

export default function SabcallConversationsPage() {
  const [items, setItems] = React.useState<TimelineItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        const res = await listConversations({ q: q.trim() || undefined });
        if (!cancelled && res.success) setItems(res.data);
        if (!cancelled) setLoading(false);
      })();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Conversations</PageTitle>
          <PageDescription>
            One timeline for every call and voicemail. Place a call from the
            dialpad — the engine bridges it through Asterisk.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[320px_1fr]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Softphone />
        </div>

        <div className="flex flex-col gap-[var(--st-space-3)]">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by number…"
            aria-label="Search conversations"
          />

          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="p-10">
              <EmptyState
                icon={<PhoneCall aria-hidden />}
                title="No activity yet"
                description="Calls and voicemails will appear here as they happen. Try placing a call from the dialpad."
              />
            </Card>
          ) : (
            <ul className="sc-stagger flex flex-col gap-2">
              {items.map((it, i) => (
                <li
                  key={`${it.kind}-${it.id}`}
                  className="sc-stagger-item"
                  style={{ ["--sc-i" as string]: i } as React.CSSProperties}
                >
                  <Card className="sc-card flex flex-col gap-2 p-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                        <ItemIcon item={it} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[var(--st-text)]">
                          {it.peer || "Unknown"}
                        </div>
                        <div className="truncate text-xs text-[var(--st-text-secondary)]">
                          {it.kind === "voicemail"
                            ? it.transcript
                              ? it.transcript
                              : "Voicemail"
                            : `${it.direction === "outbound" ? "Outbound" : "Inbound"} call`}
                          {fmtDuration(it.durationSecs)
                            ? ` · ${fmtDuration(it.durationSecs)}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant={it.status === "missed" ? "outline" : "default"}>
                          {it.kind === "voicemail" ? "Voicemail" : it.status}
                        </Badge>
                        <span className="text-[11px] text-[var(--st-text-secondary)]">
                          {fmtWhen(it.at)}
                        </span>
                      </div>
                    </div>
                    {it.kind === "voicemail" && it.transcript ? (
                      <AiSummary transcript={it.transcript} />
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
