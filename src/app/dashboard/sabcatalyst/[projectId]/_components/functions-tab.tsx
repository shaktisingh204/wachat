'use client';

/**
 * Functions tab — list + create form. Code upload uses
 * `<SabFilePickerButton>` (SabFiles ZIP). Each row exposes deploy +
 * test-invoke + delete actions.
 */
import React from 'react';
import { useRouter } from 'next/navigation';

import {
    createSabcatalystFunction,
    deploySabcatalystFunction,
    invokeSabcatalystFunction,
    deleteSabcatalystFunction,
} from '@/app/actions/sabcatalyst.actions';
import {
    Button,
    Card,
    Input,
    Label,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    Badge,
    EmptyState,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/zoruui';
import { SabFilePickerButton } from '@/components/sabfiles';
import type {
    SabcatalystFunction,
    FunctionKind,
    FunctionRuntime,
} from '@/lib/rust-client/sabcatalyst-functions';

const KINDS: FunctionKind[] = ['http', 'cron', 'event', 'queue'];
const RUNTIMES: FunctionRuntime[] = ['nodejs20', 'python311', 'deno', 'bun'];

interface Props {
    projectId: string;
    initialItems: SabcatalystFunction[];
}

export function FunctionsTab({ projectId, initialItems }: Props) {
    const router = useRouter();
    const [items, setItems] = React.useState(initialItems);
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [name, setName] = React.useState('');
    const [kind, setKind] = React.useState<FunctionKind>('http');
    const [runtime, setRuntime] = React.useState<FunctionRuntime>('nodejs20');
    const [entrypoint, setEntrypoint] = React.useState('index.handler');
    const [schedule, setSchedule] = React.useState('');
    const [codeBlobFileId, setCodeBlobFileId] = React.useState<string | null>(null);
    const [err, setErr] = React.useState<string | null>(null);

    async function create() {
        setErr(null);
        setBusy(true);
        try {
            const fn = await createSabcatalystFunction({
                projectId,
                name: name.trim(),
                kind,
                runtime,
                entrypoint: entrypoint.trim(),
                codeBlobFileId: codeBlobFileId || undefined,
                schedule: kind === 'cron' ? schedule.trim() : undefined,
            });
            setItems((s) => [fn, ...s]);
            setOpen(false);
            setName('');
            setSchedule('');
            setCodeBlobFileId(null);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : 'Failed');
        } finally {
            setBusy(false);
        }
    }

    async function deploy(fnId: string, codeBlobFileId: string) {
        await deploySabcatalystFunction({ functionId: fnId, codeBlobFileId });
        router.refresh();
    }

    async function invoke(fnId: string) {
        const result = await invokeSabcatalystFunction({
            functionId: fnId,
            method: 'POST',
            bodyText: JSON.stringify({ test: true }),
        });
        alert(`Invocation: ${result.invocationStatus} (${result.durationMs}ms)\n\n${result.bodyText}`);
    }

    async function remove(fnId: string) {
        if (!confirm('Delete this function?')) return;
        await deleteSabcatalystFunction(fnId, projectId);
        setItems((s) => s.filter((x) => x._id !== fnId));
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => setOpen(true)}>+ New function</Button>
            </div>
            {items.length === 0 ? (
                <EmptyState
                    title="No functions yet"
                    description="Create your first cloud function — HTTP, cron, event or queue."
                />
            ) : (
                <div className="space-y-2">
                    {items.map((fn) => (
                        <Card key={fn._id} className="p-4 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold truncate">{fn.name}</h3>
                                    <Badge variant="outline">{fn.kind}</Badge>
                                    <Badge variant="secondary">{fn.runtime}</Badge>
                                    {fn.status === 'paused' ? <Badge variant="destructive">paused</Badge> : null}
                                </div>
                                <p className="text-xs text-[var(--zoru-muted-foreground)] font-mono mt-1 truncate">
                                    {fn.entrypoint}
                                    {fn.schedule ? ` • ${fn.schedule}` : ''}
                                </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <SabFilePickerButton
                                    onPick={(p) => deploy(fn._id, p.id)}
                                >
                                    Deploy ZIP
                                </SabFilePickerButton>
                                <Button variant="outline" onClick={() => invoke(fn._id)}>
                                    Test
                                </Button>
                                <Button variant="destructive" onClick={() => remove(fn._id)}>
                                    Delete
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New function</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="fn-name">Name</Label>
                            <Input
                                id="fn-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="hello-world"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Kind</Label>
                                <Select value={kind} onValueChange={(v) => setKind(v as FunctionKind)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {KINDS.map((k) => (
                                            <SelectItem key={k} value={k}>{k}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Runtime</Label>
                                <Select value={runtime} onValueChange={(v) => setRuntime(v as FunctionRuntime)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {RUNTIMES.map((r) => (
                                            <SelectItem key={r} value={r}>{r}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="entry">Entrypoint</Label>
                            <Input
                                id="entry"
                                value={entrypoint}
                                onChange={(e) => setEntrypoint(e.target.value)}
                                placeholder="index.handler"
                            />
                        </div>
                        {kind === 'cron' ? (
                            <div>
                                <Label htmlFor="schedule">Cron schedule</Label>
                                <Input
                                    id="schedule"
                                    value={schedule}
                                    onChange={(e) => setSchedule(e.target.value)}
                                    placeholder="*/5 * * * *"
                                />
                            </div>
                        ) : null}
                        <div>
                            <Label>Code ZIP (optional, deploy later if blank)</Label>
                            <div className="mt-1">
                                <SabFilePickerButton
                                    onPick={(p) => setCodeBlobFileId(p.id)}
                                >
                                    {codeBlobFileId ? 'ZIP attached' : 'Choose ZIP from SabFiles'}
                                </SabFilePickerButton>
                            </div>
                        </div>
                        {err ? <p className="text-sm text-red-500">{err}</p> : null}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                            Cancel
                        </Button>
                        <Button onClick={create} disabled={busy || !name.trim()}>
                            {busy ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
