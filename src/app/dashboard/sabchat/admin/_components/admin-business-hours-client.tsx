'use client';

import { useState } from 'react';
import { Plus, Trash2, Clock } from 'lucide-react';
import {
    Button,
    Card,
    CardBody,
    EmptyState,
    Field,
    Input,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    useToast,
} from '@/components/sabcrm/20ui';
import { createAdminBusinessHour, deleteAdminBusinessHour } from '@/app/actions/sabchat-admin.actions';

export function AdminBusinessHoursClient({ initialData }: { initialData: any[] }) {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [timezone, setTimezone] = useState('UTC');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createAdminBusinessHour({
                name,
                timezone,
                windows: [{ day: 1, open: '09:00', close: '17:00' }], // default Mon 9 to 5 for demo
            });
            setName('');
            setTimezone('UTC');
            toast.success('Schedule created');
        } catch {
            toast.error('Could not create the schedule. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this schedule? This cannot be undone.')) return;
        setDeletingId(id);
        try {
            await deleteAdminBusinessHour(id);
            toast.success('Schedule deleted');
        } catch {
            toast.error('Could not delete the schedule. Please try again.');
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <Card variant="outlined" padding="md">
                <CardBody>
                    <form onSubmit={handleCreate} className="flex flex-wrap gap-4 items-end">
                        <Field label="Schedule name" required className="flex-1 min-w-[12rem]">
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Regular Support"
                            />
                        </Field>
                        <Field label="Timezone" required className="flex-1 min-w-[12rem]">
                            <Input
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                                placeholder="UTC"
                            />
                        </Field>
                        <Button type="submit" variant="primary" iconLeft={Plus} loading={isSubmitting}>
                            Create schedule
                        </Button>
                    </form>
                </CardBody>
            </Card>

            <Card variant="outlined" padding="none">
                <Table>
                    <THead>
                        <Tr>
                            <Th>ID</Th>
                            <Th>Name</Th>
                            <Th>Timezone</Th>
                            <Th>Windows</Th>
                            <Th align="right">Actions</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {initialData.length === 0 ? (
                            <Tr>
                                <Td colSpan={5}>
                                    <EmptyState
                                        icon={Clock}
                                        title="No business hours yet"
                                        description="Create a schedule above and it will appear here."
                                    />
                                </Td>
                            </Tr>
                        ) : (
                            initialData.map((item) => (
                                <Tr key={item._id}>
                                    <Td className="font-mono text-xs">{item._id}</Td>
                                    <Td>{item.name}</Td>
                                    <Td>{item.timezone}</Td>
                                    <Td>{item.windows?.length ?? 0} window(s)</Td>
                                    <Td align="right">
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            iconLeft={Trash2}
                                            loading={deletingId === item._id}
                                            onClick={() => handleDelete(item._id)}
                                        >
                                            Delete
                                        </Button>
                                    </Td>
                                </Tr>
                            ))
                        )}
                    </TBody>
                </Table>
            </Card>
        </div>
    );
}
