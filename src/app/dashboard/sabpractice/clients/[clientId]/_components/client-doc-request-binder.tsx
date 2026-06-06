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
import { ExternalLink } from 'lucide-react';

import { Badge, Button, useToast } from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import { uploadSabpracticeDocument } from '@/app/actions/sabpractice.actions';

interface Props {
    requestId: string;
    slotIndex: number;
    slotName: string;
    currentStatus?: string;
    currentFileUrl?: string;
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
            <div className="flex items-center gap-2 text-sm text-[var(--st-text)]">
                <span className="font-medium">{slotName}</span>
                {currentStatus ? <Badge>{currentStatus}</Badge> : null}
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

export function NewDocRequestButton({
    clientId,
}: {
    clientId: string;
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, setPending] = React.useState(false);
    return (
        <Button
            variant="outline"
            loading={pending}
            onClick={async () => {
                const title = window.prompt('Document request title');
                if (!title) return;
                setPending(true);
                try {
                    const { requestSabpracticeDocument } = await import(
                        '@/app/actions/sabpractice.actions'
                    );
                    await requestSabpracticeDocument({
                        clientId,
                        title,
                        status: 'requested',
                        requestedFiles: [{ name: title, status: 'pending' }],
                    });
                    toast.success('Document request created.');
                    router.refresh();
                } catch {
                    toast.error('Could not create the request. Please try again.');
                } finally {
                    setPending(false);
                }
            }}
        >
            Request document
        </Button>
    );
}
