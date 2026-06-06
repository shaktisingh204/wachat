'use client';

import { useMemo, useCallback } from 'react';
import { AnnouncementForm } from '../../_components/announcement-form';
import { Card, CardBody, CardHeader, CardTitle, Button, Badge } from '@/components/sabcrm/20ui/compat';
import { FileText, Link as LinkIcon, BarChart3, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { AnnouncementKpis } from '@/app/actions/crm-announcements.actions.types';

export function NewAnnouncementClient({ initialKpis }: { initialKpis: AnnouncementKpis }) {
    const router = useRouter();

    const kpis = useMemo(() => {
        return {
            total: initialKpis?.total || 0,
            active: initialKpis?.activeOrPinned || 0,
            drafts: initialKpis?.drafts || 0,
            recent: initialKpis?.publishedThisMonth || 0,
            engagementRate: initialKpis?.total > 0 ? Math.round((initialKpis.activeOrPinned / initialKpis.total) * 100) : 0
        };
    }, [initialKpis]);

    const handleQuickAction = useCallback((action: string) => {
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
    }, [router]);

    return (
        <div className="flex w-full flex-col gap-6 lg:flex-row">
            <div className="flex-1">
                <AnnouncementForm mode="new" />
            </div>
            <div className="flex w-full flex-col gap-6 lg:w-80">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Summary Dashboard
                        </CardTitle>
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
                            Overview of your current announcements
                        </p>
                    </CardHeader>
                    <CardBody className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-[var(--st-text-secondary)]">Total</span>
                            <Badge variant="secondary">{kpis.total}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-[var(--st-text-secondary)]">Active / Pinned</span>
                            <Badge variant="default">{kpis.active}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-[var(--st-text-secondary)]">Drafts</span>
                            <Badge variant="outline">{kpis.drafts}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-[var(--st-text-secondary)]">Published this month</span>
                            <Badge variant="secondary">{kpis.recent}</Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between rounded-lg bg-[var(--st-bg-muted)] p-3">
                            <span className="text-sm font-medium">Activity Rate</span>
                            <span className="text-sm font-bold text-[var(--st-accent)]">{kpis.engagementRate}%</span>
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <LinkIcon className="h-4 w-4" />
                            Quick Actions
                        </CardTitle>
                    </CardHeader>
                    <CardBody className="flex flex-col gap-2">
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => handleQuickAction('back')}
                        >
                            <FileText className="mr-2 h-4 w-4 text-[var(--st-text-secondary)]" />
                            View all announcements
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => handleQuickAction('drafts')}
                        >
                            <PlusCircle className="mr-2 h-4 w-4 text-[var(--st-text-secondary)]" />
                            Manage drafts
                        </Button>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
