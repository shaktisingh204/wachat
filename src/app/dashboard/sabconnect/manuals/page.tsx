/**
 * SabConnect manuals / wiki list (tree view of top-level pages).
 */

import {
    PageHeader,
    PageHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Card,
    CardBody,
    CardTitle,
    Badge,
    EmptyState,
} from '@/components/sabcrm/20ui';

import { getSabConnectManuals } from '@/app/actions/sabconnect.actions';
import { CreateManualDialog } from './_components/create-manual-dialog';

export const dynamic = 'force-dynamic';

export default async function SabConnectManualsPage() {
    const { items } = await getSabConnectManuals({ limit: 100, parentId: 'root' });

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <PageHeading>
                    <PageTitle>Manuals</PageTitle>
                    <PageDescription>
                        Living documentation, runbooks and how-tos.
                    </PageDescription>
                </PageHeading>
                <PageActions>
                    <CreateManualDialog />
                </PageActions>
            </PageHeader>

            {items.length === 0 ? (
                <EmptyState
                    title="No manuals yet"
                    description="Start your knowledge base with the first page."
                />
            ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {items.map((m) => (
                        <li key={m._id}>
                            <Card>
                                <CardBody className="flex flex-col gap-2 p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-base font-semibold text-[var(--st-text)]">
                                            {m.title}
                                        </CardTitle>
                                        <Badge tone={m.published ? 'success' : 'neutral'}>
                                            {m.published ? 'Published' : 'Draft'}
                                        </Badge>
                                    </div>
                                    <p className="line-clamp-3 text-sm text-[var(--st-text-secondary)]">
                                        {m.body}
                                    </p>
                                    <p className="text-xs text-[var(--st-text-secondary)]">
                                        v{m.version ?? 1}
                                    </p>
                                </CardBody>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
