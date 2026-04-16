'use client';

/**
 * ForgeBlockSettings
 *
 * Generic settings renderer driven by a `ForgeBlock` schema:
 *   - Renders the optional `auth` section once at the top.
 *   - For single-action blocks: renders `block.fields` directly.
 *   - For multi-action blocks: renders an action selector followed by the
 *     selected action's fields.
 *
 * Conditional fields (`showIf`) are evaluated against the combined merged
 * options so one action's toggle can drive visibility of its siblings.
 */

import { useCallback, useMemo } from 'react';
import { LuKeyRound, LuZap } from 'react-icons/lu';

import { Field, selectClass } from '../shared/primitives';
import { ForgeFieldRenderer } from './ForgeFieldRenderer';
import {
  isFieldVisible,
  isMultiActionBlock,
  type ForgeAction,
  type ForgeBlock,
  type ForgeField,
} from '@/lib/sabflow/forge/types';

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  /** The schema definition for this block. */
  block: ForgeBlock;
  /** Current options snapshot persisted alongside the flow block. */
  options: Record<string, unknown>;
  /** Called with a partial patch to merge into options. */
  onChange: (patch: Record<string, unknown>) => void;
};

/* ── Component ───────────────────────────────────────────────────────────── */

export function ForgeBlockSettings({ block, options, onChange }: Props) {
  const multiAction = isMultiActionBlock(block);

  /**
   * Selected action id for multi-action blocks.  Persisted under the reserved
   * key `__action` so it doesn't collide with any user-defined field id.
   */
  const selectedActionId = useMemo(() => {
    if (!multiAction) return null;
    const current = options.__action;
    if (typeof current === 'string' && block.actions?.some((a) => a.id === current)) {
      return current;
    }
    return block.actions?.[0]?.id ?? null;
  }, [multiAction, options.__action, block.actions]);

  const selectedAction = useMemo<ForgeAction | null>(() => {
    if (!multiAction || !selectedActionId) return null;
    return block.actions?.find((a) => a.id === selectedActionId) ?? null;
  }, [multiAction, selectedActionId, block.actions]);

  const patchField = useCallback(
    (fieldId: string, value: unknown) => {
      onChange({ [fieldId]: value });
    },
    [onChange],
  );

  const handleActionChange = useCallback(
    (actionId: string) => {
      onChange({ __action: actionId });
    },
    [onChange],
  );

  return (
    <div className="space-y-5">
      {/* Block description */}
      {block.description && (
        <p className="text-[12px] leading-relaxed text-[var(--gray-10)]">{block.description}</p>
      )}

      {/* ── Auth section ──────────────────────────────────── */}
      {block.auth && block.auth.type !== 'none' && block.auth.fields && block.auth.fields.length > 0 && (
        <Section icon="key" title="Authentication">
          <FieldGroup fields={block.auth.fields} options={options} onChange={patchField} />
        </Section>
      )}

      {/* ── Single-action block fields ────────────────────── */}
      {!multiAction && block.fields && block.fields.length > 0 && (
        <Section icon="zap" title="Configuration">
          <FieldGroup fields={block.fields} options={options} onChange={patchField} />
        </Section>
      )}

      {/* ── Multi-action: selector + action fields ────────── */}
      {multiAction && block.actions && (
        <>
          <Field label="Action">
            <select
              className={selectClass}
              value={selectedActionId ?? ''}
              onChange={(e) => handleActionChange(e.target.value)}
            >
              {block.actions.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.label}
                </option>
              ))}
            </select>
          </Field>

          {selectedAction && (
            <>
              {selectedAction.description && (
                <p className="text-[11.5px] leading-relaxed text-[var(--gray-9)]">
                  {selectedAction.description}
                </p>
              )}
              <FieldGroup
                fields={selectedAction.fields}
                options={options}
                onChange={patchField}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── FieldGroup ──────────────────────────────────────────────────────────── */

type FieldGroupProps = {
  fields: ForgeField[];
  options: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
};

function FieldGroup({ fields, options, onChange }: FieldGroupProps) {
  return (
    <div className="space-y-4">
      {fields.map((field) => {
        if (!isFieldVisible(field, options)) return null;
        const current = options[field.id];
        const effective = current === undefined ? field.defaultValue : current;
        return (
          <ForgeFieldRenderer
            key={field.id}
            field={field}
            value={effective}
            onChange={(v) => onChange(field.id, v)}
          />
        );
      })}
    </div>
  );
}

/* ── Section header ──────────────────────────────────────────────────────── */

type SectionProps = {
  icon: 'key' | 'zap';
  title: string;
  children: React.ReactNode;
};

function Section({ icon, title, children }: SectionProps) {
  const Icon = icon === 'key' ? LuKeyRound : LuZap;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[var(--gray-10)]" strokeWidth={1.8} />
        <span className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
          {title}
        </span>
      </div>
      {children}
    </section>
  );
}
