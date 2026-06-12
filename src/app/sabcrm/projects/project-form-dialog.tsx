'use client';

/**
 * SabCRM Projects — create / edit dialog.
 *
 * A single 20ui Modal that doubles as "New project" (no `initial`) and "Edit
 * project" (with `initial`). It owns its own draft state, validates a required
 * name, and hands a field-keyed `data` map back to the parent — which performs
 * the gated create / update record write and closes on success.
 */

import * as React from 'react';

import {
  Modal,
  Button,
  Field,
  Input,
  Textarea,
  SelectField,
  DatePicker,
} from '@/components/sabcrm/20ui';
import {
  PROJECT_FIELDS,
  PROJECT_STATUSES,
  PROJECT_PRIORITIES,
  DEFAULT_PROJECT_STATUS,
  DEFAULT_PROJECT_PRIORITY,
} from '@/lib/sabcrm/projects-object';
import { parseDate, type ProjectVM } from './projects-shared';

interface ProjectFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Present → edit mode; absent → create mode. */
  initial?: ProjectVM | null;
  /** Seed the status in create mode (e.g. the board column "+" was used). */
  defaultStatus?: string;
  /** Persist the field-keyed data. Resolve `true` on success so the form closes. */
  onSubmit: (data: Record<string, unknown>) => Promise<boolean>;
}

const STATUS_OPTS = PROJECT_STATUSES.map((s) => ({ value: s.value, label: s.label }));
const PRIORITY_OPTS = PROJECT_PRIORITIES.map((p) => ({ value: p.value, label: p.label }));

/** A `Date` → `yyyy-mm-dd` string (the stored DATE shape), or `''`. */
function toISODate(d: Date | undefined): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ProjectFormDialog({
  open,
  onClose,
  initial,
  defaultStatus,
  onSubmit,
}: ProjectFormDialogProps): React.JSX.Element {
  const editing = Boolean(initial);

  const [name, setName] = React.useState('');
  const [status, setStatus] = React.useState<string>(DEFAULT_PROJECT_STATUS);
  const [priority, setPriority] = React.useState<string>(DEFAULT_PROJECT_PRIORITY);
  const [owner, setOwner] = React.useState('');
  const [startDate, setStartDate] = React.useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = React.useState<Date | undefined>(undefined);
  const [progress, setProgress] = React.useState('');
  const [budget, setBudget] = React.useState('');
  const [description, setDescription] = React.useState('');

  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Re-seed the draft whenever the dialog (re)opens or its subject changes.
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setName(initial?.name ?? '');
    setStatus(initial?.status ?? defaultStatus ?? DEFAULT_PROJECT_STATUS);
    setPriority(initial?.priority ?? DEFAULT_PROJECT_PRIORITY);
    setOwner(initial?.owner ?? '');
    setStartDate(parseDate(initial?.startDate ?? null) ?? undefined);
    setDueDate(parseDate(initial?.dueDate ?? null) ?? undefined);
    setProgress(initial?.progress == null ? '' : String(initial.progress));
    setBudget(initial?.budget == null ? '' : String(initial.budget));
    setDescription(initial?.description ?? '');
  }, [open, initial, defaultStatus]);

  const handleSubmit = React.useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('A project name is required.');
      return;
    }
    setSaving(true);
    setError(null);

    const progressNum = progress.trim() === '' ? null : Number(progress);
    const budgetNum = budget.trim() === '' ? null : Number(budget);

    const data: Record<string, unknown> = {
      [PROJECT_FIELDS.name]: trimmed,
      [PROJECT_FIELDS.status]: status,
      [PROJECT_FIELDS.priority]: priority,
      [PROJECT_FIELDS.owner]: owner.trim(),
      [PROJECT_FIELDS.startDate]: toISODate(startDate),
      [PROJECT_FIELDS.dueDate]: toISODate(dueDate),
      [PROJECT_FIELDS.progress]:
        progressNum == null || Number.isNaN(progressNum)
          ? null
          : Math.max(0, Math.min(100, progressNum)),
      [PROJECT_FIELDS.budget]:
        budgetNum == null || Number.isNaN(budgetNum) ? null : budgetNum,
      [PROJECT_FIELDS.description]: description.trim(),
    };

    const ok = await onSubmit(data);
    setSaving(false);
    if (!ok) setError('Could not save the project. Please try again.');
  }, [name, status, priority, owner, startDate, dueDate, progress, budget, description, onSubmit]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit project' : 'New project'}
      description={
        editing ? 'Update this project’s details.' : 'Add a project to your workspace.'
      }
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {editing ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <div className="pj-form">
        <Field label="Project name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Website relaunch"
            autoFocus
          />
        </Field>

        <div className="pj-form__row">
          <Field label="Status">
            <SelectField value={status} onChange={(v) => setStatus(v ?? DEFAULT_PROJECT_STATUS)} options={STATUS_OPTS} />
          </Field>
          <Field label="Priority">
            <SelectField
              value={priority}
              onChange={(v) => setPriority(v ?? DEFAULT_PROJECT_PRIORITY)}
              options={PRIORITY_OPTS}
            />
          </Field>
        </div>

        <div className="pj-form__row">
          <Field label="Start date">
            <DatePicker value={startDate} onChange={setStartDate} placeholder="Pick a date" />
          </Field>
          <Field label="Due date">
            <DatePicker value={dueDate} onChange={setDueDate} placeholder="Pick a date" />
          </Field>
        </div>

        <div className="pj-form__row">
          <Field label="Progress" help="0–100">
            <Input
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              suffix="%"
              placeholder="0"
            />
          </Field>
          <Field label="Budget">
            <Input
              type="number"
              min={0}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              prefix="$"
              placeholder="0"
            />
          </Field>
        </div>

        <Field label="Owner">
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Who's accountable?" />
        </Field>

        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Goals, scope and notes…"
          />
        </Field>

        {error ? (
          <p className="pj-form__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
