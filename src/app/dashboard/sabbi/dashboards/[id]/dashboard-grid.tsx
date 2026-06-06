'use client';

import * as React from 'react';
import { Card } from '@/components/sabcrm/20ui/compat';
import { WidgetRenderer } from '../_components/widget-renderer';
import type { DashboardWidget, ResolvedWidgetData } from '@/app/actions/crm-dashboards.actions.types';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

gsap.registerPlugin(useGSAP);

interface DashboardGridProps {
    widgets: DashboardWidget[];
    resolvedData: ResolvedWidgetData[];
}

export function DashboardGrid({ widgets, resolvedData }: DashboardGridProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            if (!containerRef.current) return;
            const cards = gsap.utils.toArray('.widget-card');
            if (cards.length > 0) {
                gsap.from(cards, {
                    y: 20,
                    opacity: 0,
                    duration: 0.4,
                    stagger: 0.05,
                    ease: 'power2.out',
                });
            }
        },
        { scope: containerRef, dependencies: [widgets.length] }
    );

    return (
        <div ref={containerRef} className="mt-4 grid grid-cols-12 gap-3">
            {widgets.map((w, i) => {
                const wSpan = Math.max(1, Math.min(12, w.w));
                const hMin = Math.max(1, Math.min(6, w.h)) * 90;
                
                return (
                    <Card
                        key={w.id}
                        className="widget-card overflow-hidden p-0"
                        style={{
                            gridColumn: `span ${wSpan} / span ${wSpan}`,
                            minHeight: `${hMin}px`,
                        }}
                    >
                        <div className="border-b border-[var(--st-border)] px-4 py-2 text-[12.5px] font-medium text-[var(--st-text)] flex items-center justify-between">
                            <span>{w.title}</span>
                        </div>
                        <div className="h-[calc(100%-33px)] min-h-[80px]">
                            <WidgetRenderer widget={w} data={resolvedData[i]} />
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}
