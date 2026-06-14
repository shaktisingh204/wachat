/**
 * SabBI home — the program's showcase / launchpad.
 *
 * One surface that ties the whole BI module together: live counts + a grid of
 * every capability (semantic layer, connectors, explore, query lab, boards,
 * X-ray, copilot, alerts).
 */
import Link from 'next/link';
import {
  Bell,
  Boxes,
  Compass,
  LayoutGrid,
  Plug,
  ScanSearch,
  Sparkles,
  Terminal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  StatCard,
} from '@/components/sabcrm/20ui';
import { listAlertsAction } from '@/app/actions/sabbi-alerts.actions';
import { listBoardsAction } from '@/app/actions/sabbi-boards.actions';
import { listConnectedAction } from '@/app/actions/sabbi-connectors.actions';
import { listModelsAction } from '@/app/actions/sabbi-models.actions';

export const dynamic = 'force-dynamic';

const SURFACES: { href: string; title: string; desc: string; icon: LucideIcon }[] = [
  { href: '/dashboard/sabbi/connectors', title: 'Connectors', desc: 'Connect a module to seed a governed model.', icon: Plug },
  { href: '/dashboard/sabbi/models', title: 'Models & metrics', desc: 'Define measures and dimensions once.', icon: Boxes },
  { href: '/dashboard/sabbi/explore', title: 'Explore', desc: 'Build a query step by step, live.', icon: Compass },
  { href: '/dashboard/sabbi/sql', title: 'Query Lab', desc: 'Raw, governed aggregation power.', icon: Terminal },
  { href: '/dashboard/sabbi/boards', title: 'Boards', desc: 'Cross-filter dashboards.', icon: LayoutGrid },
  { href: '/dashboard/sabbi/xray', title: 'X-ray', desc: 'Auto-generate a dashboard from a model.', icon: ScanSearch },
  { href: '/dashboard/sabbi/copilot', title: 'Copilot', desc: 'Ask in plain English.', icon: Sparkles },
  { href: '/dashboard/sabbi/alerts', title: 'Alerts', desc: 'Get notified when a metric crosses.', icon: Bell },
];

export default async function SabbiHomePage() {
  const [models, connected, boards, alerts] = await Promise.all([
    listModelsAction({ limit: 200 }).then((r) => r.items).catch(() => []),
    listConnectedAction().catch(() => ({})),
    listBoardsAction().catch(() => []),
    listAlertsAction().catch(() => []),
  ]);

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI</PageEyebrow>
          <PageTitle>Business intelligence</PageTitle>
          <PageDescription>
            A governed semantic layer feeding charts, dashboards, embeds, and an
            AI copilot — across every SabNode module.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="grid grid-cols-2 gap-[var(--st-space-4)] sm:grid-cols-4">
        <StatCard label="Models" value={models.length} icon={Boxes} accent="var(--st-accent)" />
        <StatCard label="Connected" value={Object.keys(connected).length} icon={Plug} />
        <StatCard label="Boards" value={boards.length} icon={LayoutGrid} />
        <StatCard label="Alerts" value={alerts.length} icon={Bell} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Everything in SabBI</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2 lg:grid-cols-4">
            {SURFACES.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className="flex flex-col gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] p-4 transition-colors hover:border-[var(--st-accent)]"
                >
                  <Icon size={20} aria-hidden="true" className="text-[var(--st-accent)]" />
                  <span className="font-medium text-[var(--st-text)]">{s.title}</span>
                  <span className="text-sm text-[var(--st-text-secondary)]">{s.desc}</span>
                </Link>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
