'use client';

/**
 * Bind a SabFiles file to a document-request slot.
 *
 * Per project policy, file inputs source from SabFiles ONLY — this
 * component opens `<SabFilePickerButton>` and on pick calls the
 * `uploadSabpracticeDocument` server action with the SabFiles fileId.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Badge, Button } from '@/components/sabcrm/20ui';
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
    const [pending, setPending] = React.useState(false);

    return (
        <div className="flex items-center justify-between gap-3 py-1">
            <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{slotName}</span>
                {currentStatus ? <Badge>{currentStatus}</Badge> : null}
                {currentFileUrl ? (
                    <a
                        href={currentFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--st-text-secondary)] underline-offset-2 hover:underline"
                    >
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
                        router.refresh();
                    } finally {
                        setPending(false);
                    }
                }}
            >
                {pending ? 'Saving…' : currentFileUrl ? 'Replace file' : 'Upload via SabFiles'}
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
    const [pending, setPending] = React.useState(false);
    return (
        <Button
            variant="outline"
            disabled={pending}
            onClick={async () => {
                setPending(true);
                try {
                    const { requestSabpracticeDocument } = await import(
                        '@/app/actions/sabpractice.actions'
                    );
                    const title = window.prompt('Document request title');
                    if (!title) return;
                    await requestSabpracticeDocument({
                        clientId,
                        title,
                        status: 'requested',
                        requestedFiles: [{ name: title, status: 'pending' }],
                    });
                    router.refresh();
                } finally {
                    setPending(false);
                }
            }}
        >
            {pending ? 'Adding…' : 'Request document'}
        </Button>
    );
}
