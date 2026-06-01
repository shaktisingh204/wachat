"use client";

import * as React from "react";
import {
  Paperclip,
  X,
  AtSign,
  MessageSquare,
  StickyNote,
  CheckSquare,
  Phone,
  Users,
} from "lucide-react";

import {
  Button,
  Input,
  Textarea,
  Label,
  Badge,
  cn,
  useZoruToast,
} from "@/components/zoruui";
import { SabFilePickerButton, type SabFilePick } from "@/components/sabfiles";
import {
  createActivityAction,
  addCommentAction,
  type CreateActivityActionInput,
} from "@/app/actions/sabcrm.actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Composer modes.
 *
 * - `COMMENT` → {@link addCommentAction} (a COMMENT-type timeline entry).
 * - `NOTE` / `TASK` / `CALL` / `MEETING` → {@link createActivityAction} with the
 *   matching {@link CreateActivityActionInput.type}. `TASK` additionally carries
 *   a due date + assignee.
 */
export type ActivityComposerMode = "COMMENT" | "NOTE" | "TASK" | "CALL" | "MEETING";

/**
 * A workspace member the composer can @-mention or (for tasks) assign.
 * SabCRM has no members listing action yet, so the host page supplies the
 * roster it already has on hand.
 */
export interface ActivityComposerMember {
  /** Stable user id persisted on the activity's `mentions` / `assigneeId`. */
  id: string;
  /** Display name shown in the mention menu and chips. */
  name: string;
  /** Optional secondary line (e.g. email) shown in the mention menu. */
  email?: string;
}

interface Attachment {
  fileId: string;
  name: string;
  url?: string;
  size?: number;
  contentType?: string;
}

export interface ActivityComposerProps {
  /** Object slug of the record this composer is attached to (e.g. "companies"). */
  targetObject: string;
  /** Record id this composer is attached to. */
  targetRecordId: string;
  /** Restrict the available modes. Defaults to all five. */
  modes?: ActivityComposerMode[];
  /** Mode selected on first render. Defaults to the first available mode. */
  defaultMode?: ActivityComposerMode;
  /**
   * Roster used for @-mentions and (in TASK mode) the assignee picker. When
   * omitted, mentions are captured as plain `@text` in the body but no
   * structured `mentions` are persisted and the assignee picker is hidden.
   */
  members?: ActivityComposerMember[];
  /** Called after a successful submit so the parent can refresh the timeline. */
  onSubmitted?: (result: { mode: ActivityComposerMode; id: string }) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Mode metadata
// ---------------------------------------------------------------------------

const MODE_META: Record<
  ActivityComposerMode,
  { label: string; icon: React.ComponentType<{ className?: string }>; placeholder: string }
> = {
  COMMENT: { label: "Comment", icon: MessageSquare, placeholder: "Write a comment…" },
  NOTE: { label: "Note", icon: StickyNote, placeholder: "Write a note…" },
  TASK: { label: "Task", icon: CheckSquare, placeholder: "Add task details…" },
  CALL: { label: "Log call", icon: Phone, placeholder: "What was discussed on the call?" },
  MEETING: { label: "Log meeting", icon: Users, placeholder: "Meeting notes…" },
};

const ALL_MODES: ActivityComposerMode[] = ["COMMENT", "NOTE", "TASK", "CALL", "MEETING"];

/** Maps each non-comment mode onto the timeline activity type it creates. */
const MODE_TO_ACTIVITY_TYPE: Record<
  Exclude<ActivityComposerMode, "COMMENT">,
  CreateActivityActionInput["type"]
> = {
  NOTE: "NOTE",
  TASK: "TASK",
  CALL: "CALL",
  MEETING: "MEETING",
};

/** Modes that record a `happenedAt`-style time (calls + meetings). */
const TIMED_MODES: ReadonlySet<ActivityComposerMode> = new Set<ActivityComposerMode>([
  "CALL",
  "MEETING",
]);

/** Converts a `datetime-local` value into an ISO string the action accepts. */
function localToIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityComposer({
  targetObject,
  targetRecordId,
  modes,
  defaultMode,
  members,
  onSubmitted,
  className,
}: ActivityComposerProps) {
  const { toast } = useZoruToast();

  const memberList = React.useMemo(() => members ?? [], [members]);

  const availableModes = React.useMemo<ActivityComposerMode[]>(() => {
    const allow = modes && modes.length > 0 ? modes : ALL_MODES;
    return ALL_MODES.filter((m) => allow.includes(m));
  }, [modes]);

  const [mode, setMode] = React.useState<ActivityComposerMode>(() =>
    defaultMode && availableModes.includes(defaultMode)
      ? defaultMode
      : availableModes[0],
  );

  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [happenedAt, setHappenedAt] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [mentionIds, setMentionIds] = React.useState<string[]>([]);

  const [mentionOpen, setMentionOpen] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState("");

  const [pending, startTransition] = React.useTransition();

  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const showsTitle = mode !== "COMMENT";
  const showsTime = TIMED_MODES.has(mode);
  const showsTaskFields = mode === "TASK";
  const showsAttachments = mode !== "COMMENT"; // comments stay text-only
  const hasMembers = memberList.length > 0;
  const meta = MODE_META[mode];

  // -- mention helpers ------------------------------------------------------
  const mentionedMembers = React.useMemo(
    () => memberList.filter((m) => mentionIds.includes(m.id)),
    [memberList, mentionIds],
  );

  const mentionResults = React.useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    const pool = memberList.filter((m) => !mentionIds.includes(m.id));
    if (!q) return pool.slice(0, 6);
    return pool
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.email ? m.email.toLowerCase().includes(q) : false),
      )
      .slice(0, 6);
  }, [memberList, mentionIds, mentionQuery]);

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setBody(value);
    if (!hasMembers) return;
    // Detect an active "@token" at the caret to drive the mention menu.
    const caret = e.target.selectionStart ?? value.length;
    const upto = value.slice(0, caret);
    const match = /(?:^|\s)@([\w.\-]*)$/.exec(upto);
    if (match) {
      setMentionQuery(match[1] ?? "");
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
      setMentionQuery("");
    }
  }

  function addMention(member: ActivityComposerMember) {
    setMentionIds((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
    // Replace the trailing "@query" token in the body with "@Name ".
    setBody((prev) => {
      const replaced = prev.replace(
        /(^|\s)@([\w.\-]*)$/,
        (_m, lead: string) => `${lead}@${member.name} `,
      );
      return replaced === prev ? `${prev}@${member.name} ` : replaced;
    });
    setMentionOpen(false);
    setMentionQuery("");
    bodyRef.current?.focus();
  }

  function removeMention(id: string) {
    setMentionIds((prev) => prev.filter((m) => m !== id));
  }

  // -- attachments ----------------------------------------------------------
  function handleFilePicked(pick: SabFilePick) {
    setAttachments((prev) => {
      if (prev.some((a) => a.fileId === pick.id)) return prev;
      return [
        ...prev,
        {
          fileId: pick.id,
          name: pick.name,
          url: pick.url,
          size: pick.size,
          contentType: pick.mime,
        },
      ];
    });
  }

  function removeAttachment(fileId: string) {
    setAttachments((prev) => prev.filter((a) => a.fileId !== fileId));
  }

  // -- reset ---------------------------------------------------------------
  function resetForm() {
    setTitle("");
    setBody("");
    setHappenedAt("");
    setDueAt("");
    setAssigneeId("");
    setAttachments([]);
    setMentionIds([]);
    setMentionOpen(false);
    setMentionQuery("");
  }

  // -- derived payloads -----------------------------------------------------
  const mentionsPayload = React.useMemo<
    NonNullable<CreateActivityActionInput["mentions"]>
  >(
    () =>
      mentionedMembers.map((m) => ({ userId: m.id, displayName: m.name })),
    [mentionedMembers],
  );

  const attachmentsPayload = React.useMemo<
    NonNullable<CreateActivityActionInput["attachments"]>
  >(
    () =>
      attachments.map((a) => ({
        fileId: a.fileId,
        name: a.name,
        url: a.url,
        size: a.size,
        contentType: a.contentType,
      })),
    [attachments],
  );

  // -- submit ---------------------------------------------------------------
  const canSubmit = (() => {
    if (pending) return false;
    if (mode === "COMMENT") return body.trim().length > 0;
    return title.trim().length > 0;
  })();

  function submit() {
    if (!canSubmit) return;

    startTransition(async () => {
      if (mode === "COMMENT") {
        const res = await addCommentAction({
          targetObject,
          targetRecordId,
          body: body.trim(),
          attachments: attachmentsPayload.length > 0 ? attachmentsPayload : undefined,
          mentions: mentionsPayload.length > 0 ? mentionsPayload : undefined,
        });
        if (res.ok) {
          toast({ title: "Comment added" });
          resetForm();
          onSubmitted?.({ mode, id: res.data.id });
        } else {
          toast({ title: "Couldn't add comment", description: res.error, variant: "destructive" });
        }
        return;
      }

      const input: CreateActivityActionInput = {
        type: MODE_TO_ACTIVITY_TYPE[mode],
        title: title.trim(),
        body: body.trim() || undefined,
        targetObject,
        targetRecordId,
        attachments: attachmentsPayload.length > 0 ? attachmentsPayload : undefined,
        mentions: mentionsPayload.length > 0 ? mentionsPayload : undefined,
      };

      if (mode === "TASK") {
        input.dueAt = localToIso(dueAt);
        if (assigneeId) input.assigneeId = assigneeId;
      }

      const res = await createActivityAction(input);
      if (res.ok) {
        toast({ title: `${meta.label} saved` });
        resetForm();
        onSubmitted?.({ mode, id: res.data.id });
      } else {
        toast({
          title: `Couldn't save ${meta.label.toLowerCase()}`,
          description: res.error,
          variant: "destructive",
        });
      }
    });
  }

  function handleBodyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl + Enter submits.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape" && mentionOpen) {
      e.preventDefault();
      setMentionOpen(false);
    }
  }

  function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // ------------------------------------------------------------------------
  return (
    <div
      className={cn(
        "rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-3 shadow-[var(--zoru-shadow-sm)]",
        className,
      )}
    >
      <div className="flex flex-col gap-3">
        {availableModes.length > 1 ? (
          <div
            role="tablist"
            aria-label="Activity type"
            className="inline-flex w-fit items-center gap-1 rounded-full border border-zoru-line bg-zoru-surface p-1"
          >
            {availableModes.map((m) => {
              const Icon = MODE_META[m].icon;
              const active = m === mode;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(m)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-zoru-ink text-zoru-bg shadow-[var(--zoru-shadow-sm)]"
                      : "text-zoru-ink-muted hover:text-zoru-ink",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {MODE_META[m].label}
                </button>
              );
            })}
          </div>
        ) : null}

        {showsTitle ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="activity-composer-title" required>
              Title
            </Label>
            <Input
              id="activity-composer-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${meta.label} title`}
            />
          </div>
        ) : null}

        <div className="relative">
          <Textarea
            ref={bodyRef}
            value={body}
            onChange={handleBodyChange}
            onKeyDown={handleBodyKeyDown}
            placeholder={meta.placeholder}
            aria-label={meta.label}
          />

          {mentionOpen && mentionResults.length > 0 ? (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-1 shadow-[var(--zoru-shadow-lg)]"
            >
              {mentionResults.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => addMention(m)}
                  className="flex w-full items-center gap-2 rounded-[var(--zoru-radius-sm)] px-2 py-1.5 text-left text-sm text-zoru-ink hover:bg-zoru-surface-2"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zoru-surface-2 text-[10px] font-medium text-zoru-ink">
                    {initials(m.name)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{m.name}</span>
                    {m.email ? (
                      <span className="truncate text-xs text-zoru-ink-muted">{m.email}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {showsTaskFields ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="activity-composer-due">Due date</Label>
              <Input
                id="activity-composer-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            {hasMembers ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="activity-composer-assignee">Assignee</Label>
                <select
                  id="activity-composer-assignee"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="h-9 w-full rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 text-sm text-zoru-ink shadow-[var(--zoru-shadow-sm)] transition-[border-color,box-shadow] hover:border-zoru-line-strong focus-visible:border-zoru-ink focus-visible:outline-none"
                >
                  <option value="">Unassigned</option>
                  {memberList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : null}

        {showsTime ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="activity-composer-time">
              {mode === "CALL" ? "Call time" : "Meeting time"}
            </Label>
            <Input
              id="activity-composer-time"
              type="datetime-local"
              value={happenedAt}
              onChange={(e) => setHappenedAt(e.target.value)}
            />
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <Label>Attachments</Label>
            <ul className="flex flex-col gap-1">
              {attachments.map((a) => (
                <li
                  key={a.fileId}
                  className="flex items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-2 py-1 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-zoru-ink-muted" />
                    <span className="truncate text-zoru-ink">{a.name}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${a.name}`}
                    onClick={() => removeAttachment(a.fileId)}
                    className="shrink-0 rounded p-0.5 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {mentionedMembers.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <AtSign className="h-3.5 w-3.5 text-zoru-ink-muted" />
            {mentionedMembers.map((m) => (
              <Badge key={m.id} variant="outline">
                {m.name}
                <button
                  type="button"
                  aria-label={`Remove mention ${m.name}`}
                  onClick={() => removeMention(m.id)}
                  className="ml-0.5 text-zoru-ink-muted hover:text-zoru-ink"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {showsAttachments ? (
              <SabFilePickerButton
                variant="ghost"
                onPick={handleFilePicked}
                title="Attach a file"
              >
                <Paperclip className="h-4 w-4" />
                Attach
              </SabFilePickerButton>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-zoru-ink-muted sm:inline">
              {"⌘⏎ to send"}
            </span>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!canSubmit}
              onClick={submit}
            >
              {pending ? "Saving…" : meta.label}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActivityComposer;
