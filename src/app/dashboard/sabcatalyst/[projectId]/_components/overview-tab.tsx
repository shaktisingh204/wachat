'use client';

/** Overview tab — KPI strip + project details. */
import React from 'react';
import {
    Database,
    FileBox,
    Globe,
    Info,
    KeyRound,
    Users,
    Zap,
} from 'lucide-react';

import {
    Badge,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    StatCard,
} from '@/components/sabcrm/20ui';
import type { SabcatalystProject } from '@/lib/rust-client/sabcatalyst-projects';

interface Props {
    project: SabcatalystProject;
    counts: {
        functions: number;
        tables: number;
        authUsers: number;
        files: number;
        apiKeys: number;
        domains: number;
    };
}

export function OverviewTab({ project, counts }: Props) {
    const kpis = [
        { label: 'Functions deployed', value: counts.functions, icon: Zap, accent: '#3b7af5' },
        { label: 'Datastore tables', value: counts.tables, icon: Database, accent: '#1f9d55' },
        { label: 'Auth users', value: counts.authUsers, icon: Users, accent: '#7c3aed' },
        { label: 'File entries', value: counts.files, icon: FileBox, accent: '#c77700' },
        { label: 'API keys', value: counts.apiKeys, icon: KeyRound, accent: '#0891b2' },
        { label: 'Custom domains', value: counts.domains, icon: Globe, accent: '#e0484e' },
    ];

    const details: { term: string; value: React.ReactNode; mono?: boolean }[] = [
        { term: 'Slug', value: project.slug, mono: true },
        { term: 'Runtime', value: project.runtime },
        {
            term: 'Status',
            value: (
                <Badge tone={project.status === 'active' ? 'success' : 'neutral'}>
                    {project.status}
                </Badge>
            ),
        },
        { term: 'Region', value: project.region || '—' },
        { term: 'Description', value: project.description || '—' },
    ];

    return (
        <div className="space-y-6">
            <section
                aria-label="Resource counts"
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
                {kpis.map((k) => (
                    <StatCard
                        key={k.label}
                        label={k.label}
                        value={k.value}
                        icon={k.icon}
                        accent={k.accent}
                    />
                ))}
            </section>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Info size={16} aria-hidden="true" />
                        <CardTitle>Project details</CardTitle>
                    </div>
                </CardHeader>
                <CardBody>
                    <dl className="divide-y divide-[var(--st-border)]">
                        {details.map((d) => (
                            <div
                                key={d.term}
                                className="grid grid-cols-3 gap-3 py-2.5 text-sm"
                            >
                                <dt className="text-[var(--st-text-secondary)]">{d.term}</dt>
                                <dd
                                    className={
                                        d.mono ? 'col-span-2 font-mono' : 'col-span-2'
                                    }
                                >
                                    {d.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </CardBody>
            </Card>
        </div>
    );
}
