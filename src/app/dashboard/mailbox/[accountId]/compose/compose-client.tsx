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
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    Input,
    Label,
    Textarea,
    Badge,
    useZoruToast,
} from '@/components/zoruui';

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
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-zoru-line bg-zoru-bg px-2 py-1.5">
                {values.map((v) => (
                    <Badge key={v} variant="secondary" className="gap-1">
                        {v}
                        <button
                            type="button"
                            aria-label={`Remove ${v}`}
                            onClick={() => onChange(values.filter((x) => x !== v))}
                            className="ml-0.5 hover:text-zoru-ink"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}
                <input
                    id={id}
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
                    className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-zoru-ink-muted"
                    placeholder="email@example.com"
                />
            </div>
        </div>
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
    const { toast } = useZoruToast();

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
                description: 'Account has no `drafts` folder yet.',
                variant: 'destructive',
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
            toast({ title: 'Save failed', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: 'Draft saved' });
        if (res.id) setDraftId(res.id);
    };

    const handleSend = async () => {
        if (to.length === 0) {
            toast({
                title: 'Add a recipient',
                description: 'At least one To address is required.',
                variant: 'destructive',
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
            toast({ title: 'Send failed', description: res.error, variant: 'destructive' });
            return;
        }
        // Stub transport returns IDs prefixed with `stub-` — surface that.
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
        send: 'Sending…',
        draft: 'Saving…',
        autosave: 'Autosaving…',
    };

    return (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center justify-between">
                        <span>New message</span>
                        <span className="text-xs font-normal text-zoru-ink-muted">
                            {statusLabel[busy]}
                            {draftId && busy === 'idle' ? ' Draft saved' : ''}
                        </span>
                    </ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zoru-ink-muted">
                        <span>From</span>
                        <Badge variant="secondary">
                            {fromName ? `${fromName} <${fromAddress}>` : fromAddress}
                        </Badge>
                    </div>
                    <ChipInput id="to" label="To" values={to} onChange={setTo} />
                    {!showCc && (
                        <button
                            type="button"
                            className="self-start text-xs text-zoru-ink-muted hover:text-zoru-ink"
                            onClick={() => setShowCc(true)}
                        >
                            + Add Cc
                        </button>
                    )}
                    {showCc && <ChipInput id="cc" label="Cc" values={cc} onChange={setCc} />}
                    {!showBcc && (
                        <button
                            type="button"
                            className="self-start text-xs text-zoru-ink-muted hover:text-zoru-ink"
                            onClick={() => setShowBcc(true)}
                        >
                            + Add Bcc
                        </button>
                    )}
                    {showBcc && <ChipInput id="bcc" label="Bcc" values={bcc} onChange={setBcc} />}

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="compose-subject">Subject</Label>
                        <Input
                            id="compose-subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Subject"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="compose-body">Message</Label>
                        <Textarea
                            id="compose-body"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Write your message…"
                            rows={12}
                            className="min-h-[16rem]"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Attachments</Label>
                        <div className="flex flex-wrap items-center gap-2">
                            {attachments.map((a) => (
                                <Badge key={a.id} variant="secondary" className="gap-1">
                                    <Paperclip className="h-3 w-3" />
                                    {a.name}
                                    <button
                                        type="button"
                                        aria-label={`Remove ${a.name}`}
                                        onClick={() =>
                                            setAttachments((prev) =>
                                                prev.filter((x) => x.id !== a.id),
                                            )
                                        }
                                        className="ml-0.5 hover:text-zoru-ink"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                            <SabFilePickerButton onPick={handleAttach} variant="outline">
                                <Paperclip className="mr-1 h-4 w-4" />
                                Attach from SabFiles
                            </SabFilePickerButton>
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>

            <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={busy !== 'idle'}
                >
                    <Save className="mr-2 h-4 w-4" />
                    Save draft
                </Button>
                <Button
                    type="button"
                    onClick={handleSend}
                    disabled={busy !== 'idle' || to.length === 0}
                >
                    <Send className="mr-2 h-4 w-4" />
                    {busy === 'send' ? 'Sending…' : 'Send'}
                </Button>
            </div>
        </div>
    );
}
