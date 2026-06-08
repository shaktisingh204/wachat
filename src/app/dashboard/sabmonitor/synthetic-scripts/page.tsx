import * as React from 'react';
import Link from 'next/link';
import { Camera, FileCode2, Plus, PlaySquare } from 'lucide-react';

import {
    Badge,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    EmptyState,
    PageActions,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    StatCard,
    Separator,
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
    const hasItems = res.items.length > 0;
    const withScreenshots = res.items.filter((s) => s.screenshotOnFailure).length;

    return (
        <div className="flex max-w-[1000px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>Synthetic browser scripts</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    {/* 20ui link-as-button: a navigable <a> styled with the
                        u-btn classes, the documented pattern for a Link that
                        looks like a primary Button. */}
                    <Link
                        className="u-btn u-btn--primary u-btn--md"
                        href="/dashboard/sabmonitor/synthetic-scripts/new"
                    >
                        <Plus size={14} aria-hidden="true" />
                        <span className="u-btn__label">New script</span>
                    </Link>
                </PageActions>
            </PageHeader>

            {hasItems && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <StatCard
                        label="Scripts"
                        value={<span className="tabular-nums">{res.items.length}</span>}
                        icon={<PlaySquare aria-hidden="true" />}
                        accent="#3b7af5"
                    />
                    <StatCard
                        label="Capture on failure"
                        value={<span className="tabular-nums">{withScreenshots}</span>}
                        icon={<Camera aria-hidden="true" />}
                        accent="#7c3aed"
                    />
                </div>
            )}

            <Card padding="none">
                <CardHeader className="px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <FileCode2
                            className="h-4 w-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                        />
                        Browser flows
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="p-0">
                    {!hasItems ? (
                        <EmptyState
                            icon={FileCode2}
                            title="No scripts yet"
                            description="Write a synthetic browser script to monitor a critical user flow end to end."
                            action={
                                <Link
                                    className="u-btn u-btn--primary u-btn--md"
                                    href="/dashboard/sabmonitor/synthetic-scripts/new"
                                >
                                    <Plus size={14} aria-hidden="true" />
                                    <span className="u-btn__label">New script</span>
                                </Link>
                            }
                        />
                    ) : (
                        <Table hover>
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
                                                className="font-medium text-[var(--st-text)] transition-colors hover:text-[var(--st-accent)]"
                                                href={`/dashboard/sabmonitor/synthetic-scripts/${s._id}`}
                                            >
                                                {s.name}
                                            </Link>
                                        </Td>
                                        <Td align="right">
                                            {s.screenshotOnFailure ? (
                                                <Badge tone="info" kind="soft">
                                                    <Camera size={11} aria-hidden="true" />
                                                    Screenshot
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
