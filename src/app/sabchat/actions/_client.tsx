"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play, Plus, Trash2, Wrench, Zap } from "lucide-react";

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
  deleteConnector,
  invokeConnector,
  saveConnector,
} from "@/app/actions/sabchat-ai-actions.actions";
import type {
  SabChatActionRun,
  SabChatConnector,
  SabChatInvokeResult,
} from "@/lib/rust-client/sabchat-ai-actions";

const METHODS = ["POST", "GET", "PUT", "PATCH", "DELETE"];

function parseHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) {
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (k) out[k] = v;
    }
  }
  return out;
}

function headersToText(h?: Record<string, string>): string {
  if (!h) return "";
  return Object.entries(h)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

export function ActionsClient({
  initialConnectors,
  initialRuns,
}: {
  initialConnectors: SabChatConnector[];
  initialRuns: SabChatActionRun[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = React.useTransition();
  const refresh = React.useCallback(() => startTransition(() => router.refresh()), [router]);

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabChatConnector | null>(null);
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [method, setMethod] = React.useState("POST");
  const [headers, setHeaders] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Test invoke
  const [testId, setTestId] = React.useState("");
  const [testInput, setTestInput] = React.useState('{\n  "example": "value"\n}');
  const [testBusy, setTestBusy] = React.useState(false);
  const [testResult, setTestResult] = React.useState<SabChatInvokeResult | null>(null);

  const openNew = () => {
    setEditing(null);
    setName("");
    setDesc("");
    setUrl("");
    setMethod("POST");
    setHeaders("");
    setOpen(true);
  };
  const openEdit = (c: SabChatConnector) => {
    setEditing(c);
    setName(c.name);
    setDesc(c.description ?? "");
    setUrl(c.config.url ?? "");
    setMethod(c.config.method ?? "POST");
    setHeaders(headersToText(c.config.headers));
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    const res = await saveConnector({
      id: editing?._id,
      name,
      description: desc,
      config: { url, method, headers: parseHeaders(headers) },
      enabled: editing ? editing.enabled : true,
    });
    setBusy(false);
    if (res.ok) {
      toast({ title: editing ? "Connector saved" : "Connector created" });
      setOpen(false);
      refresh();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    const res = await deleteConnector(id);
    if (res.ok) {
      toast({ title: "Connector deleted" });
      refresh();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const runTest = async () => {
    if (!testId) return;
    setTestBusy(true);
    const res = await invokeConnector(testId, testInput);
    setTestBusy(false);
    if (res.ok) {
      setTestResult(res.result);
      refresh();
    } else {
      toast({ title: "Invoke failed", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>AI actions</PageTitle>
          <PageDescription>
            Connectors the bot can invoke to take action — look up an order,
            issue a refund. v1 calls a webhook you host; every run is logged.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="mt-5 flex justify-end">
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={openNew}>
          New connector
        </Button>
      </div>

      {/* Connectors */}
      <Card className="mt-3 divide-y divide-[var(--st-border)] p-0">
        {initialConnectors.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
            No connectors yet. Add a webhook tool the bot can call.
          </p>
        ) : (
          initialConnectors.map((c) => (
            <div key={c._id} className="flex items-center justify-between gap-3 p-4">
              <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(c)}>
                <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--st-text)]">
                  <Wrench className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" aria-hidden />
                  {c.name}
                </p>
                <p className="truncate text-xs text-[var(--st-text-secondary)]">
                  {c.config.method ?? "POST"} {c.config.url}
                </p>
              </button>
              <Badge tone={c.enabled ? "success" : "neutral"}>{c.enabled ? "On" : "Off"}</Badge>
              <Button variant="ghost" size="sm" iconLeft={Trash2} onClick={() => void remove(c._id)} />
            </div>
          ))
        )}
      </Card>

      {/* Test invoke */}
      {initialConnectors.length > 0 ? (
        <Card className="mt-6 p-4">
          <h2 className="mb-2 text-sm font-semibold text-[var(--st-text)]">Test a connector</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <select
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
              className="h-9 rounded-md border border-[var(--st-border)] bg-transparent px-3 text-sm text-[var(--st-text)] outline-none sm:w-56"
            >
              <option value="">Select a connector…</option>
              {initialConnectors.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              rows={4}
              className="flex-1 font-mono text-xs"
              placeholder='{ "key": "value" }'
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              iconLeft={Play}
              loading={testBusy}
              disabled={testBusy || !testId}
              onClick={() => void runTest()}
            >
              Invoke
            </Button>
            {testResult ? (
              <Badge tone={testResult.status === "ok" ? "success" : "danger"}>
                {testResult.status}
                {testResult.httpStatus ? ` · HTTP ${testResult.httpStatus}` : ""}
              </Badge>
            ) : null}
          </div>
          {testResult ? (
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-[var(--st-bg-muted)] p-3 text-xs text-[var(--st-text)]">
              {JSON.stringify(testResult.error ?? testResult.output, null, 2)}
            </pre>
          ) : null}
        </Card>
      ) : null}

      {/* Runs audit */}
      <h2 className="mt-8 mb-2 text-sm font-semibold text-[var(--st-text)]">Recent invocations</h2>
      <Card className="p-0">
        {initialRuns.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
            No invocations yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {initialRuns.map((r) => (
              <li key={r._id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-[var(--st-text)]">
                  <Zap
                    className={`h-3.5 w-3.5 ${r.status === "ok" ? "text-[var(--st-status-ok)]" : "text-red-500"}`}
                    aria-hidden
                  />
                  {r.connectorId.slice(-6)}
                  {r.httpStatus ? (
                    <span className="text-xs text-[var(--st-text-secondary)]">HTTP {r.httpStatus}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={r.status === "ok" ? "success" : "danger"}>{r.status}</Badge>
                  <span className="text-xs text-[var(--st-text-secondary)]">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Editor dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit connector" : "New connector"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lookup order" autoFocus />
            </Field>
            <Field label="Method">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--st-border)] bg-transparent px-3 text-sm text-[var(--st-text)] outline-none"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Webhook URL">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/lookup" />
          </Field>
          <Field label="Description (optional)">
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this tool does" />
          </Field>
          <Field label="Headers (one per line, key: value)">
            <Textarea
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              rows={3}
              className="font-mono text-xs"
              placeholder="Authorization: Bearer xxx"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !name.trim() || !url.trim()}
              onClick={() => void save()}
            >
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
