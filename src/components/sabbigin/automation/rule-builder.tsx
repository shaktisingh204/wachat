'use client';

/**
 * SabBigin rule builder — a friendly, Bigin-style 3-step builder
 * (WHEN → IF → THEN). Deliberately NOT a node canvas: a linear, readable
 * form that any sales user can fill in.
 *
 * Persists through `saveSabbiginAutomation` and reloads an existing rule for
 * editing (the parent page passes `initial`). Action kinds the engine does
 * not run yet (e.g. WhatsApp template) are still configurable and saved so
 * the rule round-trips.
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  Zap,
  Filter,
  ListChecks,
  Plus,
  Trash2,
  ArrowLeft,
  PencilLine,
  CheckSquare,
  Mail,
  MessageCircle,
  Webhook,
} from 'lucide-react';

import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  Field,
  Input,
  Textarea,
  SelectField,
  Badge,
  Separator,
  toast,
} from '@/components/sabcrm/20ui';

import {
  saveSabbiginAutomation,
  type SabbiginAutomationDetail,
  type SabbiginTriggerInput,
  type SabbiginConditionInput,
  type SabbiginActionInput,
} from '@/app/actions/sabbigin-automations.actions';

const BASE = '/dashboard/sabbigin/automation';

/* --------------------------------------------------------------------
 * Option catalogues
 * ------------------------------------------------------------------ */

type TriggerType = SabbiginTriggerInput['type'];
type EntityKind = SabbiginTriggerInput['config']['entityKind'];
type ConditionKind = SabbiginConditionInput['kind'];
type ActionKind = SabbiginActionInput['kind'];

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'entity_created', label: 'A record is created' },
  { value: 'entity_updated', label: 'A record is updated' },
  { value: 'stage_changed', label: 'A deal stage changes' },
  { value: 'time_elapsed', label: 'No activity for N days' },
  { value: 'status_changed', label: 'A form is submitted / status changes' },
];

const ENTITY_OPTIONS: { value: EntityKind; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'deal', label: 'Deal' },
  { value: 'contact', label: 'Contact' },
  { value: 'account', label: 'Account' },
  { value: 'task', label: 'Task' },
  { value: 'form_submission', label: 'Form submission' },
];

const CONDITION_OPTIONS: { value: ConditionKind; label: string }[] = [
  { value: 'field_equals', label: 'Field equals' },
  { value: 'field_in', label: 'Field is one of' },
  { value: 'in_stage', label: 'Is in stage' },
  { value: 'has_tag', label: 'Has tag' },
];

const ACTION_CATALOG: {
  kind: ActionKind;
  label: string;
  icon: typeof PencilLine;
  supported: boolean;
}[] = [
  { kind: 'update_field', label: 'Update a field', icon: PencilLine, supported: true },
  { kind: 'create_task', label: 'Create a task', icon: CheckSquare, supported: true },
  { kind: 'send_email', label: 'Send an email', icon: Mail, supported: true },
  {
    kind: 'send_whatsapp_template',
    label: 'Send WhatsApp template',
    icon: MessageCircle,
    supported: false,
  },
  { kind: 'webhook', label: 'Call a webhook', icon: Webhook, supported: true },
];

/* --------------------------------------------------------------------
 * Local editable model (richer than the serialised input)
 * ------------------------------------------------------------------ */

interface ConditionRow extends SabbiginConditionInput {
  _key: string;
}
interface ActionRow {
  _key: string;
  kind: ActionKind;
  config: Record<string, unknown>;
}

let keySeq = 0;
const nextKey = () => `r${Date.now().toString(36)}-${keySeq++}`;

function defaultConfigFor(kind: ActionKind): Record<string, unknown> {
  switch (kind) {
    case 'update_field':
      return { field: '', value: '' };
    case 'create_task':
      return { title: '', dueInDays: 1, priority: 'Medium', type: 'Follow-up' };
    case 'send_email':
      return { to: '', subject: '', body: '' };
    case 'send_whatsapp_template':
      return { to: '', templateName: '', language: 'en' };
    case 'webhook':
      return { url: '', method: 'POST' };
    default:
      return {};
  }
}

/* --------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------ */

export interface RuleBuilderProps {
  initial?: SabbiginAutomationDetail | null;
}

export function RuleBuilder({ initial }: RuleBuilderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);

  const [triggerType, setTriggerType] = useState<TriggerType>(
    initial?.trigger.type ?? 'entity_created',
  );
  const [entityKind, setEntityKind] = useState<EntityKind>(
    initial?.trigger.config.entityKind ?? 'deal',
  );
  const [elapsedDays, setElapsedDays] = useState<number>(
    initial?.trigger.config.elapsedMinutes
      ? Math.max(1, Math.round(initial.trigger.config.elapsedMinutes / (60 * 24)))
      : 3,
  );
  const [fromValue, setFromValue] = useState(initial?.trigger.config.fromValue ?? '');
  const [toValue, setToValue] = useState(initial?.trigger.config.toValue ?? '');

  const [conditions, setConditions] = useState<ConditionRow[]>(
    (initial?.conditions ?? []).map((c) => ({ ...c, _key: nextKey() })),
  );
  const [actions, setActions] = useState<ActionRow[]>(
    (initial?.actions ?? []).map((a) => ({
      _key: nextKey(),
      kind: a.kind,
      config: { ...a.config },
    })),
  );

  /* ---- condition helpers ---- */
  const addCondition = () =>
    setConditions((prev) => [
      ...prev,
      { _key: nextKey(), kind: 'field_equals', field: '', value: '' },
    ]);
  const updateCondition = (key: string, patch: Partial<ConditionRow>) =>
    setConditions((prev) =>
      prev.map((c) => (c._key === key ? { ...c, ...patch } : c)),
    );
  const removeCondition = (key: string) =>
    setConditions((prev) => prev.filter((c) => c._key !== key));

  /* ---- action helpers ---- */
  const addAction = (kind: ActionKind) =>
    setActions((prev) => [
      ...prev,
      { _key: nextKey(), kind, config: defaultConfigFor(kind) },
    ]);
  const updateActionConfig = (key: string, patch: Record<string, unknown>) =>
    setActions((prev) =>
      prev.map((a) =>
        a._key === key ? { ...a, config: { ...a.config, ...patch } } : a,
      ),
    );
  const removeAction = (key: string) =>
    setActions((prev) => prev.filter((a) => a._key !== key));

  /* ---- save ---- */
  const handleSave = () => {
    if (!name.trim()) {
      toast.error({ title: 'Name your rule', description: 'Give the rule a short name first.' });
      return;
    }
    if (actions.length === 0) {
      toast.error({ title: 'Add an action', description: 'A rule needs at least one THEN action.' });
      return;
    }

    const trigger: SabbiginTriggerInput = {
      type: triggerType,
      config: {
        entityKind,
        ...(triggerType === 'time_elapsed'
          ? { elapsedMinutes: Math.max(1, elapsedDays) * 24 * 60 }
          : {}),
        ...(triggerType === 'stage_changed' || triggerType === 'status_changed'
          ? {
              fieldName: triggerType === 'stage_changed' ? 'stage' : 'status',
              fromValue: fromValue || undefined,
              toValue: toValue || undefined,
            }
          : {}),
      },
    };

    startTransition(async () => {
      const res = await saveSabbiginAutomation({
        id: initial?.id,
        name: name.trim(),
        description: description.trim(),
        enabled,
        trigger,
        conditions: conditions.map(({ _key, ...c }) => c),
        actions: actions.map(({ _key, ...a }) => a),
      });
      if (res.success) {
        toast.success({
          title: initial?.id ? 'Rule updated' : 'Rule created',
          description: enabled ? 'It is live and will run on matching events.' : 'Saved as paused.',
        });
        router.push(BASE);
        router.refresh();
      } else {
        toast.error({ title: 'Could not save', description: res.error });
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Name + meta */}
      <Card>
        <CardBody className="flex flex-col gap-4">
          <Field label="Rule name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Notify owner when a deal is won"
            />
          </Field>
          <Field label="Description" help="Optional — what this rule is for.">
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When a deal moves to Won, create a handoff task for delivery."
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Enable this rule (runs automatically on matching events)</span>
            <Badge tone={enabled ? 'success' : 'neutral'}>
              {enabled ? 'Active' : 'Paused'}
            </Badge>
          </label>
        </CardBody>
      </Card>

      {/* STEP 1 — WHEN */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Zap size={15} aria-hidden="true" /> When · the trigger
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="This happens">
              <SelectField
                value={triggerType}
                onChange={(v) => v && setTriggerType(v as TriggerType)}
                options={TRIGGER_OPTIONS}
              />
            </Field>
            <Field label="On this record type">
              <SelectField
                value={entityKind}
                onChange={(v) => v && setEntityKind(v as EntityKind)}
                options={ENTITY_OPTIONS}
              />
            </Field>
          </div>

          {triggerType === 'time_elapsed' ? (
            <Field label="Days with no activity" help="The rule fires once the record sits untouched this long.">
              <Input
                type="number"
                min={1}
                value={String(elapsedDays)}
                onChange={(e) => setElapsedDays(Number(e.target.value) || 1)}
              />
            </Field>
          ) : null}

          {triggerType === 'stage_changed' || triggerType === 'status_changed' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From (optional)" help="Leave blank for any starting value.">
                <Input
                  value={fromValue}
                  onChange={(e) => setFromValue(e.target.value)}
                  placeholder="e.g. Negotiation"
                />
              </Field>
              <Field label="To (optional)" help="Leave blank for any new value.">
                <Input
                  value={toValue}
                  onChange={(e) => setToValue(e.target.value)}
                  placeholder="e.g. Won"
                />
              </Field>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* STEP 2 — IF */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Filter size={15} aria-hidden="true" /> If · conditions
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: 'var(--u-text-muted, #6b7280)' }}>
            Optional. All conditions must pass for the actions to run. Leave empty to
            run on every matching event.
          </p>

          {conditions.length === 0 ? null : (
            <div className="flex flex-col gap-3">
              {conditions.map((c) => (
                <div
                  key={c._key}
                  className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <Field label="Type">
                    <SelectField
                      value={c.kind}
                      onChange={(v) =>
                        v && updateCondition(c._key, { kind: v as ConditionKind })
                      }
                      options={CONDITION_OPTIONS}
                    />
                  </Field>
                  <Field label="Field">
                    <Input
                      value={c.field ?? ''}
                      onChange={(e) =>
                        updateCondition(c._key, { field: e.target.value })
                      }
                      placeholder="e.g. source"
                    />
                  </Field>
                  <Field label="Value">
                    <Input
                      value={typeof c.value === 'string' ? c.value : String(c.value ?? '')}
                      onChange={(e) =>
                        updateCondition(c._key, { value: e.target.value })
                      }
                      placeholder={c.kind === 'field_in' ? 'a, b, c' : 'e.g. Website'}
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={Trash2}
                    onClick={() => removeCondition(c._key)}
                    aria-label="Remove condition"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div>
            <Button variant="secondary" size="sm" iconLeft={Plus} onClick={addCondition}>
              Add condition
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* STEP 3 — THEN */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <ListChecks size={15} aria-hidden="true" /> Then · do this
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {actions.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--u-text-muted, #6b7280)' }}>
              Add one or more actions to run when the trigger fires.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {actions.map((a, idx) => (
                <ActionCard
                  key={a._key}
                  index={idx}
                  action={a}
                  onChange={(patch) => updateActionConfig(a._key, patch)}
                  onRemove={() => removeAction(a._key)}
                />
              ))}
            </div>
          )}

          <Separator />

          <div className="flex flex-wrap gap-2">
            {ACTION_CATALOG.map((opt) => {
              const Icon = opt.icon;
              return (
                <Button
                  key={opt.kind}
                  variant="ghost"
                  size="sm"
                  iconLeft={Icon}
                  onClick={() => addAction(opt.kind)}
                >
                  {opt.label}
                  {!opt.supported ? (
                    <Badge tone="info" style={{ marginLeft: 6 }}>
                      Soon
                    </Badge>
                  ) : null}
                </Button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={BASE} className="u-btn u-btn--ghost u-btn--sm">
          <ArrowLeft size={13} aria-hidden="true" />
          <span className="u-btn__label">Back to rules</span>
        </Link>
        <Button variant="primary" onClick={handleSave} loading={pending}>
          {initial?.id ? 'Save changes' : 'Create rule'}
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------
 * Action card — per-kind config inputs
 * ------------------------------------------------------------------ */

function ActionCard({
  index,
  action,
  onChange,
  onRemove,
}: {
  index: number;
  action: ActionRow;
  onChange: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const meta = ACTION_CATALOG.find((m) => m.kind === action.kind);
  const Icon = meta?.icon ?? ListChecks;
  const cfg = action.config;
  const str = (k: string) =>
    typeof cfg[k] === 'string' ? (cfg[k] as string) : cfg[k] != null ? String(cfg[k]) : '';

  return (
    <Card padding="sm">
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Icon size={14} aria-hidden="true" />
            Step {index + 1}: {meta?.label ?? action.kind}
            {meta && !meta.supported ? <Badge tone="info">Configured · runs soon</Badge> : null}
          </span>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Trash2}
            onClick={onRemove}
            aria-label="Remove action"
          >
            Remove
          </Button>
        </div>

        {action.kind === 'update_field' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Field name">
              <Input value={str('field')} onChange={(e) => onChange({ field: e.target.value })} placeholder="e.g. owner" />
            </Field>
            <Field label="New value">
              <Input value={str('value')} onChange={(e) => onChange({ value: e.target.value })} placeholder="e.g. Won" />
            </Field>
          </div>
        ) : null}

        {action.kind === 'create_task' ? (
          <div className="flex flex-col gap-3">
            <Field label="Task title">
              <Input value={str('title')} onChange={(e) => onChange({ title: e.target.value })} placeholder="e.g. Call back the customer" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Due in (days)">
                <Input
                  type="number"
                  min={0}
                  value={str('dueInDays') || '1'}
                  onChange={(e) => onChange({ dueInDays: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Priority">
                <SelectField
                  value={str('priority') || 'Medium'}
                  onChange={(v) => v && onChange({ priority: v })}
                  options={[
                    { value: 'High', label: 'High' },
                    { value: 'Medium', label: 'Medium' },
                    { value: 'Low', label: 'Low' },
                  ]}
                />
              </Field>
              <Field label="Type">
                <SelectField
                  value={str('type') || 'Follow-up'}
                  onChange={(v) => v && onChange({ type: v })}
                  options={[
                    { value: 'Call', label: 'Call' },
                    { value: 'Meeting', label: 'Meeting' },
                    { value: 'Follow-up', label: 'Follow-up' },
                    { value: 'WhatsApp', label: 'WhatsApp' },
                    { value: 'Email', label: 'Email' },
                  ]}
                />
              </Field>
            </div>
          </div>
        ) : null}

        {action.kind === 'send_email' ? (
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="To" help="An email address or a {{field}} token.">
                <Input value={str('to')} onChange={(e) => onChange({ to: e.target.value })} placeholder="{{contact.email}}" />
              </Field>
              <Field label="Subject">
                <Input value={str('subject')} onChange={(e) => onChange({ subject: e.target.value })} placeholder="Thanks for your interest" />
              </Field>
            </div>
            <Field label="Body">
              <Textarea rows={3} value={str('body')} onChange={(e) => onChange({ body: e.target.value })} placeholder="Hi {{name}}, ..." />
            </Field>
          </div>
        ) : null}

        {action.kind === 'send_whatsapp_template' ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="To (phone)">
              <Input value={str('to')} onChange={(e) => onChange({ to: e.target.value })} placeholder="{{contact.phone}}" />
            </Field>
            <Field label="Template name">
              <Input value={str('templateName')} onChange={(e) => onChange({ templateName: e.target.value })} placeholder="welcome_v1" />
            </Field>
            <Field label="Language">
              <Input value={str('language') || 'en'} onChange={(e) => onChange({ language: e.target.value })} placeholder="en" />
            </Field>
          </div>
        ) : null}

        {action.kind === 'webhook' ? (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="URL">
              <Input value={str('url')} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://example.com/hook" />
            </Field>
            <Field label="Method">
              <SelectField
                value={str('method') || 'POST'}
                onChange={(v) => v && onChange({ method: v })}
                options={[
                  { value: 'POST', label: 'POST' },
                  { value: 'GET', label: 'GET' },
                  { value: 'PUT', label: 'PUT' },
                  { value: 'PATCH', label: 'PATCH' },
                  { value: 'DELETE', label: 'DELETE' },
                ]}
              />
            </Field>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
