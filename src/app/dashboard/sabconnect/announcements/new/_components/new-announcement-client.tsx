'use client';

import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, FileText, Link as LinkIcon, PlusCircle } from 'lucide-react';
import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    CardDescription,
    Button,
    StatCard,
} from '@/components/sabcrm/20ui';
import { AnnouncementForm } from '../../_components/announcement-form';
import type { AnnouncementKpis } from '@/app/actions/crm-announcements.actions.types';

export function NewAnnouncementClient({ initialKpis }: { initialKpis: AnnouncementKpis }) {
    const router = useRouter();

    const kpis = useMemo(() => {
        return {
            total: initialKpis?.total || 0,
            active: initialKpis?.activeOrPinned || 0,
            drafts: initialKpis?.drafts || 0,
            recent: initialKpis?.publishedThisMonth || 0,
            engagementRate:
                initialKpis?.total > 0
                    ? Math.round((initialKpis.activeOrPinned / initialKpis.total) * 100)
                    : 0,
        };
    }, [initialKpis]);

    const handleQuickAction = useCallback(
        (action: string) => {
            switch (action) {
                case 'back':
                    router.push('/dashboard/sabconnect/announcements');
                    break;
                case 'drafts':
                    router.push('/dashboard/sabconnect/announcements?status=draft');
                    break;
                default:
                    break;
            }
        },
        [router],
    );

    return (
        <div className="flex w-full flex-col gap-6 lg:flex-row">
            <div className="flex-1">
                <AnnouncementForm mode="new" />
            </div>
            <div className="flex w-full flex-col gap-6 lg:w-80">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" aria-hidden="true" />
                            Summary Dashboard
                        </CardTitle>
                        <CardDescription>Overview of your current announcements</CardDescription>
                    </CardHeader>
                    <CardBody className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard label="Total" value={kpis.total} />
                            <StatCard label="Active / Pinned" value={kpis.active} />
                            <StatCard label="Drafts" value={kpis.drafts} />
                            <StatCard label="Published this month" value={kpis.recent} />
                        </div>
                        <div className="flex items-center justify-between rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-3">
                            <span className="text-sm font-medium text-[var(--st-text)]">Activity Rate</span>
                            <span className="text-sm font-bold text-[var(--st-accent)]">
                                {kpis.engagementRate}%
                            </span>
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <LinkIcon className="h-4 w-4" aria-hidden="true" />
                            Quick Actions
                        </CardTitle>
                    </CardHeader>
                    <CardBody className="flex flex-col gap-2">
                        <Button
                            variant="outline"
                            block
                            iconLeft={FileText}
                            className="justify-start"
                            onClick={() => handleQuickAction('back')}
                        >
                            View all announcements
                        </Button>
                        <Button
                            variant="outline"
                            block
                            iconLeft={PlusCircle}
                            className="justify-start"
                            onClick={() => handleQuickAction('drafts')}
                        >
                            Manage drafts
                        </Button>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
