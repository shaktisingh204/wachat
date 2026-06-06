import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { notFound } from 'next/navigation';
import { Card, CardBody } from '@/components/sabcrm/20ui';
import { type DashboardWidget, resolveWidgetData } from '@/app/actions/crm-dashboards.actions';
import React from 'react';
import dynamic from 'next/dynamic';

const DashboardGrid = dynamic(() => import('../dashboard-grid').then((mod) => mod.DashboardGrid), {
    
    loading: () => (
        <div className="mt-4 flex h-64 items-center justify-center text-sm text-[var(--st-text-secondary)]">
            Loading public dashboard widgets...
        </div>
    ),
});

interface PageProps {
    params: Promise<{ id: string }>;
}

function normalizeWidgets(raw: unknown): DashboardWidget[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((w: any, i: number) => {
            if (!w || typeof w !== 'object') return null;
            const ds = w.dataSource ?? w.source ?? {};
            return {
                id: String(w.id ?? `widget_${i}`),
                kind: (w.kind ?? 'metric') as DashboardWidget['kind'],
                title: String(w.title ?? `Widget ${i + 1}`),
                x: Number.isFinite(w.x) ? Number(w.x) : 0,
                y: Number.isFinite(w.y) ? Number(w.y) : i,
                w: Number.isFinite(w.w) ? Number(w.w) : 6,
                h: Number.isFinite(w.h) ? Number(w.h) : 2,
                dataSource: {
                    type: (ds.type ?? 'saved_view') as DashboardWidget['dataSource']['type'],
                    ref: String(ds.ref ?? ds.value ?? ''),
                },
                config:
                    w.config && typeof w.config === 'object' && !Array.isArray(w.config)
                        ? w.config
                        : undefined,
            } as DashboardWidget;
        })
        .filter((w): w is DashboardWidget => !!w)
        .sort((a, b) => a.y - b.y);
}

export default async function PublicDashboardPage({ params }: PageProps) {
    const { id } = await params;
    
    if (!ObjectId.isValid(id)) notFound();
    
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_dashboards').findOne({ _id: new ObjectId(id) });
    
    if (!doc) notFound();
    
    // Check if it's public
    const visibility = doc.visibility ?? doc.sharedWith ?? doc.shareScope;
    if (visibility !== 'public') {
        return (
            <div className="flex h-screen w-full items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardBody className="p-8 text-center">
                        <h2 className="text-lg font-medium text-[var(--st-text)]">Private Dashboard</h2>
                        <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
                            This dashboard is not publicly accessible. The owner must enable public access first.
                        </p>
                    </CardBody>
                </Card>
            </div>
        );
    }
    
    const widgets = normalizeWidgets(doc.widgets);
    const resolved = await Promise.all(widgets.map((w) => resolveWidgetData(w.dataSource)));
    
    return (
        <div className="min-h-screen bg-[var(--st-bg-secondary)] p-6 sm:p-10">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-[var(--st-text)]">{doc.name || 'Public Dashboard'}</h1>
                    {doc.description && (
                        <p className="mt-1 text-sm text-[var(--st-text-secondary)]">{doc.description}</p>
                    )}
                </div>
                
                {widgets.length === 0 ? (
                    <Card>
                        <CardBody className="p-10 text-center text-[13px] text-[var(--st-text-secondary)]">
                            No widgets configured for this dashboard.
                        </CardBody>
                    </Card>
                ) : (
                    <DashboardGrid widgets={widgets} resolvedData={resolved} />
                )}
            </div>
        </div>
    );
}
