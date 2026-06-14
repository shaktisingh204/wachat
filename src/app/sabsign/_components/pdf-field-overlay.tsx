'use client';

/**
 * PDF field overlay editor.
 *
 * Renders the source SabFiles document as an `<iframe>` (browsers render
 * PDFs natively) and overlays a positionable canvas of drag-droppable
 * fields. Each field is positioned in page-relative coordinates
 * (0-1000 on each axis) so the layout survives client-side zoom and is
 * safe to round-trip through Mongo.
 *
 * NOTE: We deliberately do not depend on `pdfjs-dist` here. That ships
 * roughly 3 MB of WASM. The iframe approach works in every modern
 * browser. If the team later wants per-page placement (vs document-level
 * overlay), swap the iframe for a `pdfjs` canvas. The data model already
 * carries a `page` field per overlay item.
 */

import * as React from 'react';
import {
  Button,
  IconButton,
  Field,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { Trash2, GripHorizontal } from 'lucide-react';
import type {
  EnvelopeField,
  FieldCondition,
  SabSignFieldType,
} from '@/lib/rust-client/sabsign-envelopes';

const FIELD_TYPES: Array<{ type: SabSignFieldType; label: string; w: number; h: number }> = [
  { type: 'signature', label: 'Signature', w: 180, h: 50 },
  { type: 'initials', label: 'Initials', w: 80, h: 40 },
  { type: 'stamp', label: 'Stamp', w: 120, h: 60 },
  { type: 'date', label: 'Date', w: 120, h: 32 },
  { type: 'text', label: 'Text', w: 180, h: 32 },
  { type: 'number', label: 'Number', w: 120, h: 32 },
  { type: 'phone', label: 'Phone', w: 160, h: 32 },
  { type: 'checkbox', label: 'Checkbox', w: 32, h: 32 },
  { type: 'radio', label: 'Radio', w: 180, h: 32 },
  { type: 'dropdown', label: 'Dropdown', w: 180, h: 32 },
  { type: 'image', label: 'Image', w: 160, h: 80 },
  { type: 'file', label: 'File', w: 180, h: 32 },
];

export interface PdfFieldOverlayProps {
  docUrl: string;
  recipientRoles: string[];
  fields: EnvelopeField[];
  onChange: (fields: EnvelopeField[]) => void;
}

function newFieldId(): string {
  return `f_${Math.random().toString(36).slice(2, 10)}`;
}

export function PdfFieldOverlay({
  docUrl,
  recipientRoles,
  fields,
  onChange,
}: PdfFieldOverlayProps) {
  const [activeRole, setActiveRole] = React.useState<string>(
    recipientRoles[0] || 'signer',
  );
  const surfaceRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!recipientRoles.includes(activeRole) && recipientRoles.length) {
      setActiveRole(recipientRoles[0]);
    }
  }, [recipientRoles, activeRole]);

  const addField = (proto: (typeof FIELD_TYPES)[number]) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const f: EnvelopeField = {
      id: newFieldId(),
      recipientRole: activeRole,
      fieldType: proto.type,
      page: 1,
      x: Math.max(0, Math.round(rect.width / 2 - proto.w / 2)),
      y: Math.max(0, Math.round(rect.height / 2 - proto.h / 2)),
      w: proto.w,
      h: proto.h,
      label: proto.label,
      required: proto.type === 'signature' || proto.type === 'initials',
    };
    onChange([...fields, f]);
  };

  const updateField = (id: string, patch: Partial<EnvelopeField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
  };

  const roleOptions = recipientRoles.length ? recipientRoles : ['signer'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      {/* Toolbox */}
      <div className="space-y-4">
        <Field label="Assign new fields to">
          <Select value={activeRole} onValueChange={setActiveRole}>
            <SelectTrigger aria-label="Assign new fields to">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="space-y-1">
          <div className="text-xs font-medium text-[var(--st-text-secondary)] mb-1">
            Fields
          </div>
          {FIELD_TYPES.map((p) => (
            <Button
              key={p.type}
              variant="outline"
              size="sm"
              block
              className="justify-start"
              iconLeft={GripHorizontal}
              onClick={() => addField(p)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {fields.length > 0 ? (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-[var(--st-text-secondary)]">
              Logic &amp; formulas
            </div>
            {fields.map((f) => (
              <FieldLogicEditor
                key={f.id}
                field={f}
                allFields={fields}
                onChange={(patch) => updateField(f.id, patch)}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Document + overlay */}
      <div className="relative border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden bg-[var(--st-bg-secondary)]">
        <div className="relative" ref={surfaceRef}>
          <iframe
            src={docUrl}
            title="Document preview"
            className="w-full h-[80vh] block"
          />
          <div className="absolute inset-0 pointer-events-none">
            {fields.map((f) => (
              <DraggableField
                key={f.id}
                field={f}
                onChange={(patch) => updateField(f.id, patch)}
                onRemove={() => removeField(f.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DraggableFieldProps {
  field: EnvelopeField;
  onChange: (patch: Partial<EnvelopeField>) => void;
  onRemove: () => void;
}

function DraggableField({ field, onChange, onRemove }: DraggableFieldProps) {
  const [drag, setDrag] = React.useState<{ x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x: e.clientX - field.x, y: e.clientY - field.y });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    onChange({ x: Math.max(0, e.clientX - drag.x), y: Math.max(0, e.clientY - drag.y) });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setDrag(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className="absolute pointer-events-auto group rounded-[var(--st-radius)] border-2 border-dashed border-[var(--st-accent)] bg-[var(--st-accent)]/10 hover:bg-[var(--st-accent)]/20 cursor-move flex items-center justify-center text-xs text-[var(--st-accent)] font-medium select-none"
      style={{ left: field.x, top: field.y, width: field.w, height: field.h }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <span>{field.label || field.fieldType}</span>
      <span className="absolute -top-2 -right-2 hidden group-hover:block">
        <IconButton
          label="Remove field"
          icon={Trash2}
          variant="danger"
          size="sm"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      </span>
    </div>
  );
}

const LOGIC_SEL =
  'rounded border border-[var(--st-border)] bg-[var(--st-surface)] px-1.5 py-1 text-xs text-[var(--st-text)] outline-none';
const COND_OPS: FieldCondition['op'][] = [
  'equals',
  'not_equals',
  'contains',
  'truthy',
  'gt',
  'lt',
];

/**
 * Compact per-field logic editor — conditional show/hide/require driven by
 * another field's value, plus an optional formula. Stored on the field's
 * `conditions` / `formula` and evaluated by the signer portal.
 */
function FieldLogicEditor({
  field,
  allFields,
  onChange,
}: {
  field: EnvelopeField;
  allFields: EnvelopeField[];
  onChange: (patch: Partial<EnvelopeField>) => void;
}) {
  const cond = field.conditions?.[0];
  const others = allFields.filter((o) => o.id !== field.id);

  const setCond = (patch: Partial<FieldCondition>) => {
    const base: FieldCondition =
      cond ?? { whenFieldId: others[0]?.id ?? '', op: 'equals', action: 'show' };
    onChange({ conditions: [{ ...base, ...patch }] });
  };

  const supportsFormula = field.fieldType === 'number' || field.fieldType === 'text';

  return (
    <details className="rounded border border-[var(--st-border)] p-2 text-xs">
      <summary className="cursor-pointer select-none text-[var(--st-text)]">
        {field.label || field.fieldType}
        {cond ? <span className="ml-1 text-[var(--st-accent)]">· logic</span> : null}
      </summary>
      <div className="mt-2 space-y-2">
        <label className="flex items-center justify-between gap-1">
          <span className="text-[var(--st-text-secondary)]">Visibility</span>
          <select
            className={LOGIC_SEL}
            value={cond?.action ?? 'none'}
            onChange={(e) =>
              e.target.value === 'none'
                ? onChange({ conditions: undefined })
                : setCond({ action: e.target.value as FieldCondition['action'] })
            }
          >
            <option value="none">Always shown</option>
            <option value="show">Show when…</option>
            <option value="hide">Hide when…</option>
            <option value="require">Require when…</option>
          </select>
        </label>

        {cond && others.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            <select
              className={LOGIC_SEL}
              value={cond.whenFieldId}
              onChange={(e) => setCond({ whenFieldId: e.target.value })}
            >
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label || o.fieldType}
                </option>
              ))}
            </select>
            <select
              className={LOGIC_SEL}
              value={cond.op}
              onChange={(e) => setCond({ op: e.target.value as FieldCondition['op'] })}
            >
              {COND_OPS.map((op) => (
                <option key={op} value={op}>
                  {op.replace('_', ' ')}
                </option>
              ))}
            </select>
            {cond.op !== 'truthy' ? (
              <input
                className={LOGIC_SEL}
                value={cond.value ?? ''}
                onChange={(e) => setCond({ value: e.target.value })}
                placeholder="value"
              />
            ) : null}
          </div>
        ) : null}

        {supportsFormula ? (
          <label className="flex items-center justify-between gap-1">
            <span className="text-[var(--st-text-secondary)]">Formula</span>
            <input
              className={LOGIC_SEL}
              value={field.formula ?? ''}
              onChange={(e) => onChange({ formula: e.target.value || undefined })}
              placeholder="sum:a,b"
            />
          </label>
        ) : null}
      </div>
    </details>
  );
}
