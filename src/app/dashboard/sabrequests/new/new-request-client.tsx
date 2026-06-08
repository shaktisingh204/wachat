'use client';

/**
 * Two-step picker + form for `/dashboard/sabrequests/new`.
 *
 * The blueprint's `formSchema` is treated as opaque JSON of shape:
 *   { fields: Array<{ key: string; label: string; type: 'text'|'number'|'textarea'|'select'|'date'|'file'; options?: string[]; required?: boolean }> }
 *
 * Files use the SabFiles picker (no free-text URL paste — see project policy).
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    LayoutTemplate,
    Layers,
    Clock,
    ArrowLeft,
    Send,
    Paperclip,
    X,
    ChevronRight,
} from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    EmptyState,
    Field,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import { createRequest } from '@/app/actions/sabrequests.actions';
import type { RequestBlueprintDoc } from '@/lib/rust-client/sabrequests-blueprints';

interface FormField {
    key: string;
    label: string;
    type: 'text' | 'number' | 'textarea' | 'select' | 'date' | 'file';
    options?: string[];
    required?: boolean;
}

interface FormSchema {
    fields?: FormField[];
}

interface Props {
    blueprints: RequestBlueprintDoc[];
    preselectedId?: string;
}

export function NewRequestClient({ blueprints, preselectedId }: Props) {
    const router = useRouter();
    const [selectedId, setSelectedId] = React.useState<string | undefined>(
        preselectedId,
    );
    const selected = React.useMemo(
        () => blueprints.find((b) => b._id === selectedId),
        [blueprints, selectedId],
    );
    const schema: FormSchema =
        (selected?.formSchema as FormSchema | undefined) ?? { fields: [] };
    const [values, setValues] = React.useState<Record<string, unknown>>({});
    const [attachments, setAttachments] = React.useState<
        { id: string; name: string; url: string }[]
    >([]);
    const [title, setTitle] = React.useState('');
    const [priority, setPriority] = React.useState('normal');
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const set = (k: string, v: unknown) =>
        setValues((cur) => ({ ...cur, [k]: v }));

    async function submit() {
        if (!selected) return;
        setSubmitting(true);
        setError(null);
        const res = await createRequest({
            blueprintId: selected._id,
            formData: values,
            title: title || selected.name,
            priority,
            attachments,
        });
        setSubmitting(false);
        if (!res.ok || !res.data) {
            setError(res.error ?? 'We couldn’t submit this request. Please try again.');
            return;
        }
        router.push(`/dashboard/sabrequests/${res.data._id}`);
    }

    if (!selected) {
        if (blueprints.length === 0) {
            return (
                <Card padding="none">
                    <EmptyState
                        icon={Layers}
                        title="No published blueprints yet"
                        description="An admin needs to publish a blueprint before you can submit a request."
                        action={
                            <Button variant="outline" asChild>
                                <a href="/dashboard/sabrequests/blueprints">
                                    <LayoutTemplate size={16} aria-hidden="true" />
                                    Manage blueprints
                                </a>
                            </Button>
                        }
                    />
                </Card>
            );
        }
        return (
            <section
                aria-label="Choose a blueprint"
                className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
            >
                {blueprints.map((b) => (
                    <button
                        key={b._id}
                        type="button"
                        onClick={() => setSelectedId(b._id)}
                        className="group flex flex-col gap-2 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-surface)] p-4 text-left transition-all duration-150 hover:border-[var(--st-accent)] hover:bg-[var(--st-bg-muted)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] active:scale-[0.99]"
                    >
                        <div className="flex items-center justify-between">
                            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius-md)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
                                <LayoutTemplate size={18} aria-hidden="true" />
                            </span>
                            <ChevronRight
                                size={16}
                                aria-hidden="true"
                                className="text-[var(--st-text-tertiary)] transition-transform duration-150 group-hover:translate-x-0.5"
                            />
                        </div>
                        <div className="font-medium text-[var(--st-text)]">{b.name}</div>
                        <div className="text-xs text-[var(--st-text-secondary)]">
                            {b.description ?? b.category ?? 'No description'}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge tone="neutral" kind="outline">
                                {b.stages?.length ?? 0} stages
                            </Badge>
                            {b.slaMins ? (
                                <Badge tone="info" kind="soft">
                                    {b.slaMins} min SLA
                                </Badge>
                            ) : null}
                        </div>
                    </button>
                ))}
            </section>
        );
    }

    return (
        <Card padding="md" className="flex flex-col gap-5">
            <CardHeader className="flex items-start justify-between gap-3">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Layers size={16} aria-hidden="true" />
                        {selected.name}
                    </CardTitle>
                    <CardDescription>
                        {selected.description ?? selected.category ?? 'Fill in the form and submit for approval.'}
                    </CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setSelectedId(undefined)}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Change blueprint
                </Button>
            </CardHeader>

            <CardBody className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Title">
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={selected.name}
                        />
                    </Field>
                    <Field label="Priority">
                        <Select value={priority} onValueChange={setPriority}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                </div>

                <div className="flex flex-col gap-4">
                    {(schema.fields ?? []).map((f) => (
                        <Field key={f.key} label={f.label} required={f.required}>
                            {f.type === 'textarea' ? (
                                <Textarea
                                    value={String(values[f.key] ?? '')}
                                    onChange={(e) => set(f.key, e.target.value)}
                                />
                            ) : f.type === 'select' ? (
                                <Select
                                    value={String(values[f.key] ?? '')}
                                    onValueChange={(v) => set(f.key, v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(f.options ?? []).map((o) => (
                                            <SelectItem key={o} value={o}>
                                                {o}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : f.type === 'file' ? (
                                <SabFilePickerButton
                                    onPick={(file) =>
                                        set(f.key, {
                                            id: file.id,
                                            name: file.name,
                                            url: file.url,
                                        })
                                    }
                                />
                            ) : (
                                <Input
                                    type={
                                        f.type === 'number'
                                            ? 'number'
                                            : f.type === 'date'
                                              ? 'date'
                                              : 'text'
                                    }
                                    value={String(values[f.key] ?? '')}
                                    onChange={(e) => set(f.key, e.target.value)}
                                />
                            )}
                        </Field>
                    ))}
                </div>

                <Field label="Attachments">
                    <div className="flex flex-col gap-2">
                        <SabFilePickerButton
                            onPick={(file) =>
                                setAttachments((a) => [
                                    ...a,
                                    { id: file.id, name: file.name, url: file.url },
                                ])
                            }
                        />
                        {attachments.length > 0 ? (
                            <ul className="flex flex-col gap-1">
                                {attachments.map((a, i) => (
                                    <li
                                        key={`${a.id}-${i}`}
                                        className="flex items-center justify-between gap-2 rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] px-2.5 py-1.5 text-xs text-[var(--st-text-secondary)]"
                                    >
                                        <span className="flex items-center gap-1.5 truncate">
                                            <Paperclip size={13} aria-hidden="true" />
                                            <span className="truncate">{a.name}</span>
                                        </span>
                                        <button
                                            type="button"
                                            aria-label={`Remove ${a.name}`}
                                            onClick={() =>
                                                setAttachments((cur) =>
                                                    cur.filter((_, idx) => idx !== i),
                                                )
                                            }
                                            className="rounded-[var(--st-radius-sm)] p-0.5 text-[var(--st-text-tertiary)] transition-colors hover:text-[var(--st-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                                        >
                                            <X size={13} aria-hidden="true" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                </Field>

                {error ? (
                    <p
                        className="rounded-[var(--st-radius-md)] bg-[var(--st-danger-soft)] px-3 py-2 text-sm text-[var(--st-danger)]"
                        role="alert"
                    >
                        {error}
                    </p>
                ) : null}
            </CardBody>

            <div className="flex justify-end gap-2 border-t border-[var(--st-border)] pt-4">
                <Button
                    variant="outline"
                    onClick={() => router.push('/dashboard/sabrequests')}
                >
                    Cancel
                </Button>
                <Button variant="primary" disabled={submitting} onClick={submit}>
                    <Send size={16} aria-hidden="true" />
                    {submitting ? 'Submitting…' : 'Submit request'}
                </Button>
            </div>
        </Card>
    );
}
