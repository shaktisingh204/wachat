'use client';

import { useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import {
    Button,
    Badge,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    Field,
    Input,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    EmptyState,
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
    useToast,
} from '@/components/sabcrm/20ui';
import { createAdminTeam, deleteAdminTeam } from '@/app/actions/sabchat-admin.actions';

export function AdminTeamsClient({ initialData }: { initialData: any[] }) {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createAdminTeam({ name });
            setName('');
            toast.success('Team created.');
        } catch {
            toast.error('Could not create the team.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleConfirmDelete() {
        if (!pendingDelete) return;
        setIsDeleting(true);
        try {
            await deleteAdminTeam(pendingDelete.id);
            toast.success('Team deleted.');
            setPendingDelete(null);
        } catch {
            toast.error('Could not delete the team.');
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Create a team</CardTitle>
                    <CardDescription>Group agents to route and manage conversations.</CardDescription>
                </CardHeader>
                <CardBody>
                    <form onSubmit={handleCreate} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <Field label="Team name" required className="flex-1">
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="e.g. Support L1"
                            />
                        </Field>
                        <Button type="submit" variant="primary" iconLeft={Plus} loading={isSubmitting}>
                            Create team
                        </Button>
                    </form>
                </CardBody>
            </Card>

            <Card padding="none">
                {initialData.length === 0 ? (
                    <EmptyState
                        icon={Users}
                        title="No teams yet"
                        description="Create your first team to start organizing your agents."
                    />
                ) : (
                    <Table>
                        <THead>
                            <Tr>
                                <Th>ID</Th>
                                <Th>Name</Th>
                                <Th align="right">Actions</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {initialData.map((item) => (
                                <Tr key={item._id}>
                                    <Td>
                                        <Badge tone="neutral" kind="soft" className="font-mono">
                                            {item._id}
                                        </Badge>
                                    </Td>
                                    <Td>{item.name}</Td>
                                    <Td align="right">
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            iconLeft={Trash2}
                                            onClick={() => setPendingDelete({ id: item._id, name: item.name })}
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

            <AlertDialog
                open={pendingDelete != null}
                onOpenChange={(open) => {
                    if (!open) setPendingDelete(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this team?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDelete
                                ? `This removes "${pendingDelete.name}". You cannot undo this.`
                                : 'You cannot undo this.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep team</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                void handleConfirmDelete();
                            }}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete team'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
