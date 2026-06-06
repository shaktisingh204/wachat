'use client';

import { useState } from 'react';
import { Clock, Plus, Trash2 } from 'lucide-react';
import {
    Button,
    Card,
    CardBody,
    EmptyState,
    Field,
    IconButton,
    Input,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    useToast,
} from '@/components/sabcrm/20ui';
import { createAdminSla, deleteAdminSla } from '@/app/actions/sabchat-admin.actions';

export function AdminSlaClient({ initialData }: { initialData: any[] }) {
    const { toast } = useToast();
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
            toast.success('SLA policy created');
        } catch {
            toast.error('Could not create the SLA policy');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure?')) return;
        try {
            await deleteAdminSla(id);
            toast.success('SLA policy deleted');
        } catch {
            toast.error('Could not delete the SLA policy');
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <Card variant="outlined">
                <CardBody>
                    <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
                        <Field label="Policy Name" required className="min-w-48 flex-1">
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="e.g. VIP Customers"
                            />
                        </Field>
                        <Field label="First Response (mins)" required className="min-w-40 flex-1">
                            <Input
                                type="number"
                                value={firstResponseMinutes}
                                onChange={(e) => setFirstResponseMinutes(e.target.value)}
                                required
                            />
                        </Field>
                        <Field label="Resolution (mins)" required className="min-w-40 flex-1">
                            <Input
                                type="number"
                                value={resolutionMinutes}
                                onChange={(e) => setResolutionMinutes(e.target.value)}
                                required
                            />
                        </Field>
                        <Button type="submit" variant="primary" iconLeft={Plus} loading={isSubmitting}>
                            Create SLA
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
                            <Th align="right">First Response (mins)</Th>
                            <Th align="right">Resolution (mins)</Th>
                            <Th align="right">Actions</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {initialData.length === 0 ? (
                            <Tr>
                                <Td colSpan={5}>
                                    <EmptyState
                                        icon={Clock}
                                        title="No SLA policies found"
                                        description="Create your first SLA policy using the form above."
                                    />
                                </Td>
                            </Tr>
                        ) : (
                            initialData.map((item) => (
                                <Tr key={item._id}>
                                    <Td className="font-mono text-xs">{item._id}</Td>
                                    <Td>{item.name}</Td>
                                    <Td align="right">{item.firstResponseMinutes}</Td>
                                    <Td align="right">{item.resolutionMinutes}</Td>
                                    <Td align="right">
                                        <IconButton
                                            label="Delete SLA policy"
                                            icon={Trash2}
                                            variant="danger"
                                            size="sm"
                                            onClick={() => handleDelete(item._id)}
                                        />
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
