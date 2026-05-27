'use client';

/**
 * Two-step picker + form for `/dashboard/requests/new`.
 *
 * The blueprint's `formSchema` is treated as opaque JSON of shape:
 *   { fields: Array<{ key: string; label: string; type: 'text'|'number'|'textarea'|'select'|'date'|'file'; options?: string[]; required?: boolean }> }
 *
 * Files use the SabFiles picker (no free-text URL paste — see project policy).
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Card,
    Input,
    Label,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    Textarea,
} from '@/components/zoruui';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
    createRequest,
} from '@/app/actions/sabrequests.actions';
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
    const [attachments, setAttachments] = React.useState<unknown[]>([]);
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
            setError(res.error ?? 'Failed to create request.');
            return;
        }
        router.push(`/dashboard/requests/${res.data._id}`);
    }

    if (!selected) {
        return (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {blueprints.length === 0 ? (
                    <Card className="col-span-full p-8 text-center text-sm text-zoru-ink-muted">
                        No published blueprints yet. Admins can create one under
                        Manage blueprints.
                    </Card>
                ) : (
                    blueprints.map((b) => (
                        <Card
                            key={b._id}
                            className="cursor-pointer p-4 transition hover:bg-zoru-surface-2/40"
                            onClick={() => setSelectedId(b._id)}
                        >
                            <div className="text-2xl">{b.icon ?? 'Form'}</div>
                            <div className="mt-2 font-medium">{b.name}</div>
                            <div className="text-xs text-zoru-ink-muted">
                                {b.description ?? b.category ?? '—'}
                            </div>
                            <div className="mt-3 text-xs text-zoru-ink-muted">
                                {b.stages?.length ?? 0} stages ·{' '}
                                {b.slaMins ? `${b.slaMins} min SLA` : 'no SLA'}
                            </div>
                        </Card>
                    ))
                )}
            </div>
        );
    }

    return (
        <Card className="flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-lg font-medium">{selected.name}</div>
                    <div className="text-xs text-zoru-ink-muted">
                        {selected.description ?? selected.category ?? ''}
                    </div>
                </div>
                <Button variant="ghost" onClick={() => setSelectedId(undefined)}>
                    Change blueprint
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                    <Label>Title</Label>
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={selected.name}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label>Priority</Label>
                    <Select value={priority} onValueChange={setPriority}>
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="low">Low</ZoruSelectItem>
                            <ZoruSelectItem value="normal">Normal</ZoruSelectItem>
                            <ZoruSelectItem value="high">High</ZoruSelectItem>
                            <ZoruSelectItem value="urgent">Urgent</ZoruSelectItem>
                        </ZoruSelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                {(schema.fields ?? []).map((f) => (
                    <div key={f.key} className="flex flex-col gap-1">
                        <Label>
                            {f.label}
                            {f.required ? ' *' : ''}
                        </Label>
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
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue placeholder="Choose…" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {(f.options ?? []).map((o) => (
                                        <ZoruSelectItem key={o} value={o}>
                                            {o}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
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
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-1">
                <Label>Attachments</Label>
                <SabFilePickerButton
                    onPick={(file) =>
                        setAttachments((a) => [
                            ...a,
                            { id: file.id, name: file.name, url: file.url },
                        ])
                    }
                />
                <ul className="text-xs text-zoru-ink-muted">
                    {attachments.map((a, i) => (
                        <li key={i}>
                            {(a as { name?: string }).name ?? 'file'}
                        </li>
                    ))}
                </ul>
            </div>

            {error ? (
                <div className="text-sm text-zoru-ink">{error}</div>
            ) : null}

            <div className="flex justify-end gap-2">
                <Button
                    variant="outline"
                    onClick={() => router.push('/dashboard/requests')}
                >
                    Cancel
                </Button>
                <Button disabled={submitting} onClick={submit}>
                    {submitting ? 'Submitting…' : 'Submit request'}
                </Button>
            </div>
        </Card>
    );
}
