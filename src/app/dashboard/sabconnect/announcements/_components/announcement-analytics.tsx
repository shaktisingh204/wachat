'use client';

import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent } from '@/components/zoruui';
import { BarChart, Users, CheckCircle2, TrendingUp } from 'lucide-react';

export function AnnouncementAnalytics({ entityId }: { entityId: string }) {
    // Simulated analytics
    return (
        <Card>
            <ZoruCardHeader className="flex flex-row items-center justify-between py-3">
                <ZoruCardTitle className="flex items-center gap-2 text-sm font-medium">
                    <BarChart className="h-4 w-4 text-zoru-ink" />
                    Reach & Engagement
                </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="pb-4 pt-0">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-zoru-ink dark:text-zoru-ink-muted">
                            <Users className="h-4 w-4" />
                            <span>Total Views</span>
                        </div>
                        <span className="font-medium text-zoru-ink dark:text-white">1,248</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-zoru-ink dark:text-zoru-ink-muted">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Acknowledged</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-zoru-ink dark:text-white">892</span>
                            <span className="text-xs text-zoru-ink">(71%)</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-zoru-ink dark:text-zoru-ink-muted">
                            <TrendingUp className="h-4 w-4" />
                            <span>Click-through</span>
                        </div>
                        <span className="font-medium text-zoru-ink dark:text-white">12%</span>
                    </div>

                    <div className="mt-4 border-t border-zoru-line pt-4 dark:border-zoru-line">
                        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zoru-surface-2 dark:bg-zoru-ink">
                            <div className="bg-zoru-ink w-[71%]" title="Acknowledged"></div>
                            <div className="w-[29%] bg-zoru-surface-2 dark:bg-zoru-ink" title="Pending"></div>
                        </div>
                        <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-zoru-ink">
                            Engagement Rate
                        </p>
                    </div>
                </div>
            </ZoruCardContent>
        </Card>
    );
}
