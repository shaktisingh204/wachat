'use client';

import { useState } from 'react';
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/sabcrm/20ui/compat';
import { createAdminSla, deleteAdminSla } from '@/app/actions/sabchat-admin.actions';

export function AdminSlaClient({ initialData }: { initialData: any[] }) {
    const [name, setName] = useState('');
    const [firstResponseMinutes, setFirstResponseMinutes] = useState('15');
    const [resolutionMinutes, setResolutionMinutes] = useState('60');
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createAdminSla({
                name,
                firstResponseMinutes: parseInt(firstResponseMinutes),
                resolutionMinutes: parseInt(resolutionMinutes),
            });
            setName('');
            setFirstResponseMinutes('15');
            setResolutionMinutes('60');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure?')) return;
        await deleteAdminSla(id);
    }

    return (
        <div className="flex flex-col gap-6">
            <form onSubmit={handleCreate} className="flex gap-4 items-end bg-[var(--st-bg-muted)]/50 p-4 rounded-lg border">
                <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Policy Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. VIP Customers" />
                </div>
                <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">First Response (mins)</label>
                    <Input type="number" value={firstResponseMinutes} onChange={(e) => setFirstResponseMinutes(e.target.value)} required />
                </div>
                <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Resolution (mins)</label>
                    <Input type="number" value={resolutionMinutes} onChange={(e) => setResolutionMinutes(e.target.value)} required />
                </div>
                <Button type="submit" disabled={isSubmitting}>Create SLA</Button>
            </form>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>First Response (mins)</TableHead>
                            <TableHead>Resolution (mins)</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialData.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center">No SLA policies found.</TableCell></TableRow>
                        ) : (
                            initialData.map((item) => (
                                <TableRow key={item._id}>
                                    <TableCell className="font-mono text-xs">{item._id}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.firstResponseMinutes}</TableCell>
                                    <TableCell>{item.resolutionMinutes}</TableCell>
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
