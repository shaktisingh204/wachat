'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    Field,
    Input,
    Textarea,
    Switch,
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
        <Card>
            <CardHeader>
                <CardTitle>{initial ? 'Edit status page' : 'New status page'}</CardTitle>
                <CardDescription>
                    Configure the public status page slug, title, and the checks it surfaces.
                </CardDescription>
            </CardHeader>
            <CardBody>
                <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                    <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Slug" required>
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
                    </div>
                    <Field label="Check IDs" help="Comma-separated list of check IDs to display.">
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
                    <Field label="Custom header" help="Rendered as Markdown above the checks.">
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
                    <div className="flex justify-end">
                        <Button type="submit" variant="primary" loading={pending}>
                            {initial ? 'Save page' : 'Create page'}
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}
