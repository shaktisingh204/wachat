"use client";

import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/sabcrm/20ui";

import {
  createSinkAction,
  deleteSinkAction,
  setSinkEnabledAction,
  type PublicSink,
} from "./sinks-actions";
import type { SabsmsEventSinkKind } from "@/lib/sabsms/types";

const FIELD =
  "rounded border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-sm text-[var(--st-text)]";
const HTTP_KINDS: SabsmsEventSinkKind[] = ["webhook", "http_batch", "segment"];

export function SinksSettingsCard({ initial }: { initial: PublicSink[] }) {
  const [sinks, setSinks] = useState<PublicSink[]>(initial);
  const [kind, setKind] = useState<SabsmsEventSinkKind>("webhook");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const isHttp = HTTP_KINDS.includes(kind);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNewSecret(null);
    const res = await createSinkAction({
      kind,
      url: isHttp ? url : undefined,
      events: events.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSinks((prev) => [res.sink, ...prev]);
    setUrl("");
    setEvents("");
    if (res.secret) setNewSecret(res.secret);
  }

  async function toggle(sink: PublicSink) {
    const res = await setSinkEnabledAction(sink.id, !sink.enabled);
    if (res.success) {
      setSinks((prev) =>
        prev.map((s) => (s.id === sink.id ? { ...s, enabled: !s.enabled } : s)),
      );
    }
  }

  async function remove(sink: PublicSink) {
    const res = await deleteSinkAction(sink.id);
    if (res.success) setSinks((prev) => prev.filter((s) => s.id !== sink.id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event streams &amp; sinks</CardTitle>
        <CardDescription>
          Stream SabSMS events (sends, delivery receipts, inbound, clicks) to
          your own infrastructure. HTTP sinks are HMAC-signed; the signing
          secret is shown once on creation.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          {sinks.length === 0 && (
            <p className="text-sm text-[var(--st-text-muted)]">No sinks yet.</p>
          )}
          {sinks.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded border border-[var(--st-border)] p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge>{s.kind}</Badge>
                  {!s.enabled && <span className="text-xs text-[var(--st-text-muted)]">disabled</span>}
                </div>
                <p className="truncate text-sm text-[var(--st-text)]">{s.endpoint || "—"}</p>
                <p className="text-xs text-[var(--st-text-muted)]">
                  {s.events.length ? s.events.join(", ") : "all events"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="outline" onClick={() => toggle(s)}>
                  {s.enabled ? "Disable" : "Enable"}
                </Button>
                <Button type="button" variant="outline" onClick={() => remove(s)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}

          {newSecret && (
            <div className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
              <p className="text-xs text-[var(--st-text-muted)]">
                Signing secret (copy now — shown once):
              </p>
              <code className="break-all text-sm text-[var(--st-text)]">{newSecret}</code>
            </div>
          )}

          <form onSubmit={handleAdd} className="space-y-3 border-t border-[var(--st-border)] pt-4">
            <div className="grid gap-3 md:grid-cols-2 md:max-w-2xl">
              <div className="grid gap-2">
                <Label htmlFor="sabsms-sink-kind">Kind</Label>
                <select
                  id="sabsms-sink-kind"
                  className={FIELD}
                  value={kind}
                  onChange={(e) => setKind(e.target.value as SabsmsEventSinkKind)}
                >
                  <option value="webhook">Webhook</option>
                  <option value="http_batch">HTTP batch</option>
                  <option value="segment">Segment</option>
                  <option value="kafka">Kafka</option>
                  <option value="kinesis">Kinesis</option>
                </select>
              </div>
              {isHttp && (
                <div className="grid gap-2">
                  <Label htmlFor="sabsms-sink-url">Endpoint URL (https)</Label>
                  <Input
                    id="sabsms-sink-url"
                    placeholder="https://example.com/events"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              )}
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="sabsms-sink-events">Events (comma separated, empty = all)</Label>
                <Input
                  id="sabsms-sink-events"
                  placeholder="message.delivered, message.failed"
                  value={events}
                  onChange={(e) => setEvents(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Adding…" : "Add sink"}
              </Button>
              {error && <span className="text-sm text-[var(--st-danger,#dc2626)]">{error}</span>}
            </div>
          </form>
        </div>
      </CardBody>
    </Card>
  );
}
