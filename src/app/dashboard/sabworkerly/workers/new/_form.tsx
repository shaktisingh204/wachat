'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Card,
    CardContent,
    Input,
    Label,
    Textarea,
    Badge,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/zoruui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { X, FileIcon } from 'lucide-react';
import { addSabworkerlyWorker } from '@/app/actions/sabworkerly.actions';

interface AttachedDoc {
    id: string;
    name: string;
}

export function WorkerForm() {
    const router = useRouter();
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
        const name = pick.name || pick.filename || `Document ${docs.length + 1}`;
        setDocs((prev) => (prev.some((d) => d.id === id) ? prev : [...prev, { id, name }]));
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
                router.push(`/dashboard/sabworkerly/workers/${res.id}`);
                router.refresh();
            } else {
                setError(res.error);
            }
        });
    };

    return (
        <Card>
            <CardContent className="p-6">
                <form onSubmit={onSubmit} className="flex flex-col gap-5">
                    {error && (
                        <div className="rounded-md border border-zoru-line/40 bg-zoru-ink/10 p-3 text-sm text-zoru-ink-muted">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="status">Status</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                                <SelectTrigger id="status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="on_assignment">On assignment</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="rate">Pay rate (per hour)</Label>
                            <Input
                                id="rate"
                                type="number"
                                step="0.01"
                                min="0"
                                value={hourlyRate}
                                onChange={(e) => setHourlyRate(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Input
                                id="currency"
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                                maxLength={3}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Skills</Label>
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
                        {skills.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-2">
                                {skills.map((s) => (
                                    <Badge key={s} variant="secondary" className="gap-1">
                                        {s}
                                        <button
                                            type="button"
                                            aria-label={`Remove ${s}`}
                                            onClick={() => setSkills((prev) => prev.filter((x) => x !== s))}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Documents (ID, visa, certs)</Label>
                        <p className="text-xs text-[color:var(--zoru-muted-fg)]">
                            Sourced from SabFiles. Use the picker to attach uploaded documents.
                        </p>
                        <div>
                            <SabFilePickerButton
                                accept="all"
                                onPick={onDocPick}
                                variant="secondary"
                            >
                                Attach document from SabFiles
                            </SabFilePickerButton>
                        </div>
                        {docs.length > 0 && (
                            <ul className="mt-2 flex flex-col gap-1">
                                {docs.map((d) => (
                                    <li
                                        key={d.id}
                                        className="flex items-center justify-between rounded-md border border-[color:var(--zoru-border)] px-3 py-2 text-sm"
                                    >
                                        <span className="flex items-center gap-2">
                                            <FileIcon className="h-4 w-4 text-[color:var(--zoru-muted-fg)]" />
                                            {d.name}
                                        </span>
                                        <button
                                            type="button"
                                            aria-label={`Remove ${d.name}`}
                                            onClick={() => setDocs((prev) => prev.filter((x) => x.id !== d.id))}
                                            className="text-[color:var(--zoru-muted-fg)] hover:text-[color:var(--zoru-fg)]"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => router.back()}
                            disabled={pending}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={pending}>
                            {pending ? 'Saving…' : 'Create worker'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
