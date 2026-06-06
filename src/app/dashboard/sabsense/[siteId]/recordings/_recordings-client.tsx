'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';

import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Input,
    Field,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    EmptyState,
    Badge,
} from '@/components/sabcrm/20ui';

import type { PagesenseSite } from '@/lib/rust-client/pagesense-sites';
import type { Recording } from '@/lib/rust-client/pagesense-recordings';

import { PagesenseSiteNav } from '../_site-nav';

interface Props {
    site: PagesenseSite | null;
    initialUrl: string;
    initialCountry: string;
    initialMinDuration: number;
    recordings: Recording[];
}

export function RecordingsClient({
    site,
    initialUrl,
    initialCountry,
    initialMinDuration,
    recordings,
}: Props) {
    const router = useRouter();
    const [url, setUrl] = useState(initialUrl);
    const [country, setCountry] = useState(initialCountry);
    const [minDuration, setMinDuration] = useState(initialMinDuration);

    if (!site) {
        return (
            <div className="p-8 text-sm text-[color:var(--st-text-secondary)]">
                Site not found.
            </div>
        );
    }

    const apply = () => {
        const sp = new URLSearchParams();
        if (url) sp.set('url', url);
        if (country) sp.set('country', country);
        if (minDuration > 0) sp.set('minDuration', String(minDuration));
        router.push(`?${sp.toString()}`);
    };

    return (
        <div className="p-8 space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>{site.name}, session recordings</PageTitle>
                    <PageDescription>
                        Replay visitor sessions captured by the snippet.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <PagesenseSiteNav siteId={site._id} />

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
                        <Field label="URL path">
                            <Input
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="/"
                            />
                        </Field>
                        <Field label="Country">
                            <Input
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                                placeholder="US"
                            />
                        </Field>
                        <Field label="Min duration (s)">
                            <Input
                                type="number"
                                value={minDuration || ''}
                                onChange={(e) => setMinDuration(Number(e.target.value) || 0)}
                            />
                        </Field>
                        <div className="flex items-end">
                            <Button variant="primary" onClick={apply}>
                                Apply
                            </Button>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {recordings.length === 0 ? (
                <EmptyState
                    icon={Play}
                    title="No recordings yet"
                    description="Once visitors browse a snippet-installed page, recordings will appear here."
                />
            ) : (
                <Card padding="none">
                    <Table>
                        <THead>
                            <Tr>
                                <Th>Started</Th>
                                <Th>URL</Th>
                                <Th>Duration</Th>
                                <Th>Country</Th>
                                <Th>Events</Th>
                                <Th align="right">Open</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {recordings.map((r) => (
                                <Tr key={r._id}>
                                    <Td className="font-mono text-xs">
                                        {new Date(r.startedAt).toLocaleString()}
                                    </Td>
                                    <Td className="font-mono text-xs">{r.urlPath}</Td>
                                    <Td>{r.durationSecs}s</Td>
                                    <Td>{r.country || '-'}</Td>
                                    <Td>
                                        <Badge tone={r.eventsFileId ? 'success' : 'neutral'} dot>
                                            {r.eventsFileId ? 'ready' : 'pending'}
                                        </Badge>
                                    </Td>
                                    <Td align="right">
                                        <Link
                                            href={`/dashboard/pagesense/${site._id}/recordings/${r._id}`}
                                        >
                                            <Button size="sm" variant="ghost" iconLeft={Play}>
                                                Play
                                            </Button>
                                        </Link>
                                    </Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
