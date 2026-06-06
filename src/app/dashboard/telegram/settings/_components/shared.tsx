'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import {
    Button,
    Card,
    CardBody,
    CardDescription,
    CardTitle,
    Field,
    IconButton,
    Input,
    Switch,
} from '@/components/sabcrm/20ui';

export interface ChipInputProps {
    label?: string;
    values: string[];
    onChange: (v: string[]) => void;
    placeholder?: string;
    validate?: (v: string) => boolean;
}

export function ChipInput({ label, values, onChange, placeholder, validate }: ChipInputProps) {
    const [draft, setDraft] = React.useState('');
    const add = () => {
        const v = draft.trim();
        if (!v) return;
        if (validate && !validate(v)) return;
        if (values.includes(v)) {
            setDraft('');
            return;
        }
        onChange([...values, v]);
        setDraft('');
    };
    return (
        <Field label={label}>
            <div className="flex flex-wrap items-center gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-1.5">
                {values.map((v, i) => (
                    <span
                        key={`${v}-${i}`}
                        className="inline-flex items-center gap-1 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-2 py-0.5 text-xs text-[var(--st-text)]"
                    >
                        {v}
                        <IconButton
                            size="sm"
                            label={`Remove ${v}`}
                            icon={X}
                            onClick={() => onChange(values.filter((_, j) => j !== i))}
                        />
                    </span>
                ))}
                <Input
                    inputSize="sm"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            add();
                        } else if (e.key === 'Backspace' && !draft && values.length > 0) {
                            onChange(values.slice(0, -1));
                        }
                    }}
                    onBlur={add}
                    placeholder={placeholder ?? 'Type and press Enter'}
                    className="min-w-[8rem] flex-1 border-0 bg-transparent"
                />
            </div>
        </Field>
    );
}

export function SwitchRow({
    label,
    value,
    onChange,
    description,
}: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
    description?: string;
}) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-sm">
            <div>
                <div className="font-medium text-[var(--st-text)]">{label}</div>
                {description ? (
                    <div className="text-xs text-[var(--st-text-secondary)]">{description}</div>
                ) : null}
            </div>
            <Switch checked={value} onCheckedChange={onChange} aria-label={label} />
        </div>
    );
}

export function NumberRow({
    label,
    value,
    onChange,
    min,
    max,
}: {
    label: string;
    value: number | null | undefined;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
}) {
    return (
        <Field label={label}>
            <Input
                type="number"
                value={value ?? 0}
                min={min}
                max={max}
                onChange={(e) => onChange(Number(e.target.value) || 0)}
            />
        </Field>
    );
}

export function SectionCard({
    icon: Icon,
    title,
    description,
    children,
    onSave,
    saving,
    extra,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description?: string;
    children: React.ReactNode;
    onSave?: () => void;
    saving?: boolean;
    extra?: React.ReactNode;
}) {
    return (
        <Card>
            <CardBody className="space-y-5 p-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent)]/10 text-[var(--st-accent)]"
                            aria-hidden="true"
                        >
                            <Icon className="h-4 w-4" />
                        </span>
                        <div>
                            <CardTitle className="text-base">{title}</CardTitle>
                            {description ? (
                                <CardDescription>{description}</CardDescription>
                            ) : null}
                        </div>
                    </div>
                    {extra}
                </div>
                <div>{children}</div>
                {onSave ? (
                    <div className="flex justify-end pt-2">
                        <Button variant="primary" onClick={onSave} loading={saving}>
                            Save
                        </Button>
                    </div>
                ) : null}
            </CardBody>
        </Card>
    );
}
