'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, CardBody, Input, Label, Textarea, Switch } from '@/components/sabcrm/20ui';

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
                    router.push('/dashboard/sabmonitor/status-pages');
                } else {
                    await createSabmonitorStatusPage(input);
                    router.push('/dashboard/sabmonitor/status-pages');
                }
            } catch (err) {
                window.alert((err as Error).message);
            }
        });
    };

    return (
        <Card className="zoruui">
            <CardBody className="p-4">
                <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="slug">Slug</Label>
                            <Input
                                id="slug"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                required
                                placeholder="acme"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="checkIds">Check IDs (comma-separated)</Label>
                        <Input
                            id="checkIds"
                            value={checkIds}
                            onChange={(e) => setCheckIds(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch
                            id="showUptime"
                            checked={showUptime}
                            onCheckedChange={setShowUptime}
                        />
                        <Label htmlFor="showUptime">Show historical uptime</Label>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="customHeader">Custom header (Markdown)</Label>
                        <Textarea
                            id="customHeader"
                            rows={3}
                            value={customHeader}
                            onChange={(e) => setCustomHeader(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="customCss">Custom CSS</Label>
                        <Textarea
                            id="customCss"
                            rows={4}
                            value={customCss}
                            onChange={(e) => setCustomCss(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={pending}>
                            {pending ? 'Saving…' : initial ? 'Save page' : 'Create page'}
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}
