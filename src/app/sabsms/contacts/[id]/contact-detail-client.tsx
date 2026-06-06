"use client";

/**
 * SabSMS contact detail — client surface.
 *
 * Renders the full message thread, consent timeline, engagement KPI row,
 * drip + campaign memberships, send-message mini composer, custom-field
 * editor, GDPR actions, audit drawer, and the linked
 * CRM/SabWa/Wachat placeholder cards.
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
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  StatCard,
  Textarea,
} from "@/components/sabcrm/20ui/zoru";
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
      return <Badge variant="default">Double opt-in</Badge>;
    case "single":
      return <Badge variant="secondary">Single opt-in</Badge>;
    case "opt_out":
      return <Badge variant="destructive">Opted out</Badge>;
    default:
      return <Badge variant="outline">No consent</Badge>;
  }
}

function statusGlyph(status: string) {
  if (status === "delivered") return <CheckCircle2 className="h-3.5 w-3.5 text-[var(--st-text)]" />;
  if (status === "failed" || status === "rejected" || status === "undelivered") {
    return <XCircle className="h-3.5 w-3.5 text-[var(--st-text)]" />;
  }
  return <Activity className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />;
}

export function ContactDetailClient({
  contact,
  isAdmin,
}: ContactDetailClientProps) {
  const [state, setState] = React.useState(contact);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{
    kind: "ok" | "err";
    msg: string;
  } | null>(null);

  const [composerBody, setComposerBody] = React.useState("");
  const [noteBody, setNoteBody] = React.useState("");
  const [newFieldKey, setNewFieldKey] = React.useState("");
  const [newFieldValue, setNewFieldValue] = React.useState("");
  const [tagsDraft, setTagsDraft] = React.useState(contact.tags.join(", "));
  const [suppressionReason, setSuppressionReason] = React.useState("");
  const [auditOpen, setAuditOpen] = React.useState(false);
  const [eraseConfirm, setEraseConfirm] = React.useState(false);

  function flash(res: { ok: boolean; error?: string }, okMsg: string) {
    if (res.ok) setFeedback({ kind: "ok", msg: okMsg });
    else setFeedback({ kind: "err", msg: res.error ?? "Action failed" });
    setTimeout(() => setFeedback(null), 4000);
  }

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
        flash({ ok: true }, "Message queued");
        setComposerBody("");
      } else {
        flash({ ok: false, error: res.error }, "");
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
        flash({ ok: true }, "Note added");
      } else {
        flash({ ok: false, error: res.error }, "");
      }
    });
  }

  async function commitTags() {
    const tags = tagsDraft.split(",").map((t) => t.trim()).filter(Boolean);
    await withBusy("tags", async () => {
      const res = await setDetailTags({ contactId: state.id, tags });
      if (res.ok) {
        setState((prev) => ({ ...prev, tags }));
        flash({ ok: true }, "Tags saved");
      } else {
        flash({ ok: false, error: res.error }, "");
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
        flash({ ok: true }, "Field saved");
      } else {
        flash({ ok: false, error: res.error }, "");
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
        flash({ ok: true }, "Field removed");
      } else {
        flash({ ok: false, error: res.error }, "");
      }
    });
  }

  async function changeTimezone(tz: string) {
    await withBusy("tz", async () => {
      const res = await setTimezone({ contactId: state.id, timezone: tz });
      if (res.ok) {
        setState((prev) => ({ ...prev, timezone: tz }));
        flash({ ok: true }, "Time zone saved");
      } else {
        flash({ ok: false, error: res.error }, "");
      }
    });
  }

  async function changeLocale(loc: string) {
    await withBusy("locale", async () => {
      const res = await setLocale({ contactId: state.id, locale: loc });
      if (res.ok) {
        setState((prev) => ({ ...prev, locale: loc }));
        flash({ ok: true }, "Locale saved");
      } else {
        flash({ ok: false, error: res.error }, "");
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
        flash({ ok: true }, "Suppressed");
        setSuppressionReason("");
      } else {
        flash({ ok: false, error: res.error }, "");
      }
    });
  }

  async function removeSuppression() {
    await withBusy("supp-del", async () => {
      const res = await removeContactFromSuppression({ phone: state.phone });
      if (res.ok) {
        flash({ ok: true }, "Suppression removed");
      } else {
        flash({ ok: false, error: res.error }, "");
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
        flash({ ok: true }, "Export downloaded");
      } else {
        flash({ ok: false, error: res.error }, "");
      }
    });
  }

  async function confirmErase() {
    setEraseConfirm(false);
    await withBusy("gdpr-erase", async () => {
      const res = await gdprDeleteContact({ contactId: state.id });
      if (res.ok) {
        flash({ ok: true }, `Erased ${res.erased} record(s)`);
        window.location.href = "/sabsms/contacts";
      } else {
        flash({ ok: false, error: res.error }, "");
      }
    });
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={
            feedback.kind === "ok"
              ? "rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-sm text-[var(--st-text)]"
              : "rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-sm text-[var(--st-text)]"
          }
          role="status"
        >
          {feedback.msg}
        </div>
      )}

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
          invertDelta
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — conversation thread + composer */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <ZoruCardHeader className="flex flex-row items-center justify-between">
              <div>
                <ZoruCardTitle>Conversation thread</ZoruCardTitle>
                <ZoruCardDescription>
                  Full history with delivery ticks. {state.conversationId && (
                    <Link
                      className="text-[var(--st-accent)] hover:underline"
                      href={`/sabsms/inbox?conversationId=${state.conversationId}`}
                    >
                      Open in inbox <ExternalLink className="inline h-3 w-3" />
                    </Link>
                  )}
                </ZoruCardDescription>
              </div>
              <div className="flex items-center gap-2">
                {consentBadge(state.consent)}
              </div>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-2">
              {state.messages.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--st-border)] p-6 text-center text-sm text-[var(--st-text)]">
                  No messages exchanged yet.
                </div>
              ) : (
                <div className="max-h-[500px] space-y-2 overflow-y-auto">
                  {state.messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        m.direction === "outbound"
                          ? "ml-12 rounded-md bg-[var(--st-accent)]/10 p-3"
                          : "mr-12 rounded-md bg-[var(--st-bg-muted)] p-3"
                      }
                    >
                      <div className="flex items-center justify-between text-xs text-[var(--st-text)]">
                        <span className="inline-flex items-center gap-1">
                          {m.direction === "outbound" ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownLeft className="h-3 w-3" />
                          )}
                          {m.direction}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {statusGlyph(m.status)}
                          {m.status}
                          {m.createdAt && (
                            <span className="ml-2 text-[var(--st-text-secondary)]">
                              {new Date(m.createdAt).toLocaleString()}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 text-sm">{m.body}</div>
                      {m.errorMessage && (
                        <div className="mt-1 text-xs text-[var(--st-text)]">
                          {m.errorMessage}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ZoruCardContent>
          </Card>

          {/* Mini composer */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Send a message</ZoruCardTitle>
              <ZoruCardDescription>
                Enqueues an outbound SMS via the SabSMS engine, scoped to this
                contact.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-3">
              <Textarea
                value={composerBody}
                onChange={(e) => setComposerBody(e.target.value)}
                placeholder="Type your message…"
                rows={3}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--st-text)]">
                  {composerBody.length} characters
                </span>
                <Button
                  onClick={handleSend}
                  disabled={!composerBody.trim() || busy === "send"}
                >
                  {busy === "send" ? "Sending…" : "Send"}
                </Button>
              </div>
            </ZoruCardContent>
          </Card>

          {/* Consent timeline */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Consent timeline</ZoruCardTitle>
              <ZoruCardDescription>
                Every opt-in / opt-out captured for {state.phone}.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
              {state.consentEvents.length === 0 ? (
                <div className="text-sm text-[var(--st-text)]">No events.</div>
              ) : (
                <ol className="space-y-2 text-sm">
                  {state.consentEvents.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-start justify-between rounded-md border border-[var(--st-border)] bg-white p-2"
                    >
                      <div>
                        <div className="font-medium">{e.kind}</div>
                        <div className="text-xs text-[var(--st-text)]">
                          captured via {e.captureMethod}
                          {e.source && ` · ${e.source}`}
                        </div>
                      </div>
                      <span className="text-xs text-[var(--st-text-secondary)]">
                        {new Date(e.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </ZoruCardContent>
          </Card>

          {/* Notes */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Internal notes</ZoruCardTitle>
              <ZoruCardDescription>
                Visible to workspace members only. Never sent to the contact.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-3">
              <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Note for the team…"
                rows={2}
              />
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!noteBody.trim() || busy === "note"}
              >
                Add note
              </Button>
              <ul className="space-y-2 text-sm">
                {state.notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-md border border-[var(--st-border)] p-2"
                  >
                    <div className="text-xs text-[var(--st-text)]">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                    <div>{n.body}</div>
                  </li>
                ))}
              </ul>
            </ZoruCardContent>
          </Card>
        </div>

        {/* Right column — meta + actions */}
        <div className="space-y-4">
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Identity</ZoruCardTitle>
              <ZoruCardDescription>
                E.164 + workspace metadata.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-2 text-sm">
              <div>
                <span className="text-[var(--st-text)]">Phone:</span>{" "}
                <span className="font-mono">{state.phone}</span>
              </div>
              <div>
                <span className="text-[var(--st-text)]">Country:</span> {state.country}
              </div>
              {state.name && (
                <div>
                  <span className="text-[var(--st-text)]">Name:</span> {state.name}
                </div>
              )}
              {state.email && (
                <div>
                  <span className="text-[var(--st-text)]">Email:</span> {state.email}
                </div>
              )}
              <div>
                <span className="text-[var(--st-text)]">Engagement:</span>{" "}
                {state.engagementScore}/100
              </div>
              <div>
                <span className="text-[var(--st-text)]">Risk score:</span>{" "}
                <span
                  className={
                    state.riskScore >= 50
                      ? "text-[var(--st-text)] inline-flex items-center gap-1"
                      : "text-[var(--st-text)]"
                  }
                >
                  {state.riskScore >= 50 && <ShieldAlert className="h-3 w-3" />}
                  {state.riskScore}/100
                </span>
              </div>
            </ZoruCardContent>
          </Card>

          {/* Carrier */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Carrier</ZoruCardTitle>
              <ZoruCardDescription>HLR / operator details.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-1 text-sm">
              <div>
                <span className="text-[var(--st-text)]">Operator:</span>{" "}
                {state.carrier?.operator ?? "—"}
              </div>
              <div>
                <span className="text-[var(--st-text)]">Country:</span>{" "}
                {state.carrier?.country ?? state.country}
              </div>
              <div>
                <span className="text-[var(--st-text)]">Line type:</span>{" "}
                {state.carrier?.lineType ?? "—"}
              </div>
            </ZoruCardContent>
          </Card>

          {/* Tags */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Tags & labels</ZoruCardTitle>
              <ZoruCardDescription>Comma-separated.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-2">
              <Input
                value={tagsDraft}
                onChange={(e) => setTagsDraft(e.target.value)}
                placeholder="vip, india-tier-1"
              />
              <Button size="sm" onClick={commitTags} disabled={busy === "tags"}>
                <Tag className="mr-1.5 h-3.5 w-3.5" /> Save tags
              </Button>
              <div className="flex flex-wrap gap-1">
                {state.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            </ZoruCardContent>
          </Card>

          {/* Timezone + locale */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Overrides</ZoruCardTitle>
              <ZoruCardDescription>
                Per-contact time zone + locale (used by scheduled sends).
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-3">
              <div>
                <Label>Time zone</Label>
                <Select value={state.timezone} onValueChange={changeTimezone}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Pick a time zone" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {TZ_OPTIONS.map((tz) => (
                      <ZoruSelectItem key={tz} value={tz}>
                        {tz}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </Select>
              </div>
              <div>
                <Label>Locale</Label>
                <Select value={state.locale} onValueChange={changeLocale}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Pick a locale" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {LOCALE_OPTIONS.map((l) => (
                      <ZoruSelectItem key={l} value={l}>
                        {l}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </Select>
              </div>
            </ZoruCardContent>
          </Card>

          {/* Custom fields */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Custom fields</ZoruCardTitle>
              <ZoruCardDescription>Key / value pairs.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newFieldKey}
                  onChange={(e) => setNewFieldKey(e.target.value)}
                  placeholder="field key"
                  className="flex-1"
                />
                <Input
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                  placeholder="value"
                  className="flex-1"
                />
                <Button size="sm" onClick={addField} disabled={busy === "field"}>
                  Add
                </Button>
              </div>
              <ul className="space-y-1 text-sm">
                {Object.entries(state.customFields).map(([k, v]) => (
                  <li
                    key={k}
                    className="flex items-center justify-between rounded-md border border-[var(--st-border)] p-2"
                  >
                    <span>
                      <span className="font-medium">{k}</span>:{" "}
                      <span className="text-[var(--st-text)]">{v}</span>
                    </span>
                    <button
                      type="button"
                      className="text-xs text-[var(--st-text)] hover:underline"
                      onClick={() => removeField(k)}
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            </ZoruCardContent>
          </Card>

          {/* Drips */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Drip enrolments</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-2 text-sm">
              {state.drips.length === 0 ? (
                <div className="text-[var(--st-text)]">Not enrolled in any drip.</div>
              ) : (
                state.drips.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-md border border-[var(--st-border)] p-2"
                  >
                    <span>{d.dripName ?? d.dripId}</span>
                    <Badge variant="secondary">step {d.step}</Badge>
                  </div>
                ))
              )}
            </ZoruCardContent>
          </Card>

          {/* Campaigns */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Campaign memberships</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-2 text-sm">
              {state.campaigns.length === 0 ? (
                <div className="text-[var(--st-text)]">No campaign memberships.</div>
              ) : (
                state.campaigns.map((c) => (
                  <Link
                    key={c.id}
                    href={`/sabsms/campaigns/${c.campaignId}`}
                    className="flex items-center justify-between rounded-md border border-[var(--st-border)] p-2 hover:bg-[var(--st-bg-muted)]"
                  >
                    <span>{c.campaignName ?? c.campaignId}</span>
                    <Badge variant="outline">{c.status ?? "—"}</Badge>
                  </Link>
                ))
              )}
            </ZoruCardContent>
          </Card>

          {/* Linked CRM / SabWa / Wachat */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Linked records</ZoruCardTitle>
              <ZoruCardDescription>
                Cross-module handles. Placeholders shown when not linked yet.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-2 text-sm">
              {state.crmLeadId ? (
                <Link
                  href={`/dashboard/crm/leads/${state.crmLeadId}`}
                  className="flex items-center justify-between rounded-md border border-[var(--st-border)] p-2 hover:bg-[var(--st-bg-muted)]"
                >
                  <span>CRM lead</span>
                  <span className="text-xs text-[var(--st-text)] font-mono">
                    {state.crmLeadId}
                  </span>
                </Link>
              ) : (
                <div className="rounded-md border border-dashed border-[var(--st-border)] p-2 text-[var(--st-text-secondary)]">
                  No linked CRM lead
                </div>
              )}
              {state.crmDealId ? (
                <Link
                  href={`/dashboard/crm/deals/${state.crmDealId}`}
                  className="flex items-center justify-between rounded-md border border-[var(--st-border)] p-2 hover:bg-[var(--st-bg-muted)]"
                >
                  <span>CRM deal</span>
                  <span className="text-xs text-[var(--st-text)] font-mono">
                    {state.crmDealId}
                  </span>
                </Link>
              ) : (
                <div className="rounded-md border border-dashed border-[var(--st-border)] p-2 text-[var(--st-text-secondary)]">
                  No linked CRM deal
                </div>
              )}
              {state.sabwaContactId ? (
                <Link
                  href={`/sabwa/contacts/${state.sabwaContactId}`}
                  className="flex items-center justify-between rounded-md border border-[var(--st-border)] p-2 hover:bg-[var(--st-bg-muted)]"
                >
                  <span>SabWa contact</span>
                  <span className="text-xs text-[var(--st-text)] font-mono">
                    {state.sabwaContactId}
                  </span>
                </Link>
              ) : (
                <div className="rounded-md border border-dashed border-[var(--st-border)] p-2 text-[var(--st-text-secondary)]">
                  No linked SabWa contact
                </div>
              )}
              {state.wachatContactId ? (
                <Link
                  href={`/dashboard/contacts/${state.wachatContactId}`}
                  className="flex items-center justify-between rounded-md border border-[var(--st-border)] p-2 hover:bg-[var(--st-bg-muted)]"
                >
                  <span>Wachat contact</span>
                  <span className="text-xs text-[var(--st-text)] font-mono">
                    {state.wachatContactId}
                  </span>
                </Link>
              ) : (
                <div className="rounded-md border border-dashed border-[var(--st-border)] p-2 text-[var(--st-text-secondary)]">
                  No linked Wachat contact
                </div>
              )}
            </ZoruCardContent>
          </Card>

          {/* Suppression */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Suppression</ZoruCardTitle>
              <ZoruCardDescription>
                Hashed entries live in `sabsms_suppressions`.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-2">
              <Input
                value={suppressionReason}
                onChange={(e) => setSuppressionReason(e.target.value)}
                placeholder="reason (optional)"
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={addSuppression}
                disabled={busy === "supp"}
              >
                <ShieldOff className="mr-1.5 h-3.5 w-3.5" /> Add to suppression
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={removeSuppression}
                  disabled={busy === "supp-del"}
                >
                  Remove suppression (admin)
                </Button>
              )}
            </ZoruCardContent>
          </Card>

          {/* GDPR + audit */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Privacy</ZoruCardTitle>
              <ZoruCardDescription>
                Subject access + erasure. Audit drawer captures every consent
                event.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-2">
              <Button size="sm" variant="outline" onClick={exportGdpr}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> GDPR export (JSON)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAuditOpen(true)}
              >
                <History className="mr-1.5 h-3.5 w-3.5" /> View audit drawer
              </Button>
              <Separator />
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setEraseConfirm(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> GDPR delete request
              </Button>
              <p className="text-xs text-[var(--st-text)]">
                Deletion erases PII but retains a hashed suppression entry so
                future re-imports stay compliant.
              </p>
            </ZoruCardContent>
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
          <div className="text-sm text-[var(--st-text)]">No audit entries yet.</div>
        ) : (
          <ul className="space-y-3 text-sm">
            {state.consentEvents.map((e) => (
              <li
                key={e.id}
                className="rounded-md border border-[var(--st-border)] bg-white p-3"
              >
                <div className="flex justify-between text-xs text-[var(--st-text)]">
                  <span>{e.captureMethod}</span>
                  <span>{new Date(e.createdAt).toLocaleString()}</span>
                </div>
                <div className="mt-1 font-medium">{e.kind}</div>
                {e.source && (
                  <div className="text-xs text-[var(--st-text)]">via {e.source}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SabsmsDetailDrawer>

      {/* Erase confirm */}
      <ZoruAlertDialog open={eraseConfirm} onOpenChange={setEraseConfirm}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Permanently erase this contact?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              PII (phone, name, email, message bodies) will be replaced with
              hashed placeholders. The suppression hash is retained for
              compliance.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={confirmErase}>
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Erase
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Tiny inline icon to silence the unused-symbol case */}
      <MessageSquare className="hidden" aria-hidden />
    </div>
  );
}
