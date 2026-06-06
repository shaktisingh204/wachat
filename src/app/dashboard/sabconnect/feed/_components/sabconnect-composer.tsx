'use client';

import { useState, useTransition } from 'react';

import { Paperclip, Send } from 'lucide-react';

import { Button, Card, CardBody, Field, Tag, Textarea, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, useToast } from '@/components/sabcrm/20ui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { createSabConnectPost } from '@/app/actions/sabconnect.actions';
import type { SabConnectGroupDoc } from '@/lib/rust-client/sabconnect-groups';

interface Props {
    groups: SabConnectGroupDoc[];
}

export function SabConnectComposer({ groups }: Props) {
    const { toast } = useToast();
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
                toast.error(res.error);
                return;
            }
            setBody('');
            setAttachments([]);
            toast.success('Update shared with your team.');
        });
    };

    return (
        <Card>
            <CardBody className="flex flex-col gap-3 p-4">
                <Field error={error ?? undefined}>
                    <Textarea
                        aria-label="Share an update"
                        placeholder="Share an update with your team."
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={3}
                    />
                </Field>
                {attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {attachments.map((a) => (
                            <Tag
                                key={a.id}
                                removeLabel={`Remove ${a.name}`}
                                onRemove={() =>
                                    setAttachments((prev) => prev.filter((p) => p.id !== a.id))
                                }
                            >
                                {a.name}
                            </Tag>
                        ))}
                    </div>
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
                            <span className="inline-flex items-center gap-1.5">
                                <Paperclip size={14} aria-hidden="true" />
                                Attach
                            </span>
                        </SabFilePickerButton>
                        <Select value={groupId} onValueChange={setGroupId}>
                            <SelectTrigger className="w-[180px]" aria-label="Post audience">
                                <SelectValue placeholder="Everyone" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Everyone</SelectItem>
                                {groups.map((g) => (
                                    <SelectItem key={g._id} value={g._id}>
                                        {g.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="primary" iconRight={Send} onClick={onSubmit} loading={pending}>
                        {pending ? 'Posting' : 'Post'}
                    </Button>
                </div>
            </CardBody>
        </Card>
    );
}
