'use client';

/**
 * Bind a SabFiles file to a document-request slot.
 *
 * Per project policy, file inputs source from SabFiles ONLY. This component
 * opens a SabFilePickerButton and, on pick, calls the
 * `uploadSabpracticeDocument` server action with the SabFiles fileId.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, FilePlus2 } from 'lucide-react';

import {
    Badge,
    type BadgeTone,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Field,
    Input,
    useToast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import { uploadSabpracticeDocument } from '@/app/actions/sabpractice.actions';

interface Props {
    requestId: string;
    slotIndex: number;
    slotName: string;
    currentStatus?: string;
    currentFileUrl?: string;
}

function slotTone(status?: string): BadgeTone {
    switch (status) {
        case 'uploaded':
        case 'approved':
            return 'success';
        case 'rejected':
            return 'danger';
        default:
            return 'neutral';
    }
}

function cap(s?: string): string {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ClientDocRequestBinder({
    requestId,
    slotIndex,
    slotName,
    currentStatus,
    currentFileUrl,
}: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, setPending] = React.useState(false);

    return (
        <div className="flex items-center justify-between gap-3 py-1">
            <div className="flex min-w-0 items-center gap-2 text-sm text-[var(--st-text)]">
                <span className="truncate font-medium">{slotName}</span>
                {currentStatus ? (
                    <Badge tone={slotTone(currentStatus)}>{cap(currentStatus)}</Badge>
                ) : null}
                {currentFileUrl ? (
                    <a
                        href={currentFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View uploaded file for ${slotName} (opens in a new tab)`}
                        className="inline-flex items-center gap-1 text-xs text-[var(--st-text-secondary)] underline-offset-2 hover:text-[var(--st-text)] hover:underline"
                    >
                        <ExternalLink size={12} aria-hidden="true" />
                        View
                    </a>
                ) : null}
            </div>
            <SabFilePickerButton
                variant="outline"
                onPick={async (pick) => {
                    setPending(true);
                    try {
                        await uploadSabpracticeDocument({
                            requestId,
                            slotIndex,
                            fileId: pick.id,
                            fileUrl: pick.url,
                        });
                        toast.success(`File bound to ${slotName}.`);
                        router.refresh();
                    } catch {
                        toast.error('Could not save the file. Please try again.');
                    } finally {
                        setPending(false);
                    }
                }}
            >
                {pending ? 'Saving' : currentFileUrl ? 'Replace file' : 'Upload via SabFiles'}
            </SabFilePickerButton>
        </div>
    );
}

export function NewDocRequestButton({ clientId }: { clientId: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [due, setDue] = React.useState('');
    const [pending, start] = React.useTransition();

    function submit() {
        if (!title.trim()) return;
        start(async () => {
            try {
                const { requestSabpracticeDocument } = await import(
                    '@/app/actions/sabpractice.actions'
                );
                await requestSabpracticeDocument({
                    clientId,
                    title: title.trim(),
                    status: 'requested',
                    dueDate: due ? new Date(due).toISOString() : undefined,
                    requestedFiles: [{ name: title.trim(), status: 'pending' }],
                });
                toast.success('Document request created.');
                setOpen(false);
                setTitle('');
                setDue('');
                router.refresh();
            } catch {
                toast.error('Could not create the request. Please try again.');
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" iconLeft={FilePlus2}>
                    Request document
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Request a document</DialogTitle>
                    <DialogDescription>
                        The client uploads the file into the bound slot from SabFiles.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <Field label="Title" required>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Bank statement, March 2026"
                            autoFocus
                        />
                    </Field>
                    <Field label="Due date" help="Optional — leave blank for no deadline.">
                        <Input
                            type="date"
                            value={due}
                            onChange={(e) => setDue(e.target.value)}
                        />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={submit}
                        loading={pending}
                        disabled={!title.trim()}
                    >
                        Create request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
