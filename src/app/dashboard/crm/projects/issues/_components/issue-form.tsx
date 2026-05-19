'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useId, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  LoaderCircle,
  Paperclip,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

import { saveWsIssue } from '@/app/actions/worksuite/projects.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { SabFilePickerButton } from '@/components/sabfiles';

/**
 * Shared `<IssueForm>` — used by `/issues/new` and `/issues/[issueId]/edit`.
 *
 * Deepening (§3.3.2):
 *  - Sectioned form (Overview · Classification · Subtasks · Attachments).
 *  - Linked-entity pickers (project / assignee / reporter).
 *  - Subtask inline editor (title · assignee · status · due) reorderable.
 *  - File attachments via SabFilePickerButton (no plain `<input type="file">`).
 *  - Severity + type selects in addition to status/priority.
 *  - Sticky bottom Cancel/Save bar.
 *
 * Action contract: still `saveWsIssue`. New fields ride through `genericSave`
 * (additive — see `saveWsIssue` extension in `worksuite/projects.actions.ts`).
 */

const BASE = '/dashboard/crm/projects/issues';

const SEVERITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'trivial', label: 'Trivial' },
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
  { value: 'critical', label: 'Critical' },
  { value: 'blocker', label: 'Blocker' },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'task', label: 'Task' },
  { value: 'epic', label: 'Epic' },
];

const SUBTASK_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

export interface IssueSubtaskRow {
  id: string;
  title: string;
  assigneeId?: string;
  assigneeName?: string;
  status: string;
  dueDate?: string;
}

export interface IssueAttachment {
  id: string;
  url: string;
  name: string;
  mime?: string;
  size?: number;
}

export interface IssueFormInitial {
  _id?: string;
  title?: string;
  description?: string;
  projectId?: string;
  status?: string;
  priority?: string;
  severity?: string;
  issueType?: string;
  assigneeId?: string;
  assigneeName?: string;
  reporterId?: string;
  reporterName?: string;
  dueDate?: string;
  estimatedHours?: number | string;
  subtasks?: IssueSubtaskRow[];
  attachments?: IssueAttachment[];
}

export interface IssueFormProps {
  mode: 'new' | 'edit';
  initial?: IssueFormInitial;
}

type SaveState = { message?: string; error?: string; id?: string };
const INITIAL_STATE: SaveState = {};

function emptySubtask(): IssueSubtaskRow {
  return {
    id: uuidv4(),
    title: '',
    assigneeId: '',
    assigneeName: '',
    status: 'todo',
    dueDate: '',
  };
}

function normaliseSubtasks(rows?: IssueSubtaskRow[]): IssueSubtaskRow[] {
  if (!rows || rows.length === 0) return [];
  return rows.map((r) => ({
    id: r.id ?? uuidv4(),
    title: r.title ?? '',
    assigneeId: r.assigneeId ? String(r.assigneeId) : '',
    assigneeName: r.assigneeName ?? '',
    status: r.status ?? 'todo',
    dueDate: r.dueDate ?? '',
  }));
}

function toDateInput(value: unknown): string {
  if (!value) return '';
  const s = typeof value === 'string' ? value : String(value);
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function IssueForm({ mode, initial }: IssueFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formId = useId();
  const [state, action, isPending] = useActionState(saveWsIssue, INITIAL_STATE);

  const [subtasks, setSubtasks] = useState<IssueSubtaskRow[]>(
    normaliseSubtasks(initial?.subtasks),
  );
  const [attachments, setAttachments] = useState<IssueAttachment[]>(
    Array.isArray(initial?.attachments) ? initial!.attachments! : [],
  );

  const subtasksJson = useMemo(
    () =>
      JSON.stringify(
        subtasks
          .map((s) => ({
            id: s.id,
            title: s.title.trim(),
            assigneeId: s.assigneeId || undefined,
            assigneeName: s.assigneeName || undefined,
            status: s.status,
            dueDate: s.dueDate || undefined,
          }))
          .filter((s) => s.title.length > 0),
      ),
    [subtasks],
  );

  const attachmentsJson = useMemo(
    () => JSON.stringify(attachments),
    [attachments],
  );

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      const target = state.id ? `${BASE}/${state.id}` : BASE;
      router.push(target);
      router.refresh();
    }
    if (state?.error) {
      toast({
        title: 'Could not save',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router]);

  const addSubtask = () => setSubtasks((prev) => [...prev, emptySubtask()]);
  const removeSubtask = (id: string) =>
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  const moveSubtask = (id: string, dir: -1 | 1) =>
    setSubtasks((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const [row] = copy.splice(idx, 1);
      copy.splice(next, 0, row);
      return copy;
    });
  const updateSubtask = <K extends keyof IssueSubtaskRow>(
    id: string,
    key: K,
    value: IssueSubtaskRow[K],
  ) =>
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [key]: value } : s)),
    );

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  return (
    <form
      id={formId}
      action={action}
      className="flex w-full flex-col gap-5"
    >
      {initial?._id ? (
        <input type="hidden" name="_id" value={initial._id} />
      ) : null}
      <input type="hidden" name="subtasks" value={subtasksJson} />
      <input type="hidden" name="attachments" value={attachmentsJson} />

      {/* ── Overview ─────────────────────────────────────────────── */}
      <ZoruCard className="p-0">
        <ZoruCardHeader>
          <ZoruCardTitle>Overview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="flex flex-col gap-4">
          <div>
            <ZoruLabel htmlFor="title">
              Title <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="title"
              name="title"
              required
              minLength={2}
              defaultValue={initial?.title ?? ''}
              placeholder="Short, action-first summary…"
              className="mt-1.5 h-10"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="description">Description</ZoruLabel>
            <ZoruTextarea
              id="description"
              name="description"
              rows={5}
              defaultValue={initial?.description ?? ''}
              placeholder="Reproduction steps, expected vs actual, links…"
              className="mt-1.5"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <ZoruLabel htmlFor="projectId">Project</ZoruLabel>
              <div className="mt-1.5">
                <EntityFormField
                  entity="project"
                  name="projectId"
                  initialId={initial?.projectId}
                  placeholder="Pick project (optional)"
                />
              </div>
            </div>
            <div>
              <ZoruLabel htmlFor="dueDate">Due date</ZoruLabel>
              <ZoruInput
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={toDateInput(initial?.dueDate)}
                className="mt-1.5 h-10"
              />
            </div>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      {/* ── Classification ───────────────────────────────────────── */}
      <ZoruCard className="p-0">
        <ZoruCardHeader>
          <ZoruCardTitle>Classification</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <ZoruLabel>Status</ZoruLabel>
              <div className="mt-1.5">
                <EnumFormField
                  enumName="issueStatus"
                  name="status"
                  initialId={initial?.status ?? 'open'}
                  placeholder="Status"
                />
              </div>
            </div>
            <div>
              <ZoruLabel>Priority</ZoruLabel>
              <div className="mt-1.5">
                <EnumFormField
                  enumName="priorityMedium"
                  name="priority"
                  initialId={initial?.priority ?? 'medium'}
                  placeholder="Priority"
                />
              </div>
            </div>
            <div>
              <ZoruLabel htmlFor="severity">Severity</ZoruLabel>
              <select
                id="severity"
                name="severity"
                defaultValue={initial?.severity ?? 'minor'}
                className="mt-1.5 h-10 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink"
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <ZoruLabel htmlFor="issueType">Type</ZoruLabel>
              <select
                id="issueType"
                name="issueType"
                defaultValue={initial?.issueType ?? 'bug'}
                className="mt-1.5 h-10 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <ZoruLabel htmlFor="assigneeId">Assignee</ZoruLabel>
              <div className="mt-1.5">
                <EntityFormField
                  entity="employee"
                  name="assigneeId"
                  dualWriteName="assigneeName"
                  initialId={initial?.assigneeId}
                  initialLabel={initial?.assigneeName}
                  placeholder="Pick assignee"
                />
              </div>
            </div>
            <div>
              <ZoruLabel htmlFor="reporterId">Reporter</ZoruLabel>
              <div className="mt-1.5">
                <EntityFormField
                  entity="user"
                  name="reporterId"
                  dualWriteName="reporterName"
                  initialId={initial?.reporterId}
                  initialLabel={initial?.reporterName}
                  placeholder="Pick reporter"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <ZoruLabel htmlFor="estimatedHours">Estimated hours</ZoruLabel>
              <ZoruInput
                id="estimatedHours"
                name="estimatedHours"
                type="number"
                min={0}
                step="0.25"
                defaultValue={
                  initial?.estimatedHours != null
                    ? String(initial.estimatedHours)
                    : ''
                }
                placeholder="e.g. 4"
                className="mt-1.5 h-10 sm:max-w-[200px]"
              />
            </div>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      {/* ── Subtasks ─────────────────────────────────────────────── */}
      <ZoruCard className="p-0">
        <ZoruCardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <ZoruCardTitle>Subtasks</ZoruCardTitle>
            <p className="text-[12px] text-zoru-ink-muted">
              Break this issue into smaller pieces. Use arrows to reorder.
            </p>
          </div>
          <ZoruButton
            type="button"
            variant="outline"
            size="sm"
            onClick={addSubtask}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add subtask
          </ZoruButton>
        </ZoruCardHeader>
        <ZoruCardContent>
          {subtasks.length === 0 ? (
            <p className="rounded-md border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-3 text-center text-[12px] text-zoru-ink-muted">
              No subtasks yet — click Add subtask to start.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {subtasks.map((row, idx) => (
                <li
                  key={row.id}
                  className="rounded-md border border-zoru-line bg-zoru-surface-2 p-2.5"
                >
                  <div className="grid items-end gap-2 sm:grid-cols-[1fr_180px_140px_120px_auto]">
                    <ZoruInput
                      placeholder={`Subtask ${idx + 1} title`}
                      value={row.title}
                      onChange={(e) =>
                        updateSubtask(row.id, 'title', e.target.value)
                      }
                      className="h-9"
                    />
                    <EntityFormField
                      entity="employee"
                      name={`__subtaskAssignee-${row.id}`}
                      initialId={row.assigneeId}
                      initialLabel={row.assigneeName}
                      placeholder="Assignee"
                      onChange={(id, hydrated) => {
                        updateSubtask(row.id, 'assigneeId', id ?? '');
                        updateSubtask(
                          row.id,
                          'assigneeName',
                          hydrated?.chip.primary ?? '',
                        );
                      }}
                    />
                    <select
                      value={row.status}
                      onChange={(e) =>
                        updateSubtask(row.id, 'status', e.target.value)
                      }
                      className="h-9 w-full rounded-md border border-zoru-line bg-zoru-bg px-2 text-[13px] text-zoru-ink"
                    >
                      {SUBTASK_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ZoruInput
                      type="date"
                      value={row.dueDate ?? ''}
                      onChange={(e) =>
                        updateSubtask(row.id, 'dueDate', e.target.value)
                      }
                      className="h-9"
                    />
                    <div className="flex items-center justify-end gap-1">
                      <ZoruButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Move up"
                        disabled={idx === 0}
                        onClick={() => moveSubtask(row.id, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </ZoruButton>
                      <ZoruButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Move down"
                        disabled={idx === subtasks.length - 1}
                        onClick={() => moveSubtask(row.id, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </ZoruButton>
                      <ZoruButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove subtask"
                        onClick={() => removeSubtask(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                      </ZoruButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ZoruCardContent>
      </ZoruCard>

      {/* ── Attachments ──────────────────────────────────────────── */}
      <ZoruCard className="p-0">
        <ZoruCardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <ZoruCardTitle>Attachments</ZoruCardTitle>
            <p className="text-[12px] text-zoru-ink-muted">
              Screenshots, logs, repro files — picked from your SabFiles library.
            </p>
          </div>
          <SabFilePickerButton
            onPick={(pick) => {
              setAttachments((prev) =>
                prev.some((a) => a.id === pick.id)
                  ? prev
                  : [
                      ...prev,
                      {
                        id: pick.id,
                        url: pick.url,
                        name: pick.name,
                        mime: pick.mime,
                        size: pick.size,
                      },
                    ],
              );
            }}
          >
            <Paperclip className="mr-1.5 h-3.5 w-3.5" /> Add file
          </SabFilePickerButton>
        </ZoruCardHeader>
        <ZoruCardContent>
          {attachments.length === 0 ? (
            <p className="rounded-md border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-3 text-center text-[12px] text-zoru-ink-muted">
              No attachments — add files from SabFiles to share context.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-zoru-line px-2.5 py-1.5 text-[12.5px]"
                >
                  <span className="truncate text-zoru-ink">{a.name}</span>
                  <ZoruButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAttachment(a.id)}
                    aria-label={`Remove ${a.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </ZoruButton>
                </li>
              ))}
            </ul>
          )}
        </ZoruCardContent>
      </ZoruCard>

      {state?.error ? (
        <p
          role="alert"
          className="flex items-center gap-2 text-[13px] text-zoru-danger-ink"
        >
          <AlertTriangle className="h-4 w-4" /> {state.error}
        </p>
      ) : null}

      {/* ── Sticky footer ────────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-4 -mb-4 mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-zoru-line bg-zoru-bg px-4 py-3 md:-mx-6 md:px-6">
        <ZoruButton variant="ghost" asChild>
          <Link
            href={initial?._id ? `${BASE}/${initial._id}` : BASE}
          >
            <ChevronLeft className="mr-1.5 h-4 w-4" /> Cancel
          </Link>
        </ZoruButton>
        <ZoruButton type="submit" disabled={isPending}>
          {isPending ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {mode === 'edit' ? 'Save changes' : 'Create issue'}
        </ZoruButton>
      </div>
    </form>
  );
}

export default IssueForm;
