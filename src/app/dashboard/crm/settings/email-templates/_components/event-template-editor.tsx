'use client';

/**
 * Event template editor — right-hand pane of the settings UI.
 *
 * Renders the editable subject + body for one event, the variable chip
 * sidebar, the preview pane (rendered HTML using example values), and the
 * Save / Test Send / Restore Default actions.
 */

import * as React from 'react';
import { LoaderCircle, RotateCcw, Send, Save, Eye, Code } from 'lucide-react';

import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Textarea, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, useToast } from '@/components/sabcrm/20ui/compat';
import { cn } from '@/components/sabcrm/20ui/compat';

import {
    previewEmailTemplate,
    restoreDefaultTemplate,
    saveEmailTemplate,
    testSendTemplate,
    type EmailTemplateDetail,
} from '@/app/actions/email-templates.actions';

interface EventTemplateEditorProps {
    template: EmailTemplateDetail;
    /** Called after successful save / restore so the parent can refresh state. */
    onPersisted: () => void;
}

type ViewMode = 'edit' | 'preview';

export function EventTemplateEditor({
    template,
    onPersisted,
}: EventTemplateEditorProps): React.JSX.Element {
    const { toast } = useToast();
    const [subject, setSubject] = React.useState(template.subject);
    const [body, setBody] = React.useState(template.body);
    const [viewMode, setViewMode] = React.useState<ViewMode>('edit');
    const [savePending, startSaveTransition] = React.useTransition();
    const [restorePending, startRestoreTransition] = React.useTransition();
    const [testPending, startTestTransition] = React.useTransition();
    const [previewSubject, setPreviewSubject] = React.useState('');
    const [previewHtml, setPreviewHtml] = React.useState('');
    const [previewLoading, setPreviewLoading] = React.useState(false);

    const bodyRef = React.useRef<HTMLTextAreaElement | null>(null);
    const subjectRef = React.useRef<HTMLInputElement | null>(null);
    const lastFocusRef = React.useRef<'subject' | 'body'>('body');

    // Reset local form whenever the parent switches events.
    React.useEffect(() => {
        setSubject(template.subject);
        setBody(template.body);
        setViewMode('edit');
        setPreviewHtml('');
        setPreviewSubject('');
    }, [template.eventKey, template.subject, template.body]);

    const isDirty = subject !== template.subject || body !== template.body;

    const handleInsertVariable = React.useCallback(
        (key: string) => {
            const token = `{{${key}}}`;
            if (lastFocusRef.current === 'subject' && subjectRef.current) {
                const input = subjectRef.current;
                const start = input.selectionStart ?? subject.length;
                const end = input.selectionEnd ?? subject.length;
                const next = subject.slice(0, start) + token + subject.slice(end);
                setSubject(next);
                requestAnimationFrame(() => {
                    input.focus();
                    const cursor = start + token.length;
                    input.setSelectionRange(cursor, cursor);
                });
                return;
            }
            const textarea = bodyRef.current;
            if (!textarea) {
                setBody((b) => b + token);
                return;
            }
            const start = textarea.selectionStart ?? body.length;
            const end = textarea.selectionEnd ?? body.length;
            const next = body.slice(0, start) + token + body.slice(end);
            setBody(next);
            requestAnimationFrame(() => {
                textarea.focus();
                const cursor = start + token.length;
                textarea.setSelectionRange(cursor, cursor);
            });
        },
        [body, subject],
    );

    const handleSave = () => {
        startSaveTransition(async () => {
            const res = await saveEmailTemplate(template.eventKey, subject, body);
            if (res.ok) {
                toast({ title: 'Template saved' });
                onPersisted();
            } else {
                toast({
                    title: 'Could not save template',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const handleRestore = () => {
        startRestoreTransition(async () => {
            const res = await restoreDefaultTemplate(template.eventKey);
            if (res.ok) {
                setSubject(template.default.subject);
                setBody(template.default.body);
                toast({ title: 'Restored to default' });
                onPersisted();
            } else {
                toast({
                    title: 'Could not restore default',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const handleTestSend = () => {
        startTestTransition(async () => {
            const res = await testSendTemplate(template.eventKey, subject, body);
            if (res.ok) {
                toast({
                    title: 'Test email sent',
                    description: 'Check your inbox in a moment.',
                });
            } else {
                toast({
                    title: 'Test send failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const togglePreview = async (next: ViewMode) => {
        if (next === viewMode) return;
        if (next === 'preview') {
            setPreviewLoading(true);
            try {
                const res = await previewEmailTemplate(
                    template.eventKey,
                    subject,
                    body,
                );
                if (res.ok) {
                    setPreviewSubject(res.subject);
                    setPreviewHtml(res.html);
                } else {
                    toast({
                        title: 'Preview failed',
                        description: res.error,
                        variant: 'destructive',
                    });
                    return;
                }
            } finally {
                setPreviewLoading(false);
            }
        }
        setViewMode(next);
    };

    return (
        <Card className="flex h-full flex-col">
            <CardHeader className="border-b border-[var(--st-border)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="truncate">
                                {template.label}
                            </CardTitle>
                            {template.isCustomized ? (
                                <Badge variant="secondary">Customized</Badge>
                            ) : (
                                <Badge variant="outline">Using default</Badge>
                            )}
                        </div>
                        <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
                            {template.description}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-[var(--st-text-tertiary)]">
                            event: {template.eventKey}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 rounded-md border border-[var(--st-border)] p-1">
                        <button
                            type="button"
                            onClick={() => void togglePreview('edit')}
                            className={cn(
                                'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                                viewMode === 'edit'
                                    ? 'bg-[var(--st-text)] text-[var(--st-bg)]'
                                    : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
                            )}
                            aria-pressed={viewMode === 'edit'}
                        >
                            <Code className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                            type="button"
                            onClick={() => void togglePreview('preview')}
                            className={cn(
                                'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                                viewMode === 'preview'
                                    ? 'bg-[var(--st-text)] text-[var(--st-bg)]'
                                    : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
                            )}
                            aria-pressed={viewMode === 'preview'}
                        >
                            {previewLoading ? (
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Eye className="h-3.5 w-3.5" />
                            )}{' '}
                            Preview
                        </button>
                    </div>
                </div>
            </CardHeader>

            <CardBody className="flex flex-1 flex-col gap-4 overflow-hidden pt-4">
                <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_240px]">
                    {/* Form / preview column */}
                    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
                        {viewMode === 'edit' ? (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="email-template-subject">
                                        Subject
                                    </Label>
                                    <Input
                                        id="email-template-subject"
                                        ref={subjectRef}
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        onFocus={() => {
                                            lastFocusRef.current = 'subject';
                                        }}
                                        placeholder="Email subject line"
                                    />
                                </div>
                                <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                                    <Label htmlFor="email-template-body">
                                        HTML body
                                    </Label>
                                    <Textarea
                                        id="email-template-body"
                                        ref={bodyRef}
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        onFocus={() => {
                                            lastFocusRef.current = 'body';
                                        }}
                                        spellCheck={false}
                                        className="min-h-[320px] flex-1 font-mono text-[12.5px] leading-relaxed"
                                    />
                                    <p className="text-[11px] text-[var(--st-text-tertiary)]">
                                        Use{' '}
                                        <code className="rounded bg-[var(--st-bg)] px-1 py-0.5 font-mono">
                                            {'{{variableName}}'}
                                        </code>{' '}
                                        to insert dynamic values. HTML tags such as{' '}
                                        <code className="rounded bg-[var(--st-bg)] px-1 py-0.5 font-mono">
                                            &lt;p&gt;
                                        </code>{' '}
                                        and{' '}
                                        <code className="rounded bg-[var(--st-bg)] px-1 py-0.5 font-mono">
                                            &lt;a href&gt;
                                        </code>{' '}
                                        are supported.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                                <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-3 text-sm">
                                    <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                                        Subject
                                    </p>
                                    <p className="mt-1 font-medium text-[var(--st-text)]">
                                        {previewSubject || '(empty)'}
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto rounded-md border border-[var(--st-border)] bg-white p-5 text-sm text-[var(--st-text)] shadow-inner">
                                    {/*
                                        Preview HTML is generated server-side by `previewEmailTemplate`
                                        which already escapes variable values. The remaining HTML is
                                        template author content and is trusted.
                                    */}
                                    <div
                                        // eslint-disable-next-line react/no-danger
                                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                                    />
                                </div>
                                <p className="text-[11px] text-[var(--st-text-tertiary)]">
                                    Preview uses example values from the variable list.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Variables column */}
                    <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-[var(--st-border)] bg-[var(--st-bg)]/40">
                        <div className="border-b border-[var(--st-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                            Variables
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            <TooltipProvider delayDuration={200}>
                                <ul className="flex flex-col gap-1">
                                    {template.variables.map((v) => (
                                        <li key={v.key}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleInsertVariable(v.key)}
                                                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] font-mono text-[var(--st-text)] hover:bg-[var(--st-bg)]"
                                                    >
                                                        <span className="truncate">{`{{${v.key}}}`}</span>
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent
                                                    side="left"
                                                    className="max-w-[220px]"
                                                >
                                                    <p className="text-[12px] font-medium">
                                                        {v.description}
                                                    </p>
                                                    <p className="mt-0.5 text-[11px] text-[var(--st-text-tertiary)]">
                                                        e.g. {v.example}
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </li>
                                    ))}
                                </ul>
                            </TooltipProvider>
                        </div>
                        <div className="border-t border-[var(--st-border)] px-3 py-2 text-[11px] text-[var(--st-text-tertiary)]">
                            Click a chip to insert at the cursor.
                        </div>
                    </div>
                </div>

                {/* Footer actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--st-border)] pt-3">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={handleRestore}
                            disabled={
                                restorePending || savePending || !template.isCustomized
                            }
                        >
                            {restorePending ? (
                                <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Restore default
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleTestSend}
                            disabled={testPending || savePending}
                        >
                            {testPending ? (
                                <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Send className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Send test to me
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        {isDirty ? (
                            <span className="text-[11px] text-[var(--st-text-tertiary)]">
                                Unsaved changes
                            </span>
                        ) : template.updatedAt ? (
                            <span className="text-[11px] text-[var(--st-text-tertiary)]">
                                Last saved {new Date(template.updatedAt).toLocaleString()}
                            </span>
                        ) : null}
                        <Button
                            onClick={handleSave}
                            disabled={!isDirty || savePending}
                        >
                            {savePending ? (
                                <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Save className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Save changes
                        </Button>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}
