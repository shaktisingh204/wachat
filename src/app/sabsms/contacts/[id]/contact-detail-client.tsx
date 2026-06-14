"use client";

/**
 * SabSMS contact detail - client surface.
 *
 * Renders the full message thread, consent timeline, engagement KPI row,
 * drip + campaign memberships, send-message mini composer, custom-field
 * editor, GDPR actions, audit drawer, and the linked
 * CRM/Wachat placeholder cards.
 */

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Download,
  ExternalLink,
  History,
  MessageSquare,
  ShieldAlert,
  ShieldOff,
  Tag as TagIcon,
  Trash2,
  XCircle,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  StatCard,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";
import { SabsmsDetailDrawer } from "@/components/sabsms/page-toolkit";

import {
  addContactNote,
  addContactToSuppression,
  gdprDeleteContact,
  gdprExportContact,
  removeContactFromSuppression,
  removeCustomField,
  sendMessageFromDetail,
  setCustomField,
  setDetailTags,
  setLocale,
  setTimezone,
  type ContactDetailView,
} from "./actions";

interface ContactDetailClientProps {
  contact: ContactDetailView;
  isAdmin: boolean;
}

const TZ_OPTIONS = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

const LOCALE_OPTIONS = [
  "en",
  "en-US",
  "en-GB",
  "es",
  "fr",
  "de",
  "hi",
  "pt",
  "ja",
];

function consentBadge(c: ContactDetailView["consent"]) {
  switch (c) {
    case "double":
      return <Badge variant="success">Double opt-in</Badge>;
    case "single":
      return <Badge variant="secondary">Single opt-in</Badge>;
    case "opt_out":
      return <Badge variant="destructive">Opted out</Badge>;
    default:
      return <Badge variant="outline">No consent</Badge>;
  }
}

function statusGlyph(status: string) {
  if (status === "delivered") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-[var(--st-status-ok)]" aria-hidden />;
  }
  if (status === "failed" || status === "rejected" || status === "undelivered") {
    return <XCircle className="h-3.5 w-3.5 text-[var(--st-danger)]" aria-hidden />;
  }
  return <Activity className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" aria-hidden />;
}

export function ContactDetailClient({
  contact,
  isAdmin,
}: ContactDetailClientProps) {
  const { toast } = useToast();
  const [state, setState] = React.useState(contact);
  const [busy, setBusy] = React.useState<string | null>(null);

  const [composerBody, setComposerBody] = React.useState("");
  const [noteBody, setNoteBody] = React.useState("");
  const [newFieldKey, setNewFieldKey] = React.useState("");
  const [newFieldValue, setNewFieldValue] = React.useState("");
  const [tagsDraft, setTagsDraft] = React.useState(contact.tags.join(", "));
  const [suppressionReason, setSuppressionReason] = React.useState("");
  const [auditOpen, setAuditOpen] = React.useState(false);
  const [eraseConfirm, setEraseConfirm] = React.useState(false);

  async function withBusy<T>(label: string, fn: () => Promise<T>): Promise<T> {
    setBusy(label);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  }

  async function handleSend() {
    if (!composerBody.trim()) return;
    await withBusy("send", async () => {
      const res = await sendMessageFromDetail({
        contactId: state.id,
        phone: state.phone,
        body: composerBody,
      });
      if (res.ok) {
        toast.success("Message queued");
        setComposerBody("");
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  }

  async function handleAddNote() {
    if (!noteBody.trim()) return;
    await withBusy("note", async () => {
      const res = await addContactNote({
        contactId: state.id,
        body: noteBody,
      });
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          notes: [
            {
              id: crypto.randomUUID(),
              body: noteBody,
              createdAt: new Date().toISOString(),
            },
            ...prev.notes,
          ],
        }));
        setNoteBody("");
        toast.success("Note added");
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  }

  async function commitTags() {
    const tags = tagsDraft.split(",").map((t) => t.trim()).filter(Boolean);
    await withBusy("tags", async () => {
      const res = await setDetailTags({ contactId: state.id, tags });
      if (res.ok) {
        setState((prev) => ({ ...prev, tags }));
        toast.success("Tags saved");
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  }

  async function addField() {
    if (!newFieldKey.trim()) return;
    await withBusy("field", async () => {
      const res = await setCustomField({
        contactId: state.id,
        key: newFieldKey,
        value: newFieldValue,
      });
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          customFields: {
            ...prev.customFields,
            [newFieldKey]: newFieldValue,
          },
        }));
        setNewFieldKey("");
        setNewFieldValue("");
        toast.success("Field saved");
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  }

  async function removeField(key: string) {
    await withBusy("field-del", async () => {
      const res = await removeCustomField({ contactId: state.id, key });
      if (res.ok) {
        setState((prev) => {
          const next = { ...prev.customFields };
          delete next[key];
          return { ...prev, customFields: next };
        });
        toast.success("Field removed");
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  }

  async function changeTimezone(tz: string) {
    await withBusy("tz", async () => {
      const res = await setTimezone({ contactId: state.id, timezone: tz });
      if (res.ok) {
        setState((prev) => ({ ...prev, timezone: tz }));
        toast.success("Time zone saved");
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  }

  async function changeLocale(loc: string) {
    await withBusy("locale", async () => {
      const res = await setLocale({ contactId: state.id, locale: loc });
      if (res.ok) {
        setState((prev) => ({ ...prev, locale: loc }));
        toast.success("Locale saved");
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  }

  async function addSuppression() {
    await withBusy("supp", async () => {
      const res = await addContactToSuppression({
        phone: state.phone,
        reason: suppressionReason,
      });
      if (res.ok) {
        toast.success("Suppressed");
        setSuppressionReason("");
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  }

  async function removeSuppression() {
    await withBusy("supp-del", async () => {
      const res = await removeContactFromSuppression({ phone: state.phone });
      if (res.ok) {
        toast.success("Suppression removed");
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  }

  async function exportGdpr() {
    await withBusy("gdpr-export", async () => {
      const res = await gdprExportContact({ contactId: state.id });
      if (res.ok) {
        const blob = new Blob([JSON.stringify(res.payload, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sabsms-contact-${state.phone.replace(/[^0-9]/g, "")}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Export downloaded");
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  }

  async function confirmErase() {
    setEraseConfirm(false);
    await withBusy("gdpr-erase", async () => {
      const res = await gdprDeleteContact({ contactId: state.id });
      if (res.ok) {
        toast.success(`Erased ${res.erased} record(s)`);
        window.location.href = "/sabsms/contacts";
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Sent" value={state.metrics.sent.toLocaleString()} />
        <StatCard
          label="Delivered"
          value={state.metrics.delivered.toLocaleString()}
        />
        <StatCard
          label="Replied"
          value={state.metrics.replied.toLocaleString()}
        />
        <StatCard
          label="Clicked"
          value={state.metrics.clicked.toLocaleString()}
        />
        <StatCard
          label="Failed"
          value={state.metrics.failed.toLocaleString()}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column - conversation thread + composer */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Conversation thread</CardTitle>
                <CardDescription>
                  Full history with delivery ticks. {state.conversationId && (
                    <Link
                      className="text-[var(--st-accent)] hover:underline"
                      href={`/sabsms/inbox?conversationId=${state.conversationId}`}
                    >
                      Open in inbox{" "}
                      <ExternalLink className="inline h-3 w-3" aria-hidden />
                    </Link>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {consentBadge(state.consent)}
              </div>
            </CardHeader>
            <CardBody className="space-y-2">
              {state.messages.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No messages exchanged yet"
                  description="Outbound and inbound SMS will appear here as they are sent and received."
                  size="sm"
                />
              ) : (
                <div className="max-h-[500px] space-y-2 overflow-y-auto">
                  {state.messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        m.direction === "outbound"
                          ? "ml-12 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] p-3"
                          : "mr-12 rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-3"
                      }
                    >
                      <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
                        <span className="inline-flex items-center gap-1">
                          {m.direction === "outbound" ? (
                            <ArrowUpRight className="h-3 w-3" aria-hidden />
                          ) : (
                            <ArrowDownLeft className="h-3 w-3" aria-hidden />
                          )}
                          {m.direction}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {statusGlyph(m.status)}
                          {m.status}
                          {m.createdAt && (
                            <span className="ml-2 text-[var(--st-text-tertiary)]">
                              {new Date(m.createdAt).toLocaleString()}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-[var(--st-text)]">{m.body}</div>
                      {m.errorMessage && (
                        <div className="mt-1 text-xs text-[var(--st-danger)]">
                          {m.errorMessage}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Mini composer */}
          <Card>
            <CardHeader>
              <CardTitle>Send a message</CardTitle>
              <CardDescription>
                Enqueues an outbound SMS via the SabSMS engine, scoped to this
                contact.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              <Field label="Message" className="space-y-0">
                <Textarea
                  value={composerBody}
                  onChange={(e) => setComposerBody(e.target.value)}
                  placeholder="Type your message..."
                  rows={3}
                />
              </Field>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--st-text-secondary)]">
                  {composerBody.length} characters
                </span>
                <Button
                  variant="primary"
                  onClick={handleSend}
                  disabled={!composerBody.trim()}
                  loading={busy === "send"}
                >
                  Send
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Consent timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Consent timeline</CardTitle>
              <CardDescription>
                Every opt-in / opt-out captured for {state.phone}.
              </CardDescription>
            </CardHeader>
            <CardBody>
              {state.consentEvents.length === 0 ? (
                <EmptyState title="No consent events" size="sm" />
              ) : (
                <ol className="space-y-2 text-sm">
                  {state.consentEvents.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-start justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2"
                    >
                      <div>
                        <div className="font-medium text-[var(--st-text)]">{e.kind}</div>
                        <div className="text-xs text-[var(--st-text-secondary)]">
                          captured via {e.captureMethod}
                          {e.source && ` , ${e.source}`}
                        </div>
                      </div>
                      <span className="text-xs text-[var(--st-text-tertiary)]">
                        {new Date(e.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Internal notes</CardTitle>
              <CardDescription>
                Visible to workspace members only. Never sent to the contact.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              <Field label="New note" className="space-y-0">
                <Textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Note for the team..."
                  rows={2}
                />
              </Field>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddNote}
                disabled={!noteBody.trim()}
                loading={busy === "note"}
              >
                Add note
              </Button>
              <ul className="space-y-2 text-sm">
                {state.notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-2"
                  >
                    <div className="text-xs text-[var(--st-text-secondary)]">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                    <div className="text-[var(--st-text)]">{n.body}</div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        {/* Right column - meta + actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
              <CardDescription>
                E.164 + workspace metadata.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              <div>
                <span className="text-[var(--st-text-secondary)]">Phone:</span>{" "}
                <span className="font-mono text-[var(--st-text)]">{state.phone}</span>
              </div>
              <div>
                <span className="text-[var(--st-text-secondary)]">Country:</span>{" "}
                <span className="text-[var(--st-text)]">{state.country}</span>
              </div>
              {state.name && (
                <div>
                  <span className="text-[var(--st-text-secondary)]">Name:</span>{" "}
                  <span className="text-[var(--st-text)]">{state.name}</span>
                </div>
              )}
              {state.email && (
                <div>
                  <span className="text-[var(--st-text-secondary)]">Email:</span>{" "}
                  <span className="text-[var(--st-text)]">{state.email}</span>
                </div>
              )}
              <div>
                <span className="text-[var(--st-text-secondary)]">Engagement:</span>{" "}
                <span className="text-[var(--st-text)]">{state.engagementScore}/100</span>
              </div>
              <div>
                <span className="text-[var(--st-text-secondary)]">Risk score:</span>{" "}
                <span
                  className={
                    state.riskScore >= 50
                      ? "inline-flex items-center gap-1 text-[var(--st-danger)]"
                      : "text-[var(--st-text)]"
                  }
                >
                  {state.riskScore >= 50 && (
                    <ShieldAlert className="h-3 w-3" aria-hidden />
                  )}
                  {state.riskScore}/100
                </span>
              </div>
            </CardBody>
          </Card>

          {/* Carrier */}
          <Card>
            <CardHeader>
              <CardTitle>Carrier</CardTitle>
              <CardDescription>HLR / operator details.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-1 text-sm">
              <div>
                <span className="text-[var(--st-text-secondary)]">Operator:</span>{" "}
                <span className="text-[var(--st-text)]">
                  {state.carrier?.operator ?? "Not set"}
                </span>
              </div>
              <div>
                <span className="text-[var(--st-text-secondary)]">Country:</span>{" "}
                <span className="text-[var(--st-text)]">
                  {state.carrier?.country ?? state.country}
                </span>
              </div>
              <div>
                <span className="text-[var(--st-text-secondary)]">Line type:</span>{" "}
                <span className="text-[var(--st-text)]">
                  {state.carrier?.lineType ?? "Not set"}
                </span>
              </div>
            </CardBody>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Tags &amp; labels</CardTitle>
              <CardDescription>Comma-separated.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-2">
              <Field label="Tags" className="space-y-0">
                <Input
                  value={tagsDraft}
                  onChange={(e) => setTagsDraft(e.target.value)}
                  placeholder="vip, india-tier-1"
                />
              </Field>
              <Button
                variant="secondary"
                size="sm"
                iconLeft={TagIcon}
                onClick={commitTags}
                loading={busy === "tags"}
              >
                Save tags
              </Button>
              <div className="flex flex-wrap gap-1">
                {state.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Timezone + locale */}
          <Card>
            <CardHeader>
              <CardTitle>Overrides</CardTitle>
              <CardDescription>
                Per-contact time zone + locale (used by scheduled sends).
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              <Field label="Time zone" className="space-y-0">
                <Select value={state.timezone} onValueChange={changeTimezone}>
                  <SelectTrigger aria-label="Time zone">
                    <SelectValue placeholder="Pick a time zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TZ_OPTIONS.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Locale" className="space-y-0">
                <Select value={state.locale} onValueChange={changeLocale}>
                  <SelectTrigger aria-label="Locale">
                    <SelectValue placeholder="Pick a locale" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALE_OPTIONS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </CardBody>
          </Card>

          {/* Custom fields */}
          <Card>
            <CardHeader>
              <CardTitle>Custom fields</CardTitle>
              <CardDescription>Key / value pairs.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-2">
              <div className="flex gap-2">
                <Field label="Field key" className="flex-1 space-y-0">
                  <Input
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                    placeholder="field key"
                  />
                </Field>
                <Field label="Value" className="flex-1 space-y-0">
                  <Input
                    value={newFieldValue}
                    onChange={(e) => setNewFieldValue(e.target.value)}
                    placeholder="value"
                  />
                </Field>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={addField}
                loading={busy === "field"}
              >
                Add
              </Button>
              <ul className="space-y-1 text-sm">
                {Object.entries(state.customFields).map(([k, v]) => (
                  <li
                    key={k}
                    className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-2"
                  >
                    <span className="text-[var(--st-text)]">
                      <span className="font-medium">{k}</span>:{" "}
                      <span className="text-[var(--st-text-secondary)]">{v}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(k)}
                      loading={busy === "field-del"}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {/* Drips */}
          <Card>
            <CardHeader>
              <CardTitle>Drip enrolments</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              {state.drips.length === 0 ? (
                <p className="text-[var(--st-text-secondary)]">
                  Not enrolled in any drip.
                </p>
              ) : (
                state.drips.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-2 text-[var(--st-text)]"
                  >
                    <span>{d.dripName ?? d.dripId}</span>
                    <Badge variant="secondary">step {d.step}</Badge>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* Campaigns */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign memberships</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              {state.campaigns.length === 0 ? (
                <p className="text-[var(--st-text-secondary)]">
                  No campaign memberships.
                </p>
              ) : (
                state.campaigns.map((c) => (
                  <Link
                    key={c.id}
                    href={`/sabsms/campaigns/${c.campaignId}`}
                    className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-2 text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                  >
                    <span>{c.campaignName ?? c.campaignId}</span>
                    <Badge variant="outline">{c.status ?? "Unknown"}</Badge>
                  </Link>
                ))
              )}
            </CardBody>
          </Card>

          {/* Linked CRM / Wachat */}
          <Card>
            <CardHeader>
              <CardTitle>Linked records</CardTitle>
              <CardDescription>
                Cross-module handles. Placeholders shown when not linked yet.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              {state.crmLeadId ? (
                <Link
                  href={`/dashboard/crm/leads/${state.crmLeadId}`}
                  className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-2 text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                >
                  <span>CRM lead</span>
                  <span className="font-mono text-xs text-[var(--st-text-secondary)]">
                    {state.crmLeadId}
                  </span>
                </Link>
              ) : (
                <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] p-2 text-[var(--st-text-tertiary)]">
                  No linked CRM lead
                </div>
              )}
              {state.crmDealId ? (
                <Link
                  href={`/dashboard/crm/deals/${state.crmDealId}`}
                  className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-2 text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                >
                  <span>CRM deal</span>
                  <span className="font-mono text-xs text-[var(--st-text-secondary)]">
                    {state.crmDealId}
                  </span>
                </Link>
              ) : (
                <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] p-2 text-[var(--st-text-tertiary)]">
                  No linked CRM deal
                </div>
              )}
              {state.wachatContactId ? (
                <Link
                  href={`/dashboard/contacts/${state.wachatContactId}`}
                  className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-2 text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                >
                  <span>Wachat contact</span>
                  <span className="font-mono text-xs text-[var(--st-text-secondary)]">
                    {state.wachatContactId}
                  </span>
                </Link>
              ) : (
                <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] p-2 text-[var(--st-text-tertiary)]">
                  No linked Wachat contact
                </div>
              )}
            </CardBody>
          </Card>

          {/* Suppression */}
          <Card>
            <CardHeader>
              <CardTitle>Suppression</CardTitle>
              <CardDescription>
                Hashed entries live in `sabsms_suppressions`.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-2">
              <Field label="Reason" className="space-y-0">
                <Input
                  value={suppressionReason}
                  onChange={(e) => setSuppressionReason(e.target.value)}
                  placeholder="reason (optional)"
                />
              </Field>
              <Button
                variant="danger"
                size="sm"
                iconLeft={ShieldOff}
                onClick={addSuppression}
                loading={busy === "supp"}
              >
                Add to suppression
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={removeSuppression}
                  loading={busy === "supp-del"}
                >
                  Remove suppression (admin)
                </Button>
              )}
            </CardBody>
          </Card>

          {/* GDPR + audit */}
          <Card>
            <CardHeader>
              <CardTitle>Privacy</CardTitle>
              <CardDescription>
                Subject access + erasure. Audit drawer captures every consent
                event.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                iconLeft={Download}
                onClick={exportGdpr}
                loading={busy === "gdpr-export"}
              >
                GDPR export (JSON)
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconLeft={History}
                onClick={() => setAuditOpen(true)}
              >
                View audit drawer
              </Button>
              <Separator />
              <Button
                variant="danger"
                size="sm"
                iconLeft={Trash2}
                onClick={() => setEraseConfirm(true)}
              >
                GDPR delete request
              </Button>
              <p className="text-xs text-[var(--st-text-secondary)]">
                Deletion erases PII but retains a hashed suppression entry so
                future re-imports stay compliant.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Audit drawer */}
      <SabsmsDetailDrawer
        open={auditOpen}
        onOpenChange={setAuditOpen}
        title="Contact audit"
        description="Every consent + opt-in / opt-out event captured for this phone."
      >
        {state.consentEvents.length === 0 ? (
          <EmptyState
            icon={History}
            title="No audit entries yet"
            size="sm"
          />
        ) : (
          <ul className="space-y-3 text-sm">
            {state.consentEvents.map((e) => (
              <li
                key={e.id}
                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3"
              >
                <div className="flex justify-between text-xs text-[var(--st-text-secondary)]">
                  <span>{e.captureMethod}</span>
                  <span>{new Date(e.createdAt).toLocaleString()}</span>
                </div>
                <div className="mt-1 font-medium text-[var(--st-text)]">{e.kind}</div>
                {e.source && (
                  <div className="text-xs text-[var(--st-text-secondary)]">
                    via {e.source}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SabsmsDetailDrawer>

      {/* Erase confirm */}
      <AlertDialog open={eraseConfirm} onOpenChange={setEraseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Permanently erase this contact?
            </AlertDialogTitle>
            <AlertDialogDescription>
              PII (phone, name, email, message bodies) will be replaced with
              hashed placeholders. The suppression hash is retained for
              compliance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmErase}>
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Erase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
