'use client';

import { useState, useTransition } from 'react';
import { Button, AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/sabcrm/20ui';
import { Archive, ArchiveRestore, LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { setProjectArchived } from '@/app/actions/admin-hardening.actions';

export function AdminArchiveProjectButton({
    projectId,
    projectName,
    isArchived = false,
}: {
    projectId: string;
    projectName: string;
    isArchived?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleConfirm = () => {
        startTransition(async () => {
            const result = await setProjectArchived(projectId, !isArchived);
            if (result.success) {
                toast({
                    title: isArchived ? 'Project restored' : 'Project archived',
                    description: `"${projectName}" has been ${isArchived ? 'restored' : 'archived'}.`,
                });
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not update the project.',
                    variant: 'destructive',
                });
            }
            setOpen(false);
        });
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(true)}
                aria-label={isArchived ? `Restore ${projectName}` : `Archive ${projectName}`}
                className="text-[var(--st-text)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
            >
                {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </Button>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {isArchived ? 'Restore project?' : 'Archive project?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {isArchived
                            ? `"${projectName}" will reappear in the user's project list and webhook processing will resume.`
                            : `"${projectName}" will be hidden from the user's project list. Webhooks and broadcasts will be paused. This action is reversible.`}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-4">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button
                        variant={isArchived ? 'default' : 'destructive'}
                        onClick={handleConfirm}
                        disabled={isPending}
                    >
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        {isArchived ? 'Restore' : 'Archive'}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
