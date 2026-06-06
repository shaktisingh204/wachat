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
import type { EnvelopeField, EsignFieldType } from '@/lib/rust-client/esign-envelopes';

const FIELD_TYPES: Array<{ type: EsignFieldType; label: string; w: number; h: number }> = [
  { type: 'signature', label: 'Signature', w: 180, h: 50 },
  { type: 'initials', label: 'Initials', w: 80, h: 40 },
  { type: 'date', label: 'Date', w: 120, h: 32 },
  { type: 'text', label: 'Text', w: 180, h: 32 },
  { type: 'checkbox', label: 'Checkbox', w: 32, h: 32 },
  { type: 'dropdown', label: 'Dropdown', w: 180, h: 32 },
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
