import * as React from 'react';
import Link from 'next/link';
import { Camera, FileCode2, Plus } from 'lucide-react';

import {
    Badge,
    Card,
    CardBody,
    EmptyState,
    PageActions,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
} from '@/components/sabcrm/20ui';

import { listSabmonitorSyntheticScripts } from '@/app/actions/sabmonitor.actions';

export const dynamic = 'force-dynamic';

export default async function SyntheticScriptsPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorSyntheticScripts();

    return (
        <div className="20ui flex flex-col gap-4">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Synthetic browser scripts</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    {/* 20ui link-as-button: a navigable <a> styled with the
                        u-btn classes, the documented pattern for a Link that
                        looks like a primary Button. */}
                    <Link className="u-btn u-btn--primary u-btn--md" href="/dashboard/sabmonitor/synthetic-scripts/new">
                        <Plus size={14} aria-hidden="true" />
                        <span className="u-btn__label">New script</span>
                    </Link>
                </PageActions>
            </PageHeader>

            <Card padding="none">
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <EmptyState
                            icon={FileCode2}
                            title="No scripts yet"
                            description="Create a synthetic browser script to monitor critical user flows."
                            action={
                                <Link
                                    className="u-btn u-btn--primary u-btn--sm"
                                    href="/dashboard/sabmonitor/synthetic-scripts/new"
                                >
                                    <Plus size={13} aria-hidden="true" />
                                    <span className="u-btn__label">New script</span>
                                </Link>
                            }
                        />
                    ) : (
                        <Table density="compact" hover>
                            <THead>
                                <Tr>
                                    <Th>Name</Th>
                                    <Th align="right">On failure</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {res.items.map((s) => (
                                    <Tr key={s._id}>
                                        <Td>
                                            <Link
                                                className="font-medium text-[var(--st-text)] hover:underline"
                                                href={`/dashboard/sabmonitor/synthetic-scripts/${s._id}`}
                                            >
                                                {s.name}
                                            </Link>
                                        </Td>
                                        <Td align="right">
                                            {s.screenshotOnFailure ? (
                                                <Badge tone="info" kind="soft">
                                                    <Camera size={11} aria-hidden="true" />
                                                    Screenshots on failure
                                                </Badge>
                                            ) : (
                                                <Badge tone="neutral" kind="soft">
                                                    None
                                                </Badge>
                                            )}
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
