'use client';

import {
  Alert,
  Button,
  Skeleton,
  StatCard,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { BarChart3,
  Eye,
  RefreshCw,
  Users } from 'lucide-react';
import type { WithId,
  Project } from '@/lib/definitions';

import { getProjectById } from '@/app/actions/project.actions';
import { getWidgetStats } from '@/app/actions/wachat-widget-tracking.actions';
import type { WidgetStats } from '@/lib/rust-client/wachat-widget-tracking';
import { useProject } from '@/context/project-context';
import { WhatsAppWidgetGenerator } from '@/components/zoruui-domain/whatsapp-widget-generator';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import React from 'react';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert tone="danger" title="Something went wrong">
          {this.state.error?.message || 'An unexpected error occurred.'}
        </Alert>
      );
    }
    return this.props.children;
  }
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

const ZERO_STATS: WidgetStats = { loads: 0, opens: 0, clicks: 0 };

export default function WhatsappWidgetGeneratorPage() {
  const { activeProject } = useProject();
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [stats, setStats] = useState<WidgetStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();

  const fetchProjectData = useCallback(async () => {
    const id = activeProject?._id?.toString();
    if (!id) {
      setProject(null);
      setStats(null);
      setStatsError(null);
      return;
    }

    // The project still backs the appearance/embed form (a different crate).
    // Widget analytics now come from the dedicated Rust stats endpoint via the
    // wachat-widget-tracking action — no longer read off the project doc.
    const [projectData, statsResult] = await Promise.all([
      getProjectById(id),
      getWidgetStats(id),
    ]);

    setProject(projectData);
    if (statsResult.success) {
      setStats(statsResult.stats);
      setStatsError(null);
    } else {
      setStats(null);
      setStatsError(statsResult.error);
    }
  }, [activeProject]);

  useEffect(() => {
    startLoadingTransition(() => {
      fetchProjectData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject]);

  const displayStats = stats ?? ZERO_STATS;

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Integrations', href: '/wachat/integrations' },
        { label: 'Widget generator' },
      ]}
      title="Widget generator"
      description="Embed a WhatsApp chat widget on your site and track its performance."
    >
      <div className="flex-1 space-y-6">
        {isLoading ? (
          <PageSkeleton />
        ) : !project ? (
          <Alert tone="danger" title="No project selected">
            Please select a project from the main dashboard.
          </Alert>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] [color:var(--st-text)]">
                Widget analytics
              </h2>
              <Button
                size="sm"
                variant="outline"
                iconLeft={RefreshCw}
                onClick={() =>
                  startLoadingTransition(() => {
                    fetchProjectData();
                  })
                }
              >
                Refresh
              </Button>
            </div>

            {statsError ? (
              <Alert tone="danger" title="Could not load widget analytics">
                {statsError}
              </Alert>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <StatCard label="Widget loads" value={displayStats.loads.toLocaleString()} icon={Eye} />
                <StatCard label="Chat opens" value={displayStats.opens.toLocaleString()} icon={Users} />
                <StatCard
                  label="Clicks to WhatsApp"
                  value={displayStats.clicks.toLocaleString()}
                  icon={BarChart3}
                />
              </div>
            )}

            <ErrorBoundary>
              <WhatsAppWidgetGenerator project={project} />
            </ErrorBoundary>
          </>
        )}
      </div>
    </WachatPage>
  );
}
