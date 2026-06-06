'use client';

import { useState } from 'react';
import { Inbox, Trash2 } from 'lucide-react';
import {
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    CardDescription,
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
import { createAdminInbox, deleteAdminInbox } from '@/app/actions/sabchat-admin.actions';

export function AdminInboxesClient({ initialData }: { initialData: any[] }) {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createAdminInbox({ name, channelType: 'website' });
            setName('');
            toast.success('Inbox created');
        } catch {
            toast.error('Could not create the inbox');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure?')) return;
        setDeletingId(id);
        try {
            await deleteAdminInbox(id);
            toast.success('Inbox deleted');
        } catch {
            toast.error('Could not delete the inbox');
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>New inbox</CardTitle>
                    <CardDescription>Create a channel inbox to route incoming conversations.</CardDescription>
                </CardHeader>
                <CardBody>
                    <form onSubmit={handleCreate} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="flex-1">
                            <Field label="Inbox name">
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    placeholder="e.g. Sales Website"
                                />
                            </Field>
                        </div>
                        <Button type="submit" variant="primary" loading={isSubmitting}>
                            Create inbox
                        </Button>
                    </form>
                </CardBody>
            </Card>

            <Card padding="none">
                <Table>
                    <THead>
                        <Tr>
                            <Th>ID</Th>
                            <Th>Name</Th>
                            <Th>Channel type</Th>
                            <Th align="right">Actions</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {initialData.length === 0 ? (
                            <Tr>
                                <Td colSpan={4}>
                                    <EmptyState
                                        icon={Inbox}
                                        title="No inboxes yet"
                                        description="Create your first inbox to start routing conversations."
                                    />
                                </Td>
                            </Tr>
                        ) : (
                            initialData.map((item) => (
                                <Tr key={item._id}>
                                    <Td className="font-mono text-xs text-[var(--st-text-secondary)]">{item._id}</Td>
                                    <Td>{item.name}</Td>
                                    <Td>
                                        <Badge tone="info">{item.channelType}</Badge>
                                    </Td>
                                    <Td align="right">
                                        <IconButton
                                            label="Delete inbox"
                                            icon={Trash2}
                                            variant="danger"
                                            size="sm"
                                            onClick={() => handleDelete(item._id)}
                                            disabled={deletingId === item._id}
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
