import { Card, CardBody, CardDescription, CardHeader, CardTitle, Progress } from '@/components/sabcrm/20ui';
import {
  HardDrive } from 'lucide-react';

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
    const pct = quota && quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : null;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                <h1 className="text-xl font-semibold text-[var(--st-text)]">Storage usage</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Cloud storage</CardTitle>
                    <CardDescription>
                        Files uploaded to SabFiles are stored in cloud storage.
                    </CardDescription>
                </CardHeader>
                <CardBody className="flex flex-col gap-3">
                    <div className="flex items-baseline justify-between">
                        <div>
                            <div className="text-2xl font-semibold text-[var(--st-text)]">
                                {fmt(used)}
                            </div>
                            <div className="text-xs text-[var(--st-text-secondary)]">
                                {count} file{count === 1 ? '' : 's'} stored
                            </div>
                        </div>
                        {quota !== undefined && quota !== null && (
                            <div className="text-right text-sm text-[var(--st-text-secondary)]">
                                of {fmt(quota)}
                            </div>
                        )}
                    </div>
                    {pct !== null && <Progress value={pct} />}
                </CardBody>
            </Card>
        </div>
    );
}
