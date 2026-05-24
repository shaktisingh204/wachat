'use client';

import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent } from '@/components/zoruui';
import { BarChart, Users, CheckCircle2, TrendingUp } from 'lucide-react';

export function AnnouncementAnalytics({ entityId }: { entityId: string }) {
    // Simulated analytics
    return (
        <Card>
            <ZoruCardHeader className="flex flex-row items-center justify-between py-3">
                <ZoruCardTitle className="flex items-center gap-2 text-sm font-medium">
                    <BarChart className="h-4 w-4 text-zinc-500" />
                    Reach & Engagement
                </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="pb-4 pt-0">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <Users className="h-4 w-4" />
                            <span>Total Views</span>
                        </div>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">1,248</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Acknowledged</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">892</span>
                            <span className="text-xs text-zinc-500">(71%)</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <TrendingUp className="h-4 w-4" />
                            <span>Click-through</span>
                        </div>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">12%</span>
                    </div>

                    <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div className="bg-emerald-500 w-[71%]" title="Acknowledged"></div>
                            <div className="w-[29%] bg-zinc-300 dark:bg-zinc-600" title="Pending"></div>
                        </div>
                        <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-zinc-500">
                            Engagement Rate
                        </p>
                    </div>
                </div>
            </ZoruCardContent>
        </Card>
    );
}
