'use client';

import { Card } from '@/components/zoruui';
import type { PortalKpis } from '@/app/actions/hrm-portal.actions';
import { Users, ClipboardList, CheckCircle2, FileWarning } from 'lucide-react';

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
            accent: 'text-zoru-primary bg-zoru-primary/10',
        },
        {
            label: 'Tasks Assigned to Me',
            value: kpis.pendingTasks,
            icon: <ClipboardList className="h-5 w-5" />,
            accent: 'text-zoru-warning-ink bg-zoru-warning/10',
        },
        {
            label: "Tasks I've Assigned",
            value: kpis.pendingReports,
            icon: <FileWarning className="h-5 w-5" />,
            accent: 'text-zoru-info-ink bg-zoru-info/10',
        },
        {
            label: 'Completed This Week',
            value: kpis.completedThisWeek,
            icon: <CheckCircle2 className="h-5 w-5" />,
            accent: 'text-zoru-success-ink bg-zoru-success/10',
        },
    ];

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
                <ZoruCard key={item.label} className="flex items-center gap-4 p-5">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.accent}`}>
                        {item.icon}
                    </div>
                    <div>
                        <p className="text-[24px] font-bold text-zoru-ink leading-tight">
                            {item.value}
                        </p>
                        <p className="text-[12px] text-zoru-ink-muted">{item.label}</p>
                    </div>
                </ZoruCard>
            ))}
        </div>
    );
}
