/**
 * SabCatalyst project console - Overview / Functions / Datastore /
 * Auth / File Store / API Keys / Domains / Usage tabs.
 */
import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    ArrowLeft,
    KeyRound,
    Database,
    Globe,
    HardDrive,
    LayoutDashboard,
    Activity,
    Users,
    Zap,
} from 'lucide-react';

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
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Badge,
    Button,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';

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

const TRIGGERS: { value: string; label: string; icon: React.ElementType }[] = [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard },
    { value: 'functions', label: 'Functions', icon: Zap },
    { value: 'datastore', label: 'Datastore', icon: Database },
    { value: 'auth', label: 'Auth', icon: Users },
    { value: 'files', label: 'File store', icon: HardDrive },
    { value: 'apikeys', label: 'API keys', icon: KeyRound },
    { value: 'domains', label: 'Domains', icon: Globe },
    { value: 'usage', label: 'Usage', icon: Activity },
];

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
        <div className="20ui flex-1 space-y-6 p-4 pt-6 md:p-8">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabCatalyst project</PageEyebrow>
                    <div className="flex items-center gap-2">
                        <PageTitle>{project.name}</PageTitle>
                        <Badge tone={project.status === 'active' ? 'success' : 'neutral'}>
                            {project.status}
                        </Badge>
                    </div>
                    <PageDescription className="font-mono">
                        /api/catalyst/{project.slug}/...
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="ghost" iconLeft={ArrowLeft} asChild>
                        <Link href="/dashboard/sabcatalyst">All projects</Link>
                    </Button>
                </PageActions>
            </PageHeader>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="flex flex-wrap">
                    {TRIGGERS.map(({ value, label, icon: Icon }) => (
                        <TabsTrigger key={value} value={value}>
                            <span className="inline-flex items-center gap-1.5">
                                <Icon size={14} aria-hidden="true" />
                                {label}
                            </span>
                        </TabsTrigger>
                    ))}
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
