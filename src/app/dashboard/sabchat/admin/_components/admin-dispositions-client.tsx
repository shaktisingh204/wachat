'use client';

import { useState } from 'react';
import { Plus, Trash2, Inbox } from 'lucide-react';
import {
    Button,
    IconButton,
    Card,
    CardBody,
    Field,
    Input,
    EmptyState,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    useToast,
} from '@/components/sabcrm/20ui';
import { createAdminDisposition, deleteAdminDisposition } from '@/app/actions/sabchat-admin.actions';

export function AdminDispositionsClient({ initialData }: { initialData: any[] }) {
    const { toast } = useToast();
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
            toast.success('Disposition created.');
        } catch {
            toast.error('Could not create disposition.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure?')) return;
        try {
            await deleteAdminDisposition(id);
            toast.success('Disposition deleted.');
        } catch {
            toast.error('Could not delete disposition.');
        }
    }

    return (
        <div className="20ui flex flex-col gap-6">
            <Card padding="md">
                <CardBody>
                    <form onSubmit={handleCreate} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <Field label="Code" className="flex-1">
                            <Input
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                required
                                placeholder="e.g. RESOLVED_DOCS"
                            />
                        </Field>
                        <Field label="Label" className="flex-1">
                            <Input
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                required
                                placeholder="e.g. Resolved via Documentation"
                            />
                        </Field>
                        <Button type="submit" variant="primary" loading={isSubmitting} iconLeft={Plus}>
                            Create Disposition
                        </Button>
                    </form>
                </CardBody>
            </Card>

            {initialData.length === 0 ? (
                <Card padding="lg">
                    <EmptyState
                        icon={Inbox}
                        title="No dispositions found"
                        description="Create your first disposition using the form above."
                    />
                </Card>
            ) : (
                <Card padding="none">
                    <Table>
                        <THead>
                            <Tr>
                                <Th>ID</Th>
                                <Th>Code</Th>
                                <Th>Label</Th>
                                <Th align="right">Actions</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {initialData.map((item) => (
                                <Tr key={item._id}>
                                    <Td className="font-mono text-xs">{item._id}</Td>
                                    <Td>{item.code}</Td>
                                    <Td>{item.label}</Td>
                                    <Td align="right">
                                        <IconButton
                                            label={`Delete ${item.label || item.code}`}
                                            icon={Trash2}
                                            variant="danger"
                                            size="sm"
                                            onClick={() => handleDelete(item._id)}
                                        />
                                    </Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
