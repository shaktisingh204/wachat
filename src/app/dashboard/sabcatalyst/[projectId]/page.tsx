/**
 * SabCatalyst project console — Overview / Functions / Datastore /
 * Auth / File Store / API Keys / Domains / Usage tabs.
 */
import React from 'react';
import { notFound } from 'next/navigation';

import {
    getSabcatalystProject,
    listSabcatalystFunctions,
    listSabcatalystTables,
    listSabcatalystAuthUsers,
    listSabcatalystFiles,
    listSabcatalystApiKeys,
    listSabcatalystDomains,
    getSabcatalystUsage,
} from '@/app/actions/sabcatalyst.actions';
import { Tabs, TabsList, TabsTrigger, TabsContent, Badge } from '@/components/sabcrm/20ui';

import { OverviewTab } from './_components/overview-tab';
import { FunctionsTab } from './_components/functions-tab';
import { DatastoreTab } from './_components/datastore-tab';
import { AuthTab } from './_components/auth-tab';
import { FileStoreTab } from './_components/file-store-tab';
import { ApiKeysTab } from './_components/api-keys-tab';
import { DomainsTab } from './_components/domains-tab';
import { UsageTab } from './_components/usage-tab';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ projectId: string }>;
}

export default async function ProjectConsolePage({ params }: PageProps) {
    const { projectId } = await params;

    const project = await getSabcatalystProject(projectId).catch(() => null);
    if (!project) return notFound();

    // Parallel-fetch everything the tabs need on first paint.
    const [functions, tables, authUsers, files, apiKeys, domains, usage] = await Promise.all([
        listSabcatalystFunctions(projectId).catch(() => ({ items: [] })),
        listSabcatalystTables(projectId).catch(() => ({ items: [] })),
        listSabcatalystAuthUsers(projectId).catch(() => ({ items: [] })),
        listSabcatalystFiles(projectId).catch(() => ({ items: [] })),
        listSabcatalystApiKeys(projectId).catch(() => ({ items: [] })),
        listSabcatalystDomains(projectId).catch(() => ({ items: [] })),
        getSabcatalystUsage(projectId, 'monthly').catch(() => ({ rows: [] })),
    ]);

    return (
        <div className="zoruui flex-1 space-y-6 p-4 md:p-8 pt-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                        <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                            {project.status}
                        </Badge>
                    </div>
                    <p className="text-sm text-[var(--st-text-secondary)] font-mono mt-1">
                        /api/catalyst/{project.slug}/…
                    </p>
                </div>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="flex flex-wrap">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="functions">Functions</TabsTrigger>
                    <TabsTrigger value="datastore">Datastore</TabsTrigger>
                    <TabsTrigger value="auth">Auth</TabsTrigger>
                    <TabsTrigger value="files">File Store</TabsTrigger>
                    <TabsTrigger value="apikeys">API Keys</TabsTrigger>
                    <TabsTrigger value="domains">Domains</TabsTrigger>
                    <TabsTrigger value="usage">Usage</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6">
                    <OverviewTab
                        project={project}
                        counts={{
                            functions: functions.items.length,
                            tables: tables.items.length,
                            authUsers: authUsers.items.length,
                            files: files.items.length,
                            apiKeys: apiKeys.items.length,
                            domains: domains.items.length,
                        }}
                    />
                </TabsContent>

                <TabsContent value="functions" className="mt-6">
                    <FunctionsTab projectId={projectId} initialItems={functions.items} />
                </TabsContent>

                <TabsContent value="datastore" className="mt-6">
                    <DatastoreTab projectId={projectId} initialTables={tables.items} />
                </TabsContent>

                <TabsContent value="auth" className="mt-6">
                    <AuthTab projectId={projectId} initialUsers={authUsers.items} />
                </TabsContent>

                <TabsContent value="files" className="mt-6">
                    <FileStoreTab projectId={projectId} initialFiles={files.items} />
                </TabsContent>

                <TabsContent value="apikeys" className="mt-6">
                    <ApiKeysTab projectId={projectId} initialKeys={apiKeys.items} />
                </TabsContent>

                <TabsContent value="domains" className="mt-6">
                    <DomainsTab projectId={projectId} initialDomains={domains.items} />
                </TabsContent>

                <TabsContent value="usage" className="mt-6">
                    <UsageTab projectId={projectId} initialRows={usage.rows} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
