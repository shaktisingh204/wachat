'use client';

/**
 * SabCRM - Pipelines settings (`/dashboard/settings/crm/pipelines`).
 *
 * The sales-pipelines editor. A two-pane layout:
 *
 *   LEFT  - the list of pipelines this project owns. Each row shows the
 *           pipeline name, its stage count, and a "Default" badge on the one
 *           pipeline marked default. A "New" button at the top creates one.
 *
 *   RIGHT - the editor for the selected pipeline: its name, the object it runs
 *           on, an ordered list of stages (each a label + colour-swatch picker,
 *           with add / remove / reorder-by-arrows), a per-stage collapsible
 *           "Governance" panel (required fields to enter, requires-approval,
 *           rotting days, explicit open/won/lost kind), a pipeline-level
 *           lost-reason section (require-a-reason switch + curated reason
 *           chips), and a "Set as default" toggle. Save persists via
 *           `updatePipelineTw` (existing) or `createPipelineTw` (new, unsaved)
 *           drafts. Delete removes it.
 *
 * Mutations go through the gated server actions in
 * `@/app/actions/sabcrm-pipelines.actions` (session -> project -> RBAC -> plan),
 * which return a typed `ActionResult`, so the page degrades to loading / empty
 * / error states and never crashes when the engine is unreachable.
 *
 * Pure 20ui: every control comes from `@/components/sabcrm/20ui`. Auth / RBAC /
 * project context are enforced by the parent `../../layout.tsx`; every action
 * independently re-runs the full gate. The colour-swatch picker and the
 * arrow-based reorder mirror the Data Model SELECT-option editor.
 */

import * as React from 'react';
import {
  Plus,
  Workflow,
  AlertTriangle,
  Trash2,
  Check,
  ArrowUp,
  ArrowDown,
  Star,
  GripVertical,
  ShieldCheck,
  X,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  Field,
  Input,
  Switch,
  MultiSelect,
  Badge,
  Alert,
  EmptyState,
  Skeleton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listPipelinesTw,
  getPipelineTw,
  createPipelineTw,
  updatePipelineTw,
  deletePipelineTw,
} from '@/app/actions/sabcrm-pipelines.actions';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';

// ---------------------------------------------------------------------------
// Wire shapes
//
// Declared locally to keep this client page free of any `server-only` import.
// Mirrors the `Pipeline` shape documented in the
// `@/app/actions/sabcrm-pipelines.actions` contract:
//   { id, name, object, stages:[{ id, label, color }], isDefault? }
// ---------------------------------------------------------------------------

/** Explicit stage classification persisted as `stage.kind` (additive). */
type StageKind = 'open' | 'won' | 'lost';

interface PipelineStage {
  id: string;
  label: string;
  /** A `--st-*` token (or hex); optional on the wire, defaulted in the UI. */
  color?: string;
  /** Governance: `data.<key>`s required before a record may ENTER the stage. */
  requiredFields?: string[];
  /** Governance: entering the stage raises an approval request first. */
  requiresApproval?: boolean;
  /** Governance: idle-days threshold for deal rotting. Omitted → never rots. */
  rottingDays?: number;
  /** Explicit open / won / lost marker. Omitted on legacy stages. */
  kind?: StageKind;
  /** Forecast weighting (percent 0-100). Omitted → position-based default. */
  probability?: number;
}

interface Pipeline {
  id: string;
  name: string;
  object: string;
  stages: PipelineStage[];
  isDefault?: boolean;
  /** Loss governance: marking a record lost requires a reason. */
  lostReasonRequired?: boolean;
  /** Loss governance: curated lost reasons (empty → free text). */
  lostReasons?: string[];
}

/** Input for create/update - `id` is server-assigned for new pipelines. */
interface PipelineInput {
  name: string;
  object: string;
  stages: PipelineStage[];
  isDefault?: boolean;
  lostReasonRequired?: boolean;
  lostReasons?: string[];
}

/** One pickable object field (key + label) for the required-fields gate. */
interface ObjectFieldOption {
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Stage-colour palette
//
// A fixed palette for stage swatches. `token` is what we persist (a stable
// name, consistent with the seeded schema) and `swatch` is the literal hex we
// paint - the swatch must be concrete since these tokens are not in scope here.
// ---------------------------------------------------------------------------

interface PaletteColor {
  name: string;
  token: string;
  swatch: string;
}

const STAGE_PALETTE: ReadonlyArray<PaletteColor> = [
  { name: 'Gray', token: 'stage-gray', swatch: '#8c8c8c' },
  { name: 'Blue', token: 'stage-blue', swatch: '#3b7ae4' },
  { name: 'Sky', token: 'stage-sky', swatch: '#5db4e3' },
  { name: 'Turquoise', token: 'stage-turquoise', swatch: '#21b8a6' },
  { name: 'Green', token: 'stage-green', swatch: '#3dab5a' },
  { name: 'Yellow', token: 'stage-yellow', swatch: '#e0c64a' },
  { name: 'Orange', token: 'stage-orange', swatch: '#f0883e' },
  { name: 'Red', token: 'stage-red', swatch: '#e0484e' },
  { name: 'Pink', token: 'stage-pink', swatch: '#e052b0' },
  { name: 'Purple', token: 'stage-purple', swatch: '#9b51e0' },
];

const DEFAULT_STAGE_COLOR = STAGE_PALETTE[0].token;

/** Resolve a stored stage colour (token or hex) to a paintable swatch. */
function swatchFor(color: string | undefined): string {
  if (!color) return STAGE_PALETTE[0].swatch;
  const match = STAGE_PALETTE.find((c) => c.token === color);
  if (match) return match.swatch;
  return /^#|^rgb|^hsl/.test(color) ? color : STAGE_PALETTE[0].swatch;
}

/**
 * Objects a pipeline can run on. The values are the plural object slugs the
 * Rust engine uses - `"opportunities"` is the server-side default - so a
 * created pipeline's `object` round-trips cleanly.
 */
const PIPELINE_OBJECTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'opportunities', label: 'Opportunities' },
  { value: 'leads', label: 'Leads' },
  { value: 'deals', label: 'Deals' },
  { value: 'companies', label: 'Companies' },
  { value: 'people', label: 'People' },
];

function objectLabel(object: string): string {
  return PIPELINE_OBJECTS.find((o) => o.value === object)?.label ?? object;
}

/** Stable client-side id for unsaved stage rows. */
function tempId(): string {
  return `tmp_${Math.random().toString(36).slice(2, 10)}`;
}

/** A fresh draft pipeline (not yet persisted; `id` is empty until created). */
function newDraft(): Pipeline {
  return {
    id: '',
    name: 'New pipeline',
    object: PIPELINE_OBJECTS[0].value,
    stages: [
      { id: tempId(), label: 'New', color: 'stage-gray' },
      { id: tempId(), label: 'In progress', color: 'stage-blue' },
      { id: tempId(), label: 'Won', color: 'stage-green', kind: 'won' },
      { id: tempId(), label: 'Lost', color: 'stage-red', kind: 'lost' },
    ],
    isDefault: false,
  };
}

/** Deep-enough copy so draft edits never alias the pristine original. */
function clonePipeline(p: Pipeline): Pipeline {
  return {
    ...p,
    lostReasons: p.lostReasons ? [...p.lostReasons] : undefined,
    stages: p.stages.map((s) => ({
      ...s,
      requiredFields: s.requiredFields ? [...s.requiredFields] : undefined,
    })),
  };
}

/** Order-sensitive equality on optional string lists (undefined ≡ empty). */
function sameStrings(a: string[] | undefined, b: string[] | undefined): boolean {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/** Compare two pipelines for editor dirty-state (order-sensitive on stages). */
function pipelineEquals(a: Pipeline, b: Pipeline): boolean {
  if (
    a.name !== b.name ||
    a.object !== b.object ||
    Boolean(a.isDefault) !== Boolean(b.isDefault) ||
    Boolean(a.lostReasonRequired) !== Boolean(b.lostReasonRequired) ||
    !sameStrings(a.lostReasons, b.lostReasons) ||
    a.stages.length !== b.stages.length
  ) {
    return false;
  }
  return a.stages.every((s, i) => {
    const o = b.stages[i];
    return (
      o !== undefined &&
      s.id === o.id &&
      s.label === o.label &&
      s.color === o.color &&
      sameStrings(s.requiredFields, o.requiredFields) &&
      Boolean(s.requiresApproval) === Boolean(o.requiresApproval) &&
      (s.rottingDays ?? null) === (o.rottingDays ?? null) &&
      (s.kind ?? null) === (o.kind ?? null) &&
      (s.probability ?? null) === (o.probability ?? null)
    );
  });
}

// ---------------------------------------------------------------------------
// Colour-swatch picker (popover) - mirrors the Data Model option editor.
// ---------------------------------------------------------------------------

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (token: string) => void;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          aria-label="Pick stage colour"
          className="!size-8 shrink-0 !p-0"
        >
          <span
            className="block size-4 rounded-full"
            style={{ background: swatchFor(value) }}
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-[var(--st-space-2)]">
        <div
          role="listbox"
          aria-label="Colours"
          className="grid grid-cols-5 gap-[var(--st-space-1)]"
        >
          {STAGE_PALETTE.map((c) => (
            <Button
              key={c.token}
              variant="ghost"
              role="option"
              aria-selected={c.token === value}
              aria-label={c.name}
              title={c.name}
              className="!size-7 !p-0"
              onClick={() => {
                onChange(c.token);
                setOpen(false);
              }}
            >
              <span
                className="grid size-5 place-items-center rounded-full"
                style={{ background: c.swatch }}
                aria-hidden="true"
              >
                {c.token === value ? (
                  <Check size={12} className="text-white" aria-hidden="true" />
                ) : null}
              </span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Stage governance - collapsible per-stage panel: required fields (entry
// gate), approval, rotting threshold and the explicit open/won/lost kind.
// ---------------------------------------------------------------------------

/** How many governance rules a stage has switched on (for the toggle badge). */
function governanceCount(stage: PipelineStage): number {
  let n = 0;
  if (stage.requiredFields && stage.requiredFields.length > 0) n += 1;
  if (stage.requiresApproval) n += 1;
  if (typeof stage.rottingDays === 'number') n += 1;
  if (stage.kind === 'won' || stage.kind === 'lost') n += 1;
  if (typeof stage.probability === 'number') n += 1;
  return n;
}

const STAGE_KINDS: ReadonlyArray<{ value: StageKind; label: string }> = [
  { value: 'open', label: 'Open (in progress)' },
  { value: 'won', label: 'Won (closed positively)' },
  { value: 'lost', label: 'Lost (closed negatively)' },
];

function StageGovernancePanel({
  stage,
  fieldOptions,
  onChange,
}: {
  stage: PipelineStage;
  /** Pickable fields of the pipeline's object for the required-fields gate. */
  fieldOptions: ObjectFieldOption[];
  onChange: (patch: Partial<PipelineStage>) => void;
}): React.JSX.Element {
  // Preserve already-selected keys the catalogue no longer knows, so a stale
  // gate still round-trips (and can be removed) instead of silently vanishing.
  const options = React.useMemo<ObjectFieldOption[]>(() => {
    const known = new Set(fieldOptions.map((o) => o.value));
    const extras = (stage.requiredFields ?? [])
      .filter((k) => !known.has(k))
      .map((k) => ({ value: k, label: k }));
    return [...fieldOptions, ...extras];
  }, [fieldOptions, stage.requiredFields]);

  return (
    <div className="ml-[calc(14px+var(--st-space-2))] flex flex-col gap-[var(--st-space-3)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-[var(--st-space-3)] py-[var(--st-space-3)]">
      <Field
        label="Required fields to enter"
        help="Records cannot move into this stage until these fields are filled."
      >
        <MultiSelect
          value={stage.requiredFields ?? []}
          onChange={(requiredFields) => onChange({ requiredFields })}
          options={options}
          placeholder={
            options.length > 0 ? 'Pick fields' : 'No fields on this object'
          }
          searchable
          disabled={options.length === 0}
          aria-label="Required fields to enter this stage"
        />
      </Field>

      <div className="flex items-start gap-[var(--st-space-3)]">
        <Switch
          checked={Boolean(stage.requiresApproval)}
          aria-label="Require approval to enter this stage"
          onCheckedChange={(requiresApproval) => onChange({ requiresApproval })}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-[var(--st-text)]">
            Require approval
          </span>
          <span className="text-[12px] text-[var(--st-text-secondary)]">
            Moving here raises an approval request instead of moving directly.
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2">
        <Field
          label="Rotting after (days)"
          help="Idle records are flagged as rotting. Empty turns it off."
        >
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={typeof stage.rottingDays === 'number' ? stage.rottingDays : ''}
            placeholder="Off"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                onChange({ rottingDays: undefined });
                return;
              }
              const n = Number(raw);
              onChange({
                rottingDays: Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined,
              });
            }}
          />
        </Field>

        <Field
          label="Win probability (%)"
          help="Weights this stage's deals in the forecast. Empty uses a position-based default."
        >
          <Input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={typeof stage.probability === 'number' ? stage.probability : ''}
            placeholder="Auto"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                onChange({ probability: undefined });
                return;
              }
              const n = Number(raw);
              onChange({
                probability:
                  Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined,
              });
            }}
          />
        </Field>

        <Field
          label="Stage type"
          help="Lost stages trigger the lost-reason dialog."
        >
          <Select
            value={stage.kind ?? 'open'}
            onValueChange={(kind) => onChange({ kind: kind as StageKind })}
          >
            <SelectTrigger aria-label="Stage type">
              <SelectValue placeholder="Open (in progress)" />
            </SelectTrigger>
            <SelectContent>
              {STAGE_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stages editor - ordered rows of swatch + label, with add/remove/reorder.
// ---------------------------------------------------------------------------

function StagesEditor({
  stages,
  fieldOptions,
  onChange,
}: {
  stages: PipelineStage[];
  /** Pickable fields of the pipeline's object for the governance panels. */
  fieldOptions: ObjectFieldOption[];
  onChange: (next: PipelineStage[]) => void;
}): React.JSX.Element {
  /** id of the stage whose governance panel is expanded (one at a time). */
  const [openGovernanceId, setOpenGovernanceId] = React.useState<string | null>(
    null,
  );
  const update = (idx: number, patch: Partial<PipelineStage>) => {
    onChange(stages.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...stages];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => {
    if (stages[idx] && stages[idx].id === openGovernanceId) {
      setOpenGovernanceId(null);
    }
    onChange(stages.filter((_, i) => i !== idx));
  };

  const add = () => {
    onChange([...stages, { id: tempId(), label: '', color: DEFAULT_STAGE_COLOR }]);
  };

  return (
    <div className="flex flex-col gap-[var(--st-space-2)]">
      <span className="text-[13px] font-medium text-[var(--st-text)]">Stages</span>
      <div className="flex flex-col gap-[var(--st-space-2)]">
        {stages.length === 0 ? (
          <p className="m-0 text-[13px] text-[var(--st-text-secondary)]">
            No stages yet. Add one to start the pipeline.
          </p>
        ) : (
          stages.map((stage, idx) => {
            const governanceOpen = openGovernanceId === stage.id;
            const ruleCount = governanceCount(stage);
            return (
              <div className="flex flex-col gap-[var(--st-space-2)]" key={stage.id}>
                <div className="flex items-center gap-[var(--st-space-2)]">
                  <span className="text-[var(--st-text-tertiary)]" aria-hidden="true">
                    <GripVertical size={14} />
                  </span>
                  <ColorPicker
                    value={stage.color || DEFAULT_STAGE_COLOR}
                    onChange={(token) => update(idx, { color: token })}
                  />
                  <div className="min-w-0 flex-1">
                    <Input
                      value={stage.label}
                      placeholder={`Stage ${idx + 1}`}
                      autoComplete="off"
                      aria-label={`Stage ${idx + 1} label`}
                      onChange={(e) => update(idx, { label: e.target.value })}
                    />
                  </div>
                  <Button
                    variant={governanceOpen ? 'secondary' : 'ghost'}
                    size="sm"
                    iconLeft={ShieldCheck}
                    aria-expanded={governanceOpen}
                    aria-label={`Governance for stage ${stage.label || idx + 1}${
                      ruleCount > 0 ? ` (${ruleCount} rules on)` : ''
                    }`}
                    onClick={() =>
                      setOpenGovernanceId(governanceOpen ? null : stage.id)
                    }
                  >
                    {ruleCount > 0 ? `Governance · ${ruleCount}` : 'Governance'}
                  </Button>
                  <div className="flex items-center gap-[var(--st-space-1)]">
                    <IconButton
                      icon={ArrowUp}
                      label="Move stage up"
                      variant="ghost"
                      size="sm"
                      disabled={idx === 0}
                      onClick={() => move(idx, -1)}
                    />
                    <IconButton
                      icon={ArrowDown}
                      label="Move stage down"
                      variant="ghost"
                      size="sm"
                      disabled={idx === stages.length - 1}
                      onClick={() => move(idx, 1)}
                    />
                  </div>
                  <IconButton
                    icon={Trash2}
                    label={`Remove stage ${stage.label || idx + 1}`}
                    variant="danger"
                    size="sm"
                    onClick={() => remove(idx)}
                  />
                </div>
                {governanceOpen ? (
                  <StageGovernancePanel
                    stage={stage}
                    fieldOptions={fieldOptions}
                    onChange={(patch) => update(idx, patch)}
                  />
                ) : null}
              </div>
            );
          })
        )}
        <div>
          <Button variant="ghost" size="sm" iconLeft={Plus} onClick={add}>
            Add stage
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lost-reason governance - require-a-reason switch + editable reason chips.
// ---------------------------------------------------------------------------

function LostReasonsEditor({
  required,
  reasons,
  onRequiredChange,
  onReasonsChange,
}: {
  required: boolean;
  reasons: string[];
  onRequiredChange: (required: boolean) => void;
  onReasonsChange: (reasons: string[]) => void;
}): React.JSX.Element {
  const [pending, setPending] = React.useState('');

  const addReason = () => {
    const value = pending.trim();
    if (!value || reasons.includes(value)) return;
    onReasonsChange([...reasons, value]);
    setPending('');
  };

  return (
    <div className="flex flex-col gap-[var(--st-space-3)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-[var(--st-space-3)] py-[var(--st-space-3)]">
      <div className="flex items-start gap-[var(--st-space-3)]">
        <Switch
          checked={required}
          aria-label="Require a lost reason"
          onCheckedChange={onRequiredChange}
        />
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-[var(--st-space-1)] text-[13px] font-medium text-[var(--st-text)]">
            <ShieldCheck size={14} aria-hidden="true" />
            Require a lost reason
          </span>
          <span className="text-[12px] text-[var(--st-text-secondary)]">
            Moving a record into a lost stage asks why before the move commits.
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-[var(--st-space-2)]">
        <span className="text-[12px] font-medium text-[var(--st-text-secondary)]">
          Lost reasons {reasons.length === 0 ? '(empty = free text)' : ''}
        </span>
        {reasons.length > 0 ? (
          <div className="flex flex-wrap gap-[var(--st-space-1)]">
            {reasons.map((reason) => (
              <span
                key={reason}
                className="inline-flex items-center gap-[var(--st-space-1)] rounded-full border border-[var(--st-border)] bg-[var(--st-bg)] px-[var(--st-space-2)] py-0.5 text-[12px] text-[var(--st-text)]"
              >
                {reason}
                <button
                  type="button"
                  aria-label={`Remove lost reason ${reason}`}
                  className="grid place-items-center rounded-full p-0.5 text-[var(--st-text-tertiary)] hover:text-[var(--st-text)]"
                  onClick={() =>
                    onReasonsChange(reasons.filter((r) => r !== reason))
                  }
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-[var(--st-space-2)]">
          <div className="min-w-0 flex-1">
            <Input
              value={pending}
              placeholder="Add a reason, e.g. Price"
              autoComplete="off"
              aria-label="New lost reason"
              onChange={(e) => setPending(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addReason();
                }
              }}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={Plus}
            disabled={!pending.trim() || reasons.includes(pending.trim())}
            onClick={addReason}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Left pane - pipeline list
// ---------------------------------------------------------------------------

function PipelineList({
  pipelines,
  activeId,
  dirtyId,
  onSelect,
}: {
  pipelines: Pipeline[];
  activeId: string | null;
  /** id of a pipeline (or '' for a draft) with unsaved edits, for a dot. */
  dirtyId: string | null;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  return (
    <nav className="flex flex-col gap-[var(--st-space-1)]" aria-label="Pipelines">
      {pipelines.map((p) => {
        const id = p.id || '';
        const active = id === activeId || (p.id === '' && activeId === '');
        const dirty = dirtyId !== null && dirtyId === id;
        return (
          <Button
            key={p.id || 'draft'}
            variant="ghost"
            block
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(id)}
            className={[
              '!h-auto justify-start whitespace-normal !px-[var(--st-space-3)] !py-[var(--st-space-2)] border [&_.u-btn__label]:flex [&_.u-btn__label]:w-full [&_.u-btn__label]:items-center [&_.u-btn__label]:gap-[var(--st-space-2)] [&_.u-btn__label]:overflow-visible',
              active
                ? '!border-[var(--st-accent)] !bg-[var(--st-bg-secondary)]'
                : '!border-[var(--st-border)] !bg-[var(--st-bg)]',
            ].join(' ')}
          >
            <span className="text-[var(--st-text-secondary)]" aria-hidden="true">
              <Workflow size={15} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col text-left">
              <span className="flex items-center gap-[var(--st-space-1)] truncate text-[13px] font-medium text-[var(--st-text)]">
                {p.name || 'Untitled pipeline'}
                {dirty ? (
                  <span
                    className="inline-block size-1.5 rounded-full bg-[var(--st-accent)]"
                    title="Unsaved changes"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
              <span className="truncate text-[12px] font-normal text-[var(--st-text-tertiary)]">
                {p.stages.length} {p.stages.length === 1 ? 'stage' : 'stages'}
                {' . '}
                {objectLabel(p.object)}
              </span>
            </span>
            {p.isDefault ? (
              <Badge tone="accent" kind="soft">
                Default
              </Badge>
            ) : null}
          </Button>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Right pane - pipeline editor
// ---------------------------------------------------------------------------

interface EditorProps {
  /** The persisted/original pipeline (drives the dirty diff). */
  original: Pipeline;
  /** The in-progress draft the user is editing. */
  draft: Pipeline;
  /** Fields of the draft's object, for the required-fields governance gate. */
  fieldOptions: ObjectFieldOption[];
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onChange: (next: Pipeline) => void;
  onSave: () => void;
  onDelete: () => void;
}

function PipelineEditor({
  original,
  draft,
  fieldOptions,
  saving,
  deleting,
  error,
  onChange,
  onSave,
  onDelete,
}: EditorProps): React.JSX.Element {
  const isNew = draft.id === '';
  const dirty = isNew || !pipelineEquals(original, draft);

  const stagesValid =
    draft.stages.length > 0 &&
    draft.stages.every((s) => s.label.trim().length > 0);
  const nameValid = draft.name.trim().length > 0;
  const canSave = dirty && nameValid && stagesValid && !saving && !deleting;

  const knownObject = PIPELINE_OBJECTS.some((o) => o.value === draft.object);

  return (
    <Card variant="outlined" padding="none" aria-label="Pipeline editor">
      <div className="flex items-center justify-between gap-[var(--st-space-3)] border-b border-[var(--st-border)] px-[var(--st-space-4)] py-[var(--st-space-3)]">
        <div className="flex min-w-0 items-center gap-[var(--st-space-2)]">
          <h2 className="m-0 flex items-center gap-[var(--st-space-2)] truncate text-[15px] font-semibold text-[var(--st-text)]">
            <Workflow size={18} aria-hidden="true" />
            {isNew ? 'New pipeline' : original.name}
          </h2>
          {draft.isDefault ? (
            <Badge tone="accent" kind="soft">
              Default
            </Badge>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-[var(--st-space-2)]">
          {!isNew ? (
            <Button
              variant="danger"
              iconLeft={Trash2}
              onClick={onDelete}
              disabled={saving || deleting}
              loading={deleting}
            >
              Delete
            </Button>
          ) : null}
          <Button
            variant="primary"
            disabled={!canSave}
            loading={saving}
            onClick={onSave}
          >
            {isNew ? 'Create pipeline' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-[var(--st-space-4)] px-[var(--st-space-4)] py-[var(--st-space-4)]">
        <Field label="Name" required>
          <Input
            value={draft.name}
            placeholder="Sales pipeline"
            autoComplete="off"
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </Field>

        <Field label="Object">
          <Select
            value={draft.object}
            onValueChange={(object) => onChange({ ...draft, object })}
          >
            <SelectTrigger aria-label="Object">
              <SelectValue placeholder="Select an object" />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_OBJECTS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
              {/* Preserve an unknown stored object so it round-trips. */}
              {knownObject ? null : (
                <SelectItem value={draft.object}>{draft.object}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </Field>

        <StagesEditor
          stages={draft.stages}
          fieldOptions={fieldOptions}
          onChange={(stages) => onChange({ ...draft, stages })}
        />

        <LostReasonsEditor
          required={Boolean(draft.lostReasonRequired)}
          reasons={draft.lostReasons ?? []}
          onRequiredChange={(lostReasonRequired) =>
            onChange({ ...draft, lostReasonRequired })
          }
          onReasonsChange={(lostReasons) => onChange({ ...draft, lostReasons })}
        />

        <div className="flex items-start gap-[var(--st-space-3)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-[var(--st-space-3)] py-[var(--st-space-3)]">
          <Switch
            checked={Boolean(draft.isDefault)}
            aria-label="Set as default pipeline"
            onCheckedChange={(checked) =>
              onChange({ ...draft, isDefault: checked })
            }
          />
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-[var(--st-space-1)] text-[13px] font-medium text-[var(--st-text)]">
              <Star size={14} aria-hidden="true" />
              Set as default pipeline
            </span>
            <span className="text-[12px] text-[var(--st-text-secondary)]">
              New {objectLabel(draft.object).toLowerCase()} land in this pipeline
              unless another is chosen.
            </span>
          </span>
        </div>

        {error ? (
          <Alert tone="danger" icon={AlertTriangle}>
            {error}
          </Alert>
        ) : null}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------

function DeleteDialog({
  pipeline,
  busy,
  open,
  onOpenChange,
  onConfirm,
}: {
  pipeline: Pipeline;
  busy: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete pipeline</AlertDialogTitle>
          <AlertDialogDescription>
            Delete the pipeline{' '}
            <strong className="text-[var(--st-text)]">
              {pipeline.name || 'Untitled pipeline'}
            </strong>
            ? Its stages will be removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            intent="danger"
            disabled={busy}
            onClick={(e) => {
              // Keep the dialog open until the async delete settles.
              e.preventDefault();
              onConfirm();
            }}
          >
            {busy ? 'Deleting...' : 'Delete pipeline'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmPipelinesSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Selection: an id, '' for the in-list unsaved draft, or null when none.
  const [activeId, setActiveId] = React.useState<string | null>(null);
  /** The working copy of the selected pipeline (drives the editor). */
  const [draft, setDraft] = React.useState<Pipeline | null>(null);
  /** The pristine copy of the selected pipeline (drives the dirty diff). */
  const [original, setOriginal] = React.useState<Pipeline | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [editorError, setEditorError] = React.useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = React.useState<Pipeline | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  /** Object slug → its pickable fields, for the governance required-fields gate. */
  const [fieldsByObject, setFieldsByObject] = React.useState<
    Record<string, ObjectFieldOption[]>
  >({});

  // ----- Load -----

  const selectInto = React.useCallback((p: Pipeline) => {
    setActiveId(p.id);
    setDraft(clonePipeline(p));
    setOriginal(clonePipeline(p));
    setEditorError(null);
  }, []);

  // Load the object catalogue once per project so the per-stage governance
  // panel can offer the pipeline object's fields. Best-effort: a failure just
  // leaves the picker empty (governance editing degrades, nothing crashes).
  React.useEffect(() => {
    if (!activeProjectId) {
      setFieldsByObject({});
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await listObjectsTw(activeProjectId);
      if (cancelled || !res.ok) return;
      const map: Record<string, ObjectFieldOption[]> = {};
      for (const obj of res.data) {
        map[obj.slug] = obj.fields.map((f) => ({
          value: f.key,
          label: f.label || f.key,
        }));
      }
      setFieldsByObject(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setLoading(false);
      setPipelines([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await listPipelinesTw(activeProjectId);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setPipelines([]);
      } else {
        setPipelines(res.data);
        // Auto-select the default (or first) pipeline if nothing is selected.
        setActiveId((prev) => {
          if (prev !== null && (prev === '' || res.data.some((p) => p.id === prev))) {
            return prev;
          }
          const first = res.data.find((p) => p.isDefault) ?? res.data[0];
          if (first) {
            setDraft(clonePipeline(first));
            setOriginal(clonePipeline(first));
            return first.id;
          }
          setDraft(null);
          setOriginal(null);
          return null;
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // selectInto is stable; intentionally only re-run on project change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, isLoadingProject]);

  // ----- Selection -----

  const handleSelect = React.useCallback(
    (id: string) => {
      if (id === '') {
        // The unsaved draft is whatever is already in `draft` when id===''.
        setActiveId('');
        return;
      }
      const p = pipelines.find((x) => x.id === id);
      if (p) selectInto(p);
    },
    [pipelines, selectInto],
  );

  const handleNew = React.useCallback(() => {
    const d = newDraft();
    setActiveId('');
    setDraft(d);
    setOriginal(d);
    setEditorError(null);
  }, []);

  // The list shows persisted pipelines, plus the draft row when one is active.
  const listPipelines = React.useMemo<Pipeline[]>(() => {
    if (activeId === '' && draft) return [...pipelines, draft];
    return pipelines;
  }, [pipelines, activeId, draft]);

  const dirtyId = React.useMemo<string | null>(() => {
    if (!draft || !original) return null;
    if (draft.id === '') return ''; // a new draft is always "dirty"
    return pipelineEquals(original, draft) ? null : draft.id;
  }, [draft, original]);

  // ----- Save -----

  const handleSave = React.useCallback(async () => {
    if (!draft || !activeProjectId) return;
    setSaving(true);
    setEditorError(null);

    const input: PipelineInput = {
      name: draft.name.trim(),
      object: draft.object,
      isDefault: Boolean(draft.isDefault),
      // Loss governance - always sent so switching OFF persists too.
      lostReasonRequired: Boolean(draft.lostReasonRequired),
      lostReasons: (draft.lostReasons ?? [])
        .map((r) => r.trim())
        .filter((r) => r.length > 0),
      // Stage governance keys are included only when set; the whole `stages`
      // array is replaced on save, so omission clears a previous value.
      stages: draft.stages.map((s) => ({
        id: s.id,
        label: s.label.trim(),
        color: s.color || DEFAULT_STAGE_COLOR,
        ...(s.requiredFields && s.requiredFields.length > 0
          ? { requiredFields: s.requiredFields }
          : {}),
        ...(s.requiresApproval ? { requiresApproval: true } : {}),
        ...(typeof s.rottingDays === 'number' && s.rottingDays > 0
          ? { rottingDays: Math.floor(s.rottingDays) }
          : {}),
        ...(s.kind ? { kind: s.kind } : {}),
        ...(typeof s.probability === 'number' && s.probability >= 0 && s.probability <= 100
          ? { probability: s.probability }
          : {}),
      })),
    };

    const isUpdate = Boolean(draft.id);
    const res = isUpdate
      ? await updatePipelineTw(draft.id, { ...input }, activeProjectId)
      : await createPipelineTw({ ...input }, activeProjectId);

    setSaving(false);
    if (!res.ok) {
      setEditorError(res.error);
      toast.error(res.error);
      return;
    }

    const saved = res.data as Pipeline;
    // Re-fetch the canonical pipeline so server-assigned ids / default-flag
    // adjustments (only one default) are reflected; fall back to the response.
    const refreshed = await getPipelineTw(saved.id, activeProjectId);
    const canonical: Pipeline = refreshed.ok ? (refreshed.data as Pipeline) : saved;

    setPipelines((prev) => {
      const exists = prev.some((p) => p.id === canonical.id);
      const next = exists
        ? prev.map((p) => (p.id === canonical.id ? canonical : p))
        : [...prev, canonical];
      // Saving a default un-defaults the others in our local copy.
      return canonical.isDefault
        ? next.map((p) =>
            p.id === canonical.id ? p : { ...p, isDefault: false },
          )
        : next;
    });
    selectInto(canonical);
    toast.success(isUpdate ? 'Pipeline saved' : 'Pipeline created');
  }, [draft, activeProjectId, selectInto, toast]);

  // ----- Delete -----

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget || !activeProjectId || !deleteTarget.id) return;
    setDeleting(true);
    setEditorError(null);
    const res = await deletePipelineTw(deleteTarget.id, activeProjectId);
    setDeleting(false);
    if (!res.ok) {
      setEditorError(res.error);
      setDeleteTarget(null);
      toast.error(res.error);
      return;
    }
    setPipelines((prev) => {
      const next = prev.filter((p) => p.id !== deleteTarget.id);
      // Move selection to the new default/first, or clear it.
      const fallback = next.find((p) => p.isDefault) ?? next[0] ?? null;
      if (fallback) {
        setActiveId(fallback.id);
        setDraft(clonePipeline(fallback));
        setOriginal(clonePipeline(fallback));
      } else {
        setActiveId(null);
        setDraft(null);
        setOriginal(null);
      }
      return next;
    });
    setDeleteTarget(null);
    toast.success('Pipeline deleted');
  }, [deleteTarget, activeProjectId, toast]);

  // ----- Render -----

  return (
    <div className="20ui mx-auto w-full max-w-[var(--st-page-max,72rem)] px-[var(--st-space-5)] py-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Pipelines</PageTitle>
          <PageDescription>
            Sales pipelines and their stages. Records move left-to-right through a
            pipeline&apos;s stages; the default pipeline catches new records.
          </PageDescription>
        </PageHeaderHeading>
        {activeProjectId && !error ? (
          <PageActions>
            <Button
              variant="primary"
              iconLeft={Plus}
              onClick={handleNew}
              disabled={loading}
            >
              New
            </Button>
          </PageActions>
        ) : null}
      </PageHeader>

      <div className="mt-[var(--st-space-5)]">
        {isLoadingProject || loading ? (
          <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[18rem_minmax(0,1fr)]">
            <Card variant="outlined" padding="md">
              <div className="flex flex-col gap-[var(--st-space-2)]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} height={40} radius={8} />
                ))}
              </div>
            </Card>
            <Card variant="outlined" padding="md">
              <div className="flex flex-col gap-[var(--st-space-2)]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} height={40} radius={8} />
                ))}
              </div>
            </Card>
          </div>
        ) : !activeProjectId ? (
          <EmptyState
            icon={AlertTriangle}
            tone="warning"
            title="No project selected"
            description="Select a project to manage its sales pipelines."
          />
        ) : error ? (
          <Alert tone="danger" icon={AlertTriangle}>
            {error}
          </Alert>
        ) : pipelines.length === 0 && activeId !== '' ? (
          <EmptyState
            icon={Workflow}
            title="No pipelines yet"
            description="Create your first sales pipeline to organise records into stages."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={handleNew}>
                New pipeline
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[18rem_minmax(0,1fr)]">
            <PipelineList
              pipelines={listPipelines}
              activeId={activeId}
              dirtyId={dirtyId}
              onSelect={handleSelect}
            />

            {draft && original ? (
              <PipelineEditor
                original={original}
                draft={draft}
                fieldOptions={fieldsByObject[draft.object] ?? []}
                saving={saving}
                deleting={deleting}
                error={editorError}
                onChange={setDraft}
                onSave={handleSave}
                onDelete={() => setDeleteTarget(draft)}
              />
            ) : (
              <Card
                variant="ghost"
                padding="lg"
                className="grid min-h-[12rem] place-items-center text-center text-[13px] text-[var(--st-text-secondary)]"
              >
                Select a pipeline to edit its stages, or create a new one.
              </Card>
            )}
          </div>
        )}
      </div>

      {deleteTarget ? (
        <DeleteDialog
          pipeline={deleteTarget}
          busy={deleting}
          open={Boolean(deleteTarget)}
          onOpenChange={(o) => {
            if (!o && !deleting) setDeleteTarget(null);
          }}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
