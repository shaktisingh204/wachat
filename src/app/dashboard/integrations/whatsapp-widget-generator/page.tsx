'use client';

import { useEffect, useState, useTransition } from 'react';
import { getProjectById } from '@/app/actions/project.actions';
import type { WithId, Project } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { WhatsAppWidgetGenerator } from '@/components/wabasimplify/whatsapp-widget-generator';
import {
  LuEye,
  LuUsers,
  LuChartBar,
  LuRefreshCw,
} from 'react-icons/lu';
import { ClayBreadcrumbs, ClayCard, ClayButton } from '@/components/clay';

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-24 w-full animate-pulse rounded-clay-lg bg-clay-bg-2" />
      <div className="h-80 w-full animate-pulse rounded-clay-lg bg-clay-bg-2" />
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <ClayCard className="flex items-center gap-4 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-clay-bg-2 text-clay-ink-muted">
        {icon}
      </span>
      <div>
        <p className="text-[12px] text-clay-ink-muted">{title}</p>
        <p className="text-[20px] font-semibold tabular-nums text-clay-ink">
          {value.toLocaleString()}
        </p>
      </div>
    </ClayCard>
  );
}

export default function WhatsappWidgetGeneratorPage() {
  const { activeProject } = useProject();
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();

  const fetchProjectData = async () => {
    const id = activeProject?._id?.toString();
    if (id) {
      const data = await getProjectById(id);
      setProject(data);
    }
  };

  useEffect(() => {
    startLoadingTransition(() => {
      fetchProjectData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject]);

  const stats = project?.widgetSettings?.stats || {
    loads: 0,
    opens: 0,
    clicks: 0,
  };

  return (
    <div className="flex h-full w-full flex-col">
      <ClayBreadcrumbs
        items={[
          { label: 'SabNode', href: '/home' },
          { label: 'Wachat', href: '/dashboard' },
          { label: 'Integrations', href: '/dashboard/integrations' },
          { label: 'Widget Generator' },
        ]}
      />

      <div className="mt-5 flex-1 space-y-6">
        {isLoading ? (
          <PageSkeleton />
        ) : !project ? (
          <div className="flex items-center gap-3 rounded-clay-md border border-clay-red/20 bg-red-50 p-4 text-[13px] text-clay-red">
            No project selected. Please select a project from the main
            dashboard.
          </div>
        ) : (
          <>
            {/* Analytics strip */}
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-clay-ink">
                Widget Analytics
              </h2>
              <ClayButton
                variant="pill"
                size="sm"
                leading={
                  <LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
                }
                onClick={() =>
                  startLoadingTransition(() => {
                    fetchProjectData();
                  })
                }
              >
                Refresh
              </ClayButton>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard
                title="Widget Loads"
                value={stats.loads}
                icon={<LuEye className="h-4 w-4" />}
              />
              <StatCard
                title="Chat Opens"
                value={stats.opens}
                icon={<LuUsers className="h-4 w-4" />}
              />
              <StatCard
                title="Clicks to WhatsApp"
                value={stats.clicks}
                icon={<LuChartBar className="h-4 w-4" />}
              />
            </div>

            <WhatsAppWidgetGenerator project={project} />
          </>
        )}
      </div>
    </div>
  );
}
