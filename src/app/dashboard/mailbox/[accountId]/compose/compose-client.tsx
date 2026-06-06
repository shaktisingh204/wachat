'use client';

/**
 * Composer.
 *
 * - to/cc/bcc chip inputs (comma / enter)
 * - subject + body textarea
 * - attachments via <SabFilePickerButton> (multi)
 * - Send + Save draft
 * - Debounced autosave-as-draft after typing pauses
 *
 * Send goes through `sendMailMessage`; when the stub transport returns a
 * synthetic message id we surface "Queued (provider pending)" instead of
 * "Sent".
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip, Save, Send, X } from 'lucide-react';

import {
    saveMailDraft,
    sendMailMessage,
} from '@/app/actions/mailbox.actions';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import {
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Field,
    IconButton,
    Input,
    Textarea,
    useToast,
} from '@/components/sabcrm/20ui';

interface ChipInputProps {
    id: string;
    label: string;
    values: string[];
    onChange: (v: string[]) => void;
}

function ChipInput({ id, label, values, onChange }: ChipInputProps) {
    const [draft, setDraft] = React.useState('');

    const commit = (raw: string) => {
        const v = raw.trim().replace(/,$/, '');
        if (!v) return;
        if (values.includes(v)) {
            setDraft('');
            return;
        }
        onChange([...values, v]);
        setDraft('');
    };

    return (
        <Field label={label} id={id}>
            <div className="flex flex-wrap items-center gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-1.5">
                {values.map((v) => (
                    <Badge key={v} tone="neutral" className="gap-1">
                        {v}
                        <IconButton
                            label={`Remove ${v}`}
                            icon={X}
                            size="sm"
                            onClick={() => onChange(values.filter((x) => x !== v))}
                        />
                    </Badge>
                ))}
                <Input
                    value={draft}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val.endsWith(',')) {
                            commit(val);
                        } else {
                            setDraft(val);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Tab') {
                            if (draft.trim()) {
                                e.preventDefault();
                                commit(draft);
                            }
                        } else if (e.key === 'Backspace' && !draft && values.length) {
                            onChange(values.slice(0, -1));
                        }
                    }}
                    onBlur={() => draft.trim() && commit(draft)}
                    className="min-w-[8rem] flex-1 border-0 bg-transparent px-0 shadow-none focus:ring-0"
                    placeholder="email@example.com"
                />
            </div>
        </Field>
    );
}

export interface ComposeClientProps {
    accountId: string;
    fromAddress: string;
    fromName?: string;
    draftsFolderId: string | null;
    sentFolderId: string | null;
}

export function ComposeClient({
    accountId,
    fromAddress,
    fromName,
    draftsFolderId,
    sentFolderId,
}: ComposeClientProps) {
    const router = useRouter();
    const { toast } = useToast();

    const [to, setTo] = React.useState<string[]>([]);
    const [cc, setCc] = React.useState<string[]>([]);
    const [bcc, setBcc] = React.useState<string[]>([]);
    const [showCc, setShowCc] = React.useState(false);
    const [showBcc, setShowBcc] = React.useState(false);
    const [subject, setSubject] = React.useState('');
    const [body, setBody] = React.useState('');
    const [attachments, setAttachments] = React.useState<SabFilePick[]>([]);
    const [busy, setBusy] = React.useState<'idle' | 'send' | 'draft' | 'autosave'>('idle');
    const [draftId, setDraftId] = React.useState<string | null>(null);

    const lastSavedRef = React.useRef<string>('');

    // Debounced autosave when there's any meaningful content.
    React.useEffect(() => {
        if (!draftsFolderId) return;
        const hasContent =
            to.length || cc.length || bcc.length || subject.trim() || body.trim();
        if (!hasContent) return;
        const snapshot = JSON.stringify({ to, cc, bcc, subject, body, attachments });
        if (snapshot === lastSavedRef.current) return;

        const handle = window.setTimeout(async () => {
            setBusy('autosave');
            const res = await saveMailDraft({
                accountId,
                folderId: draftsFolderId,
                subject: subject || undefined,
                toAddrs: to.map((email) => ({ email })),
                cc: cc.length ? cc.map((email) => ({ email })) : undefined,
                bcc: bcc.length ? bcc.map((email) => ({ email })) : undefined,
                snippet: body.slice(0, 200) || undefined,
                attachmentFileIds: attachments.map((a) => a.id),
            });
            setBusy('idle');
            if (res.ok && res.id) {
                setDraftId(res.id);
                lastSavedRef.current = snapshot;
            }
        }, 1500);
        return () => window.clearTimeout(handle);
    }, [accountId, draftsFolderId, to, cc, bcc, subject, body, attachments]);

    const handleAttach = (p: SabFilePick) => {
        setAttachments((prev) =>
            prev.find((x) => x.id === p.id) ? prev : [...prev, p],
        );
    };

    const handleSaveDraft = async () => {
        if (!draftsFolderId) {
            toast({
                title: 'No drafts folder',
                description: 'Account has no drafts folder yet.',
                tone: 'danger',
            });
            return;
        }
        setBusy('draft');
        const res = await saveMailDraft({
            accountId,
            folderId: draftsFolderId,
            subject: subject || undefined,
            toAddrs: to.map((email) => ({ email })),
            cc: cc.length ? cc.map((email) => ({ email })) : undefined,
            bcc: bcc.length ? bcc.map((email) => ({ email })) : undefined,
            snippet: body.slice(0, 200) || undefined,
            attachmentFileIds: attachments.map((a) => a.id),
        });
        setBusy('idle');
        if (!res.ok) {
            toast({ title: 'Save failed', description: res.error, tone: 'danger' });
            return;
        }
        toast.success('Draft saved');
        if (res.id) setDraftId(res.id);
    };

    const handleSend = async () => {
        if (to.length === 0) {
            toast({
                title: 'Add a recipient',
                description: 'At least one To address is required.',
                tone: 'danger',
            });
            return;
        }
        setBusy('send');
        const res = await sendMailMessage({
            accountId,
            from: { email: fromAddress, name: fromName },
            to: to.map((email) => ({ email })),
            cc: cc.length ? cc.map((email) => ({ email })) : undefined,
            bcc: bcc.length ? bcc.map((email) => ({ email })) : undefined,
            subject: subject || '(no subject)',
            text: body,
            attachmentFileIds: attachments.map((a) => a.id),
        });
        setBusy('idle');
        if (!res.ok) {
            toast({ title: 'Send failed', description: res.error, tone: 'danger' });
            return;
        }
        // Stub transport returns IDs prefixed with `stub-`, surface that.
        if (res.messageId.startsWith('stub-')) {
            toast({
                title: 'Queued (provider pending)',
                description: 'Outbound provider not yet configured. Message stored locally.',
            });
        } else {
            toast({ title: 'Sent', description: `Message id ${res.messageId}` });
        }
        if (sentFolderId) {
            router.push(`/dashboard/mailbox/${accountId}/inbox`);
        }
    };

    const statusLabel: Record<typeof busy, string> = {
        idle: '',
        send: 'Sending...',
        draft: 'Saving...',
        autosave: 'Autosaving...',
    };

    return (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>New message</span>
                        <span className="text-xs font-normal text-[var(--st-text-secondary)]">
                            {statusLabel[busy]}
                            {draftId && busy === 'idle' ? ' Draft saved' : ''}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardBody className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                        <span>From</span>
                        <Badge tone="neutral">
                            {fromName ? `${fromName} <${fromAddress}>` : fromAddress}
                        </Badge>
                    </div>
                    <ChipInput id="to" label="To" values={to} onChange={setTo} />
                    {!showCc && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="self-start"
                            onClick={() => setShowCc(true)}
                        >
                            Add Cc
                        </Button>
                    )}
                    {showCc && <ChipInput id="cc" label="Cc" values={cc} onChange={setCc} />}
                    {!showBcc && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="self-start"
                            onClick={() => setShowBcc(true)}
                        >
                            Add Bcc
                        </Button>
                    )}
                    {showBcc && <ChipInput id="bcc" label="Bcc" values={bcc} onChange={setBcc} />}

                    <Field label="Subject" id="compose-subject">
                        <Input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Subject"
                        />
                    </Field>
                    <Field label="Message" id="compose-body">
                        <Textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Write your message..."
                            rows={12}
                            className="min-h-[16rem]"
                        />
                    </Field>

                    <Field label="Attachments">
                        <div className="flex flex-wrap items-center gap-2">
                            {attachments.map((a) => (
                                <Badge key={a.id} tone="neutral" className="gap-1">
                                    <Paperclip className="h-3 w-3" aria-hidden="true" />
                                    {a.name}
                                    <IconButton
                                        label={`Remove ${a.name}`}
                                        icon={X}
                                        size="sm"
                                        onClick={() =>
                                            setAttachments((prev) =>
                                                prev.filter((x) => x.id !== a.id),
                                            )
                                        }
                                    />
                                </Badge>
                            ))}
                            <SabFilePickerButton onPick={handleAttach} variant="outline">
                                <Paperclip className="mr-1 h-4 w-4" aria-hidden="true" />
                                Attach from SabFiles
                            </SabFilePickerButton>
                        </div>
                    </Field>
                </CardBody>
            </Card>

            <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                    variant="outline"
                    iconLeft={Save}
                    onClick={handleSaveDraft}
                    disabled={busy !== 'idle'}
                >
                    Save draft
                </Button>
                <Button
                    variant="primary"
                    iconLeft={Send}
                    loading={busy === 'send'}
                    onClick={handleSend}
                    disabled={busy !== 'idle' || to.length === 0}
                >
                    {busy === 'send' ? 'Sending...' : 'Send'}
                </Button>
            </div>
        </div>
    );
}
