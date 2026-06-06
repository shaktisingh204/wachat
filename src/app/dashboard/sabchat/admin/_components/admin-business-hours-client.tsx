'use client';

import { useState } from 'react';
import { Button, Input, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import { createAdminBusinessHour, deleteAdminBusinessHour } from '@/app/actions/sabchat-admin.actions';

export function AdminBusinessHoursClient({ initialData }: { initialData: any[] }) {
    const [name, setName] = useState('');
    const [timezone, setTimezone] = useState('UTC');
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createAdminBusinessHour({
                name,
                timezone,
                windows: [{ day: 1, open: '09:00', close: '17:00' }], // default Mon 9-5 for demo
            });
            setName('');
            setTimezone('UTC');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure?')) return;
        await deleteAdminBusinessHour(id);
    }

    return (
        <div className="flex flex-col gap-6">
            <form onSubmit={handleCreate} className="flex gap-4 items-end bg-[var(--st-bg-muted)]/50 p-4 rounded-lg border">
                <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Schedule Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Regular Support" />
                </div>
                <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Timezone</label>
                    <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} required placeholder="UTC" />
                </div>
                <Button type="submit" disabled={isSubmitting}>Create Schedule</Button>
            </form>

            <div className="rounded-md border">
                <Table>
                    <THead>
                        <Tr>
                            <Th>ID</Th>
                            <Th>Name</Th>
                            <Th>Timezone</Th>
                            <Th>Windows</Th>
                            <Th className="text-right">Actions</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {initialData.length === 0 ? (
                            <Tr><Td colSpan={5} className="text-center">No business hours found.</Td></Tr>
                        ) : (
                            initialData.map((item) => (
                                <Tr key={item._id}>
                                    <Td className="font-mono text-xs">{item._id}</Td>
                                    <Td>{item.name}</Td>
                                    <Td>{item.timezone}</Td>
                                    <Td>{item.windows?.length ?? 0} window(s)</Td>
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
