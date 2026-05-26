'use client';

import { useState, useTransition } from 'react';

import {
    Button,
    Card,
    CardContent,
    Textarea,
    Badge,
    Select,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSelectContent,
    ZoruSelectItem,
} from '@/components/zoruui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { createSabConnectPost } from '@/app/actions/sabconnect.actions';
import type { SabConnectGroupDoc } from '@/lib/rust-client/sabconnect-groups';

interface Props {
    groups: SabConnectGroupDoc[];
}

export function SabConnectComposer({ groups }: Props) {
    const [body, setBody] = useState('');
    const [attachments, setAttachments] = useState<SabFilePick[]>([]);
    const [groupId, setGroupId] = useState<string>('all');
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const onSubmit = () => {
        if (!body.trim()) {
            setError('Write something to share.');
            return;
        }
        setError(null);
        startTransition(async () => {
            const res = await createSabConnectPost({
                body: body.trim(),
                attachmentIds: attachments.map((f) => f.id),
                groupId: groupId === 'all' ? undefined : groupId,
            });
            if ('error' in res) {
                setError(res.error);
                return;
            }
            setBody('');
            setAttachments([]);
        });
    };

    return (
        <Card>
            <CardContent className="flex flex-col gap-3 p-4">
                <Textarea
                    aria-label="Share an update"
                    placeholder="Share an update with your team…"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={3}
                />
                {attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {attachments.map((a) => (
                            <Badge key={a.id} variant="secondary">
                                {a.name}
                            </Badge>
                        ))}
                    </div>
                ) : null}
                {error ? (
                    <p role="alert" className="text-sm text-zoru-danger">
                        {error}
                    </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <SabFilePickerButton
                            accept="all"
                            onPick={(pick) =>
                                setAttachments((prev) =>
                                    prev.some((p) => p.id === pick.id) ? prev : [...prev, pick],
                                )
                            }
                        >
                            Attach
                        </SabFilePickerButton>
                        <Select value={groupId} onValueChange={setGroupId}>
                            <ZoruSelectTrigger className="w-[180px]" aria-label="Post audience">
                                <ZoruSelectValue placeholder="Everyone" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">Everyone</ZoruSelectItem>
                                {groups.map((g) => (
                                    <ZoruSelectItem key={g._id} value={g._id}>
                                        {g.name}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <Button onClick={onSubmit} disabled={pending}>
                        {pending ? 'Posting…' : 'Post'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
