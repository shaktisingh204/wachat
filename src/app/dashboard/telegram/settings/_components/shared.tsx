import * as React from 'react';
import {
    Card,
    Input,
    Label,
    Switch,
    ZoruCardContent,
} from '@/components/sabcrm/20ui/compat';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui/compat';

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
        <div className="space-y-2">
            {label ? <Label>{label}</Label> : null}
            <div className="flex flex-wrap items-center gap-1 rounded border border-zoru-line bg-zoru-bg px-2 py-1.5">
                {values.map((v, i) => (
                    <span
                        key={`${v}-${i}`}
                        className="inline-flex items-center gap-1 rounded bg-zoru-fg/10 px-2 py-0.5 text-xs"
                    >
                        {v}
                        <button
                            type="button"
                            className="text-zoru-fg/60 hover:text-zoru-fg"
                            onClick={() => onChange(values.filter((_, j) => j !== i))}
                            aria-label={`Remove ${v}`}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <input
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
                    className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none"
                />
            </div>
        </div>
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
        <div className="flex items-center justify-between gap-3 rounded border border-zoru-line bg-zoru-bg px-3 py-2 text-sm">
            <div>
                <div className="font-medium">{label}</div>
                {description ? (
                    <div className="text-xs text-zoru-fg/60">{description}</div>
                ) : null}
            </div>
            <Switch checked={value} onCheckedChange={onChange} />
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
        <div className="space-y-1">
            <Label>{label}</Label>
            <Input
                type="number"
                value={value ?? 0}
                min={min}
                max={max}
                onChange={(e) => onChange(Number(e.target.value) || 0)}
            />
        </div>
    );
}

const ACCENT = '#229ED9';

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
            <ZoruCardContent className="space-y-5 p-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                            style={{ backgroundColor: `${ACCENT}1A`, color: ACCENT }}
                        >
                            <Icon className="h-4 w-4" />
                        </span>
                        <div>
                            <h2 className="text-base font-semibold">{title}</h2>
                            {description ? (
                                <p className="text-sm text-zoru-fg/60">{description}</p>
                            ) : null}
                        </div>
                    </div>
                    {extra}
                </div>
                <div>{children}</div>
                {onSave ? (
                    <div className="flex justify-end pt-2">
                        <Button onClick={onSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                            Save
                        </Button>
                    </div>
                ) : null}
            </ZoruCardContent>
        </Card>
    );
}
