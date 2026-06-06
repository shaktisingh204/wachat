'use client';

/** Datastore tab — table list + simple create form. */
import React from 'react';

import {
    createSabcatalystTable,
    deleteSabcatalystTable,
} from '@/app/actions/sabcatalyst.actions';
import {
    Button,
    Card,
    Input,
    Label,
    EmptyState,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Badge,
} from '@/components/sabcrm/20ui/compat';
import type { SabcatalystTable, TableField } from '@/lib/rust-client/sabcatalyst-tables';

interface Props { projectId: string; initialTables: SabcatalystTable[] }

const TYPES = ['string', 'number', 'boolean', 'datetime', 'json'];

export function DatastoreTab({ projectId, initialTables }: Props) {
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
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : 'Failed');
        } finally {
            setBusy(false);
        }
    }

    async function remove(id: string) {
        if (!confirm('Delete table?')) return;
        await deleteSabcatalystTable(id, projectId);
        setTables((s) => s.filter((x) => x._id !== id));
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
                <Button onClick={() => setOpen(true)}>+ New table</Button>
            </div>
            {tables.length === 0 ? (
                <EmptyState title="No tables yet" description="Datastore tables hold project-scoped records." />
            ) : (
                <div className="space-y-2">
                    {tables.map((t) => (
                        <Card key={t._id} className="p-4 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <h3 className="font-semibold">{t.name}</h3>
                                <p className="text-xs text-[var(--zoru-muted-foreground)] mt-1">
                                    {t.schemaJson.fields.length} fields • {t.recordsCount} records
                                </p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {t.schemaJson.fields.map((f) => (
                                        <Badge key={f.name} variant="outline" className="text-xs">
                                            {f.name}:{f.type}
                                            {f.indexed ? '*' : ''}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <Button variant="destructive" onClick={() => remove(t._id)}>
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
                        <div>
                            <Label htmlFor="tbl-name">Table name</Label>
                            <Input
                                id="tbl-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="customers"
                            />
                        </div>
                        <div>
                            <Label>Fields</Label>
                            <div className="space-y-2 mt-1">
                                {fields.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <Input
                                            value={f.name}
                                            onChange={(e) => updateField(i, { name: e.target.value })}
                                            placeholder="field"
                                            className="flex-1"
                                        />
                                        <select
                                            value={f.type}
                                            onChange={(e) => updateField(i, { type: e.target.value })}
                                            className="bg-[var(--zoru-background)] border border-[var(--zoru-border)] rounded px-2 py-1 text-sm"
                                        >
                                            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <label className="text-xs flex items-center gap-1">
                                            <input
                                                type="checkbox"
                                                checked={!!f.indexed}
                                                onChange={(e) => updateField(i, { indexed: e.target.checked })}
                                            />
                                            indexed
                                        </label>
                                        <Button variant="ghost" onClick={() => removeField(i)}>×</Button>
                                    </div>
                                ))}
                                <Button variant="outline" onClick={addField} type="button">
                                    + Add field
                                </Button>
                            </div>
                        </div>
                        {err ? <p className="text-sm text-[var(--st-text)]">{err}</p> : null}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                            Cancel
                        </Button>
                        <Button
                            onClick={create}
                            disabled={busy || !name.trim() || fields.some((f) => !f.name.trim())}
                        >
                            {busy ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
