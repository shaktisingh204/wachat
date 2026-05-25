import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getDashboardById, type DashboardWidget } from '@/app/actions/crm-dashboards.actions';
import { DashboardEditForm } from './edit-form';
import dynamic from 'next/dynamic';

const DashboardEditor = dynamic(
    () => import('../../_components/dashboard-editor').then((mod) => mod.DashboardEditor),
    { }
);

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

export default async function DashboardEditPage({ params }: PageProps) {
    const { id } = await params;
    const d = await getDashboardById(id);
    if (!d) notFound();

    const widgets = normalizeWidgets(d.widgets);

    return (
        <EntityDetailShell
            eyebrow="DASHBOARD"
            title={`Edit · ${d.name || 'dashboard'}`}
            back={{ href: '/dashboard/crm/dashboards', label: 'Dashboards' }}
        >
            <DashboardEditForm dashboard={{ ...d, _id: String(d._id ?? id) }} />
            <section className="space-y-2">
                <h2 className="text-[14px] font-medium text-zoru-ink">Widgets</h2>
                <DashboardEditor dashboardId={String(d._id ?? id)} initialWidgets={widgets} />
            </section>
        </EntityDetailShell>
    );
}
