'use client';

import Link from 'next/link';
import { Network, ArrowRight } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function OrgChartPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Org Chart"
        subtitle="Visualize your organization's reporting structure."
        icon={Network}
        actions={
          <Link href="/dashboard/crm/hr/directory">
            <ClayButton
              variant="pill"
              trailing={<ArrowRight className="h-4 w-4" strokeWidth={1.75} />}
            >
              View Directory
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="flex flex-col items-start gap-3 p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-clay-md bg-clay-rose-soft">
            <Network
              className="h-6 w-6 text-clay-rose-ink"
              strokeWidth={1.75}
            />
          </div>
          <h3 className="text-[16px] font-semibold text-clay-ink">
            Org chart visualization — coming soon
          </h3>
          <p className="max-w-2xl text-[13px] text-clay-ink-muted">
            We're working on an interactive hierarchy view that maps
            reporting relationships pulled from your employee records. In
            the meantime, explore the read-only directory for a flat view of
            your team.
          </p>
          <Link href="/dashboard/crm/hr/directory">
            <ClayButton
              variant="obsidian"
              trailing={<ArrowRight className="h-4 w-4" strokeWidth={1.75} />}
            >
              Open Directory
            </ClayButton>
          </Link>
        </div>
      </ClayCard>
    </div>
  );
}
