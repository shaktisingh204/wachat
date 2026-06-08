'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Globe2, ListChecks, Paintbrush } from 'lucide-react';

import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Field,
    Input,
    Textarea,
    Switch,
    Separator,
    useToast,
} from '@/components/sabcrm/20ui';

import {
    createSabmonitorStatusPage,
    updateSabmonitorStatusPage,
} from '@/app/actions/sabmonitor.actions';
import type {
    SabmonitorStatusPageCreateInput,
    SabmonitorStatusPageDoc,
} from '@/lib/rust-client/sabmonitor-status-pages';

export function StatusPageForm({
    initial,
}: {
    initial?: SabmonitorStatusPageDoc;
}): React.JSX.Element {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, startTransition] = useTransition();
    const [slug, setSlug] = React.useState(initial?.slug ?? '');
    const [title, setTitle] = React.useState(initial?.title ?? '');
    const [checkIds, setCheckIds] = React.useState((initial?.checkIds ?? []).join(','));
    const [showUptime, setShowUptime] = React.useState(initial?.showHistoricalUptime ?? true);
    const [customHeader, setCustomHeader] = React.useState(initial?.customHeader ?? '');
    const [customCss, setCustomCss] = React.useState(initial?.customCss ?? '');

    const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        const input: SabmonitorStatusPageCreateInput = {
            slug: slug.trim(),
            title: title.trim(),
            checkIds: checkIds
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            showHistoricalUptime: showUptime,
            customHeader: customHeader.trim() || undefined,
            customCss: customCss.trim() || undefined,
        };
        startTransition(async () => {
            try {
                if (initial?._id) {
                    await updateSabmonitorStatusPage(initial._id, input);
                } else {
                    await createSabmonitorStatusPage(input);
                }
                router.push('/dashboard/sabmonitor/status-pages');
            } catch (err) {
                toast.error((err as Error).message);
            }
        });
    };

    return (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Globe2 className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                        Basics
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="grid gap-3 md:grid-cols-2">
                    <Field
                        label="Slug"
                        required
                        help="Used in the public URL: /uptime/<slug>."
                    >
                        <Input
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            required
                            placeholder="acme"
                        />
                    </Field>
                    <Field label="Title" required>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </Field>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <ListChecks
                            className="h-4 w-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                        />
                        Monitors
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="flex flex-col gap-3">
                    <Field
                        label="Check IDs"
                        help="Comma-separated list of monitor IDs to display."
                    >
                        <Input
                            value={checkIds}
                            onChange={(e) => setCheckIds(e.target.value)}
                        />
                    </Field>
                    <Switch
                        checked={showUptime}
                        onCheckedChange={setShowUptime}
                        label="Show historical uptime"
                    />
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Paintbrush
                            className="h-4 w-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                        />
                        Appearance
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="flex flex-col gap-3">
                    <Field label="Custom header" help="Rendered as Markdown above the monitors.">
                        <Textarea
                            rows={3}
                            value={customHeader}
                            onChange={(e) => setCustomHeader(e.target.value)}
                        />
                    </Field>
                    <Field label="Custom CSS">
                        <Textarea
                            rows={4}
                            value={customCss}
                            onChange={(e) => setCustomCss(e.target.value)}
                        />
                    </Field>
                </CardBody>
            </Card>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--st-border)] bg-[var(--st-bg)] py-3">
                <Button type="submit" variant="primary" loading={pending}>
                    {pending ? 'Saving' : initial ? 'Save page' : 'Create page'}
                </Button>
            </div>
        </form>
    );
}
