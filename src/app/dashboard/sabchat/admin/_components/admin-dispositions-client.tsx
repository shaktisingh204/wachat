'use client';

import { useState } from 'react';
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/sabcrm/20ui/compat';
import { createAdminDisposition, deleteAdminDisposition } from '@/app/actions/sabchat-admin.actions';

export function AdminDispositionsClient({ initialData }: { initialData: any[] }) {
    const [code, setCode] = useState('');
    const [label, setLabel] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createAdminDisposition({ code, label });
            setCode('');
            setLabel('');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure?')) return;
        await deleteAdminDisposition(id);
    }

    return (
        <div className="flex flex-col gap-6">
            <form onSubmit={handleCreate} className="flex gap-4 items-end bg-[var(--st-bg-muted)]/50 p-4 rounded-lg border">
                <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Code</label>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="e.g. RESOLVED_DOCS" />
                </div>
                <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Label</label>
                    <Input value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="e.g. Resolved via Documentation" />
                </div>
                <Button type="submit" disabled={isSubmitting}>Create Disposition</Button>
            </form>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Label</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialData.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center">No dispositions found.</TableCell></TableRow>
                        ) : (
                            initialData.map((item) => (
                                <TableRow key={item._id}>
                                    <TableCell className="font-mono text-xs">{item._id}</TableCell>
                                    <TableCell>{item.code}</TableCell>
                                    <TableCell>{item.label}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(item._id)}>Delete</Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
