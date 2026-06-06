/**
 * `/dashboard/requests/blueprints` - admin view of all blueprints
 * (published + draft).
 */
import * as React from 'react';
import Link from 'next/link';

import {
    Button,
    Card,
    Badge,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';
import { FileText } from 'lucide-react';
import { listBlueprints } from '@/app/actions/sabrequests.actions';

export const dynamic = 'force-dynamic';

export default async function BlueprintsListPage() {
    const res = await listBlueprints({ limit: 200 });
    const rows = res.data ?? [];
    return (
        <div className="ui20 flex flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Blueprints</PageTitle>
                    <PageDescription>
                        Templates that drive form-based approval workflows.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="primary">
                        <Link href="/dashboard/requests/blueprints/new">
                            New blueprint
                        </Link>
                    </Button>
                </PageActions>
            </PageHeader>
            <Card padding="none">
                {rows.length === 0 ? (
                    <EmptyState
                        icon={FileText}
                        title="No blueprints yet"
                        description="Create your first blueprint to drive form-based approval workflows."
                        action={
                            <Button variant="primary">
                                <Link href="/dashboard/requests/blueprints/new">
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
                                            href={`/dashboard/requests/blueprints/${b._id}`}
                                            className="font-medium text-[var(--st-text)] hover:underline"
                                        >
                                            {b.name}
                                        </Link>
                                    </Td>
                                    <Td>
                                        {b.published ? (
                                            <Badge tone="success">Published</Badge>
                                        ) : (
                                            <Badge tone="neutral">Draft</Badge>
                                        )}
                                    </Td>
                                    <Td>
                                        <span className="text-[var(--st-text-secondary)]">
                                            {b.category ?? 'Uncategorized'}
                                        </span>
                                    </Td>
                                    <Td align="right">
                                        <span className="text-[var(--st-text-secondary)]">
                                            {b.stages?.length ?? 0}
                                        </span>
                                    </Td>
                                    <Td align="right">
                                        <span className="text-[var(--st-text-secondary)]">
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
