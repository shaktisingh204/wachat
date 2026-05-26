import { Button, Card, ZoruCardContent } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

import {
    getDashboardById,
    resolveWidgetData,
    type DashboardWidget,
} from '@/app/actions/crm-dashboards.actions';
import { ShareButton } from '../_components/share-button';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

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

import dynamic from 'next/dynamic';

const DashboardGrid = dynamic(() => import('./dashboard-grid').then((mod) => mod.DashboardGrid), {
    
    loading: () => (
        <div className="mt-4 flex h-64 items-center justify-center text-sm text-zoru-ink-muted">
            Loading widgets...
        </div>
    ),
});

export default async function DashboardDetailPage({ params }: PageProps) {
    const { id } = await params;
    const d = await getDashboardById(id);
    if (!d) notFound();

    const widgets = normalizeWidgets(d.widgets);
    const resolved = await Promise.all(widgets.map((w) => resolveWidgetData(w.dataSource)));

    return (
        <EntityDetailShell
            title={d.name || 'Dashboard'}
            eyebrow="DASHBOARD"
            back={{ href: '/dashboard/sabbi/dashboards', label: 'All dashboards' }}
            actions={
                <div className="flex gap-2">
                    <ShareButton dashboardId={id} visibility={d.visibility ?? d.sharedWith ?? d.shareScope ?? 'private'} />
                <Link href={`/dashboard/sabbi/dashboards/${id}/edit`}>
                    <Button size="sm">Edit dashboard</Button>
                </Link>
                </div>
            }
            audit={<EntityAuditTimeline entityKind="dashboard" entityId={id} />}
        >
            <Card>
                <ZoruCardContent className="space-y-2 p-6 text-sm">
                    <Row label="Description" value={d.description} />
                    <Row label="Layout" value={d.layout} />
                    <Row label="Visibility" value={d.visibility ?? d.sharedWith ?? d.shareScope} />
                    <Row
                        label="Auto-refresh (s)"
                        value={String(d.autoRefreshSeconds ?? d.refreshInterval ?? '—')}
                    />
                    <Row label="Widgets" value={String(widgets.length)} />
                </ZoruCardContent>
            </Card>

            {widgets.length === 0 ? (
                <Card className="mt-4">
                    <ZoruCardContent className="p-10 text-center text-[13px] text-zoru-ink-muted">
                        No widgets yet. Click <span className="text-zoru-ink">Edit dashboard</span> to add some.
                    </ZoruCardContent>
                </Card>
            ) : (
                <DashboardGrid widgets={widgets} resolvedData={resolved} />
            )}
        </EntityDetailShell>
    );
}

function Row({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex items-baseline gap-3">
            <span className="w-40 shrink-0 text-zoru-ink-muted">{label}</span>
            <span className="text-zoru-ink">{value || '—'}</span>
        </div>
    );
}
