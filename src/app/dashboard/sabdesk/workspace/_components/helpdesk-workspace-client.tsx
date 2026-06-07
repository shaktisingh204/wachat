"use client";

/**
 * <HelpdeskWorkspaceClient> - three-pane Zoho-Desk-style helpdesk view.
 *
 * Layout (resizable via flex-basis, 12-col virtual grid on desktop):
 *   - LEFT (3 cols)   : ticket list with search + status filter
 *   - CENTER (6 cols) : conversation thread + composer tabs
 *   - RIGHT (3 cols)  : properties panel (status / priority / assignee /
 *                       SLA timer)
 *
 * All inline mutations route through `helpdesk.actions.ts`, which carries
 * the Rust BFF + Mongo dual-impl behind the scenes.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Send,
  Search,
  StickyNote,
  Ticket as TicketIcon,
  User,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
  useToast,
  type BadgeTone,
} from "@/components/sabcrm/20ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/sabcrm/20ui";

import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";
import type { CrmReplyTemplateDoc } from "@/lib/rust-client/crm-reply-templates";
import {
  addTicketReply,
  addTicketInternalNote,
  setTicketStatus,
  setTicketPriority,
  setTicketAssignee,
} from "@/app/actions/helpdesk.actions";

/* --- Types --------------------------------------------------------- */

type TabKey = "reply" | "note";

type Props = {
  initialTickets: CrmTicketDoc[];
  initialError?: string;
  initialSelectedId: string | null;
  initialStatus: string;
  templates: { items: CrmReplyTemplateDoc[] };
};

/* --- Helpers ------------------------------------------------------- */

const STATUS_TONES: Record<string, BadgeTone> = {
  open: "info",
  pending: "warning",
  on_hold: "warning",
  resolved: "success",
  closed: "neutral",
  reopened: "danger",
};

const PRIORITY_TONES: Record<string, BadgeTone> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
  urgent: "danger",
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-3 w-3" aria-hidden="true" />,
  whatsapp: <MessageSquare className="h-3 w-3" aria-hidden="true" />,
  chat: <MessageSquare className="h-3 w-3" aria-hidden="true" />,
  phone: <Phone className="h-3 w-3" aria-hidden="true" />,
  portal: <User className="h-3 w-3" aria-hidden="true" />,
  web: <MessageSquare className="h-3 w-3" aria-hidden="true" />,
  form: <StickyNote className="h-3 w-3" aria-hidden="true" />,
  api: <TicketIcon className="h-3 w-3" aria-hidden="true" />,
};

function formatRelative(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return "-";
  const diff = Date.now() - d;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function slaState(
  dueBy?: string,
  status?: string,
): {
  tone: BadgeTone;
  label: string;
} {
  if (!dueBy || status === "closed" || status === "resolved") {
    return { tone: "neutral", label: "No SLA" };
  }
  const now = Date.now();
  const due = new Date(dueBy).getTime();
  if (!Number.isFinite(due)) return { tone: "neutral", label: "No SLA" };
  const diff = due - now;
  if (diff <= 0) return { tone: "danger", label: "Breached" };
  if (diff < 60 * 60_000)
    return {
      tone: "warning",
      label: `Due in ${Math.floor(diff / 60_000)}m`,
    };
  if (diff < 24 * 60 * 60_000)
    return {
      tone: "warning",
      label: `Due in ${Math.floor(diff / 3_600_000)}h`,
    };
  return {
    tone: "success",
    label: `Due in ${Math.floor(diff / 86_400_000)}d`,
  };
}

/* --- Component ----------------------------------------------------- */

export function HelpdeskWorkspaceClient(props: Props): React.JSX.Element {
  const { toast } = useToast();
  const router = useRouter();

  const [tickets, setTickets] = React.useState<CrmTicketDoc[]>(
    props.initialTickets ?? [],
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(
    props.initialSelectedId ?? props.initialTickets[0]?._id ?? null,
  );
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState(props.initialStatus);
  const [tab, setTab] = React.useState<TabKey>("reply");
  const [composer, setComposer] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const selected = React.useMemo(
    () => tickets.find((t) => t._id === selectedId) ?? null,
    [tickets, selectedId],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== "all" && (t.status ?? "open") !== statusFilter)
        return false;
      if (!q) return true;
      return `${t.subject ?? ""} ${t.requesterId ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [tickets, search, statusFilter]);

  /* -- Mutators ----------------------------------------------------- */

  const patchSelected = (patch: Partial<CrmTicketDoc>) => {
    if (!selected) return;
    setTickets((rows) =>
      rows.map((r) => (r._id === selected._id ? { ...r, ...patch } : r)),
    );
  };

  const handleSend = () => {
    if (!selected || !composer.trim()) return;
    const body = composer;
    const action = tab === "note" ? addTicketInternalNote : addTicketReply;
    startTransition(async () => {
      const res = await action(selected._id, body);
      if (res.success) {
        toast.success(tab === "note" ? "Internal note added" : "Reply sent");
        setComposer("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed");
      }
    });
  };

  const handleStatus = (status: string) => {
    if (!selected) return;
    patchSelected({ status });
    startTransition(async () => {
      const res = await setTicketStatus(selected._id, status);
      if (!res.success) {
        toast.error(res.error ?? "Failed");
        router.refresh();
      }
    });
  };

  const handlePriority = (priority: string) => {
    if (!selected) return;
    patchSelected({ priority });
    startTransition(async () => {
      const res = await setTicketPriority(selected._id, priority);
      if (!res.success) {
        toast.error(res.error ?? "Failed");
        router.refresh();
      }
    });
  };

  const handleAssignee = (id: string) => {
    if (!selected) return;
    const next = id === "unassign" ? null : id;
    patchSelected({ assigneeId: next ?? undefined });
    startTransition(async () => {
      const res = await setTicketAssignee(selected._id, next);
      if (!res.success) {
        toast.error(res.error ?? "Failed");
        router.refresh();
      }
    });
  };

  const applyTemplate = (tpl: CrmReplyTemplateDoc) => {
    setTab("reply");
    setComposer((prev) => (prev ? `${prev}\n\n${tpl.body}` : tpl.body));
  };

  /* -- Render ------------------------------------------------------- */

  return (
    <div className="flex h-full min-h-0 flex-1 gap-0 overflow-hidden border-t border-[var(--st-border)]">
      {/* LEFT: ticket list */}
      <aside className="flex h-full w-[320px] min-w-[280px] shrink-0 flex-col border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <div className="flex flex-col gap-2 border-b border-[var(--st-border)] px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--st-text)]">Tickets</span>
            <Link href="/dashboard/sabdesk/new">
              <Button size="sm" variant="outline" iconLeft={Plus}>
                New
              </Button>
            </Link>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets..."
            inputSize="sm"
            iconLeft={Search}
            aria-label="Search tickets"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="on_hold">On hold</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="reopened">Reopened</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1">
          {props.initialError ? (
            <div className="p-4 text-[13px] text-[var(--st-danger)]">
              {props.initialError}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-[13px] text-[var(--st-text-secondary)]">
              No tickets match these filters.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--st-border)]">
              {filtered.map((t) => {
                const isActive = t._id === selectedId;
                const sla = slaState(t.dueBy, t.status);
                const channel = (t.channel ?? "web").toLowerCase();
                return (
                  <li key={t._id}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-pressed={isActive}
                      onClick={() => setSelectedId(t._id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(t._id);
                        }
                      }}
                      className={`flex w-full cursor-pointer flex-col gap-1.5 px-3 py-3 text-left transition-colors hover:bg-[var(--st-bg-muted)] ${
                        isActive ? "bg-[var(--st-bg-muted)]" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-[13px] font-medium text-[var(--st-text)]">
                          {t.subject ?? "(no subject)"}
                        </span>
                        <Badge tone={STATUS_TONES[t.status ?? "open"] ?? "neutral"}>
                          {t.status ?? "open"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--st-text-secondary)]">
                        <Badge tone="neutral" className="gap-1">
                          {CHANNEL_ICONS[channel] ?? (
                            <MessageSquare className="h-3 w-3" aria-hidden="true" />
                          )}
                          {channel}
                        </Badge>
                        {t.priority ? (
                          <Badge tone={PRIORITY_TONES[t.priority] ?? "neutral"}>
                            {t.priority}
                          </Badge>
                        ) : null}
                        <Badge tone={sla.tone}>
                          {sla.tone === "danger" ? (
                            <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                          ) : null}
                          {sla.label}
                        </Badge>
                        <span className="ml-auto">
                          {formatRelative(t.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </aside>

      {/* CENTER: conversation + composer */}
      <section className="flex h-full min-w-0 flex-1 flex-col bg-[var(--st-bg-secondary)]">
        {selected ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] px-5 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/sabdesk/${selected._id}`}
                  className="block truncate text-[15px] font-semibold text-[var(--st-text)] hover:underline"
                >
                  {selected.subject ?? "(no subject)"}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--st-text-secondary)]">
                  <Badge tone="neutral" className="gap-1">
                    {CHANNEL_ICONS[(selected.channel ?? "web").toLowerCase()] ??
                      null}
                    {selected.channel ?? "web"}
                  </Badge>
                  <Badge tone={STATUS_TONES[selected.status ?? "open"] ?? "neutral"}>
                    {selected.status ?? "open"}
                  </Badge>
                  <Badge tone={slaState(selected.dueBy, selected.status).tone}>
                    {slaState(selected.dueBy, selected.status).label}
                  </Badge>
                  <span>Updated {formatRelative(selected.updatedAt)}</span>
                </div>
              </div>
            </header>

            <ScrollArea className="flex-1">
              <div className="space-y-3 px-5 py-5">
                {(
                  selected.internalNotes as
                    | Array<Record<string, unknown>>
                    | undefined
                )?.length ? (
                  (
                    selected.internalNotes as Array<Record<string, unknown>>
                  ).map((n, i) => (
                    <Card key={String(n._id ?? i)} padding="none">
                      <CardBody className="space-y-1 p-3 text-[13px]">
                        <div className="flex items-center gap-2 text-[11px] text-[var(--st-text-secondary)]">
                          {n.isInternal ? (
                            <Badge tone="warning">Internal</Badge>
                          ) : (
                            <Badge tone="info">Reply</Badge>
                          )}
                          <span>
                            {formatRelative(n.createdAt as string | undefined)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-[var(--st-text)]">
                          {String(n.body ?? "")}
                        </p>
                      </CardBody>
                    </Card>
                  ))
                ) : (
                  <EmptyState
                    title="No conversation yet"
                    description="Reply to the requester or jot an internal note below."
                  />
                )}
              </div>
            </ScrollArea>

            <footer className="border-t border-[var(--st-border)] bg-[var(--st-bg-muted)] px-5 py-3">
              <div className="mb-2 flex items-center gap-2">
                <Button
                  variant={tab === "reply" ? "primary" : "outline"}
                  size="sm"
                  iconLeft={Send}
                  onClick={() => setTab("reply")}
                >
                  Reply
                </Button>
                <Button
                  variant={tab === "note" ? "primary" : "outline"}
                  size="sm"
                  iconLeft={StickyNote}
                  onClick={() => setTab("note")}
                >
                  Internal note
                </Button>
                <div className="ml-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" iconRight={ChevronDown}>
                        Templates
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="max-h-[300px] overflow-y-auto"
                    >
                      {props.templates.items.length === 0 ? (
                        <div className="px-3 py-2 text-[12px] text-[var(--st-text-secondary)]">
                          No templates yet.{" "}
                          <Link
                            href="/dashboard/sabdesk/reply-templates/new"
                            className="underline"
                          >
                            Create one
                          </Link>
                        </div>
                      ) : (
                        props.templates.items.map((tpl) => (
                          <DropdownMenuItem
                            key={tpl._id}
                            onSelect={() => applyTemplate(tpl)}
                          >
                            <div className="flex flex-col">
                              <span className="text-[13px] font-medium">
                                {tpl.name}
                              </span>
                              {tpl.shortcut ? (
                                <span className="text-[11px] text-[var(--st-text-secondary)]">
                                  /{tpl.shortcut}
                                </span>
                              ) : null}
                            </div>
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <Textarea
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder={
                  tab === "reply"
                    ? "Type your reply to the requester..."
                    : "Internal note, visible to staff only."
                }
                aria-label={tab === "reply" ? "Reply body" : "Internal note body"}
                rows={4}
              />
              <div className="mt-2 flex items-center justify-end">
                <Button
                  onClick={handleSend}
                  variant="primary"
                  iconLeft={Send}
                  disabled={isPending || !composer.trim()}
                >
                  {tab === "reply" ? "Send reply" : "Save note"}
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              title="Pick a ticket"
              description="Select a ticket from the list to view its conversation."
            />
          </div>
        )}
      </section>

      {/* RIGHT: properties panel */}
      <aside className="hidden h-full w-[320px] min-w-[260px] shrink-0 flex-col border-l border-[var(--st-border)] bg-[var(--st-bg-secondary)] lg:flex">
        {selected ? (
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4 text-[13px]">
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
                  Workflow
                </h3>
                <div className="space-y-3">
                  <Field label="Status">
                    <Select
                      value={selected.status ?? "open"}
                      onValueChange={handleStatus}
                    >
                      <SelectTrigger aria-label="Status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="on_hold">On hold</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="reopened">Reopened</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Priority">
                    <Select
                      value={selected.priority ?? "medium"}
                      onValueChange={handlePriority}
                    >
                      <SelectTrigger aria-label="Priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label="Assignee"
                    help="Paste a user id, or 'unassign' to clear."
                  >
                    <Input
                      placeholder="Paste user id or 'unassign'"
                      defaultValue={selected.assigneeId ?? ""}
                      inputSize="sm"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v === (selected.assigneeId ?? "")) return;
                        handleAssignee(v || "unassign");
                      }}
                    />
                  </Field>
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
                  SLA
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-secondary)]">Due by</span>
                  <Badge tone={slaState(selected.dueBy, selected.status).tone}>
                    {slaState(selected.dueBy, selected.status).label}
                  </Badge>
                </div>
                {selected.dueBy ? (
                  <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
                    {new Date(selected.dueBy).toLocaleString()}
                  </p>
                ) : null}
              </section>

              <Separator />

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
                  Classification
                </h3>
                <dl className="space-y-1.5">
                  <div className="flex justify-between">
                    <dt className="text-[var(--st-text-secondary)]">Channel</dt>
                    <dd className="text-[var(--st-text)]">{selected.channel ?? "-"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--st-text-secondary)]">Severity</dt>
                    <dd className="text-[var(--st-text)]">
                      {selected.severity ?? "-"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--st-text-secondary)]">Category</dt>
                    <dd className="text-[var(--st-text)]">
                      {selected.category ?? "-"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--st-text-secondary)]">Requester</dt>
                    <dd className="truncate text-[var(--st-text)]">
                      {selected.requesterId ?? "-"}
                    </dd>
                  </div>
                </dl>
              </section>

              <Separator />

              <Link href={`/dashboard/sabdesk/${selected._id}`} className="block">
                <Button variant="outline" block>
                  Open full ticket
                </Button>
              </Link>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-[13px] text-[var(--st-text-secondary)]">
            Pick a ticket to see properties.
          </div>
        )}
      </aside>
    </div>
  );
}
