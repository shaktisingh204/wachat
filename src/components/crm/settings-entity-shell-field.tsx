'use client';

import { Input, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue, Textarea } from '@/components/sabcrm/20ui/compat';
/**
 * Internal helpers for <SettingsEntityShell>:
 *  - FieldRenderer: renders one form field by `SettingsField` shape
 *  - formatFieldValue: serialises a stored value into the input's
 *    `defaultValue` (handles dates + objects)
 *  - downloadCsv: client-side CSV export of the current filtered rows
 *
 * Extracted from settings-entity-shell.tsx to keep that file under
 * the 600-line budget.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import type { EntityKey } from '@/lib/lookup-registry';

export type SettingsFieldType =
    | 'text'
    | 'textarea'
    | 'select'
    | 'number'
    | 'email'
    | 'url'
    | 'tel'
    | 'date'
    | 'color'
    | 'entity';

export interface SettingsField {
    name: string;
    label: string;
    type?: SettingsFieldType;
    required?: boolean;
    options?: { value: string; label: string }[];
    placeholder?: string;
    defaultValue?: string;
    fullWidth?: boolean;
    help?: string;
    /** For `type: 'entity'`. */
    entity?: EntityKey;
    filter?: Record<string, unknown>;
    cascadeFilterFrom?: (
        siblings: Record<string, string>,
    ) => Record<string, unknown> | undefined;
}

export interface SettingsColumn<T> {
    key: string;
    label: string;
    render?: (row: T) => React.ReactNode;
    /** Set to false to omit from CSV export. */
    exportable?: boolean;
    className?: string;
}

function toCsvCell(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
        try {
            return JSON.stringify(v);
        } catch {
            return '';
        }
    }
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

export function downloadCsv<T>(
    filename: string,
    columns: SettingsColumn<T>[],
    rows: T[],
): void {
    const exportable = columns.filter((c) => c.exportable !== false);
    const header = exportable.map((c) => toCsvCell(c.label)).join(',');
    const lines = rows.map((r) =>
        exportable
            .map((c) => toCsvCell((r as Record<string, unknown>)[c.key]))
            .join(','),
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function formatFieldValue(
    value: unknown,
    type?: SettingsFieldType,
): string {
    if (value === null || value === undefined) return '';
    if (type === 'date' && value) {
        const d = new Date(value as string | number | Date);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export function FieldRenderer({
    field,
    value,
    entityValues,
    onEntityChange,
}: {
    field: SettingsField;
    value?: unknown;
    entityValues: Record<string, string>;
    onEntityChange: (name: string, id: string | null) => void;
}) {
    const stringValue = typeof value === 'string' ? value : '';

    if (field.type === 'entity' && field.entity) {
        const computedFilter = (() => {
            if (field.cascadeFilterFrom) {
                const f = field.cascadeFilterFrom(entityValues);
                return { ...(field.filter ?? {}), ...(f ?? {}) };
            }
            return field.filter;
        })();
        return (
            <EntityFormField
                entity={field.entity}
                name={field.name}
                initialId={stringValue || field.defaultValue || null}
                filter={computedFilter}
                required={field.required}
                placeholder={field.placeholder}
                onChange={(id) => onEntityChange(field.name, id)}
            />
        );
    }

    const common = {
        id: field.name,
        name: field.name,
        required: field.required,
        defaultValue: stringValue || field.defaultValue || '',
        placeholder: field.placeholder,
    };

    if (field.type === 'textarea') {
        return <Textarea {...common} rows={3} />;
    }
    if (field.type === 'select') {
        return (
            <Select
                name={field.name}
                defaultValue={String(common.defaultValue || '')}
            >
                <ZoruSelectTrigger id={field.name}>
                    <ZoruSelectValue placeholder={field.placeholder || 'Select'} />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    {(field.options || []).map((opt) => (
                        <ZoruSelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </ZoruSelectItem>
                    ))}
                </ZoruSelectContent>
            </Select>
        );
    }
    if (field.type === 'color') {
        return (
            <div className="flex items-center gap-2">
                <Input {...common} type="color" className="h-9 w-12 p-1" />
                <span className="text-[12px] text-zoru-ink-muted">
                    {stringValue || field.defaultValue || ''}
                </span>
            </div>
        );
    }
    return (
        <Input
            {...common}
            type={field.type || 'text'}
            min={field.type === 'number' ? 0 : undefined}
        />
    );
}
