'use client';

import { useState } from 'react';
import { Button, Input, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
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
            <form onSubmit={handleCreate} className="flex gap-4 items-end bg-[var(--st-bg-muted)]/50 p-4 rounded-lg border">
                <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Team Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Support L1" />
                </div>
                <Button type="submit" disabled={isSubmitting}>Create Team</Button>
            </form>

            <div className="rounded-md border">
                <Table>
                    <THead>
                        <Tr>
                            <Th>ID</Th>
                            <Th>Name</Th>
                            <Th className="text-right">Actions</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {initialData.length === 0 ? (
                            <Tr><Td colSpan={3} className="text-center">No teams found.</Td></Tr>
                        ) : (
                            initialData.map((item) => (
                                <Tr key={item._id}>
                                    <Td className="font-mono text-xs">{item._id}</Td>
                                    <Td>{item.name}</Td>
                                    <Td className="text-right">
                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(item._id)}>Delete</Button>
                                    </Td>
                                </Tr>
                            ))
                        )}
                    </TBody>
                </Table>
            </div>
        </div>
    );
}
