'use client';

import { Card, CardHeader, CardTitle, CardBody, Progress } from '@/components/sabcrm/20ui';
import { BarChart, Users, CheckCircle2, TrendingUp } from 'lucide-react';

export function AnnouncementAnalytics({ entityId }: { entityId: string }) {
    // Simulated analytics
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <BarChart className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    Reach &amp; Engagement
                </CardTitle>
            </CardHeader>
            <CardBody>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                            <Users className="h-4 w-4" aria-hidden="true" />
                            <span>Total Views</span>
                        </div>
                        <span className="font-medium text-[var(--st-text)]">1,248</span>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            <span>Acknowledged</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--st-text)]">892</span>
                            <span className="text-xs text-[var(--st-text-tertiary)]">(71%)</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                            <TrendingUp className="h-4 w-4" aria-hidden="true" />
                            <span>Click-through</span>
                        </div>
                        <span className="font-medium text-[var(--st-text)]">12%</span>
                    </div>

                    <div className="mt-4 border-t border-[var(--st-border)] pt-4">
                        <Progress value={71} size="sm" aria-label="Engagement rate" />
                        <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-[var(--st-text-tertiary)]">
                            Engagement Rate
                        </p>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}
