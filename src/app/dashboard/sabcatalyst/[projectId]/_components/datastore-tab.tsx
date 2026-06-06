'use client';

/** Datastore tab - table list + simple create form. */
import React from 'react';
import { Database, Plus, Trash2, X } from 'lucide-react';

import {
    createSabcatalystTable,
    deleteSabcatalystTable,
} from '@/app/actions/sabcatalyst.actions';
import {
    Alert,
    Badge,
    Button,
    Card,
    CardTitle,
    Checkbox,
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    EmptyState,
    Field,
    IconButton,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    useToast,
} from '@/components/sabcrm/20ui';
import type { SabcatalystTable, TableField } from '@/lib/rust-client/sabcatalyst-tables';

interface Props { projectId: string; initialTables: SabcatalystTable[] }

const TYPES = ['string', 'number', 'boolean', 'datetime', 'json'];

export function DatastoreTab({ projectId, initialTables }: Props) {
    const { toast } = useToast();
    const [tables, setTables] = React.useState(initialTables);
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState('');
    const [fields, setFields] = React.useState<TableField[]>([
        { name: 'id', type: 'string', indexed: true },
    ]);
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState<string | null>(null);

    async function create() {
        setBusy(true);
        setErr(null);
        try {
            const t = await createSabcatalystTable({
                projectId,
                name: name.trim(),
                schemaJson: { fields },
            });
            setTables((s) => [t, ...s]);
            setOpen(false);
            setName('');
            setFields([{ name: 'id', type: 'string', indexed: true }]);
            toast.success('Table created');
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed';
            setErr(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    }

    async function remove(id: string) {
        if (!confirm('Delete table?')) return;
        try {
            await deleteSabcatalystTable(id, projectId);
            setTables((s) => s.filter((x) => x._id !== id));
            toast.success('Table deleted');
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to delete table');
        }
    }

    function addField() {
        setFields((s) => [...s, { name: '', type: 'string' }]);
    }
    function updateField(i: number, patch: Partial<TableField>) {
        setFields((s) => s.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
    }
    function removeField(i: number) {
        setFields((s) => s.filter((_, idx) => idx !== i));
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
                    New table
                </Button>
            </div>
            {tables.length === 0 ? (
                <EmptyState
                    icon={Database}
                    title="No tables yet"
                    description="Datastore tables hold project-scoped records."
                    action={
                        <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
                            New table
                        </Button>
                    }
                />
            ) : (
                <div className="space-y-2">
                    {tables.map((t) => (
                        <Card key={t._id} variant="outlined" padding="md" className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <CardTitle>{t.name}</CardTitle>
                                <p className="text-xs text-[var(--st-text-secondary)] mt-1">
                                    {t.schemaJson.fields.length} fields, {t.recordsCount} records
                                </p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {t.schemaJson.fields.map((f) => (
                                        <Badge key={f.name} variant="outline">
                                            {f.name}:{f.type}
                                            {f.indexed ? '*' : ''}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <Button variant="danger" iconLeft={Trash2} onClick={() => remove(t._id)}>
                                Delete
                            </Button>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>New datastore table</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Field label="Table name">
                            <Input
                                id="tbl-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="customers"
                            />
                        </Field>
                        <Field label="Fields">
                            <div className="space-y-2 mt-1">
                                {fields.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <Input
                                            value={f.name}
                                            onChange={(e) => updateField(i, { name: e.target.value })}
                                            placeholder="field"
                                            aria-label={`Field ${i + 1} name`}
                                            className="flex-1"
                                        />
                                        <Select
                                            value={f.type}
                                            onValueChange={(v) => updateField(i, { type: v })}
                                        >
                                            <SelectTrigger aria-label={`Field ${i + 1} type`} className="w-32">
                                                <SelectValue placeholder="Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TYPES.map((t) => (
                                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Checkbox
                                            size="sm"
                                            label="indexed"
                                            checked={!!f.indexed}
                                            onChange={(e) => updateField(i, { indexed: e.target.checked })}
                                        />
                                        <IconButton
                                            label={`Remove field ${i + 1}`}
                                            icon={X}
                                            variant="ghost"
                                            onClick={() => removeField(i)}
                                        />
                                    </div>
                                ))}
                                <Button variant="outline" iconLeft={Plus} onClick={addField} type="button">
                                    Add field
                                </Button>
                            </div>
                        </Field>
                        {err ? <Alert tone="danger">{err}</Alert> : null}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            loading={busy}
                            onClick={create}
                            disabled={busy || !name.trim() || fields.some((f) => !f.name.trim())}
                        >
                            {busy ? 'Creating...' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
