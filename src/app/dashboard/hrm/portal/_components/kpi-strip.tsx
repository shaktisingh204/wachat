'use client';

import { Card } from '@/components/sabcrm/20ui/compat';
import { Users, ClipboardList, CheckCircle2, FileWarning } from 'lucide-react';
import type { PortalKpis } from '@/app/actions/hrm-portal.actions.types';

interface KpiStripProps {
    kpis: PortalKpis;
}

interface KpiItem {
    label: string;
    value: number;
    icon: React.ReactNode;
    accent: string;
}

export function KpiStrip({ kpis }: KpiStripProps) {
    const items: KpiItem[] = [
        {
            label: 'My Team',
            value: kpis.teamSize,
            icon: <Users className="h-5 w-5" />,
            accent: 'text-[var(--st-text)] bg-[var(--st-text)]/10',
        },
        {
            label: 'Tasks Assigned to Me',
            value: kpis.pendingTasks,
            icon: <ClipboardList className="h-5 w-5" />,
            accent: 'text-[var(--st-warn)] bg-[var(--st-warn)]/10',
        },
        {
            label: "Tasks I've Assigned",
            value: kpis.pendingReports,
            icon: <FileWarning className="h-5 w-5" />,
            accent: 'text-[var(--st-text-secondary)] bg-[var(--st-text-secondary)]/10',
        },
        {
            label: 'Completed This Week',
            value: kpis.completedThisWeek,
            icon: <CheckCircle2 className="h-5 w-5" />,
            accent: 'text-[var(--st-status-ok)] bg-[var(--st-status-ok)]/10',
        },
    ];

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
                <Card key={item.label} className="flex items-center gap-4 p-5">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.accent}`}>
                        {item.icon}
                    </div>
                    <div>
                        <p className="text-[24px] font-bold text-[var(--st-text)] leading-tight">
                            {item.value}
                        </p>
                        <p className="text-[12px] text-[var(--st-text-secondary)]">{item.label}</p>
                    </div>
                </Card>
            ))}
        </div>
    );
}
