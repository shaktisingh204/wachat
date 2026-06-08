'use client';

/**
 * Functions tab — list + create form. Code upload uses
 * `<SabFilePickerButton>` (SabFiles ZIP). Each row exposes deploy +
 * test-invoke + delete actions.
 */
import React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Play, Trash2, UploadCloud, Zap } from 'lucide-react';

import {
    createSabcatalystFunction,
    deploySabcatalystFunction,
    invokeSabcatalystFunction,
    deleteSabcatalystFunction,
} from '@/app/actions/sabcatalyst.actions';
import {
    Alert,
    Badge,
    Button,
    Card,
    CardBody,
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    EmptyState,
    Field,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    useToast,
} from '@/components/sabcrm/20ui';
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
    const { toast } = useToast();
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
            toast.success('Function created');
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Could not create the function.';
            setErr(message);
        } finally {
            setBusy(false);
        }
    }

    async function deploy(fnId: string, codeFileId: string) {
        await deploySabcatalystFunction({ functionId: fnId, codeBlobFileId: codeFileId });
        toast.success('Deploy started');
        router.refresh();
    }

    async function invoke(fnId: string) {
        const result = await invokeSabcatalystFunction({
            functionId: fnId,
            method: 'POST',
            bodyText: JSON.stringify({ test: true }),
        });
        toast({
            tone: result.invocationStatus === 'success' ? 'success' : 'danger',
            title: `Invocation ${result.invocationStatus}`,
            description: `${result.durationMs}ms · ${result.bodyText}`,
        });
    }

    async function remove(fnId: string) {
        if (!confirm('Delete this function?')) return;
        await deleteSabcatalystFunction(fnId, projectId);
        setItems((s) => s.filter((x) => x._id !== fnId));
        toast.success('Function deleted');
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
                    New function
                </Button>
            </div>
            {items.length === 0 ? (
                <Card>
                    <CardBody className="p-6">
                        <EmptyState
                            icon={Zap}
                            title="No functions yet"
                            description="Create your first cloud function: HTTP, cron, event, or queue."
                            action={
                                <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
                                    New function
                                </Button>
                            }
                        />
                    </CardBody>
                </Card>
            ) : (
                <ul className="flex list-none flex-col gap-2 p-0">
                    {items.map((fn) => (
                        <li key={fn._id}>
                            <Card>
                                <CardBody className="flex items-center justify-between gap-4 p-4">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="truncate font-semibold">{fn.name}</h3>
                                            <Badge tone="info">{fn.kind}</Badge>
                                            <Badge tone="neutral">{fn.runtime}</Badge>
                                            {fn.status === 'paused' ? (
                                                <Badge tone="warning">paused</Badge>
                                            ) : null}
                                        </div>
                                        <p className="mt-1 truncate font-mono text-xs text-[var(--st-text-secondary)]">
                                            {fn.entrypoint}
                                            {fn.schedule ? ` · ${fn.schedule}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                        <SabFilePickerButton onPick={(p) => deploy(fn._id, p.id)}>
                                            <UploadCloud size={14} aria-hidden="true" />
                                            Deploy ZIP
                                        </SabFilePickerButton>
                                        <Button
                                            variant="secondary"
                                            iconLeft={Play}
                                            onClick={() => invoke(fn._id)}
                                        >
                                            Test
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            iconLeft={Trash2}
                                            onClick={() => remove(fn._id)}
                                            aria-label={`Delete ${fn.name}`}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New function</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Field label="Name" required>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="hello-world"
                                autoFocus
                            />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Kind">
                                <Select value={kind} onValueChange={(v) => setKind(v as FunctionKind)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {KINDS.map((k) => (
                                            <SelectItem key={k} value={k}>{k}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Runtime">
                                <Select value={runtime} onValueChange={(v) => setRuntime(v as FunctionRuntime)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {RUNTIMES.map((r) => (
                                            <SelectItem key={r} value={r}>{r}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                        <Field label="Entrypoint">
                            <Input
                                value={entrypoint}
                                onChange={(e) => setEntrypoint(e.target.value)}
                                placeholder="index.handler"
                            />
                        </Field>
                        {kind === 'cron' ? (
                            <Field label="Cron schedule">
                                <Input
                                    value={schedule}
                                    onChange={(e) => setSchedule(e.target.value)}
                                    placeholder="*/5 * * * *"
                                />
                            </Field>
                        ) : null}
                        <Field label="Code ZIP" help="Optional. You can deploy code later.">
                            <SabFilePickerButton onPick={(p) => setCodeBlobFileId(p.id)}>
                                <UploadCloud size={14} aria-hidden="true" />
                                {codeBlobFileId ? 'ZIP attached' : 'Choose ZIP from SabFiles'}
                            </SabFilePickerButton>
                        </Field>
                        {err ? (
                            <Alert tone="danger" title="Could not create function">
                                {err}
                            </Alert>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={create}
                            loading={busy}
                            disabled={busy || !name.trim()}
                        >
                            Create function
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
