import { Card, ZoruCardContent, ZoruCardDescription, ZoruCardHeader, ZoruCardTitle, Progress } from '@/components/zoruui';
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
                <h1 className="text-xl font-semibold text-zoru-ink">Storage usage</h1>
            </div>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Cloud storage</ZoruCardTitle>
                    <ZoruCardDescription>
                        Files uploaded to SabFiles are stored in cloud storage.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-3">
                    <div className="flex items-baseline justify-between">
                        <div>
                            <div className="text-2xl font-semibold text-zoru-ink">
                                {fmt(used)}
                            </div>
                            <div className="text-xs text-zoru-ink-muted">
                                {count} file{count === 1 ? '' : 's'} stored
                            </div>
                        </div>
                        {quota !== undefined && quota !== null && (
                            <div className="text-right text-sm text-zoru-ink-muted">
                                of {fmt(quota)}
                            </div>
                        )}
                    </div>
                    {pct !== null && <ZoruProgress value={pct} />}
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
