'use client';

import { useState } from 'react';
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/zoruui';
import { createAdminTeam, deleteAdminTeam } from '@/app/actions/sabchat-admin.actions';

export function AdminTeamsClient({ initialData }: { initialData: any[] }) {
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createAdminTeam({ name });
            setName('');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure?')) return;
        await deleteAdminTeam(id);
    }

    return (
        <div className="flex flex-col gap-6">
            <form onSubmit={handleCreate} className="flex gap-4 items-end bg-muted/50 p-4 rounded-lg border">
                <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Team Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Support L1" />
                </div>
                <Button type="submit" disabled={isSubmitting}>Create Team</Button>
            </form>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialData.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center">No teams found.</TableCell></TableRow>
                        ) : (
                            initialData.map((item) => (
                                <TableRow key={item._id}>
                                    <TableCell className="font-mono text-xs">{item._id}</TableCell>
                                    <TableCell>{item.name}</TableCell>
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
