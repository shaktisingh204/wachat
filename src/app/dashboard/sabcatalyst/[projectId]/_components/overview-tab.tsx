'use client';

/** Overview tab — KPI cards. */
import React from 'react';
import { Card } from '@/components/sabcrm/20ui/compat';
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
        { label: 'Functions deployed', value: counts.functions },
        { label: 'Datastore tables', value: counts.tables },
        { label: 'Auth users', value: counts.authUsers },
        { label: 'File entries', value: counts.files },
        { label: 'API keys', value: counts.apiKeys },
        { label: 'Custom domains', value: counts.domains },
    ];
    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {kpis.map((k) => (
                    <Card key={k.label} className="p-4">
                        <p className="text-xs text-[var(--st-text-secondary)]">{k.label}</p>
                        <p className="text-3xl font-bold mt-2">{k.value}</p>
                    </Card>
                ))}
            </div>
            <Card className="p-4">
                <h3 className="font-semibold mb-3">Project details</h3>
                <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div>
                        <dt className="text-[var(--st-text-secondary)]">Slug</dt>
                        <dd className="font-mono">{project.slug}</dd>
                    </div>
                    <div>
                        <dt className="text-[var(--st-text-secondary)]">Runtime</dt>
                        <dd>{project.runtime}</dd>
                    </div>
                    <div>
                        <dt className="text-[var(--st-text-secondary)]">Status</dt>
                        <dd>{project.status}</dd>
                    </div>
                    <div>
                        <dt className="text-[var(--st-text-secondary)]">Region</dt>
                        <dd>{project.region || '—'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                        <dt className="text-[var(--st-text-secondary)]">Description</dt>
                        <dd>{project.description || '—'}</dd>
                    </div>
                </dl>
            </Card>
        </div>
    );
}
