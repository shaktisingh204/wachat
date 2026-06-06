/**
 * SabConnect — manuals / wiki list (tree view of top-level pages).
 */

import {
    PageHeader,
    ZoruPageHeading,
    ZoruPageTitle,
    ZoruPageDescription,
    Card,
    CardContent,
    Badge,
    EmptyState,
} from '@/components/sabcrm/20ui/compat';

import { getSabConnectManuals } from '@/app/actions/sabconnect.actions';
import { CreateManualDialog } from './_components/create-manual-dialog';

export const dynamic = 'force-dynamic';

export default async function SabConnectManualsPage() {
    const { items } = await getSabConnectManuals({ limit: 100, parentId: 'root' });

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>Manuals</ZoruPageTitle>
                    <ZoruPageDescription>
                        Living documentation, runbooks and how-tos.
                    </ZoruPageDescription>
                </ZoruPageHeading>
                <CreateManualDialog />
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
                                <CardContent className="flex flex-col gap-2 p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="text-base font-semibold text-zoru-text">
                                            {m.title}
                                        </h3>
                                        <Badge variant={m.published ? 'default' : 'outline'}>
                                            {m.published ? 'Published' : 'Draft'}
                                        </Badge>
                                    </div>
                                    <p className="line-clamp-3 text-sm text-[var(--st-bg-muted)]">{m.body}</p>
                                    <p className="text-xs text-[var(--st-bg-muted)]">v{m.version ?? 1}</p>
                                </CardContent>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
