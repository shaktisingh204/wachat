'use client';

import { useState } from 'react';
import { Plus, Trash2, MessageSquareText } from 'lucide-react';
import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    EmptyState,
    Field,
    Input,
    Textarea,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    useToast,
} from '@/components/sabcrm/20ui';
import { createAdminMacro, deleteAdminMacro } from '@/app/actions/sabchat-admin.actions';

export function AdminMacrosClient({ initialData }: { initialData: any[] }) {
    const [name, setName] = useState('');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createAdminMacro({ name, content, active: true });
            setName('');
            setContent('');
            toast.success('Macro created.');
        } catch {
            toast.error('Could not create the macro. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure?')) return;
        try {
            await deleteAdminMacro(id);
            toast.success('Macro deleted.');
        } catch {
            toast.error('Could not delete the macro. Please try again.');
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>New macro</CardTitle>
                    <CardDescription>Create a reusable canned reply for agents.</CardDescription>
                </CardHeader>
                <CardBody>
                    <form onSubmit={handleCreate} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <Field label="Macro name" className="flex-1" required>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="e.g. Welcome Message"
                            />
                        </Field>
                        <Field label="Content" className="flex-1" required>
                            <Textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                required
                                rows={2}
                                placeholder="Hello! How can I help you?"
                            />
                        </Field>
                        <Button type="submit" variant="primary" iconLeft={Plus} loading={isSubmitting}>
                            Create Macro
                        </Button>
                    </form>
                </CardBody>
            </Card>

            <Card padding="none">
                {initialData.length === 0 ? (
                    <EmptyState
                        icon={MessageSquareText}
                        title="No macros found"
                        description="Create your first canned reply using the form above."
                    />
                ) : (
                    <Table>
                        <THead>
                            <Tr>
                                <Th>ID</Th>
                                <Th>Name</Th>
                                <Th>Content</Th>
                                <Th align="right">Actions</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {initialData.map((item) => (
                                <Tr key={item._id}>
                                    <Td className="font-mono text-xs">{item._id}</Td>
                                    <Td>{item.name}</Td>
                                    <Td truncate className="max-w-[200px]">{item.content}</Td>
                                    <Td align="right">
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            iconLeft={Trash2}
                                            onClick={() => handleDelete(item._id)}
                                        >
                                            Delete
                                        </Button>
                                    </Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                )}
            </Card>
        </div>
    );
}
