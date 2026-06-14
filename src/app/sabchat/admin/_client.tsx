"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Inbox as InboxIcon,
  MessageSquareText,
  Plus,
  ScrollText,
  Send,
  Tag,
  Trash2,
  Webhook,
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
  createInbox,
  deleteDisposition,
  deleteInbox,
  deleteMacro,
  saveDisposition,
  saveMacro,
  setInboxEnabled,
} from "@/app/actions/sabchat-config.actions";
import {
  SABCHAT_WEBHOOK_EVENTS,
  deleteWebhook,
  saveWebhook,
  testWebhook,
} from "@/app/actions/sabchat-ops.actions";
import type { SabChatInbox } from "@/lib/rust-client/sabchat";
import type { SabChatMacro } from "@/lib/rust-client/sabchat-macros";
import type { SabChatDisposition } from "@/lib/rust-client/sabchat-dispositions";
import type { SabChatWebhookEndpoint } from "@/lib/rust-client/sabchat-webhooks";

type Tab = "inboxes" | "macros" | "dispositions" | "webhooks" | "audit";

const TABS: { id: Tab; label: string; icon: typeof InboxIcon }[] = [
  { id: "inboxes", label: "Inboxes", icon: InboxIcon },
  { id: "macros", label: "Canned responses", icon: MessageSquareText },
  { id: "dispositions", label: "Dispositions", icon: Tag },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "audit", label: "Audit log", icon: ScrollText },
];

export function AdminClient({
  initialInboxes,
  initialMacros,
  initialDispositions,
  initialWebhooks,
  initialAudit,
}: {
  initialInboxes: SabChatInbox[];
  initialMacros: SabChatMacro[];
  initialDispositions: SabChatDisposition[];
  initialWebhooks: SabChatWebhookEndpoint[];
  initialAudit: unknown[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<Tab>("inboxes");
  const [, startTransition] = React.useTransition();

  const refresh = React.useCallback(() => startTransition(() => router.refresh()), [router]);

  const handle = React.useCallback(
    async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => {
      const res = await fn();
      if (res.ok) {
        if (okMsg) toast({ title: okMsg });
        refresh();
      } else {
        toast({ title: "Failed", description: res.error, variant: "destructive" });
      }
      return res.ok;
    },
    [toast, refresh],
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Admin</PageTitle>
          <PageDescription>
            Manage inboxes, canned responses, and close reasons for this chat
            workspace.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="mt-5 flex gap-1 border-b border-[var(--st-border)]">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
                tab === t.id
                  ? "border-[var(--st-primary,var(--st-accent))] font-medium text-[var(--st-text)]"
                  : "border-transparent text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === "inboxes" && (
          <InboxesSection inboxes={initialInboxes} onAction={handle} />
        )}
        {tab === "macros" && <MacrosSection macros={initialMacros} onAction={handle} />}
        {tab === "dispositions" && (
          <DispositionsSection dispositions={initialDispositions} onAction={handle} />
        )}
        {tab === "webhooks" && (
          <WebhooksSection webhooks={initialWebhooks} onAction={handle} />
        )}
        {tab === "audit" && <AuditSection events={initialAudit} />}
      </div>
    </div>
  );
}

type ActionRunner = (
  fn: () => Promise<{ ok: boolean; error?: string }>,
  okMsg?: string,
) => Promise<boolean>;

/* -- Webhooks ------------------------------------------------------------ */

function WebhooksSection({
  webhooks,
  onAction,
}: {
  webhooks: SabChatWebhookEndpoint[];
  onAction: ActionRunner;
}) {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [events, setEvents] = React.useState<string[]>([...SABCHAT_WEBHOOK_EVENTS]);
  const [busy, setBusy] = React.useState(false);

  const toggleEvent = (ev: string) =>
    setEvents((p) => (p.includes(ev) ? p.filter((x) => x !== ev) : [...p, ev]));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-[var(--st-text-secondary)]">
          POST conversation/message events to your endpoints (HMAC-signed).
        </p>
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
          New endpoint
        </Button>
      </div>
      <Card className="divide-y divide-[var(--st-border)] p-0">
        {webhooks.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
            No webhook endpoints yet.
          </p>
        ) : (
          webhooks.map((w) => (
            <div key={w._id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--st-text)]">{w.url}</p>
                <p className="truncate text-xs text-[var(--st-text-secondary)]">
                  {(w.events ?? []).length} events
                </p>
              </div>
              <Badge variant={w.active ? "default" : "outline"}>
                {w.active ? "Active" : "Paused"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                iconLeft={Send}
                onClick={() => void onAction(() => testWebhook(w._id), "Test sent")}
              >
                Test
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Trash2}
                onClick={() => void onAction(() => deleteWebhook(w._id), "Deleted")}
              />
            </div>
          ))
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New webhook endpoint</DialogTitle>
          </DialogHeader>
          <Field label="URL">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoFocus />
          </Field>
          <Field label="Events">
            <div className="grid grid-cols-2 gap-1.5">
              {SABCHAT_WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-1.5 text-xs text-[var(--st-text)]">
                  <input
                    type="checkbox"
                    checked={events.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                  />
                  {ev}
                </label>
              ))}
            </div>
          </Field>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !url.trim() || !events.length}
              onClick={async () => {
                setBusy(true);
                const ok = await onAction(() => saveWebhook({ url, events }), "Created");
                setBusy(false);
                if (ok) {
                  setUrl("");
                  setOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -- Audit log ----------------------------------------------------------- */

function AuditSection({ events }: { events: unknown[] }) {
  const rows = events as Array<Record<string, unknown>>;
  const fmt = (v: unknown) => {
    if (typeof v !== "string") return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
  };
  return (
    <Card className="p-0">
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
          No audit events yet.
        </p>
      ) : (
        <div className="divide-y divide-[var(--st-border)]">
          {rows.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium text-[var(--st-text)]">
                {String(e.action ?? "event")}
              </span>
              <span className="text-xs text-[var(--st-text-secondary)]">
                {String(e.actorType ?? "")}
              </span>
              <span className="text-xs text-[var(--st-text-secondary)]">
                {fmt(e.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* -- Inboxes ------------------------------------------------------------- */

function InboxesSection({
  inboxes,
  onAction,
}: {
  inboxes: SabChatInbox[];
  onAction: ActionRunner;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
          New inbox
        </Button>
      </div>
      <Card className="divide-y divide-[var(--st-border)] p-0">
        {inboxes.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
            No inboxes yet.
          </p>
        ) : (
          inboxes.map((i) => (
            <div key={i._id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--st-text)]">{i.name}</p>
                <p className="text-xs text-[var(--st-text-secondary)]">{i.channelType}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={i.enabled ? "default" : "outline"}>
                  {i.enabled ? "Enabled" : "Disabled"}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void onAction(() => setInboxEnabled(i._id, !i.enabled))}
                >
                  {i.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Trash2}
                  onClick={() =>
                    void onAction(() => deleteInbox(i._id), "Inbox deleted")
                  }
                />
              </div>
            </div>
          ))
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New inbox</DialogTitle>
          </DialogHeader>
          <Field label="Inbox name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Website" autoFocus />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !name.trim()}
              onClick={async () => {
                setBusy(true);
                const ok = await onAction(() => createInbox({ name }), "Inbox created");
                setBusy(false);
                if (ok) {
                  setName("");
                  setOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -- Macros -------------------------------------------------------------- */

function MacrosSection({
  macros,
  onAction,
}: {
  macros: SabChatMacro[];
  onAction: ActionRunner;
}) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabChatMacro | null>(null);
  const [name, setName] = React.useState("");
  const [content, setContent] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const openNew = () => {
    setEditing(null);
    setName("");
    setContent("");
    setOpen(true);
  };
  const openEdit = (m: SabChatMacro) => {
    setEditing(m);
    setName(m.name);
    setContent(m.content);
    setOpen(true);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-[var(--st-text-secondary)]">
          Agents insert these by typing <code>/name</code> in the composer.
        </p>
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={openNew}>
          New response
        </Button>
      </div>
      <Card className="divide-y divide-[var(--st-border)] p-0">
        {macros.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
            No canned responses yet.
          </p>
        ) : (
          macros.map((m) => (
            <div key={m._id} className="flex items-start justify-between gap-3 p-4">
              <button onClick={() => openEdit(m)} className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium text-[var(--st-text)]">/{m.name}</p>
                <p className="line-clamp-2 text-xs text-[var(--st-text-secondary)]">{m.content}</p>
              </button>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Trash2}
                onClick={() => void onAction(() => deleteMacro(m._id), "Deleted")}
              />
            </div>
          ))
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit response" : "New canned response"}</DialogTitle>
          </DialogHeader>
          <Field label="Shortcut name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="thanks" autoFocus />
          </Field>
          <Field label="Content">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Thanks for reaching out! How can I help?"
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
              disabled={busy || !name.trim() || !content.trim()}
              onClick={async () => {
                setBusy(true);
                const ok = await onAction(
                  () => saveMacro({ id: editing?._id, name, content }),
                  "Saved",
                );
                setBusy(false);
                if (ok) setOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -- Dispositions -------------------------------------------------------- */

function DispositionsSection({
  dispositions,
  onAction,
}: {
  dispositions: SabChatDisposition[];
  onAction: ActionRunner;
}) {
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [color, setColor] = React.useState("#536CDD");
  const [busy, setBusy] = React.useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-[var(--st-text-secondary)]">
          Close reasons agents pick when resolving a conversation.
        </p>
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
          New disposition
        </Button>
      </div>
      <Card className="divide-y divide-[var(--st-border)] p-0">
        {dispositions.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
            No dispositions yet.
          </p>
        ) : (
          dispositions.map((d) => (
            <div key={d._id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-full"
                  style={{ background: d.color || "var(--st-text-secondary)" }}
                />
                <span className="text-sm font-medium text-[var(--st-text)]">{d.label}</span>
                <code className="text-xs text-[var(--st-text-secondary)]">{d.code}</code>
              </div>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Trash2}
                onClick={() => void onAction(() => deleteDisposition(d._id), "Deleted")}
              />
            </div>
          ))
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New disposition</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="resolved_billing" autoFocus />
            </Field>
            <Field label="Colour">
              <input
                type="color"
                aria-label="Colour"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-md border border-[var(--st-border)] bg-transparent p-1"
              />
            </Field>
          </div>
          <Field label="Label">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Billing resolved" />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !code.trim() || !label.trim()}
              onClick={async () => {
                setBusy(true);
                const ok = await onAction(
                  () => saveDisposition({ code, label, color }),
                  "Created",
                );
                setBusy(false);
                if (ok) {
                  setCode("");
                  setLabel("");
                  setOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
