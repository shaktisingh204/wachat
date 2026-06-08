/**
 * SabConnect manuals / wiki list (tree view of top-level pages).
 */

import { BookOpen, CheckCircle2, FileEdit, FileText } from 'lucide-react';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Card,
    CardBody,
    CardTitle,
    Badge,
    EmptyState,
    StatCard,
} from '@/components/sabcrm/20ui';

import { getSabConnectManuals } from '@/app/actions/sabconnect.actions';
import { CreateManualDialog } from './_components/create-manual-dialog';

export const dynamic = 'force-dynamic';

export default async function SabConnectManualsPage() {
    const { items } = await getSabConnectManuals({ limit: 100, parentId: 'root' });

    const published = items.filter((m) => m.published).length;
    const drafts = items.length - published;

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Connect</PageEyebrow>
                    <PageTitle>Manuals</PageTitle>
                    <PageDescription>
                        Living documentation, runbooks, and how-tos for the whole team.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <CreateManualDialog />
                </PageActions>
            </PageHeader>

            {items.length === 0 ? (
                <Card variant="outlined" className="min-h-[240px]">
                    <EmptyState
                        icon={BookOpen}
                        title="No manuals yet"
                        description="Start your knowledge base by writing the first page."
                        action={<CreateManualDialog />}
                    />
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <StatCard
                            label="Pages"
                            value={items.length}
                            icon={FileText}
                            accent="#3b7af5"
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
                            icon={FileEdit}
                            accent="#d97706"
                        />
                    </div>

                    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {items.map((m) => (
                            <li key={m._id}>
                                <Card className="h-full">
                                    <CardBody className="flex h-full flex-col gap-2 p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <CardTitle className="flex items-center gap-2 text-base">
                                                <span
                                                    className="grid size-7 shrink-0 place-items-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                                                    aria-hidden="true"
                                                >
                                                    <FileText size={15} />
                                                </span>
                                                {m.title}
                                            </CardTitle>
                                            <Badge tone={m.published ? 'success' : 'neutral'}>
                                                {m.published ? 'Published' : 'Draft'}
                                            </Badge>
                                        </div>
                                        <p className="line-clamp-3 text-sm text-[var(--st-text-secondary)]">
                                            {m.body}
                                        </p>
                                        <p className="mt-auto pt-1 text-xs tabular-nums text-[var(--st-text-secondary)]">
                                            Version {m.version ?? 1}
                                        </p>
                                    </CardBody>
                                </Card>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
