'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';

import {
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    Input,
    Label,
    PageHeader,
    ZoruPageTitle,
    ZoruPageDescription,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    EmptyState,
    Badge,
} from '@/components/sabcrm/20ui/compat';

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
            <div className="zoruui p-8 text-sm text-[color:var(--zoru-fg-muted)]">
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
        <div className="zoruui p-8 space-y-6">
            <PageHeader>
                <ZoruPageTitle>{site.name} — Session recordings</ZoruPageTitle>
                <ZoruPageDescription>
                    Replay visitor sessions captured by the snippet.
                </ZoruPageDescription>
            </PageHeader>

            <PagesenseSiteNav siteId={site._id} />

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Filters</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
                        <div className="space-y-2">
                            <Label htmlFor="r-url">URL path</Label>
                            <Input
                                id="r-url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="/"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="r-country">Country</Label>
                            <Input
                                id="r-country"
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                                placeholder="US"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="r-dur">Min duration (s)</Label>
                            <Input
                                id="r-dur"
                                type="number"
                                value={minDuration || ''}
                                onChange={(e) => setMinDuration(Number(e.target.value) || 0)}
                            />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={apply}>Apply</Button>
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>

            {recordings.length === 0 ? (
                <EmptyState
                    title="No recordings yet"
                    description="Once visitors browse a snippet-installed page, recordings will appear here."
                />
            ) : (
                <Card>
                    <ZoruCardContent className="p-0">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Started</ZoruTableHead>
                                    <ZoruTableHead>URL</ZoruTableHead>
                                    <ZoruTableHead>Duration</ZoruTableHead>
                                    <ZoruTableHead>Country</ZoruTableHead>
                                    <ZoruTableHead>Events</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Open</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {recordings.map((r) => (
                                    <ZoruTableRow key={r._id}>
                                        <ZoruTableCell className="font-mono text-xs">
                                            {new Date(r.startedAt).toLocaleString()}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-mono text-xs">
                                            {r.urlPath}
                                        </ZoruTableCell>
                                        <ZoruTableCell>{r.durationSecs}s</ZoruTableCell>
                                        <ZoruTableCell>{r.country || '—'}</ZoruTableCell>
                                        <ZoruTableCell>
                                            <Badge variant={r.eventsFileId ? 'default' : 'secondary'}>
                                                {r.eventsFileId ? 'ready' : 'pending'}
                                            </Badge>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <Link
                                                href={`/dashboard/pagesense/${site._id}/recordings/${r._id}`}
                                            >
                                                <Button size="sm" variant="ghost">
                                                    <Play className="mr-2 h-4 w-4" /> Play
                                                </Button>
                                            </Link>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </Table>
                    </ZoruCardContent>
                </Card>
            )}
        </div>
    );
}
