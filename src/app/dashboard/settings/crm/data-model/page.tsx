'use client';

/**
 * SabCRM Data Model settings (`/dashboard/settings/crm/data-model`).
 *
 * A two-pane layout where the LEFT pane lists every object the active project
 * can see (standard + custom, each with a badge) and the RIGHT pane shows the
 * selected object's fields in a table (key, label, type chip, flags).
 *
 * Mutations go through the gated server actions in
 * `@/app/actions/sabcrm-objects.actions` (session, project, RBAC, plan), which
 * wrap the Rust *objects* engine:
 *   - "New object"  -> createObjectTw
 *   - "Add field"   -> addFieldTw
 *   - remove field  -> removeFieldTw
 *
 * Standard objects keep their identity and built-in fields read-only; only
 * appended custom fields can be removed. The engine is the source of truth for
 * which fields are immutable and rejects anything it does not allow. The UI
 * mirrors those guards so disabled controls never hit a server error, and any
 * rejection still surfaces as an inline banner.
 *
 * The Rust engine may be DOWN; every call returns an `ActionResult`, so the
 * page degrades to loading / empty / error states and never crashes. Pure 20ui:
 * everything renders under the `ui20` scope using the 20ui component library and
 * `--st-*` tokens. Auth / RBAC / project context are enforced by the parent
 * `../../layout.tsx`; the actions independently re-run the full gate.
 */

import * as React from 'react';
import {
  Plus,
  Database,
  Lock,
  Trash2,
  Check,
  ArrowUp,
  ArrowDown,
  Pencil,
  Settings2,
  KeyRound,
  Type,
  Search,
  Users,
  User,
  Building2,
  Briefcase,
  Target,
  CircleDollarSign,
  FileText,
  Mail,
  Phone,
  Calendar,
  CheckSquare,
  Tag as TagIcon,
  Star,
  Flag,
  Folder,
  Box,
  ShoppingCart,
  CreditCard,
  Truck,
  Globe,
  MapPin,
  Heart,
  Bell,
  Rocket,
  Zap,
  X,
  type LucideIcon,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Badge,
  Alert,
  EmptyState,
  Spinner,
  Skeleton,
  Modal,
  Field,
  Input,
  Textarea,
  Checkbox,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageActions,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listObjectsTw,
  createObjectTw,
  addFieldTw,
  removeFieldTw,
  updateObjectTw,
  setObjectIndexesTw,
  deleteObjectTw,
} from '@/app/actions/sabcrm-objects.actions';
import {
  aiFieldConfig,
  type ObjectMetadata,
  type FieldMetadata,
  type FieldType,
  type FieldOption,
  type FieldRelation,
  type AiOutputType,
} from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// SELECT-option colour palette
// ---------------------------------------------------------------------------

/**
 * The fixed option-colour palette. `token` is what we persist (a `--ui20-*`
 * name, kept to stay consistent with the seeded schema) and `swatch` is the
 * literal hex we paint in the picker.
 */
interface PaletteColor {
  name: string;
  token: string;
  swatch: string;
}

const OPTION_PALETTE: ReadonlyArray<PaletteColor> = [
  { name: 'Green', token: 'green', swatch: '#3dab5a' },
  { name: 'Turquoise', token: 'turquoise', swatch: '#21b8a6' },
  { name: 'Sky', token: 'sky', swatch: '#5db4e3' },
  { name: 'Blue', token: 'blue', swatch: '#3b7ae4' },
  { name: 'Purple', token: 'purple', swatch: '#9b51e0' },
  { name: 'Pink', token: 'pink', swatch: '#e052b0' },
  { name: 'Red', token: 'red', swatch: '#e0484e' },
  { name: 'Orange', token: 'orange', swatch: '#f0883e' },
  { name: 'Yellow', token: 'yellow', swatch: '#e0c64a' },
  { name: 'Gray', token: 'gray', swatch: '#8c8c8c' },
];

const DEFAULT_OPTION_COLOR = OPTION_PALETTE[0].token;

/** Resolve a stored option colour (token or hex) to a paintable swatch. */
function swatchFor(color: string | undefined): string {
  if (!color) return OPTION_PALETTE[0].swatch;
  // Legacy values stored as `--ui20-<name>`; strip the prefix before matching.
  const key = color.replace(/^--ui20-/, '');
  const match = OPTION_PALETTE.find((c) => c.token === key);
  if (match) return match.swatch;
  // Already a hex / concrete colour, paint as-is, else fall back.
  return /^#|^rgb|^hsl/.test(color) ? color : OPTION_PALETTE[0].swatch;
}

/**
 * A `LucideIcon`-shaped component that paints a solid colour dot. Lets us pass a
 * runtime colour swatch into 20ui's icon-only controls (which expect a
 * `LucideIcon`) without a raw element. The fill is genuinely runtime-computed.
 */
function swatchIcon(color: string): LucideIcon {
  const Glyph = ({ size = 14 }: { size?: number | string }) => (
    <span
      className="block rounded-full"
      style={{ width: size, height: size, background: color }}
    />
  );
  return Glyph as unknown as LucideIcon;
}

/** Turn a label into a stable SCREAMING_SNAKE option value. */
function optionValue(label: string): string {
  return (
    label
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'OPTION'
  );
}

// ---------------------------------------------------------------------------
// Field-type catalogue
// ---------------------------------------------------------------------------

/** Field types a user can pick when adding a field, with friendly labels. */
const FIELD_TYPE_OPTIONS: ReadonlyArray<{ value: FieldType; label: string }> = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'CURRENCY', label: 'Currency' },
  { value: 'BOOLEAN', label: 'Boolean' },
  { value: 'DATE', label: 'Date' },
  { value: 'DATE_TIME', label: 'Date and time' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'LINK', label: 'Link' },
  { value: 'SELECT', label: 'Select (single)' },
  { value: 'MULTI_SELECT', label: 'Select (multiple)' },
  { value: 'RATING', label: 'Rating' },
  { value: 'FILE', label: 'File' },
  { value: 'FULL_NAME', label: 'Full name' },
  { value: 'ADDRESS', label: 'Address' },
  { value: 'EMAILS', label: 'Emails' },
  { value: 'PHONES', label: 'Phones' },
  { value: 'LINKS', label: 'Links' },
  { value: 'ARRAY', label: 'Array' },
  { value: 'RAW_JSON', label: 'Raw JSON' },
  { value: 'AI', label: 'AI (computed)' },
];

function fieldTypeLabel(type: FieldType): string {
  if (type === 'RELATION') return 'Relation';
  return FIELD_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type;
}

// ---------------------------------------------------------------------------
// Object icon catalogue
// ---------------------------------------------------------------------------

/**
 * Curated grid of lucide icon names a user can assign to an object. The chosen
 * name is persisted as the object's `icon` string. Keys are stored lowercase to
 * match the seeded schema (`database`, `users`, ...); the swatch renders the
 * component.
 */
const OBJECT_ICONS: ReadonlyArray<{ name: string; Icon: LucideIcon }> = [
  { name: 'database', Icon: Database },
  { name: 'users', Icon: Users },
  { name: 'user', Icon: User },
  { name: 'building2', Icon: Building2 },
  { name: 'briefcase', Icon: Briefcase },
  { name: 'target', Icon: Target },
  { name: 'circledollarsign', Icon: CircleDollarSign },
  { name: 'filetext', Icon: FileText },
  { name: 'mail', Icon: Mail },
  { name: 'phone', Icon: Phone },
  { name: 'calendar', Icon: Calendar },
  { name: 'checksquare', Icon: CheckSquare },
  { name: 'tag', Icon: TagIcon },
  { name: 'star', Icon: Star },
  { name: 'flag', Icon: Flag },
  { name: 'folder', Icon: Folder },
  { name: 'box', Icon: Box },
  { name: 'shoppingcart', Icon: ShoppingCart },
  { name: 'creditcard', Icon: CreditCard },
  { name: 'truck', Icon: Truck },
  { name: 'globe', Icon: Globe },
  { name: 'mappin', Icon: MapPin },
  { name: 'heart', Icon: Heart },
  { name: 'bell', Icon: Bell },
  { name: 'rocket', Icon: Rocket },
  { name: 'zap', Icon: Zap },
];

/** Resolve a stored icon name (case-insensitive) to a lucide component. */
function iconComponentFor(name: string | undefined): LucideIcon {
  if (!name) return Database;
  const key = name.trim().toLowerCase();
  return OBJECT_ICONS.find((i) => i.name === key)?.Icon ?? Database;
}

/** Common ISO-4217 currency codes offered in the CURRENCY default editor. */
const CURRENCY_CODES: ReadonlyArray<string> = [
  'USD',
  'EUR',
  'GBP',
  'INR',
  'JPY',
  'CNY',
  'AUD',
  'CAD',
  'CHF',
  'SGD',
  'AED',
  'BRL',
];

/** Slugify a label into a kebab-case object slug suggestion. */
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** camelCase-ify a label into a field-key suggestion. */
function camelKey(input: string): string {
  const cleaned = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/);
  return (
    parts[0] +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('')
  );
}

// ---------------------------------------------------------------------------
// Depth object/field settings (label identifier, searchable, system, indexes,
// field uniqueness)
//
// The shared `ObjectMetadata` / `FieldMetadata` types in `@/lib/sabcrm/types`
// don't yet declare these object-level flags, but the engine + the
// `updateObjectTw(slug, patch)` action carry them (added in parallel). Rather
// than touch the shared types from this page, we read/write them through small
// local extension shapes. The patch input (`SabcrmObjectUpdateInput`) is an
// open `Record<string, unknown>`, so the writes type-check; the reads narrow
// off a cast. Index shape: { name, fields: string[], isUnique }.
// ---------------------------------------------------------------------------

/** One metadata index over an object's fields. */
interface ObjectIndex {
  /** Index name, unique per object; auto-derived from its fields. */
  name: string;
  /** Field keys participating in the index, in order. */
  fields: string[];
  /** UNIQUE constraint. A single-field unique index drives `field.isUnique`. */
  isUnique?: boolean;
}

/** Object-level depth flags layered over `ObjectMetadata`. */
interface ObjectTwExtras {
  isSystem?: boolean;
  isSearchable?: boolean;
  /** Field key that acts as the record's display title. */
  labelIdentifier?: string;
  indexes?: ObjectIndex[];
}

/** Field-level depth flags layered over `FieldMetadata`. */
interface FieldTwExtras {
  isUnique?: boolean;
  /** Type-discriminated per-field settings blob (AI fields use `settings.ai`). */
  settings?: Record<string, unknown>;
}

/** Narrow an object to its depth extras (safe, read-only view). */
function objectExtras(object: ObjectMetadata): ObjectTwExtras {
  return object as ObjectMetadata & ObjectTwExtras;
}

/** Read the index list off an object, normalised to a clean array. */
function objectIndexes(object: ObjectMetadata): ObjectIndex[] {
  const raw = objectExtras(object).indexes;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((ix) => {
      // The engine round-trips `unique`; older/local data may carry `isUnique`.
      const rec = (ix ?? {}) as Partial<ObjectIndex> & { unique?: boolean };
      const fields = Array.isArray(rec.fields)
        ? rec.fields.map((f) => String(f)).filter(Boolean)
        : [];
      return {
        name: typeof rec.name === 'string' ? rec.name : indexNameFor(fields),
        fields,
        isUnique: rec.unique === true || rec.isUnique === true,
      };
    })
    .filter((ix) => ix.fields.length > 0);
}

/** Read whether a field carries a UNIQUE constraint. */
function fieldIsUnique(field: FieldMetadata): boolean {
  return (field as FieldMetadata & FieldTwExtras).isUnique === true;
}

/**
 * Resolve the object's current label-identifier field key (which field is the
 * record title). Prefers the explicit `labelIdentifier` extra, falls back to
 * the field flagged `isLabel`, then to the first field.
 */
function objectLabelIdentifier(object: ObjectMetadata): string {
  const explicit = objectExtras(object).labelIdentifier;
  if (explicit && object.fields.some((f) => f.key === explicit)) return explicit;
  const labelled = object.fields.find((f) => f.isLabel);
  if (labelled) return labelled.key;
  return object.fields[0]?.key ?? '';
}

/**
 * Field types eligible to be the record's label identifier (text-ish title).
 * The display title must be a plain scalar text-like field.
 */
const LABEL_IDENTIFIER_TYPES: ReadonlySet<FieldType> = new Set([
  'TEXT',
  'EMAIL',
  'PHONE',
  'LINK',
  'FULL_NAME',
]);

/** Derive a stable index name from its participating field keys. */
function indexNameFor(fields: string[]): string {
  const stem = fields.filter(Boolean).join('_').replace(/[^A-Za-z0-9_]+/g, '_');
  return stem ? `IDX_${stem.toUpperCase()}` : 'IDX';
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return <Alert tone="danger">{message}</Alert>;
}

function ObjectBadge({ standard }: { standard: boolean }) {
  return standard ? (
    <Badge tone="neutral">Standard</Badge>
  ) : (
    <Badge tone="accent">Custom</Badge>
  );
}

// ---------------------------------------------------------------------------
// SELECT option editor (rows with colour-swatch picker, add/remove/reorder)
// ---------------------------------------------------------------------------

/** A colour-swatch popover over the fixed option palette. */
function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (token: string) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton
          label="Pick option colour"
          icon={swatchIcon(swatchFor(value))}
          variant="outline"
          size="sm"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div
          className="grid grid-cols-5 gap-1"
          role="listbox"
          aria-label="Colours"
        >
          {OPTION_PALETTE.map((c) => (
            <IconButton
              key={c.token}
              label={c.name}
              icon={swatchIcon(c.swatch)}
              variant={c.token === value ? 'primary' : 'ghost'}
              size="md"
              role="option"
              aria-selected={c.token === value}
              onClick={() => {
                onChange(c.token);
                setOpen(false);
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Editable list of SELECT / MULTI_SELECT option rows. */
function OptionRowsEditor({
  options,
  onChange,
}: {
  options: FieldOption[];
  onChange: (next: FieldOption[]) => void;
}) {
  const update = (idx: number, patch: Partial<FieldOption>) => {
    onChange(options.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...options];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(options.filter((_, i) => i !== idx));
  };

  const add = () => {
    onChange([
      ...options,
      { value: '', label: '', color: DEFAULT_OPTION_COLOR },
    ]);
  };

  return (
    <Field label="Options">
      <div className="flex flex-col gap-2">
        {options.length === 0 ? (
          <p className="text-[13px] text-[var(--st-text-secondary)]">
            No options yet. Add one below.
          </p>
        ) : (
          options.map((opt, idx) => (
            <div className="flex items-center gap-2" key={idx}>
              <ColorPicker
                value={opt.color ?? DEFAULT_OPTION_COLOR}
                onChange={(token) => update(idx, { color: token })}
              />
              <Input
                inputSize="sm"
                className="flex-1"
                value={opt.label}
                placeholder="Label"
                autoComplete="off"
                aria-label="Option label"
                onChange={(e) => {
                  const label = e.target.value;
                  // Auto-derive value while it still mirrors the label.
                  const derived =
                    !opt.value || opt.value === optionValue(opt.label);
                  update(idx, {
                    label,
                    ...(derived ? { value: optionValue(label) } : null),
                  });
                }}
              />
              <Input
                inputSize="sm"
                className="w-[120px]"
                value={opt.value}
                placeholder="VALUE"
                autoComplete="off"
                aria-label="Option value"
                onChange={(e) =>
                  update(idx, {
                    value: e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9_]+/g, '_'),
                  })
                }
              />
              <div className="flex items-center gap-0.5">
                <IconButton
                  label="Move up"
                  icon={ArrowUp}
                  variant="ghost"
                  size="sm"
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                />
                <IconButton
                  label="Move down"
                  icon={ArrowDown}
                  variant="ghost"
                  size="sm"
                  disabled={idx === options.length - 1}
                  onClick={() => move(idx, 1)}
                />
              </div>
              <IconButton
                label={`Remove option ${opt.label || idx + 1}`}
                icon={Trash2}
                variant="danger"
                size="sm"
                onClick={() => remove(idx)}
              />
            </div>
          ))
        )}
        <div>
          <Button variant="ghost" size="sm" iconLeft={Plus} onClick={add}>
            Add option
          </Button>
        </div>
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// RELATION target editor
// ---------------------------------------------------------------------------

function RelationEditor({
  objects,
  selfSlug,
  relation,
  onChange,
}: {
  objects: ObjectMetadata[];
  selfSlug: string;
  relation: FieldRelation;
  onChange: (next: FieldRelation) => void;
}) {
  const targets = React.useMemo(
    () => objects.filter((o) => o.slug !== selfSlug),
    [objects, selfSlug],
  );

  const targetObj = React.useMemo(
    () => objects.find((o) => o.slug === relation.targetObject) ?? null,
    [objects, relation.targetObject],
  );

  return (
    <div className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
      <Field label="Target object" required>
        <Select
          value={relation.targetObject}
          onValueChange={(slug) => {
            const obj = objects.find((o) => o.slug === slug);
            const labelField =
              obj?.fields.find((f) => f.isLabel)?.key ??
              obj?.fields[0]?.key ??
              '';
            onChange({ ...relation, targetObject: slug, labelField });
          }}
        >
          <SelectTrigger aria-label="Target object">
            <SelectValue placeholder="Select an object" />
          </SelectTrigger>
          <SelectContent>
            {targets.map((o) => (
              <SelectItem key={o.slug} value={o.slug}>
                {o.labelPlural}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Relationship">
        <Select
          value={relation.kind}
          onValueChange={(kind) =>
            onChange({ ...relation, kind: kind as FieldRelation['kind'] })
          }
        >
          <SelectTrigger aria-label="Relationship">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MANY_TO_ONE">
              Many {selfSlug || 'records'} to one target
            </SelectItem>
            <SelectItem value="ONE_TO_MANY">
              One {selfSlug || 'record'} to many targets
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Label field">
        <Select
          value={relation.labelField ?? ''}
          disabled={!targetObj}
          onValueChange={(labelField) => onChange({ ...relation, labelField })}
        >
          <SelectTrigger aria-label="Label field">
            <SelectValue
              placeholder={
                targetObj ? 'Select a field' : 'Pick a target object first'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {(targetObj?.fields ?? []).map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composite / multi-value default-value editors
//
// These edit a field's `defaultValue` for the composite & multi-value field
// types. CURRENCY -> { amount, currencyCode }, FULL_NAME -> { firstName,
// lastName }, ADDRESS -> { street, city, state, postcode, country },
// EMAILS/PHONES/ARRAY -> string[], LINKS -> { label, url }[], RATING -> number,
// RAW_JSON -> object.
// ---------------------------------------------------------------------------

/** Coerce an unknown default into a record (composite editors). */
function recordDefault(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Coerce an unknown default into a string[] (multi-value editors). */
function stringArrayDefault(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

/** CURRENCY default editor: amount input + currency-code select. */
function CurrencyDefaultEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: { amount: number; currencyCode: string }) => void;
}) {
  const rec = recordDefault(value);
  const amount =
    typeof rec.amount === 'number' ? rec.amount : Number(rec.amount) || 0;
  const code = typeof rec.currencyCode === 'string' ? rec.currencyCode : 'USD';
  return (
    <Field label="Default amount">
      <div className="flex items-start gap-2">
        <Input
          className="flex-1"
          type="number"
          step="0.01"
          aria-label="Default amount"
          value={Number.isFinite(amount) ? amount : 0}
          onChange={(e) =>
            onChange({ amount: Number(e.target.value) || 0, currencyCode: code })
          }
        />
        <div className="w-[110px] shrink-0">
          <Select
            value={code}
            onValueChange={(currencyCode) => onChange({ amount, currencyCode })}
          >
            <SelectTrigger aria-label="Currency code">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_CODES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Field>
  );
}

/** FULL_NAME default editor: first + last inputs. */
function FullNameDefaultEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: { firstName: string; lastName: string }) => void;
}) {
  const rec = recordDefault(value);
  const firstName = typeof rec.firstName === 'string' ? rec.firstName : '';
  const lastName = typeof rec.lastName === 'string' ? rec.lastName : '';
  return (
    <Field label="Default name">
      <div className="flex gap-2">
        <Input
          placeholder="First"
          autoComplete="off"
          aria-label="Default first name"
          value={firstName}
          onChange={(e) => onChange({ firstName: e.target.value, lastName })}
        />
        <Input
          placeholder="Last"
          autoComplete="off"
          aria-label="Default last name"
          value={lastName}
          onChange={(e) => onChange({ firstName, lastName: e.target.value })}
        />
      </div>
    </Field>
  );
}

const ADDRESS_FIELDS: ReadonlyArray<{ key: string; label: string; full?: boolean }> = [
  { key: 'street', label: 'Street', full: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'country', label: 'Country' },
];

/** ADDRESS default editor: street / city / state / postcode / country. */
function AddressDefaultEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: Record<string, string>) => void;
}) {
  const rec = recordDefault(value);
  const get = (k: string) => (typeof rec[k] === 'string' ? (rec[k] as string) : '');
  const set = (k: string, v: string) => {
    const next: Record<string, string> = {};
    for (const f of ADDRESS_FIELDS) next[f.key] = get(f.key);
    next[k] = v;
    onChange(next);
  };
  return (
    <Field label="Default address">
      <div className="grid grid-cols-2 gap-2">
        {ADDRESS_FIELDS.map((f) => (
          <div key={f.key} className={f.full ? 'col-span-2' : undefined}>
            <Field label={f.label}>
              <Input
                autoComplete="off"
                value={get(f.key)}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </Field>
          </div>
        ))}
      </div>
    </Field>
  );
}

/** Add/remove list editor for EMAILS / PHONES / ARRAY string lists. */
function StringListEditor({
  label,
  placeholder,
  inputType,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  inputType?: string;
  value: unknown;
  onChange: (next: string[]) => void;
}) {
  const items = stringArrayDefault(value);
  const update = (idx: number, next: string) =>
    onChange(items.map((v, i) => (i === idx ? next : v)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, '']);
  return (
    <Field label={label}>
      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-[13px] text-[var(--st-text-secondary)]">None yet.</p>
        ) : (
          items.map((item, idx) => (
            <div className="flex items-center gap-2" key={idx}>
              <Input
                className="flex-1"
                type={inputType ?? 'text'}
                placeholder={placeholder}
                autoComplete="off"
                aria-label={`${label} ${idx + 1}`}
                value={item}
                onChange={(e) => update(idx, e.target.value)}
              />
              <IconButton
                label={`Remove ${label} ${idx + 1}`}
                icon={X}
                variant="danger"
                size="sm"
                onClick={() => remove(idx)}
              />
            </div>
          ))
        )}
        <div>
          <Button variant="ghost" size="sm" iconLeft={Plus} onClick={add}>
            Add
          </Button>
        </div>
      </div>
    </Field>
  );
}

interface LinkItem {
  label: string;
  url: string;
}

/** Add/remove editor for LINKS: label + url rows. */
function LinksEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: LinkItem[]) => void;
}) {
  const items: LinkItem[] = Array.isArray(value)
    ? value.map((v) => {
        const rec =
          v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
        return {
          label: typeof rec.label === 'string' ? rec.label : '',
          url: typeof rec.url === 'string' ? rec.url : '',
        };
      })
    : [];
  const update = (idx: number, patch: Partial<LinkItem>) =>
    onChange(items.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, { label: '', url: '' }]);
  return (
    <Field label="Default links">
      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-[13px] text-[var(--st-text-secondary)]">None yet.</p>
        ) : (
          items.map((item, idx) => (
            <div className="flex items-center gap-2" key={idx}>
              <Input
                className="flex-1"
                placeholder="Label"
                autoComplete="off"
                aria-label={`Link ${idx + 1} label`}
                value={item.label}
                onChange={(e) => update(idx, { label: e.target.value })}
              />
              <Input
                className="flex-1"
                placeholder="https://example.com"
                autoComplete="off"
                aria-label={`Link ${idx + 1} URL`}
                value={item.url}
                onChange={(e) => update(idx, { url: e.target.value })}
              />
              <IconButton
                label={`Remove link ${idx + 1}`}
                icon={X}
                variant="danger"
                size="sm"
                onClick={() => remove(idx)}
              />
            </div>
          ))
        )}
        <div>
          <Button variant="ghost" size="sm" iconLeft={Plus} onClick={add}>
            Add link
          </Button>
        </div>
      </div>
    </Field>
  );
}

/** MULTI_SELECT default editor: checkbox column over the field options. */
function MultiSelectDefaultEditor({
  options,
  value,
  onChange,
}: {
  options: FieldOption[];
  value: unknown;
  onChange: (next: string[]) => void;
}) {
  const selected = new Set(stringArrayDefault(value));
  const toggle = (optValue: string) => {
    const next = new Set(selected);
    if (next.has(optValue)) next.delete(optValue);
    else next.add(optValue);
    onChange(Array.from(next));
  };
  return (
    <Field label="Default selection">
      <div className="flex flex-col gap-1.5">
        {options.length === 0 ? (
          <p className="text-[13px] text-[var(--st-text-secondary)]">
            Add options above first.
          </p>
        ) : (
          options.map((opt) => (
            <Checkbox
              key={opt.value || opt.label}
              checked={selected.has(opt.value)}
              onChange={() => toggle(opt.value)}
              label={
                <span className="inline-flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: swatchFor(opt.color) }}
                    aria-hidden="true"
                  />
                  {opt.label || opt.value}
                </span>
              }
            />
          ))
        )}
      </div>
    </Field>
  );
}

/** RATING default editor: click a star (0-5) to set the default. */
function RatingDefaultEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: number) => void;
}) {
  const current = typeof value === 'number' ? value : Number(value) || 0;
  const clamped = Math.max(0, Math.min(5, Math.round(current)));
  return (
    <Field label="Default rating">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <IconButton
              key={i}
              label={`Set rating to ${i + 1}`}
              icon={Star}
              variant="ghost"
              size="sm"
              className={
                i < clamped
                  ? 'text-[var(--st-warn)] [&_svg]:fill-current'
                  : 'text-[var(--st-text-tertiary)]'
              }
              onClick={() => onChange(i + 1)}
            />
          ))}
        </span>
        {clamped > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(0)}>
            Clear
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

/** RAW_JSON default editor: JSON textarea with live validation. */
function RawJsonDefaultEditor({
  value,
  onChange,
  onValidityChange,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  onValidityChange: (valid: boolean) => void;
}) {
  const initial = React.useMemo(() => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }, [value]);
  const [text, setText] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);

  const onEdit = (raw: string) => {
    setText(raw);
    if (raw.trim() === '') {
      setError(null);
      onValidityChange(true);
      onChange(undefined);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setError(null);
      onValidityChange(true);
      onChange(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
      onValidityChange(false);
    }
  };

  return (
    <Field label="Default JSON" error={error ?? undefined}>
      <Textarea
        className="font-mono text-[12px]"
        spellCheck={false}
        rows={4}
        placeholder='{ "key": "value" }'
        invalid={Boolean(error)}
        value={text}
        onChange={(e) => onEdit(e.target.value)}
      />
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Left pane: object list
// ---------------------------------------------------------------------------

interface ObjectListProps {
  custom: ObjectMetadata[];
  standard: ObjectMetadata[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

function ObjectListItem({
  object,
  active,
  onSelect,
}: {
  object: ObjectMetadata;
  active: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      block
      aria-current={active ? 'true' : undefined}
      onClick={() => onSelect(object.slug)}
      className={[
        'justify-start gap-2.5 px-2.5 py-2 [&_.u-btn__label]:flex [&_.u-btn__label]:min-w-0 [&_.u-btn__label]:flex-1 [&_.u-btn__label]:items-center [&_.u-btn__label]:gap-2.5',
        active ? 'bg-[var(--st-accent-soft)]' : '',
      ].join(' ')}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
        aria-hidden="true"
      >
        <Database size={15} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-[13px] font-medium">
          {object.labelPlural}
        </span>
        <span className="truncate text-[11px] text-[var(--st-text-tertiary)]">
          {object.slug}
        </span>
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-[var(--st-text-tertiary)]">
        {object.fields.length}
      </span>
    </Button>
  );
}

function ObjectList({ custom, standard, activeSlug, onSelect }: ObjectListProps) {
  return (
    <nav
      className="flex flex-col gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2"
      aria-label="Objects"
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
          Custom
        </h2>
        {custom.length === 0 ? (
          <p className="px-2.5 py-1 text-[12px] text-[var(--st-text-secondary)]">
            No custom objects yet.
          </p>
        ) : (
          custom.map((o) => (
            <ObjectListItem
              key={o.slug}
              object={o}
              active={o.slug === activeSlug}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <h2 className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
          Standard
        </h2>
        {standard.length === 0 ? (
          <p className="px-2.5 py-1 text-[12px] text-[var(--st-text-secondary)]">
            No standard objects.
          </p>
        ) : (
          standard.map((o) => (
            <ObjectListItem
              key={o.slug}
              object={o}
              active={o.slug === activeSlug}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Right pane: object settings card
// ---------------------------------------------------------------------------

/** The default view stored on an object (first entry of `views`). */
type DefaultView = 'table' | 'board';

function objectDefaultView(object: ObjectMetadata): DefaultView {
  return object.views?.[0] === 'board' ? 'board' : 'table';
}

// ---------------------------------------------------------------------------
// Indexes editor
//
// A per-object "Indexes" subsection. Lists existing indexes (name,
// participating fields, UNIQUE chip) with remove, plus an "add index" composer
// where the admin multi-selects one or more fields, flips a unique checkbox,
// and the name auto-derives from the chosen fields. Persists the whole list
// through `setObjectIndexesTw(slug, indexes)`. Self-contained: it owns its own
// save/error/busy state so the parent settings form stays untouched.
// ---------------------------------------------------------------------------

interface IndexesEditorProps {
  object: ObjectMetadata;
  projectId: string | null;
  onSaved: (object: ObjectMetadata) => void;
}

function IndexesEditor({ object, projectId, onSaved }: IndexesEditorProps) {
  const indexes = React.useMemo(() => objectIndexes(object), [object]);

  // The "add index" composer (collapsed until "Add index" is pressed).
  const [adding, setAdding] = React.useState(false);
  const [draftFields, setDraftFields] = React.useState<string[]>([]);
  const [draftUnique, setDraftUnique] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset the composer whenever the selected object changes.
  React.useEffect(() => {
    setAdding(false);
    setDraftFields([]);
    setDraftUnique(false);
    setError(null);
    setBusy(false);
  }, [object.slug]);

  const draftName = indexNameFor(draftFields);
  const nameTaken = indexes.some(
    (ix) => ix.name.toUpperCase() === draftName.toUpperCase(),
  );
  const canAdd = draftFields.length > 0 && !nameTaken && !busy;

  const toggleDraftField = (key: string) => {
    setDraftFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const persist = async (next: ObjectIndex[]) => {
    setBusy(true);
    setError(null);
    // The dedicated indexes endpoint persists the defs AND best-effort
    // reconciles real `sabcrm_records` indexes. The engine's IndexMetadata uses
    // `unique` (not `isUnique`), so map the local read-shape onto the contract.
    const payload = next.map((ix) => ({
      name: ix.name,
      fields: ix.fields,
      unique: ix.isUnique === true,
    }));
    const res = await setObjectIndexesTw(
      object.slug,
      payload,
      projectId ?? undefined,
    );
    setBusy(false);
    if (res.ok) {
      onSaved(res.data);
      return true;
    }
    setError(res.error);
    return false;
  };

  const handleAdd = async () => {
    if (!canAdd) return;
    const next: ObjectIndex[] = [
      ...indexes,
      { name: draftName, fields: draftFields, isUnique: draftUnique },
    ];
    const ok = await persist(next);
    if (ok) {
      setAdding(false);
      setDraftFields([]);
      setDraftUnique(false);
    }
  };

  const handleRemove = async (name: string) => {
    const next = indexes.filter((ix) => ix.name !== name);
    await persist(next);
  };

  /** Human label for a field key (falls back to the raw key). */
  const labelFor = (key: string) =>
    object.fields.find((f) => f.key === key)?.label ?? key;

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--st-border)] pt-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--st-text)]">
          <KeyRound size={13} aria-hidden="true" />
          Indexes
        </span>
        {!adding ? (
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Plus}
            onClick={() => {
              setAdding(true);
              setError(null);
            }}
            disabled={busy}
          >
            Add index
          </Button>
        ) : null}
      </div>

      {indexes.length === 0 && !adding ? (
        <p className="text-[12px] text-[var(--st-text-secondary)]">
          No indexes yet. Add one to speed up filters or enforce uniqueness.
        </p>
      ) : null}

      {indexes.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {indexes.map((ix) => (
            <li
              className="flex items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
              key={ix.name}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-mono text-[12px] text-[var(--st-text)]">
                  {ix.name}
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {ix.fields.map((key) => (
                    <Badge key={key} tone="neutral">
                      {labelFor(key)}
                    </Badge>
                  ))}
                  {ix.isUnique ? <Badge tone="accent">Unique</Badge> : null}
                </span>
              </div>
              <IconButton
                label={`Remove index ${ix.name}`}
                icon={Trash2}
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => handleRemove(ix.name)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <div className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
          <Field label="Fields">
            {object.fields.length === 0 ? (
              <p className="text-[12px] text-[var(--st-text-secondary)]">
                This object has no fields yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {object.fields.map((f) => (
                  <Checkbox
                    key={f.key}
                    checked={draftFields.includes(f.key)}
                    onChange={() => toggleDraftField(f.key)}
                    label={
                      <span className="inline-flex items-baseline gap-1.5">
                        <span className="text-[13px]">{f.label}</span>
                        <span className="font-mono text-[11px] text-[var(--st-text-tertiary)]">
                          {f.key}
                        </span>
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </Field>

          <div className="flex items-end gap-4">
            <Field
              label="Name"
              className="flex-1"
              error={
                nameTaken
                  ? 'An index over these fields already exists.'
                  : undefined
              }
            >
              <Input
                value={draftName}
                readOnly
                invalid={nameTaken}
                aria-label="Index name (auto-derived)"
              />
            </Field>
            <div className="pb-2">
              <Checkbox
                checked={draftUnique}
                onChange={(e) => setDraftUnique(e.target.checked)}
                label="Unique"
              />
            </div>
          </div>

          {error ? <ErrorBanner message={error} /> : null}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setAdding(false);
                setDraftFields([]);
                setDraftUnique(false);
                setError(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={handleAdd}
              disabled={!canAdd}
            >
              Add index
            </Button>
          </div>
        </div>
      ) : null}

      {error && !adding ? <ErrorBanner message={error} /> : null}
    </div>
  );
}

interface ObjectSettingsCardProps {
  object: ObjectMetadata;
  projectId: string | null;
  onSaved: (object: ObjectMetadata) => void;
}

function ObjectSettingsCard({
  object,
  projectId,
  onSaved,
}: ObjectSettingsCardProps) {
  const [labelSingular, setLabelSingular] = React.useState(object.labelSingular);
  const [labelPlural, setLabelPlural] = React.useState(object.labelPlural);
  const [description, setDescription] = React.useState(object.description ?? '');
  const [icon, setIcon] = React.useState(object.icon || 'database');
  const [defaultView, setDefaultView] = React.useState<DefaultView>(
    objectDefaultView(object),
  );
  const [labelIdentifier, setLabelIdentifier] = React.useState(
    objectLabelIdentifier(object),
  );
  const [isSearchable, setIsSearchable] = React.useState(
    objectExtras(object).isSearchable === true,
  );
  const [iconOpen, setIconOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedTick, setSavedTick] = React.useState(false);

  const isSystem = objectExtras(object).isSystem === true;

  /** Text-ish fields eligible to be the record's label identifier (title). */
  const labelCandidates = React.useMemo(
    () => object.fields.filter((f) => LABEL_IDENTIFIER_TYPES.has(f.type)),
    [object.fields],
  );

  // Re-seed the form whenever the selected object changes.
  React.useEffect(() => {
    setLabelSingular(object.labelSingular);
    setLabelPlural(object.labelPlural);
    setDescription(object.description ?? '');
    setIcon(object.icon || 'database');
    setDefaultView(objectDefaultView(object));
    setLabelIdentifier(objectLabelIdentifier(object));
    setIsSearchable(objectExtras(object).isSearchable === true);
    setIconOpen(false);
    setError(null);
    setSavedTick(false);
  }, [object]);

  const dirty =
    labelSingular.trim() !== object.labelSingular ||
    labelPlural.trim() !== object.labelPlural ||
    description.trim() !== (object.description ?? '').trim() ||
    icon !== (object.icon || 'database') ||
    defaultView !== objectDefaultView(object) ||
    labelIdentifier !== objectLabelIdentifier(object) ||
    isSearchable !== (objectExtras(object).isSearchable === true);

  const canSave =
    labelSingular.trim().length > 0 &&
    labelPlural.trim().length > 0 &&
    dirty &&
    !saving;

  const ActiveIcon = iconComponentFor(icon);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSavedTick(false);

    // `defaultView` orders the `views` array (table is always implied first /
    // board moves to the front when selected). We also send `defaultView`
    // explicitly. The engine accepts it and persists standard overrides as an
    // extendsStandard doc.
    const views: Array<'table' | 'board'> =
      defaultView === 'board' ? ['board', 'table'] : ['table'];

    const res = await updateObjectTw(
      object.slug,
      {
        labelSingular: labelSingular.trim(),
        labelPlural: labelPlural.trim(),
        icon,
        description: description.trim(),
        defaultView,
        views,
        labelIdentifier,
        isSearchable,
      },
      projectId ?? undefined,
    );

    setSaving(false);
    if (res.ok) {
      onSaved(res.data);
      setSavedTick(true);
    } else {
      setError(res.error);
    }
  };

  const handleReset = () => {
    setLabelSingular(object.labelSingular);
    setLabelPlural(object.labelPlural);
    setDescription(object.description ?? '');
    setIcon(object.icon || 'database');
    setDefaultView(objectDefaultView(object));
    setLabelIdentifier(objectLabelIdentifier(object));
    setIsSearchable(objectExtras(object).isSearchable === true);
    setError(null);
    setSavedTick(false);
  };

  return (
    <form
      className="flex flex-col gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--st-text)]">
          <Settings2 size={15} aria-hidden="true" />
          Object settings
        </h3>
        <div className="flex items-center gap-1.5">
          {isSystem ? (
            <Badge tone="warning" title="System object, managed by the engine">
              <Lock size={11} aria-hidden="true" />
              System
            </Badge>
          ) : null}
          <ObjectBadge standard={object.standard === true} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Singular label" required>
          <Input
            value={labelSingular}
            onChange={(e) => setLabelSingular(e.target.value)}
            placeholder="Ticket"
            autoComplete="off"
          />
        </Field>

        <Field label="Plural label" required>
          <Input
            value={labelPlural}
            onChange={(e) => setLabelPlural(e.target.value)}
            placeholder="Tickets"
            autoComplete="off"
          />
        </Field>

        <div className="col-span-2">
          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this object represents"
              spellCheck
              rows={2}
            />
          </Field>
        </div>

        <div className="col-span-2">
          <Field label="Icon">
            <Popover open={iconOpen} onOpenChange={setIconOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" iconLeft={ActiveIcon}>
                  {icon}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-2">
                <div
                  className="grid grid-cols-7 gap-1"
                  role="listbox"
                  aria-label="Object icons"
                >
                  {OBJECT_ICONS.map(({ name, Icon }) => (
                    <IconButton
                      key={name}
                      label={name}
                      icon={Icon}
                      variant={name === icon ? 'primary' : 'ghost'}
                      size="md"
                      role="option"
                      aria-selected={name === icon}
                      onClick={() => {
                        setIcon(name);
                        setIconOpen(false);
                      }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </Field>
        </div>

        <Field label="Default view">
          <Select
            value={defaultView}
            onValueChange={(v) => setDefaultView(v as DefaultView)}
          >
            <SelectTrigger aria-label="Default view">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="table">Table</SelectItem>
              <SelectItem value="board">Board (Kanban)</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={
            <span className="inline-flex items-center gap-1.5">
              <Type size={12} aria-hidden="true" /> Record label
            </span>
          }
          help="Which field is shown as each record's title."
        >
          <Select
            value={labelIdentifier}
            onValueChange={setLabelIdentifier}
            disabled={labelCandidates.length === 0}
          >
            <SelectTrigger aria-label="Label identifier field">
              <SelectValue
                placeholder={
                  labelCandidates.length === 0
                    ? 'No text fields available'
                    : 'Select a field'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {labelCandidates.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="col-span-2">
          <Checkbox
            checked={isSearchable}
            onChange={(e) => setIsSearchable(e.target.checked)}
            label={
              <span className="inline-flex items-center gap-1.5">
                <Search size={13} aria-hidden="true" />
                Searchable
                <span className="text-[12px] text-[var(--st-text-secondary)]">
                  Index this object into global search.
                </span>
              </span>
            }
          />
        </div>
      </div>

      <IndexesEditor object={object} projectId={projectId} onSaved={onSaved} />

      {error ? <ErrorBanner message={error} /> : null}

      <div className="flex items-center justify-end gap-2">
        {savedTick && !dirty ? (
          <span className="mr-auto inline-flex items-center gap-1 text-[13px] text-[var(--st-status-ok)]">
            <Check size={13} aria-hidden="true" />
            Saved
          </span>
        ) : null}
        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={!dirty || saving}
        >
          Reset
        </Button>
        <Button type="submit" variant="primary" loading={saving} disabled={!canSave}>
          Save settings
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Right pane: field table
// ---------------------------------------------------------------------------

interface ObjectDetailProps {
  object: ObjectMetadata;
  projectId: string | null;
  /** Keys that are immutable (standard-object built-ins + system fields). */
  lockedKeys: ReadonlySet<string>;
  busyKey: string | null;
  onAddField: () => void;
  onEditField: (fieldKey: string) => void;
  onRemoveField: (fieldKey: string) => void;
  onSettingsSaved: (object: ObjectMetadata) => void;
  /** Open the delete-object confirmation (custom objects only). */
  onDeleteObject: () => void;
}

function ObjectDetail({
  object,
  projectId,
  lockedKeys,
  busyKey,
  onAddField,
  onEditField,
  onRemoveField,
  onSettingsSaved,
  onDeleteObject,
}: ObjectDetailProps) {
  const TitleIcon = iconComponentFor(object.icon);
  return (
    <section
      className="flex flex-col gap-4"
      aria-label={`${object.labelPlural} fields`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-[18px] font-semibold text-[var(--st-text)]">
            <TitleIcon size={18} aria-hidden="true" />
            {object.labelPlural}
            <ObjectBadge standard={object.standard === true} />
          </h2>
          <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
            <code className="font-mono text-[12px]">{object.slug}</code>{' '}
            {String.fromCharCode(183)} {object.fields.length}{' '}
            {object.fields.length === 1 ? 'field' : 'fields'}
            {object.description
              ? ` ${String.fromCharCode(183)} ${object.description}`
              : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {object.standard !== true ? (
            <Button
              variant="secondary"
              iconLeft={Trash2}
              onClick={onDeleteObject}
            >
              Delete object
            </Button>
          ) : null}
          <Button variant="primary" iconLeft={Plus} onClick={onAddField}>
            Add field
          </Button>
        </div>
      </div>

      <ObjectSettingsCard
        key={object.slug}
        object={object}
        projectId={projectId}
        onSaved={onSettingsSaved}
      />

      <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
        <Table>
          <THead>
            <Tr>
              <Th>Field</Th>
              <Th>Key</Th>
              <Th>Type</Th>
              <Th align="right">Flags</Th>
            </Tr>
          </THead>
          <TBody>
            {object.fields.map((field) => {
              const locked = field.system === true || lockedKeys.has(field.key);
              const busy = busyKey === field.key;
              return (
                <Tr key={field.key}>
                  <Td>{field.label}</Td>
                  <Td>
                    <span className="font-mono text-[12px] text-[var(--st-text-secondary)]">
                      {field.key}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone="neutral">{fieldTypeLabel(field.type)}</Badge>
                  </Td>
                  <Td align="right">
                    <span className="inline-flex items-center justify-end gap-1">
                      {field.isLabel ? <Badge tone="accent">Title</Badge> : null}
                      {field.required ? (
                        <Badge tone="neutral">Required</Badge>
                      ) : null}
                      {fieldIsUnique(field) ? (
                        <Badge tone="neutral">Unique</Badge>
                      ) : null}
                      {field.inTable ? (
                        <Badge tone="neutral">In table</Badge>
                      ) : null}
                      {field.type === 'RELATION' && field.relation ? (
                        <Badge tone="info">
                          to {field.relation.targetObject}
                        </Badge>
                      ) : null}
                      {locked ? (
                        <span
                          className="inline-flex size-7 items-center justify-center text-[var(--st-text-tertiary)]"
                          title="Built-in field, read-only"
                        >
                          <Lock size={13} aria-label="Read-only" />
                        </span>
                      ) : (
                        <>
                          <IconButton
                            label={`Edit ${field.label}`}
                            icon={Pencil}
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => onEditField(field.key)}
                          />
                          {busy ? (
                            <span className="inline-flex size-7 items-center justify-center">
                              <Spinner size="sm" label="Removing field" />
                            </span>
                          ) : (
                            <IconButton
                              label={`Remove ${field.label}`}
                              icon={Trash2}
                              variant="danger"
                              size="sm"
                              onClick={() => onRemoveField(field.key)}
                            />
                          )}
                        </>
                      )}
                    </span>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// New-object dialog
// ---------------------------------------------------------------------------

interface NewObjectDialogProps {
  existingSlugs: ReadonlySet<string>;
  projectId: string | null;
  onClose: () => void;
  onCreated: (object: ObjectMetadata) => void;
}

function NewObjectDialog({
  existingSlugs,
  projectId,
  onClose,
  onCreated,
}: NewObjectDialogProps) {
  const [labelSingular, setLabelSingular] = React.useState('');
  const [labelPlural, setLabelPlural] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [icon, setIcon] = React.useState('database');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onPluralChange = (value: string) => {
    setLabelPlural(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const slugTaken = existingSlugs.has(slug);
  const canSubmit =
    labelSingular.trim().length > 0 &&
    labelPlural.trim().length > 0 &&
    slug.trim().length > 0 &&
    !slugTaken &&
    !saving;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    const object: ObjectMetadata = {
      slug: slug.trim(),
      labelSingular: labelSingular.trim(),
      labelPlural: labelPlural.trim(),
      icon: icon.trim() || 'database',
      fields: [
        {
          key: 'name',
          label: 'Name',
          type: 'TEXT',
          isLabel: true,
          inTable: true,
          required: true,
        },
      ],
      views: ['table'],
      standard: false,
    };

    const res = await createObjectTw(object, projectId ?? undefined);
    setSaving(false);
    if (res.ok) {
      onCreated(res.data);
    } else {
      setError(res.error);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New object"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!canSubmit}
            onClick={() =>
              handleSubmit({
                preventDefault: () => {},
              } as React.FormEvent<HTMLFormElement>)
            }
          >
            Create object
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Singular label" required>
          <Input
            value={labelSingular}
            onChange={(e) => setLabelSingular(e.target.value)}
            placeholder="Ticket"
            autoComplete="off"
          />
        </Field>

        <Field label="Plural label" required>
          <Input
            value={labelPlural}
            onChange={(e) => onPluralChange(e.target.value)}
            placeholder="Tickets"
            autoComplete="off"
          />
        </Field>

        <Field label="Icon">
          <Input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="database"
            autoComplete="off"
          />
        </Field>

        <Field
          label="Slug"
          required
          error={slugTaken ? 'An object with this slug already exists.' : undefined}
        >
          <Input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="support-tickets"
            autoComplete="off"
            invalid={slugTaken}
          />
        </Field>

        {error ? <ErrorBanner message={error} /> : null}
        {/* Submit on Enter from within the form. */}
        <input type="hidden" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Delete-object dialog (custom objects only)
//
// A destructive "Delete object" confirmation: deleting drops the object AND its
// records, so we require the admin to re-type the slug before the action is
// enabled. Wired to `deleteObjectTw` (gates on `delete`); the engine rejects
// standard objects, surfaced as an inline error.
// ---------------------------------------------------------------------------

interface DeleteObjectDialogProps {
  object: ObjectMetadata;
  projectId: string | null;
  onClose: () => void;
  onDeleted: (slug: string) => void;
}

function DeleteObjectDialog({
  object,
  projectId,
  onClose,
  onDeleted,
}: DeleteObjectDialogProps) {
  const [confirm, setConfirm] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canDelete = confirm.trim() === object.slug && !deleting;

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    const res = await deleteObjectTw(object.slug, projectId ?? undefined);
    setDeleting(false);
    if (res.ok) {
      onDeleted(object.slug);
    } else {
      setError(res.error);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Delete object"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleting}
            disabled={!canDelete}
            onClick={handleDelete}
          >
            Delete object
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Alert tone="danger">
          Deleting <strong>{object.labelPlural}</strong> permanently removes the
          object and every record stored under it. This cannot be undone.
        </Alert>

        <Field
          label={
            <span>
              Type <code className="font-mono">{object.slug}</code> to confirm
            </span>
          }
        >
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={object.slug}
            autoComplete="off"
            invalid={confirm.length > 0 && !canDelete && !deleting}
          />
        </Field>

        {error ? <ErrorBanner message={error} /> : null}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Field dialog (add a new custom field OR edit an existing custom field)
// ---------------------------------------------------------------------------

const SELECT_TYPES: ReadonlySet<FieldType> = new Set(['SELECT', 'MULTI_SELECT']);

interface FieldDialogProps {
  object: ObjectMetadata;
  /** All loaded objects, used to populate the RELATION target picker. */
  allObjects: ObjectMetadata[];
  projectId: string | null;
  /** When set, edit this existing field; otherwise add a new one. */
  editKey: string | null;
  onClose: () => void;
  onSaved: (object: ObjectMetadata) => void;
}

function FieldDialog({
  object,
  allObjects,
  projectId,
  editKey,
  onClose,
  onSaved,
}: FieldDialogProps) {
  const editing = React.useMemo(
    () => (editKey ? object.fields.find((f) => f.key === editKey) ?? null : null),
    [editKey, object.fields],
  );

  const [label, setLabel] = React.useState(editing?.label ?? '');
  const [key, setKey] = React.useState(editing?.key ?? '');
  const [keyTouched, setKeyTouched] = React.useState(Boolean(editing));
  const [type, setType] = React.useState<FieldType>(editing?.type ?? 'TEXT');
  const [required, setRequired] = React.useState(editing?.required ?? false);
  const [isUnique, setIsUnique] = React.useState(
    editing ? fieldIsUnique(editing) : false,
  );
  const [options, setOptions] = React.useState<FieldOption[]>(
    editing?.options ? editing.options.map((o) => ({ ...o })) : [],
  );
  const [relation, setRelation] = React.useState<FieldRelation>(
    editing?.relation ?? {
      targetObject: '',
      kind: 'MANY_TO_ONE',
      labelField: '',
    },
  );
  const [defaultValue, setDefaultValue] = React.useState<unknown>(
    editing?.defaultValue,
  );
  /** RAW_JSON validity, blocks submit while the textarea holds invalid JSON. */
  const [jsonValid, setJsonValid] = React.useState(true);
  // AI (computed) config — seeded from the existing settings.ai blob on edit.
  const editingAi = editing ? aiFieldConfig(editing) : null;
  const [aiPrompt, setAiPrompt] = React.useState(editingAi?.prompt ?? '');
  const [aiOutputType, setAiOutputType] = React.useState<AiOutputType>(
    editingAi?.outputType ?? 'TEXT',
  );
  const [aiRefresh, setAiRefresh] = React.useState<'auto' | 'manual'>(
    editingAi?.refresh ?? 'auto',
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const existingKeys = React.useMemo(
    () =>
      new Set(object.fields.filter((f) => f.key !== editKey).map((f) => f.key)),
    [object.fields, editKey],
  );

  const onLabelChange = (value: string) => {
    setLabel(value);
    if (!keyTouched) setKey(camelKey(value));
  };

  const keyConflict = key.trim().length > 0 && existingKeys.has(key.trim());
  const isSelect = SELECT_TYPES.has(type);
  const isRelation = type === 'RELATION';
  const isAi = type === 'AI';
  /** AI fields with a SELECT output reuse the options editor as allowed values. */
  const needsOptions = isSelect || (isAi && aiOutputType === 'SELECT');

  /** Switch the field type, dropping any default that no longer fits. */
  const onTypeChange = (next: FieldType) => {
    setType(next);
    setDefaultValue(undefined);
    setJsonValid(true);
  };

  // Type-specific validity: SELECT (or AI→SELECT) needs >=1 valid option;
  // RELATION needs a target; AI needs a non-empty prompt.
  const optionsValid =
    !needsOptions ||
    (options.length > 0 &&
      options.every((o) => o.label.trim() && o.value.trim()));
  const relationValid = !isRelation || relation.targetObject.trim().length > 0;
  const aiValid = !isAi || aiPrompt.trim().length > 0;

  const canSubmit =
    label.trim().length > 0 &&
    key.trim().length > 0 &&
    !keyConflict &&
    optionsValid &&
    relationValid &&
    aiValid &&
    jsonValid &&
    !saving;

  // Seed an empty option row the first time options become required.
  React.useEffect(() => {
    if (needsOptions && options.length === 0) {
      setOptions([{ value: '', label: '', color: DEFAULT_OPTION_COLOR }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOptions]);

  /** Build the FieldMetadata payload from the current form state. */
  const buildField = (): FieldMetadata => {
    const next: FieldMetadata = {
      key: key.trim(),
      label: label.trim(),
      type,
      required,
      inTable: editing?.inTable ?? true,
    };
    if (editing?.isLabel) next.isLabel = true;
    if (editing?.icon) next.icon = editing.icon;
    if (editing?.description) next.description = editing.description;
    if (needsOptions) {
      next.options = options.map((o) => ({
        value: o.value.trim() || optionValue(o.label),
        label: o.label.trim(),
        color: o.color ?? DEFAULT_OPTION_COLOR,
      }));
    }
    if (isAi) {
      // The blob rides the extras cast like `isUnique` — the engine's
      // `settings: Option<Value>` round-trips it verbatim.
      (next as FieldMetadata & FieldTwExtras).settings = {
        ai: {
          prompt: aiPrompt.trim(),
          outputType: aiOutputType,
          refresh: aiRefresh,
        },
      };
      if (!next.icon) next.icon = 'sparkles';
    }
    if (isRelation) {
      next.relation = {
        targetObject: relation.targetObject,
        kind: relation.kind,
        labelField: relation.labelField || undefined,
      };
    }
    if (defaultValue !== undefined && defaultValue !== null) {
      next.defaultValue = defaultValue;
    }
    // `isUnique` is a depth flag not yet on the shared FieldMetadata type; the
    // engine + patch path carry it, so we attach it through a cast.
    (next as FieldMetadata & FieldTwExtras).isUnique = isUnique;
    return next;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    const field = buildField();

    let res;
    if (editing) {
      // Patch the whole fields array, replacing the edited field in place.
      const nextFields = object.fields.map((f) =>
        f.key === editKey ? field : f,
      );
      res = await updateObjectTw(
        object.slug,
        { fields: nextFields },
        projectId ?? undefined,
      );
    } else {
      res = await addFieldTw(object.slug, field, projectId ?? undefined);
    }

    setSaving(false);
    if (res.ok) {
      onSaved(res.data);
    } else {
      setError(res.error);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit field' : 'Add field'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!canSubmit}
            onClick={() =>
              handleSubmit({
                preventDefault: () => {},
              } as React.FormEvent<HTMLFormElement>)
            }
          >
            {editing ? 'Save changes' : 'Add field'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Label" required>
          <Input
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="Priority"
            autoComplete="off"
          />
        </Field>

        <Field
          label="Key"
          required
          help={editing ? "A field's key is fixed once created." : undefined}
          error={
            !editing && keyConflict
              ? 'A field with this key already exists.'
              : undefined
          }
        >
          <Input
            value={key}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(e.target.value);
            }}
            placeholder="priority"
            autoComplete="off"
            invalid={keyConflict}
            disabled={Boolean(editing)}
          />
        </Field>

        <Field label="Type">
          <Select value={type} onValueChange={(v) => onTypeChange(v as FieldType)}>
            <SelectTrigger aria-label="Field type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
              <SelectItem value="RELATION">Relation</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {isAi ? (
          <>
            <Field
              label="Prompt"
              required
              help={
                <span>
                  Use <code className="font-mono">{'{{fieldKey}}'}</code> to
                  insert this record&apos;s values.
                </span>
              }
            >
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={
                  'Summarise this record in one sentence using {{name}}…'
                }
                rows={4}
              />
            </Field>

            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label="Insert a field token into the prompt"
            >
              {object.fields
                .filter((f) => f.key !== editKey && f.key !== key.trim())
                .map((f) => (
                  <Button
                    key={f.key}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setAiPrompt((prev) =>
                        prev.length === 0 || prev.endsWith(' ')
                          ? `${prev}{{${f.key}}}`
                          : `${prev} {{${f.key}}}`,
                      )
                    }
                  >
                    {`{{${f.key}}}`}
                  </Button>
                ))}
            </div>

            <Field label="Output">
              <Select
                value={aiOutputType}
                onValueChange={(v) => setAiOutputType(v as AiOutputType)}
              >
                <SelectTrigger aria-label="AI output type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEXT">Text</SelectItem>
                  <SelectItem value="NUMBER">Number</SelectItem>
                  <SelectItem value="BOOLEAN">Boolean</SelectItem>
                  <SelectItem value="SELECT">Select (one of the options)</SelectItem>
                  <SelectItem value="RATING">Rating (1–5)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Refresh">
              <Select
                value={aiRefresh}
                onValueChange={(v) => setAiRefresh(v as 'auto' | 'manual')}
              >
                <SelectTrigger aria-label="AI refresh mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    Recompute when inputs change
                  </SelectItem>
                  <SelectItem value="manual">Only when asked</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </>
        ) : null}

        {needsOptions ? (
          <OptionRowsEditor options={options} onChange={setOptions} />
        ) : null}

        {isRelation ? (
          <RelationEditor
            objects={allObjects}
            selfSlug={object.slug}
            relation={relation}
            onChange={setRelation}
          />
        ) : null}

        {type === 'CURRENCY' ? (
          <CurrencyDefaultEditor value={defaultValue} onChange={setDefaultValue} />
        ) : null}

        {type === 'FULL_NAME' ? (
          <FullNameDefaultEditor value={defaultValue} onChange={setDefaultValue} />
        ) : null}

        {type === 'ADDRESS' ? (
          <AddressDefaultEditor value={defaultValue} onChange={setDefaultValue} />
        ) : null}

        {type === 'EMAILS' ? (
          <StringListEditor
            label="Default emails"
            placeholder="name@example.com"
            inputType="email"
            value={defaultValue}
            onChange={setDefaultValue}
          />
        ) : null}

        {type === 'PHONES' ? (
          <StringListEditor
            label="Default phones"
            placeholder="+1 555 000 0000"
            inputType="tel"
            value={defaultValue}
            onChange={setDefaultValue}
          />
        ) : null}

        {type === 'ARRAY' ? (
          <StringListEditor
            label="Default items"
            placeholder="Value"
            value={defaultValue}
            onChange={setDefaultValue}
          />
        ) : null}

        {type === 'LINKS' ? (
          <LinksEditor value={defaultValue} onChange={setDefaultValue} />
        ) : null}

        {type === 'MULTI_SELECT' ? (
          <MultiSelectDefaultEditor
            options={options}
            value={defaultValue}
            onChange={setDefaultValue}
          />
        ) : null}

        {type === 'RATING' ? (
          <RatingDefaultEditor value={defaultValue} onChange={setDefaultValue} />
        ) : null}

        {type === 'RAW_JSON' ? (
          <RawJsonDefaultEditor
            value={defaultValue}
            onChange={setDefaultValue}
            onValidityChange={setJsonValid}
          />
        ) : null}

        <Checkbox
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          label="Required"
        />

        <Checkbox
          checked={isUnique}
          onChange={(e) => setIsUnique(e.target.checked)}
          label={
            <span className="inline-flex items-center gap-1.5">
              Unique
              <span className="text-[12px] text-[var(--st-text-secondary)]">
                No two records may share this value.
              </span>
            </span>
          }
        />

        {error ? <ErrorBanner message={error} /> : null}
        <input type="hidden" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DataModelPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeSlug, setActiveSlug] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [addFieldOpen, setAddFieldOpen] = React.useState(false);
  /** Key of the custom field being edited, or null when not editing. */
  const [editFieldKey, setEditFieldKey] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  // Load the object catalogue on mount / project switch.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await listObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setObjects([]);
      } else {
        setObjects(res.data);
        // Default-select the first object (custom first, then standard).
        setActiveSlug((prev) => {
          if (prev && res.data.some((o) => o.slug === prev)) return prev;
          const first = res.data.find((o) => !o.standard) ?? res.data[0];
          return first ? first.slug : null;
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  /** Replace one object in the catalogue with its updated metadata. */
  const upsertObject = React.useCallback((next: ObjectMetadata) => {
    setObjects((prev) => {
      const exists = prev.some((o) => o.slug === next.slug);
      return exists
        ? prev.map((o) => (o.slug === next.slug ? next : o))
        : [...prev, next];
    });
  }, []);

  const customObjects = React.useMemo(
    () => objects.filter((o) => !o.standard),
    [objects],
  );
  const standardObjects = React.useMemo(
    () => objects.filter((o) => o.standard),
    [objects],
  );

  const activeObject = React.useMemo(
    () => objects.find((o) => o.slug === activeSlug) ?? null,
    [objects, activeSlug],
  );

  /**
   * Keys that are immutable on the active object. For a standard object every
   * built-in field is locked (only appended custom fields are removable); the
   * engine flags those built-ins with `system`, so we lock the standard
   * object's system fields. Custom objects lock only `system` fields.
   */
  const lockedKeys = React.useMemo<ReadonlySet<string>>(() => {
    if (!activeObject) return new Set<string>();
    return new Set(
      activeObject.fields.filter((f) => f.system === true).map((f) => f.key),
    );
  }, [activeObject]);

  const handleRemoveField = React.useCallback(
    async (fieldKey: string) => {
      if (!activeObject) return;
      setBusyKey(fieldKey);
      setMutationError(null);
      const res = await removeFieldTw(
        activeObject.slug,
        fieldKey,
        activeProjectId ?? undefined,
      );
      setBusyKey(null);
      if (res.ok) {
        upsertObject(res.data);
      } else {
        setMutationError(res.error);
      }
    },
    [activeObject, activeProjectId, upsertObject],
  );

  const existingSlugs = React.useMemo(
    () => new Set(objects.map((o) => o.slug)),
    [objects],
  );

  // ---- Render -------------------------------------------------------------

  return (
    <div className="20ui flex flex-col gap-5 p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Data Model</PageTitle>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setCreateOpen(true)}
            disabled={loading || !!error}
          >
            New object
          </Button>
        </PageActions>
      </PageHeader>

      {error ? (
        <ErrorBanner message={error} />
      ) : loading ? (
        <div className="grid grid-cols-[280px_1fr] gap-5">
          <div className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={36} radius={6} />
            ))}
          </div>
          <div className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={36} radius={6} />
            ))}
          </div>
        </div>
      ) : objects.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No objects yet"
          description="Create your first custom object to model data the standard CRM objects don't cover."
          action={
            <Button
              variant="primary"
              iconLeft={Plus}
              onClick={() => setCreateOpen(true)}
            >
              New object
            </Button>
          }
        />
      ) : (
        <>
          {mutationError ? <ErrorBanner message={mutationError} /> : null}
          <div className="grid grid-cols-[280px_1fr] items-start gap-5">
            <ObjectList
              custom={customObjects}
              standard={standardObjects}
              activeSlug={activeSlug}
              onSelect={(slug) => {
                setActiveSlug(slug);
                setMutationError(null);
              }}
            />

            {activeObject ? (
              <ObjectDetail
                object={activeObject}
                projectId={activeProjectId}
                lockedKeys={lockedKeys}
                busyKey={busyKey}
                onAddField={() => {
                  setEditFieldKey(null);
                  setAddFieldOpen(true);
                }}
                onEditField={(fieldKey) => {
                  setEditFieldKey(fieldKey);
                  setAddFieldOpen(true);
                }}
                onRemoveField={handleRemoveField}
                onSettingsSaved={(updated) => {
                  upsertObject(updated);
                  setMutationError(null);
                }}
                onDeleteObject={() => {
                  setMutationError(null);
                  setDeleteOpen(true);
                }}
              />
            ) : (
              <div className="flex items-center justify-center rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] p-12 text-[13px] text-[var(--st-text-secondary)]">
                Select an object to manage its fields.
              </div>
            )}
          </div>
        </>
      )}

      {createOpen ? (
        <NewObjectDialog
          existingSlugs={existingSlugs}
          projectId={activeProjectId}
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            upsertObject(created);
            setActiveSlug(created.slug);
            setCreateOpen(false);
          }}
        />
      ) : null}

      {addFieldOpen && activeObject ? (
        <FieldDialog
          object={activeObject}
          allObjects={objects}
          projectId={activeProjectId}
          editKey={editFieldKey}
          onClose={() => {
            setAddFieldOpen(false);
            setEditFieldKey(null);
          }}
          onSaved={(updated) => {
            upsertObject(updated);
            setAddFieldOpen(false);
            setEditFieldKey(null);
          }}
        />
      ) : null}

      {deleteOpen && activeObject && activeObject.standard !== true ? (
        <DeleteObjectDialog
          object={activeObject}
          projectId={activeProjectId}
          onClose={() => setDeleteOpen(false)}
          onDeleted={(slug) => {
            setDeleteOpen(false);
            setObjects((prev) => {
              const next = prev.filter((o) => o.slug !== slug);
              // Re-select another object (custom first, then standard).
              setActiveSlug((cur) => {
                if (cur && cur !== slug) return cur;
                const fallback = next.find((o) => !o.standard) ?? next[0];
                return fallback ? fallback.slug : null;
              });
              return next;
            });
          }}
        />
      ) : null}
    </div>
  );
}
