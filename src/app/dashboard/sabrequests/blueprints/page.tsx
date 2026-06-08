/**
 * `/dashboard/sabrequests/blueprints` — admin view of every blueprint
 * (published + draft), the templates that drive form-based approval flows.
 */
import * as React from 'react';
import Link from 'next/link';
import {
    LayoutTemplate,
    CheckCircle2,
    PencilRuler,
    Layers,
    Plus,
    Clock,
} from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    StatCard,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';
import { listBlueprints } from '@/app/actions/sabrequests.actions';

export const dynamic = 'force-dynamic';

export default async function BlueprintsListPage() {
    const res = await listBlueprints({ limit: 200 });
    const rows = res.data ?? [];

    const published = rows.filter((b) => b.published).length;
    const drafts = rows.length - published;
    const withSla = rows.filter((b) => b.slaMins).length;

    return (
        <div className="20ui flex flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Requests</PageEyebrow>
                    <PageTitle>Blueprints</PageTitle>
                    <PageDescription>
                        Templates that drive form-based approval workflows. Publish a
                        blueprint to let people submit it.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="primary" asChild>
                        <Link href="/dashboard/sabrequests/blueprints/new">
                            <Plus size={16} aria-hidden="true" />
                            New blueprint
                        </Link>
                    </Button>
                </PageActions>
            </PageHeader>

            <section
                aria-label="Blueprint summary"
                className="grid grid-cols-2 gap-3 md:grid-cols-4"
            >
                <StatCard
                    label="Blueprints"
                    value={rows.length}
                    icon={LayoutTemplate}
                    accent="#7c3aed"
                />
                <StatCard
                    label="Published"
                    value={published}
                    icon={CheckCircle2}
                    accent="#1f9d55"
                />
                <StatCard
                    label="Drafts"
                    value={drafts}
                    icon={PencilRuler}
                    accent="#d97706"
                />
                <StatCard
                    label="With an SLA"
                    value={withSla}
                    icon={Clock}
                    accent="#3b7af5"
                />
            </section>

            <Card padding="none">
                {rows.length === 0 ? (
                    <EmptyState
                        icon={Layers}
                        title="No blueprints yet"
                        description="Create your first blueprint to drive form-based approval workflows."
                        action={
                            <Button variant="primary" asChild>
                                <Link href="/dashboard/sabrequests/blueprints/new">
                                    <Plus size={16} aria-hidden="true" />
                                    New blueprint
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <Table hover>
                        <THead>
                            <Tr>
                                <Th>Name</Th>
                                <Th>Status</Th>
                                <Th>Category</Th>
                                <Th align="right">Stages</Th>
                                <Th align="right">SLA</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {rows.map((b) => (
                                <Tr key={b._id}>
                                    <Td>
                                        <Link
                                            href={`/dashboard/sabrequests/blueprints/${b._id}`}
                                            className="font-medium text-[var(--st-text)] hover:underline focus-visible:outline-none focus-visible:underline"
                                        >
                                            {b.name}
                                        </Link>
                                    </Td>
                                    <Td>
                                        {b.published ? (
                                            <Badge tone="success" dot>
                                                Published
                                            </Badge>
                                        ) : (
                                            <Badge tone="neutral" kind="outline">
                                                Draft
                                            </Badge>
                                        )}
                                    </Td>
                                    <Td>
                                        <span className="text-[var(--st-text-secondary)]">
                                            {b.category ?? 'Uncategorized'}
                                        </span>
                                    </Td>
                                    <Td align="right">
                                        <span className="tabular-nums text-[var(--st-text-secondary)]">
                                            {b.stages?.length ?? 0}
                                        </span>
                                    </Td>
                                    <Td align="right">
                                        <span className="tabular-nums text-[var(--st-text-secondary)]">
                                            {b.slaMins ? `${b.slaMins} min` : 'No SLA'}
                                        </span>
                                    </Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                )}
            </Card>
        </div>
    );
}
