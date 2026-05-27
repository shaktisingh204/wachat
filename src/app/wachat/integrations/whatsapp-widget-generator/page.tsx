'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Skeleton,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { formatUTC } from '@/lib/utils';
import { BarChart3,
  Eye,
  RefreshCw,
  Users } from 'lucide-react';
import type { WithId,
  Project } from '@/lib/definitions';

import { getProjectById } from '@/app/actions/project.actions';
import { useProject } from '@/context/project-context';
import { WhatsAppWidgetGenerator } from '@/components/zoruui-domain/whatsapp-widget-generator';
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
        <Alert variant="destructive">
          <ZoruAlertTitle>Something went wrong</ZoruAlertTitle>
          <ZoruAlertDescription>{this.state.error?.message || "An unexpected error occurred."}</ZoruAlertDescription>
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
    <Card className="flex items-center gap-4 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink-muted">
        {icon}
      </span>
      <div>
        <p className="text-xs text-zoru-ink-muted">{title}</p>
        <p className="text-[20px] tabular-nums text-zoru-ink">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
    </Card>
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

  const stats = project?.widgetSettings?.stats || { loads: 0, opens: 0, clicks: 0 };

  return (
    <div className="flex h-full w-full flex-col">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat/integrations">Integrations</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Widget generator</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="mt-5 flex-1 space-y-6">
        {isLoading ? (
          <PageSkeleton />
        ) : !project ? (
          <Alert variant="destructive">
            <ZoruAlertTitle>No project selected</ZoruAlertTitle>
            <ZoruAlertDescription>
              Please select a project from the main dashboard.
            </ZoruAlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] text-zoru-ink">Widget analytics</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  startLoadingTransition(() => {
                    fetchProjectData();
                  })
                }
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard title="Widget loads" value={stats.loads} icon={<Eye className="h-4 w-4" />} />
              <StatCard title="Chat opens" value={stats.opens} icon={<Users className="h-4 w-4" />} />
              <StatCard
                title="Clicks to WhatsApp"
                value={stats.clicks}
                icon={<BarChart3 className="h-4 w-4" />}
              />
            </div>

            <ErrorBoundary>
              <WhatsAppWidgetGenerator project={project} />
            </ErrorBoundary>
          </>
        )}
      </div>
    </div>
  );
}
