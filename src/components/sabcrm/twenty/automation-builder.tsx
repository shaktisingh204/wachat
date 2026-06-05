'use client';

/**
 * AutomationBuilder — a reusable, Twenty-faithful trigger → action step builder.
 *
 * A self-contained editor for a single SabCRM automation workflow: a record
 * lifecycle trigger (event + object) followed by an ordered list of action
 * steps (create_task / send_notification / update_field / webhook). Each step
 * carries a small, per-type config form. Steps can be added (via a type
 * picker), removed, and reordered (up / down).
 *
 * This is the *controlled* primitive behind the Workflows settings page
 * (`/dashboard/settings/crm/automations`). It owns NO server state — the parent
 * supplies the current `value`, the available `objects` (for object / field
 * pickers, sourced from `listObjectsTw`), and a busy flag, and receives every
 * edit through `onChange` plus discrete `onSave` / `onDelete` / `onToggleEnabled`
 * intents. The parent wires those intents to the EXISTING gated server actions
 * in `@/app/actions/sabcrm-workflows.actions` (create / update / delete) — this
 * component never calls the backend itself, so it degrades gracefully wherever
 * those actions are unavailable.
 *
 * Twenty visual language only: shared `.st-*` primitives from
 * `@/components/sabcrm/20ui/surface-crm-base.css` (st-input / st-select / st-textarea / st-field /
 * st-switch) plus an `ab-*` class layer in `./automation-builder.css`. No
 * ZoruUI, no Tailwind, no `--zoru-*`. The `.sabcrm-twenty` scope is applied by
 * the surrounding TwentyAppFrame.
 */

import * as React from 'react';
import {
  Zap,
  Plus,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  Bell,
  Webhook,
  PenLine,
  Save,
} from 'lucide-react';

import { TwentyButton } from './twenty-primitives';

import './automation-builder.css';

// ---------------------------------------------------------------------------
// Public types — mirror the engine wire shapes exposed by the workflow actions
// (`@/app/actions/sabcrm-workflows.actions.types`). Re-declared locally so this
// client component never imports a `server-only` module into the bundle.
// ---------------------------------------------------------------------------

export type AutomationTriggerEvent =
  | 'record.created'
  | 'record.updated'
  | 'record.deleted';

export type AutomationStepType =
  | 'create_task'
  | 'send_notification'
  | 'update_field'
  | 'webhook';

export interface AutomationTrigger {
  event: AutomationTriggerEvent;
  object: string;
}

export interface AutomationStep {
  id: string;
  type: AutomationStepType;
  config: Record<string, unknown>;
}

/** The editable workflow draft this builder operates on. */
export interface AutomationDraft {
  id?: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  steps: AutomationStep[];
}

/**
 * Minimal object-metadata shape consumed by the object / field pickers. A
 * structural subset of `ObjectMetadata` from `@/lib/sabcrm/types`, so callers
 * can pass that type straight through.
 */
export interface AutomationObjectOption {
  slug: string;
  labelPlural: string;
  fields: ReadonlyArray<{ key: string; label: string; system?: boolean }>;
}

export interface AutomationBuilderProps {
  /** The current draft (controlled). */
  value: AutomationDraft;
  /** Objects available for the trigger + field pickers (best-effort; may be empty). */
  objects?: ReadonlyArray<AutomationObjectOption>;
  /** True while a save/delete is in flight — disables the action buttons. */
  busy?: boolean;
  /** Whether the draft differs from its saved baseline (controls Save enabling). */
  dirty?: boolean;
  /** Emitted on every edit (trigger, steps, name, …). */
  onChange: (next: AutomationDraft) => void;
  /** Optional — Save intent. When omitted the Save button is hidden (read-only). */
  onSave?: () => void;
  /** Optional — Delete intent. When omitted the Delete button is hidden. */
  onDelete?: () => void;
  /** Optional — enable/disable toggle intent. */
  onToggleEnabled?: () => void;
  /** Render in read-only mode (no editing chrome). Defaults to false. */
  readOnly?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Catalogues
// ---------------------------------------------------------------------------

const EVENT_OPTIONS: ReadonlyArray<{ value: AutomationTriggerEvent; label: string }> = [
  { value: 'record.created', label: 'Record Created' },
  { value: 'record.updated', label: 'Record Updated' },
  { value: 'record.deleted', label: 'Record Deleted' },
];

const EVENT_LABEL: Record<string, string> = Object.fromEntries(
  EVENT_OPTIONS.map((e) => [e.value, e.label]),
);

const STEP_META: Record<
  AutomationStepType,
  { label: string; icon: React.ComponentType<{ size?: number }>; blurb: string }
> = {
  create_task: { label: 'Create Task', icon: ClipboardList, blurb: 'Add a task' },
  send_notification: { label: 'Send Notification', icon: Bell, blurb: 'Notify a user' },
  update_field: { label: 'Update Field', icon: PenLine, blurb: 'Set a field value' },
  webhook: { label: 'Webhook', icon: Webhook, blurb: 'Call an external URL' },
};

const STEP_ORDER: AutomationStepType[] = [
  'create_task',
  'send_notification',
  'update_field',
  'webhook',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function str(config: Record<string, unknown>, key: string): string {
  const v = config[key];
  return typeof v === 'string' ? v : '';
}

function emptyStep(type: AutomationStepType): AutomationStep {
  return { id: newId('step'), type, config: {} };
}

function triggerSummary(t: AutomationTrigger): string {
  const ev = EVENT_LABEL[t.event] ?? t.event;
  return t.object ? `${ev} on ${t.object}` : `${ev} on all objects`;
}

// ---------------------------------------------------------------------------
// Per-type step config form
// ---------------------------------------------------------------------------

interface StepConfigProps {
  step: AutomationStep;
  objects: ReadonlyArray<AutomationObjectOption>;
  triggerObject: string;
  readOnly: boolean;
  onPatch: (config: Record<string, unknown>) => void;
}

function StepConfig({
  step,
  objects,
  triggerObject,
  readOnly,
  onPatch,
}: StepConfigProps): React.JSX.Element {
  const set = (key: string, value: string) => onPatch({ ...step.config, [key]: value });

  if (step.type === 'create_task') {
    return (
      <div className="st-field">
        <label className="st-field__label" htmlFor={`${step.id}-title`}>
          Task title
        </label>
        <input
          id={`${step.id}-title`}
          className="st-input"
          value={str(step.config, 'title')}
          placeholder="e.g. Follow up with new lead"
          autoComplete="off"
          disabled={readOnly}
          onChange={(e) => set('title', e.target.value)}
        />
      </div>
    );
  }

  if (step.type === 'send_notification') {
    return (
      <>
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-ntitle`}>
            Title
          </label>
          <input
            id={`${step.id}-ntitle`}
            className="st-input"
            value={str(step.config, 'title')}
            placeholder="Notification title"
            autoComplete="off"
            disabled={readOnly}
            onChange={(e) => set('title', e.target.value)}
          />
        </div>
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-nbody`}>
            Body
          </label>
          <textarea
            id={`${step.id}-nbody`}
            className="st-textarea"
            value={str(step.config, 'body')}
            placeholder="Optional notification body"
            disabled={readOnly}
            onChange={(e) => set('body', e.target.value)}
          />
        </div>
      </>
    );
  }

  if (step.type === 'update_field') {
    const obj = objects.find((o) => o.slug === triggerObject);
    const fields = obj?.fields.filter((f) => !f.system) ?? [];
    return (
      <div className="ab-grid-2">
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-field`}>
            Field
          </label>
          {fields.length > 0 ? (
            <select
              id={`${step.id}-field`}
              className="st-select"
              value={str(step.config, 'field')}
              disabled={readOnly}
              onChange={(e) => set('field', e.target.value)}
            >
              <option value="">Select a field…</option>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${step.id}-field`}
              className="st-input"
              value={str(step.config, 'field')}
              placeholder="field key"
              autoComplete="off"
              disabled={readOnly}
              onChange={(e) => set('field', e.target.value)}
            />
          )}
        </div>
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-value`}>
            Value
          </label>
          <input
            id={`${step.id}-value`}
            className="st-input"
            value={str(step.config, 'value')}
            placeholder="New value"
            autoComplete="off"
            disabled={readOnly}
            onChange={(e) => set('value', e.target.value)}
          />
        </div>
      </div>
    );
  }

  // webhook
  return (
    <div className="st-field">
      <label className="st-field__label" htmlFor={`${step.id}-url`}>
        Webhook URL
      </label>
      <input
        id={`${step.id}-url`}
        className="st-input"
        type="url"
        value={str(step.config, 'url')}
        placeholder="https://example.com/hook"
        autoComplete="off"
        disabled={readOnly}
        onChange={(e) => set('url', e.target.value)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step card
// ---------------------------------------------------------------------------

interface StepCardProps {
  step: AutomationStep;
  index: number;
  count: number;
  objects: ReadonlyArray<AutomationObjectOption>;
  triggerObject: string;
  readOnly: boolean;
  onPatchConfig: (config: Record<string, unknown>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

function StepCard({
  step,
  index,
  count,
  objects,
  triggerObject,
  readOnly,
  onPatchConfig,
  onMove,
  onRemove,
}: StepCardProps): React.JSX.Element {
  const meta = STEP_META[step.type];
  const Icon = meta.icon;
  return (
    <div className="ab-step">
      <div className="ab-step__head">
        <span className="ab-step__index">{index + 1}</span>
        <span className="ab-step__icon">
          <Icon size={14} />
        </span>
        <span className="ab-step__title">{meta.label}</span>
        {!readOnly ? (
          <span className="ab-step__tools">
            <button
              type="button"
              className="ab-icon-btn"
              aria-label="Move step up"
              title="Move up"
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              <ChevronUp size={15} />
            </button>
            <button
              type="button"
              className="ab-icon-btn"
              aria-label="Move step down"
              title="Move down"
              disabled={index === count - 1}
              onClick={() => onMove(1)}
            >
              <ChevronDown size={15} />
            </button>
            <button
              type="button"
              className="ab-icon-btn ab-icon-btn--danger"
              aria-label="Remove step"
              title="Remove step"
              onClick={onRemove}
            >
              <Trash2 size={14} />
            </button>
          </span>
        ) : null}
      </div>
      <div className="ab-step__body">
        <StepConfig
          step={step}
          objects={objects}
          triggerObject={triggerObject}
          readOnly={readOnly}
          onPatch={onPatchConfig}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-step row (type picker)
// ---------------------------------------------------------------------------

function AddStep({ onAdd }: { onAdd: (type: AutomationStepType) => void }): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  if (!open) {
    return (
      <div className="ab-add">
        <button type="button" className="ab-add__btn" onClick={() => setOpen(true)}>
          <Plus size={14} aria-hidden="true" />
          Add step
        </button>
      </div>
    );
  }
  return (
    <div className="ab-add">
      <div className="ab-typepicker" role="menu" aria-label="Choose a step type">
        {STEP_ORDER.map((type) => {
          const meta = STEP_META[type];
          const Icon = meta.icon;
          return (
            <button
              key={type}
              type="button"
              role="menuitem"
              className="ab-typepicker__opt"
              onClick={() => {
                onAdd(type);
                setOpen(false);
              }}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="ab-add__btn" onClick={() => setOpen(false)}>
        <X size={14} aria-hidden="true" />
        Cancel
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AutomationBuilder
// ---------------------------------------------------------------------------

export function AutomationBuilder({
  value,
  objects = [],
  busy = false,
  dirty = false,
  onChange,
  onSave,
  onDelete,
  onToggleEnabled,
  readOnly = false,
  className,
}: AutomationBuilderProps): React.JSX.Element {
  const setTrigger = (patch: Partial<AutomationTrigger>) =>
    onChange({ ...value, trigger: { ...value.trigger, ...patch } });

  const addStep = (type: AutomationStepType) =>
    onChange({ ...value, steps: [...value.steps, emptyStep(type)] });

  const removeStep = (id: string) =>
    onChange({ ...value, steps: value.steps.filter((s) => s.id !== id) });

  const patchStepConfig = (id: string, config: Record<string, unknown>) =>
    onChange({
      ...value,
      steps: value.steps.map((s) => (s.id === id ? { ...s, config } : s)),
    });

  const moveStep = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= value.steps.length) return;
    const steps = [...value.steps];
    const [moved] = steps.splice(index, 1);
    steps.splice(target, 0, moved);
    onChange({ ...value, steps });
  };

  const classes = ['ab-builder', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="ab-builder__bar">
        <input
          className="st-input ab-builder__title"
          value={value.name}
          maxLength={120}
          placeholder="Workflow name"
          aria-label="Workflow name"
          autoComplete="off"
          disabled={readOnly}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
        <span className="ab-builder__spacer" />
        {onToggleEnabled ? (
          <button
            type="button"
            className={`st-switch${value.enabled ? ' is-on' : ''}`}
            role="switch"
            aria-checked={value.enabled}
            aria-label={value.enabled ? 'Disable workflow' : 'Enable workflow'}
            title={value.enabled ? 'Enabled' : 'Disabled'}
            disabled={readOnly}
            onClick={onToggleEnabled}
          />
        ) : null}
        {!readOnly && onSave ? (
          <TwentyButton
            variant="primary"
            icon={Save}
            disabled={busy || !dirty || !value.name.trim()}
            onClick={onSave}
          >
            {busy ? 'Saving…' : 'Save'}
          </TwentyButton>
        ) : null}
        {!readOnly && onDelete ? (
          <TwentyButton
            variant="ghost"
            icon={Trash2}
            className="st-btn--danger"
            disabled={busy}
            onClick={onDelete}
            title="Delete workflow"
          >
            Delete
          </TwentyButton>
        ) : null}
      </div>

      {!readOnly ? (
        <div className="st-field">
          <textarea
            className="st-textarea"
            value={value.description ?? ''}
            placeholder="Description (optional)"
            aria-label="Workflow description"
            onChange={(e) => onChange({ ...value, description: e.target.value })}
          />
        </div>
      ) : value.description ? (
        <p className="ab-desc">{value.description}</p>
      ) : null}

      <div className="ab-flow">
        {/* Trigger card */}
        <div className="ab-flow__node">
          <div className="ab-card">
            <div className="ab-card__head">
              <span className="ab-card__head-icon">
                <Zap size={13} />
              </span>
              Trigger
            </div>
            <div className="ab-card__body">
              <span className="ab-trigger-pill">
                <span className="ab-trigger-pill__icon">
                  <Zap size={12} />
                </span>
                When&nbsp;<strong>{triggerSummary(value.trigger)}</strong>
              </span>
              <div className="ab-grid-2">
                <div className="st-field">
                  <label className="st-field__label" htmlFor="ab-event">
                    Event
                  </label>
                  <select
                    id="ab-event"
                    className="st-select"
                    value={value.trigger.event}
                    disabled={readOnly}
                    onChange={(e) =>
                      setTrigger({ event: e.target.value as AutomationTriggerEvent })
                    }
                  >
                    {EVENT_OPTIONS.map((ev) => (
                      <option key={ev.value} value={ev.value}>
                        {ev.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="st-field">
                  <label className="st-field__label" htmlFor="ab-object">
                    Object
                  </label>
                  {objects.length > 0 ? (
                    <select
                      id="ab-object"
                      className="st-select"
                      value={value.trigger.object}
                      disabled={readOnly}
                      onChange={(e) => setTrigger({ object: e.target.value })}
                    >
                      <option value="">All objects</option>
                      {objects.map((o) => (
                        <option key={o.slug} value={o.slug}>
                          {o.labelPlural}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="ab-object"
                      className="st-input"
                      value={value.trigger.object}
                      placeholder="e.g. opportunities"
                      autoComplete="off"
                      disabled={readOnly}
                      onChange={(e) => setTrigger({ object: e.target.value.toLowerCase() })}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Steps */}
        {value.steps.length === 0 ? (
          <>
            <div className="ab-flow__connector" aria-hidden="true" />
            <div className="ab-flow__node">
              <div className="ab-steps-empty">
                {readOnly
                  ? 'No steps configured.'
                  : 'No steps yet. Add a step below to run an action when this trigger fires.'}
              </div>
            </div>
          </>
        ) : (
          value.steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="ab-flow__connector" aria-hidden="true" />
              <div className="ab-flow__node">
                <StepCard
                  step={step}
                  index={index}
                  count={value.steps.length}
                  objects={objects}
                  triggerObject={value.trigger.object}
                  readOnly={readOnly}
                  onPatchConfig={(config) => patchStepConfig(step.id, config)}
                  onMove={(dir) => moveStep(index, dir)}
                  onRemove={() => removeStep(step.id)}
                />
              </div>
            </React.Fragment>
          ))
        )}

        {!readOnly ? (
          <>
            <div className="ab-flow__connector" aria-hidden="true" />
            <div className="ab-flow__node">
              <AddStep onAdd={addStep} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default AutomationBuilder;
