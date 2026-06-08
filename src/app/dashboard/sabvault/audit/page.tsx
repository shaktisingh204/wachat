import * as React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

import {
    Button,
    Card,
    Badge,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
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
import { listSabvaultAudit } from '@/app/actions/sabvault.actions';
import type { SabvaultAuditAction } from '@/lib/rust-client/sabvault-audit';

export const dynamic = 'force-dynamic';

type FilterValue = SabvaultAuditAction | undefined;

const ACTION_TONE: Record<string, React.ComponentProps<typeof Badge>['tone']> = {
    reveal: 'info',
    copy: 'neutral',
    share: 'accent',
    unlock_fail: 'danger',
};

export default async function SabvaultAuditPage(props: {
    searchParams: Promise<{ action?: string; secretId?: string; page?: string }>;
}) {
    const sp = await props.searchParams;
    const page = Math.max(0, Number(sp.page) || 0);
    const res = await listSabvaultAudit({
        action: sp.action as SabvaultAuditAction | undefined,
        secretId: sp.secretId,
        page,
        limit: 50,
    });

    return (
        <div className="20ui mx-auto flex max-w-5xl flex-col gap-4 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabVault</PageEyebrow>
                    <PageTitle>Audit log</PageTitle>
                    <PageDescription>
                        Every reveal, copy, share, and failed unlock recorded across your vault.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link href="/dashboard/sabvault">
                        <Button variant="outline">Back to vault</Button>
                    </Link>
                </PageActions>
            </PageHeader>

            <div className="flex flex-wrap gap-2">
                <FilterChip current={sp.action} value={undefined} label="All" />
                <FilterChip current={sp.action} value="reveal" label="Reveals" />
                <FilterChip current={sp.action} value="copy" label="Copies" />
                <FilterChip current={sp.action} value="share" label="Shares" />
                <FilterChip current={sp.action} value="unlock_fail" label="Failed unlocks" />
            </div>

            <Card padding="none">
                {res.items.length === 0 ? (
                    <div className="p-6">
                        <EmptyState
                            icon={ShieldCheck}
                            title="No events"
                            description="Audit events show up here as you use the vault."
                        />
                    </div>
                ) : (
                    <Table>
                        <THead>
                            <Tr>
                                <Th>Time</Th>
                                <Th>Action</Th>
                                <Th>Actor</Th>
                                <Th>Secret</Th>
                                <Th>IP</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {res.items.map((e) => (
                                <Tr key={e._id}>
                                    <Td className="font-mono text-xs">
                                        {new Date(e.ts).toLocaleString()}
                                    </Td>
                                    <Td>
                                        <Badge tone={ACTION_TONE[e.action] ?? 'neutral'}>
                                            {e.action}
                                        </Badge>
                                    </Td>
                                    <Td className="font-mono text-xs">{e.actorUserId}</Td>
                                    <Td className="font-mono text-xs">{e.secretId ?? '-'}</Td>
                                    <Td className="text-xs">{e.ip ?? '-'}</Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                )}
            </Card>

            {res.hasMore ? (
                <div className="flex justify-end">
                    <Link
                        href={`/dashboard/sabvault/audit?page=${page + 1}${sp.action ? `&action=${sp.action}` : ''}`}
                    >
                        <Button variant="outline">Next page</Button>
                    </Link>
                </div>
            ) : null}
        </div>
    );
}

function FilterChip({
    current,
    value,
    label,
}: {
    current?: string;
    value?: FilterValue;
    label: string;
}) {
    const active = (current ?? undefined) === value;
    const href = value
        ? `/dashboard/sabvault/audit?action=${value}`
        : '/dashboard/sabvault/audit';
    return (
        <Link href={href}>
            <Button variant={active ? 'secondary' : 'ghost'} size="sm">
                {label}
            </Button>
        </Link>
    );
}
