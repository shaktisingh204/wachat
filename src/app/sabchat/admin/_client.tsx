"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Inbox as InboxIcon, MessageSquareText, Plus, Tag, Trash2 } from "lucide-react";

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
import type { SabChatInbox } from "@/lib/rust-client/sabchat";
import type { SabChatMacro } from "@/lib/rust-client/sabchat-macros";
import type { SabChatDisposition } from "@/lib/rust-client/sabchat-dispositions";

type Tab = "inboxes" | "macros" | "dispositions";

const TABS: { id: Tab; label: string; icon: typeof InboxIcon }[] = [
  { id: "inboxes", label: "Inboxes", icon: InboxIcon },
  { id: "macros", label: "Canned responses", icon: MessageSquareText },
  { id: "dispositions", label: "Dispositions", icon: Tag },
];

export function AdminClient({
  initialInboxes,
  initialMacros,
  initialDispositions,
}: {
  initialInboxes: SabChatInbox[];
  initialMacros: SabChatMacro[];
  initialDispositions: SabChatDisposition[];
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
      </div>
    </div>
  );
}

type ActionRunner = (
  fn: () => Promise<{ ok: boolean; error?: string }>,
  okMsg?: string,
) => Promise<boolean>;

/* ── Inboxes ───────────────────────────────────────────────────────────── */

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

/* ── Macros ────────────────────────────────────────────────────────────── */

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

/* ── Dispositions ──────────────────────────────────────────────────────── */

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
