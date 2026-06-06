'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileIcon, X } from 'lucide-react';

import {
    Alert,
    Badge,
    Button,
    Card,
    CardBody,
    Field,
    IconButton,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Tag,
    useToast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { addSabworkerlyWorker } from '@/app/actions/sabworkerly.actions';

interface AttachedDoc {
    id: string;
    name: string;
}

export function WorkerForm() {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [skillsInput, setSkillsInput] = useState('');
    const [skills, setSkills] = useState<string[]>([]);
    const [status, setStatus] = useState<'active' | 'inactive' | 'on_assignment'>('active');
    const [hourlyRate, setHourlyRate] = useState<string>('25.00');
    const [currency, setCurrency] = useState('USD');
    const [docs, setDocs] = useState<AttachedDoc[]>([]);

    const addSkill = (): void => {
        const s = skillsInput.trim();
        if (!s) return;
        setSkills((prev) => (prev.includes(s) ? prev : [...prev, s]));
        setSkillsInput('');
    };

    const onDocPick = (pick: SabFilePick): void => {
        if (!pick?.id) return;
        const id = String(pick.id);
        const docName = pick.name || `Document ${docs.length + 1}`;
        setDocs((prev) => (prev.some((d) => d.id === id) ? prev : [...prev, { id, name: docName }]));
    };

    const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        setError(null);
        const rateMinor = Math.round((Number(hourlyRate) || 0) * 100);
        startTransition(async () => {
            const res = await addSabworkerlyWorker({
                name,
                email,
                phone: phone || undefined,
                skills,
                status,
                hourlyRateMinor: rateMinor,
                currency,
                documentIds: docs.map((d) => d.id),
            });
            if (res.success) {
                toast.success('Worker created');
                router.push(`/dashboard/sabworkerly/workers/${res.id}`);
                router.refresh();
            } else {
                setError(res.error);
                toast.error(res.error);
            }
        });
    };

    return (
        <Card>
            <CardBody>
                <form onSubmit={onSubmit} className="flex flex-col gap-5">
                    {error ? (
                        <Alert tone="danger" onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Name" required>
                            <Input
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </Field>
                        <Field label="Email" required>
                            <Input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </Field>
                        <Field label="Phone">
                            <Input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </Field>
                        <Field label="Status">
                            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                                <SelectTrigger aria-label="Status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="on_assignment">On assignment</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Pay rate (per hour)">
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={hourlyRate}
                                onChange={(e) => setHourlyRate(e.target.value)}
                            />
                        </Field>
                        <Field label="Currency">
                            <Input
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                                maxLength={3}
                            />
                        </Field>
                    </div>

                    <Field label="Skills">
                        <div className="flex gap-2">
                            <Input
                                placeholder="e.g. forklift, bartending, CDL"
                                value={skillsInput}
                                onChange={(e) => setSkillsInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addSkill();
                                    }
                                }}
                            />
                            <Button type="button" variant="secondary" onClick={addSkill}>
                                Add
                            </Button>
                        </div>
                        {skills.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                                {skills.map((s) => (
                                    <Tag
                                        key={s}
                                        removeLabel={`Remove ${s}`}
                                        onRemove={() => setSkills((prev) => prev.filter((x) => x !== s))}
                                    >
                                        {s}
                                    </Tag>
                                ))}
                            </div>
                        ) : null}
                    </Field>

                    <Field
                        label="Documents (ID, visa, certs)"
                        help="Sourced from SabFiles. Use the picker to attach uploaded documents."
                    >
                        <div>
                            <SabFilePickerButton
                                accept="all"
                                onPick={onDocPick}
                                variant="outline"
                            >
                                Attach document from SabFiles
                            </SabFilePickerButton>
                        </div>
                        {docs.length > 0 ? (
                            <ul className="mt-2 flex flex-col gap-1">
                                {docs.map((d) => (
                                    <li
                                        key={d.id}
                                        className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2 text-sm text-[var(--st-text)]"
                                    >
                                        <span className="flex items-center gap-2">
                                            <FileIcon className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                                            {d.name}
                                        </span>
                                        <IconButton
                                            label={`Remove ${d.name}`}
                                            icon={X}
                                            size="sm"
                                            onClick={() => setDocs((prev) => prev.filter((x) => x.id !== d.id))}
                                        />
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </Field>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => router.back()}
                            disabled={pending}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" loading={pending}>
                            {pending ? 'Saving' : 'Create worker'}
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}
