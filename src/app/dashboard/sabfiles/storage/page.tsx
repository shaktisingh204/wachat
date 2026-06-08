import {
    Badge,
    Card,
    CardBody,
    CardDescription,
    CardHeader,
    CardTitle,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Progress,
    StatCard,
} from '@/components/sabcrm/20ui';
import { Database, File as FileIcon, HardDrive, Infinity as InfinityIcon } from 'lucide-react';

import { getStorageUsage } from '@/app/actions/sabfiles.actions';

function fmt(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const u = ['KB', 'MB', 'GB', 'TB'];
    let v = bytes / 1024;
    let i = 0;
    while (v >= 1024 && i < u.length - 1) {
        v /= 1024;
        i += 1;
    }
    return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

export default async function SabFilesStoragePage() {
    const usage = await getStorageUsage();
    const used = usage.used ?? 0;
    const count = usage.count ?? 0;
    const quota = 'quota' in usage ? usage.quota : undefined;
    const hasQuota = quota !== undefined && quota !== null && quota > 0;
    const pct = hasQuota ? Math.min(100, Math.round((used / quota!) * 100)) : null;
    const free = hasQuota ? Math.max(0, quota! - used) : null;
    const nearLimit = pct !== null && pct >= 90;

    return (
        <div className="flex flex-col gap-[var(--st-space-5)]">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabFiles</PageEyebrow>
                    <PageTitle>Storage usage</PageTitle>
                    <PageDescription>
                        Track how much cloud storage your uploaded files are using.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-3">
                <StatCard
                    label="Storage used"
                    value={fmt(used)}
                    icon={<HardDrive size={16} aria-hidden="true" />}
                />
                <StatCard
                    label="Files stored"
                    value={count}
                    icon={<FileIcon size={16} aria-hidden="true" />}
                />
                <StatCard
                    label={hasQuota ? 'Free space' : 'Quota'}
                    value={hasQuota ? fmt(free!) : 'Unlimited'}
                    icon={
                        hasQuota ? (
                            <Database size={16} aria-hidden="true" />
                        ) : (
                            <InfinityIcon size={16} aria-hidden="true" />
                        )
                    }
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database size={16} aria-hidden="true" />
                        Cloud storage
                        {nearLimit ? (
                            <Badge tone="warning" kind="soft">
                                Almost full
                            </Badge>
                        ) : null}
                    </CardTitle>
                    <CardDescription>
                        Files uploaded to SabFiles are stored in cloud storage.
                    </CardDescription>
                </CardHeader>
                <CardBody className="flex flex-col gap-[var(--st-space-3)]">
                    <div className="flex items-baseline justify-between">
                        <div>
                            <div className="text-2xl font-semibold text-[var(--st-text)]">{fmt(used)}</div>
                            <div className="text-xs text-[var(--st-text-secondary)]">
                                {count} file{count === 1 ? '' : 's'} stored
                            </div>
                        </div>
                        {hasQuota ? (
                            <div className="text-right text-sm text-[var(--st-text-secondary)]">
                                of {fmt(quota!)}
                            </div>
                        ) : null}
                    </div>
                    {pct !== null ? (
                        <>
                            <Progress
                                value={pct}
                                tone={nearLimit ? 'warning' : 'accent'}
                                aria-label="Storage usage"
                            />
                            <p className="text-xs text-[var(--st-text-secondary)]">
                                {pct}% used · {fmt(free!)} free
                            </p>
                        </>
                    ) : (
                        <p className="text-xs text-[var(--st-text-secondary)]">
                            No storage limit is currently applied to your account.
                        </p>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
