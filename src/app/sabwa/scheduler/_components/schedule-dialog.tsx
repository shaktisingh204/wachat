"use client";

import { Button, Calendar, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Popover, PopoverContent, PopoverTrigger, RadioGroup, ZoruRadioGroupItem, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, cn, useToast } from '@/components/sabcrm/20ui/compat';
import {
  CalendarIcon,
  Clock,
  Loader2,
  Megaphone,
  MessageSquare,
  Paperclip,
  Send,
  Users,
  X,
  } from "lucide-react";

/**
 * ScheduleDialog — shared modal for creating / editing scheduled SabWa
 * messages. Re-used by:
 *
 *   - `/sabwa/scheduler`           (calendar view)
 *   - `/sabwa/scheduler/queue`     (queue table)
 *   - any "Schedule send" CTA elsewhere in the SabWa shell.
 *
 * Phase 1 wiring: every persistence call goes through the server actions
 * in `@/app/actions/sabwa.actions` (`scheduleMessage`,
 * `updateScheduledMessage`, plus `sendMessage` for the "Test now"
 * shortcut). Those actions are still stubs that throw "not implemented",
 * so the UI catches and surfaces them as a toast — that's expected for
 * Phase 1 and unblocks the rest of the scheduler UI.
 *
 * SabFiles policy: media attachments come from `<SabFilePickerButton>`.
 * There is intentionally no free-text URL field.
 *
 * Rebuilt on ZoruUI primitives. The recipient-type picker is rendered as
 * a segmented Button group (no tab UI per ZoruUI design rules).
 */

import * as React from "react";

import { SabFilePickerButton } from "@/components/sabfiles";

import {
  scheduleMessage,
  updateScheduledMessage,
  sendMessage,
  type SabwaActionResult,
  type SabwaScheduledDraft,
  type SabwaSendMessagePayload,
} from "@/app/actions/sabwa.actions";

import { useChats, useResolveJid } from "@/lib/sabwa/use-sabwa-data";
import { formatJid } from "@/lib/sabwa/format-jid";

import type {
  SabwaScheduledTarget,
  SabwaScheduledTargetType,
  SabwaChat,
} from "@/lib/sabwa/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SchedulerRecurrence =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "custom";

export type SchedulerEndKind = "never" | "count" | "date";

export interface ScheduleDialogInitial {
  scheduledId?: string;
  sessionId?: string;
  targets?: SabwaScheduledTarget[];
  body?: string;
  mediaSabFileId?: string;
  mediaName?: string;
  scheduledFor?: Date;
  timezone?: string;
  recurrence?: SchedulerRecurrence;
  cron?: string;
  endKind?: SchedulerEndKind;
  endCount?: number;
  endDate?: Date;
}

export interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Pre-fill values (edit mode → existing row; create mode → defaults). */
  initial?: ScheduleDialogInitial;
  /** Pre-selected day when opened from a calendar cell. */
  defaultDate?: Date;
  /** Active SabWa session this schedule belongs to. */
  sessionId?: string;
  /** Called after a successful save (parent should revalidate). */
  onSaved?: () => void;
}

interface TargetDraft extends SabwaScheduledTarget {
  label: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DEFAULT_TIMEZONE: string =
  typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    : "UTC";

const TIMEZONES: string[] = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Australia/Sydney",
];

function targetTypeMeta(type: SabwaScheduledTargetType): {
  label: string;
  badge: "secondary" | "default";
  className: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (type) {
    case "group":
      return {
        label: "Group",
        badge: "secondary",
        className: "border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]",
        Icon: Users,
      };
    case "broadcast":
      return {
        label: "Broadcast",
        badge: "secondary",
        className: "border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]",
        Icon: Megaphone,
      };
    case "individual":
    default:
      return {
        label: "Chat",
        badge: "default",
        className: "border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]",
        Icon: MessageSquare,
      };
  }
}

function formatDateInput(date: Date): string {
  // yyyy-MM-dd in local time for <input type="date">.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimeInput(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

function combineDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const [h, mi] = (timeStr || "00:00").split(":").map((v) => parseInt(v, 10));
  if ([y, m, d].some((v) => Number.isNaN(v))) return null;
  return new Date(y, (m || 1) - 1, d, h || 0, mi || 0, 0, 0);
}

function recurrenceToCron(
  recurrence: SchedulerRecurrence,
  date: Date,
  custom: string,
): string | undefined {
  const minute = date.getMinutes();
  const hour = date.getHours();
  switch (recurrence) {
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly":
      return `${minute} ${hour} * * ${date.getDay()}`;
    case "monthly":
      return `${minute} ${hour} ${date.getDate()} * *`;
    case "custom":
      return custom.trim() || undefined;
    case "none":
    default:
      return undefined;
  }
}

function describeCron(cron: string): string {
  // Best-effort, dependency-free explainer. Recognises the common shapes we
  // generate ourselves; falls through to a generic label for unknown crons.
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return "Custom schedule";
  const [min, hour, dom, mon, dow] = parts;
  const hh = Number(hour);
  const mm = Number(min);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return "Custom schedule";
  const time = `${String(hh % 12 === 0 ? 12 : hh % 12)}:${String(mm).padStart(
    2,
    "0",
  )} ${hh < 12 ? "AM" : "PM"}`;
  if (dom === "*" && mon === "*" && dow === "*") return `Every day at ${time}`;
  if (dom === "*" && mon === "*" && /^[0-6]$/.test(dow)) {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return `Every ${days[Number(dow)]} at ${time}`;
  }
  if (dom === "*" && mon === "*" && dow === "1-5") {
    return `Every weekday at ${time}`;
  }
  if (mon === "*" && dow === "*" && /^\d+$/.test(dom)) {
    return `Day ${dom} of every month at ${time}`;
  }
  return "Custom schedule";
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ScheduleDialog({
  open,
  onOpenChange,
  mode,
  initial,
  defaultDate,
  sessionId,
  onSaved,
}: ScheduleDialogProps) {
  const toast = useToast();

  // ─ State ────────────────────────────────────────────────────────────────
  const initialDate = React.useMemo(
    () => initial?.scheduledFor ?? defaultDate ?? nextDefaultDate(),
    [initial?.scheduledFor, defaultDate],
  );

  const [targets, setTargets] = React.useState<TargetDraft[]>(
    () =>
      (initial?.targets ?? []).map((t) => ({
        ...t,
        label: t.jid,
      })) as TargetDraft[],
  );
  const [targetTab, setTargetTab] =
    React.useState<SabwaScheduledTargetType>("individual");
  const [search, setSearch] = React.useState("");
  const [jidInput, setJidInput] = React.useState("");
  const [body, setBody] = React.useState<string>(initial?.body ?? "");
  const [mediaId, setMediaId] = React.useState<string | undefined>(
    initial?.mediaSabFileId,
  );
  const [mediaName, setMediaName] = React.useState<string | undefined>(
    initial?.mediaName,
  );

  const [dateStr, setDateStr] = React.useState<string>(
    formatDateInput(initialDate),
  );
  const [timeStr, setTimeStr] = React.useState<string>(
    formatTimeInput(initialDate),
  );
  const [timezone, setTimezone] = React.useState<string>(
    initial?.timezone ?? DEFAULT_TIMEZONE,
  );
  const [datePopoverOpen, setDatePopoverOpen] = React.useState(false);

  const [recurrence, setRecurrence] = React.useState<SchedulerRecurrence>(
    initial?.recurrence ?? "none",
  );
  const [customCron, setCustomCron] = React.useState<string>(
    initial?.cron ?? "0 9 * * 1-5",
  );

  const [endKind, setEndKind] = React.useState<SchedulerEndKind>(
    initial?.endKind ?? "never",
  );
  const [endCount, setEndCount] = React.useState<number>(
    initial?.endCount ?? 10,
  );
  const [endDate, setEndDate] = React.useState<string>(
    initial?.endDate ? formatDateInput(initial.endDate) : "",
  );

  const [submitting, setSubmitting] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  // ─ Live chat picker data ────────────────────────────────────────────────
  const { data: chatsData, loading: chatsLoading } = useChats(sessionId);
  const resolveJid = useResolveJid(sessionId);

  // Filter chats by selected recipient-kind tab. SabWa types use
  // `'individual' | 'group' | 'broadcast' | 'status'`; we map "broadcast"
  // to status-typed chats (closest live representation) and individual
  // covers both contacts and linked-id one-to-one chats.
  const visibleChats = React.useMemo<SabwaChat[]>(() => {
    const all = chatsData ?? [];
    return all.filter((c) => {
      if (targetTab === "group") return c.type === "group";
      if (targetTab === "broadcast")
        return c.type === "broadcast" || c.type === "status";
      // "individual"
      return c.type === "individual" || c.type == null;
    });
  }, [chatsData, targetTab]);

  // Apply the search-string filter locally — cmdk's built-in fuzzy filter
  // also runs via `value=` on each item, but we pre-narrow so the empty
  // state message stays meaningful.
  const filteredChats = React.useMemo<SabwaChat[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleChats;
    return visibleChats.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const jid = c.jid.toLowerCase();
      const phone = formatJid(c.jid).toLowerCase();
      return name.includes(q) || jid.includes(q) || phone.includes(q);
    });
  }, [visibleChats, search]);

  // Reset whenever the dialog re-opens with fresh initial values.
  React.useEffect(() => {
    if (!open) return;
    setTargets(
      (initial?.targets ?? []).map((t) => ({ ...t, label: t.jid })),
    );
    setBody(initial?.body ?? "");
    setMediaId(initial?.mediaSabFileId);
    setMediaName(initial?.mediaName);
    const d = initial?.scheduledFor ?? defaultDate ?? nextDefaultDate();
    setDateStr(formatDateInput(d));
    setTimeStr(formatTimeInput(d));
    setTimezone(initial?.timezone ?? DEFAULT_TIMEZONE);
    setRecurrence(initial?.recurrence ?? "none");
    setCustomCron(initial?.cron ?? "0 9 * * 1-5");
    setEndKind(initial?.endKind ?? "never");
    setEndCount(initial?.endCount ?? 10);
    setEndDate(initial?.endDate ? formatDateInput(initial.endDate) : "");
    setSearch("");
    setJidInput("");
  }, [open, initial, defaultDate]);

  // ─ Derived ──────────────────────────────────────────────────────────────
  const combined = React.useMemo(
    () => combineDateTime(dateStr, timeStr),
    [dateStr, timeStr],
  );

  const cronPreview = React.useMemo(() => {
    if (recurrence === "none") return "Sends once at the selected time.";
    const cron = recurrenceToCron(
      recurrence,
      combined ?? new Date(),
      customCron,
    );
    if (!cron) return "Pick a recurrence.";
    return describeCron(cron);
  }, [recurrence, combined, customCron]);

  const errors = React.useMemo(() => {
    const list: string[] = [];
    if (targets.length === 0) list.push("Pick at least one recipient.");
    if (!body.trim() && !mediaId) list.push("Add a message or attachment.");
    if (!combined) list.push("Pick a valid date and time.");
    else if (combined.getTime() <= Date.now())
      list.push("Schedule must be in the future.");
    if (recurrence === "custom" && !customCron.trim())
      list.push("Enter a custom cron expression.");
    return list;
  }, [targets, body, mediaId, combined, recurrence, customCron]);

  const canSubmit = errors.length === 0 && !submitting;

  // ─ Handlers ────────────────────────────────────────────────────────────
  const addTarget = React.useCallback(
    (jid: string, label: string, type: SabwaScheduledTargetType) => {
      const key = jid.trim();
      if (!key) return;
      setTargets((curr) =>
        curr.some((t) => t.jid === key)
          ? curr
          : [...curr, { jid: key, type, label: label || key }],
      );
    },
    [],
  );

  const removeTarget = React.useCallback((jid: string) => {
    setTargets((curr) => curr.filter((t) => t.jid !== jid));
  }, []);

  const buildDraft = React.useCallback((): SabwaScheduledDraft | null => {
    if (!combined) return null;
    const cron = recurrenceToCron(recurrence, combined, customCron);
    return {
      kind: recurrence === "none" ? "one_off" : "recurring",
      scheduledFor: combined,
      cron,
      timezone,
      targets: targets.map(({ jid, type }) => ({ jid, type })),
      payload: {
        type: mediaId ? "image" : "text",
        body: body.trim() || undefined,
        mediaSabFileId: mediaId,
      },
    };
  }, [combined, recurrence, customCron, timezone, targets, body, mediaId]);

  function reportError(action: string, err: unknown) {
    const message =
      err instanceof Error ? err.message : "Something went wrong.";
    toast.toast({
      title: action,
      description: message,
      variant: "destructive",
    });
  }

  const handleSubmit = React.useCallback(async () => {
    if (!canSubmit) return;
    const draft = buildDraft();
    if (!draft) return;

    setSubmitting(true);
    try {
      let result: SabwaActionResult<{ scheduledId: string }> | SabwaActionResult;
      if (mode === "edit" && initial?.scheduledId) {
        result = await updateScheduledMessage(initial.scheduledId, draft);
      } else {
        if (!sessionId) {
          toast.toast({
            title: "No active session",
            description:
              "Connect or select a SabWa session before scheduling.",
            variant: "destructive",
          });
          return;
        }
        result = await scheduleMessage(sessionId, draft);
      }
      if (!result.ok) {
        reportError(
          mode === "edit" ? "Couldn't update schedule" : "Couldn't schedule",
          new Error(result.error),
        );
        return;
      }
      toast.toast({
        title:
          mode === "edit" ? "Schedule updated" : "Message scheduled",
        description:
          recurrence === "none"
            ? combined?.toLocaleString()
            : describeCron(
                recurrenceToCron(recurrence, combined ?? new Date(), customCron) ??
                  "",
              ),
      });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      reportError(
        mode === "edit" ? "Couldn't update schedule" : "Couldn't schedule",
        err,
      );
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canSubmit,
    buildDraft,
    mode,
    initial?.scheduledId,
    sessionId,
    recurrence,
    combined,
    customCron,
    onSaved,
    onOpenChange,
    toast,
  ]);

  const handleTestNow = React.useCallback(async () => {
    if (targets.length === 0 || (!body.trim() && !mediaId)) {
      toast.toast({
        title: "Nothing to send",
        description: "Pick a recipient and add a message first.",
        variant: "destructive",
      });
      return;
    }
    if (!sessionId) {
      toast.toast({
        title: "No active session",
        description:
          "Connect or select a SabWa session before testing a send.",
        variant: "destructive",
      });
      return;
    }
    setTesting(true);
    const payload: SabwaSendMessagePayload = {
      type: mediaId ? "image" : "text",
      body: body.trim() || undefined,
      mediaSabFileId: mediaId,
    };
    try {
      let lastError: string | null = null;
      for (const t of targets) {
        const res = await sendMessage(sessionId, t.jid, payload);
        if (!res.ok) lastError = res.error;
      }
      if (lastError) {
        reportError("Test send failed", new Error(lastError));
      } else {
        toast.toast({
          title: "Test sent",
          description: `Delivered to ${targets.length} recipient${targets.length === 1 ? "" : "s"}.`,
        });
      }
    } catch (err) {
      reportError("Test send failed", err);
    } finally {
      setTesting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, body, mediaId, sessionId, toast]);

  // ─ Render ──────────────────────────────────────────────────────────────
  const calendarSelected = combined ?? undefined;

  const TARGET_KINDS: { value: SabwaScheduledTargetType; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "individual", label: "Chat", Icon: MessageSquare },
    { value: "group", label: "Group", Icon: Users },
    { value: "broadcast", label: "Broadcast", Icon: Megaphone },
  ];

  const targetPlaceholder =
    targetTab === "individual"
      ? "Search contacts or paste a JID (e.g. 919812345678@s.whatsapp.net)"
      : targetTab === "group"
        ? "Search groups or paste a group JID (e.g. 12345-67890@g.us)"
        : "Search broadcast lists or paste an ID";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit scheduled message" : "New schedule"}
          </DialogTitle>
          <DialogDescription>
            Pick recipients, compose your message, and choose when it sends.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          {/* ─── Target ─────────────────────────────────────────────── */}
          <section className="space-y-2">
            <Label className="text-sm font-medium">Recipients</Label>
            {/* Segmented picker — no tab UI per ZoruUI rules */}
            <div
              role="group"
              aria-label="Recipient type"
              className="grid w-full grid-cols-3 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-0.5"
            >
              {TARGET_KINDS.map(({ value, label, Icon }) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={targetTab === value ? "default" : "ghost"}
                  className="h-8 w-full gap-1.5 text-xs"
                  onClick={() => setTargetTab(value)}
                  aria-pressed={targetTab === value}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Button>
              ))}
            </div>

            {/* Searchable picker — live chats list */}
            <div className="mt-3 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg)]">
              <Command
                shouldFilter={false}
                className="rounded-[var(--st-radius-sm)]"
              >
                <CommandInput
                  placeholder={
                    targetTab === "individual"
                      ? "Search chats or contacts…"
                      : targetTab === "group"
                        ? "Search groups…"
                        : "Search broadcast lists…"
                  }
                  value={search}
                  onValueChange={setSearch}
                />
                <CommandList className="max-h-[200px]">
                  {chatsLoading && (
                    <div className="px-3 py-2 text-xs text-[var(--st-text-secondary)]">
                      Loading chats…
                    </div>
                  )}
                  <CommandEmpty>
                    {chatsLoading
                      ? "Loading…"
                      : visibleChats.length === 0
                        ? "No chats available for this session."
                        : "No matches. Try a different search."}
                  </CommandEmpty>
                  {filteredChats.length > 0 && (
                    <CommandGroup heading="Chats">
                      {filteredChats.map((c) => {
                        const meta = targetTypeMeta(
                          c.type === "group"
                            ? "group"
                            : c.type === "broadcast" || c.type === "status"
                              ? "broadcast"
                              : "individual",
                        );
                        const Icon = meta.Icon;
                        const name = resolveJid(c.jid);
                        const phone = formatJid(c.jid);
                        const alreadyPicked = targets.some(
                          (t) => t.jid === c.jid,
                        );
                        return (
                          <CommandItem
                            key={c.jid}
                            value={`${name} ${phone} ${c.jid}`}
                            onSelect={() => {
                              const pickedType: SabwaScheduledTargetType =
                                c.type === "group"
                                  ? "group"
                                  : c.type === "broadcast" ||
                                      c.type === "status"
                                    ? "broadcast"
                                    : "individual";
                              addTarget(c.jid, name, pickedType);
                            }}
                            disabled={alreadyPicked}
                          >
                            <Icon className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" />
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-[13px] text-[var(--st-text)]">
                                {name}
                              </span>
                              {phone !== name && (
                                <span className="truncate text-[11px] text-[var(--st-text-tertiary)]">
                                  {phone}
                                </span>
                              )}
                            </div>
                            {alreadyPicked && (
                              <span className="ml-auto text-[10px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                                Picked
                              </span>
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </div>

            {/* Power-user fallback: paste a raw JID */}
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder={targetPlaceholder}
                  value={jidInput}
                  onChange={(e) => setJidInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && jidInput.trim()) {
                      e.preventDefault();
                      const raw = jidInput.trim();
                      addTarget(raw, resolveJid(raw), targetTab);
                      setJidInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!jidInput.trim()}
                  onClick={() => {
                    const raw = jidInput.trim();
                    addTarget(raw, resolveJid(raw), targetTab);
                    setJidInput("");
                  }}
                >
                  Add
                </Button>
              </div>
              <p className="text-[11px] text-[var(--st-text-secondary)]">
                Search and pick chats below, or paste a JID.
              </p>
              {jidInput.trim() && (
                <p className="text-[11px] text-[var(--st-text-tertiary)]">
                  Will be added as{' '}
                  <span className="font-medium text-[var(--st-text)]">
                    {resolveJid(jidInput.trim())}
                  </span>{' '}
                  <span className="font-mono text-[var(--st-text-secondary)]">
                    ({formatJid(jidInput.trim())})
                  </span>
                </p>
              )}
            </div>

            {targets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {targets.map((t) => {
                  const meta = targetTypeMeta(t.type);
                  const Icon = meta.Icon;
                  const resolvedName = resolveJid(t.jid);
                  const phone = formatJid(t.jid);
                  return (
                    <span
                      key={t.jid}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                        meta.className,
                      )}
                      title={phone !== resolvedName ? phone : t.jid}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="max-w-[16ch] truncate">
                        {resolvedName}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${resolvedName}`}
                        onClick={() => removeTarget(t.jid)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-[var(--st-bg-muted)]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </section>

          {/* ─── Message ────────────────────────────────────────────── */}
          <section className="space-y-2">
            <Label htmlFor="schedule-body" className="text-sm font-medium">
              Message
            </Label>
            <Textarea
              id="schedule-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={4}
              className="resize-y"
            />
            <div className="flex items-center gap-2">
              <SabFilePickerButton
                accept="all"
                variant="outline"
                onPick={(pick) => {
                  setMediaId(pick.id);
                  setMediaName(pick.name);
                }}
              >
                <Paperclip className="mr-1 h-4 w-4" />
                {mediaId ? "Replace attachment" : "Add attachment"}
              </SabFilePickerButton>
              {mediaId && (
                <div className="flex items-center gap-1.5 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-0.5 text-xs text-[var(--st-text)]">
                  <span className="max-w-[16ch] truncate">
                    {mediaName ?? "Attachment"}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove attachment"
                    onClick={() => {
                      setMediaId(undefined);
                      setMediaName(undefined);
                    }}
                    className="rounded-full p-0.5 hover:bg-[var(--st-bg-muted)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ─── Schedule ───────────────────────────────────────────── */}
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Date</Label>
              <Popover
                open={datePopoverOpen}
                onOpenChange={setDatePopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateStr && "text-[var(--st-text-secondary)]",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateStr ? (
                      new Date(dateStr + "T00:00:00").toLocaleDateString()
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={calendarSelected}
                    onSelect={(d) => {
                      if (d) setDateStr(formatDateInput(d));
                      setDatePopoverOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-time" className="text-sm font-medium">
                Time
              </Label>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
                <Input
                  id="schedule-time"
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-tz" className="text-sm font-medium">
                Timezone
              </Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="schedule-tz">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                  {!TIMEZONES.includes(DEFAULT_TIMEZONE) && (
                    <SelectItem value={DEFAULT_TIMEZONE}>
                      {DEFAULT_TIMEZONE}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* ─── Recurrence ─────────────────────────────────────────── */}
          <section className="space-y-2">
            <Label className="text-sm font-medium">Recurrence</Label>
            <RadioGroup
              value={recurrence}
              onValueChange={(v) =>
                setRecurrence(v as SchedulerRecurrence)
              }
              className="grid grid-cols-2 gap-2 sm:grid-cols-5"
            >
              {(
                ["none", "daily", "weekly", "monthly", "custom"] as const
              ).map((opt) => (
                <Label
                  key={opt}
                  htmlFor={`rec-${opt}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2.5 py-1.5 text-xs capitalize text-[var(--st-text)]",
                    recurrence === opt &&
                      "border-[var(--st-border-strong)] bg-[var(--st-bg-secondary)]",
                  )}
                >
                  <ZoruRadioGroupItem id={`rec-${opt}`} value={opt} />
                  {opt === "none" ? "Once" : opt}
                </Label>
              ))}
            </RadioGroup>
            {recurrence === "custom" && (
              <Input
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="Cron — e.g. 0 9 * * 1-5"
                className="font-mono text-xs"
              />
            )}
            <p className="text-[11px] text-[var(--st-text-secondary)]">{cronPreview}</p>
          </section>

          {/* ─── End condition ──────────────────────────────────────── */}
          {recurrence !== "none" && (
            <section className="space-y-2">
              <Label className="text-sm font-medium">End condition</Label>
              <RadioGroup
                value={endKind}
                onValueChange={(v) => setEndKind(v as SchedulerEndKind)}
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <Label
                  htmlFor="end-never"
                  className="flex cursor-pointer items-center gap-2 text-sm text-[var(--st-text)]"
                >
                  <ZoruRadioGroupItem id="end-never" value="never" />
                  Never
                </Label>
                <Label
                  htmlFor="end-count"
                  className="flex cursor-pointer items-center gap-2 text-sm text-[var(--st-text)]"
                >
                  <ZoruRadioGroupItem id="end-count" value="count" />
                  After
                  <Input
                    type="number"
                    min={1}
                    value={endCount}
                    onChange={(e) =>
                      setEndCount(Math.max(1, Number(e.target.value) || 1))
                    }
                    disabled={endKind !== "count"}
                    className="h-7 w-20"
                  />
                  occurrences
                </Label>
                <Label
                  htmlFor="end-date"
                  className="flex cursor-pointer items-center gap-2 text-sm text-[var(--st-text)]"
                >
                  <ZoruRadioGroupItem id="end-date" value="date" />
                  On
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={endKind !== "date"}
                    className="h-7"
                  />
                </Label>
              </RadioGroup>
            </section>
          )}

          {/* ─── Errors ─────────────────────────────────────────────── */}
          {errors.length > 0 && (
            <div className="rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2.5">
              <ul className="space-y-0.5 text-xs text-[var(--st-text-secondary)]">
                {errors.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleTestNow}
            disabled={testing}
            className="mr-auto"
          >
            {testing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Test now
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Save changes" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ScheduleDialog;

// ─── Internals ──────────────────────────────────────────────────────────────

function nextDefaultDate(): Date {
  // Round up to the next 15-minute slot for a friendlier default.
  const d = new Date();
  d.setSeconds(0, 0);
  const ms = 15 * 60 * 1000;
  return new Date(Math.ceil(d.getTime() / ms) * ms + 60 * 60 * 1000);
}

export { targetTypeMeta };
