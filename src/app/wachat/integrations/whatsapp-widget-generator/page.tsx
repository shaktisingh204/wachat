'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import {
  BarChart3,
  Code2,
  Eye,
  FolderX,
  RefreshCw,
  Users,
} from 'lucide-react';
import type { WithId } from 'mongodb';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
} from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  Section,
  MetricTile,
  PhoneFrame,
  ChatBubble,
  EmptyState,
  WaButton,
} from '@/components/wachat-ui';
import { getProjectById } from '@/app/actions/project.actions';
import type { Project } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { WhatsAppWidgetGenerator } from '@/components/zoruui-domain/whatsapp-widget-generator';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
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
        <Alert variant="destructive" className="rounded-2xl">
          <ZoruAlertTitle>Something went wrong</ZoruAlertTitle>
          <ZoruAlertDescription>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </ZoruAlertDescription>
        </Alert>
      );
    }
    return this.props.children;
  }
}

export default function WhatsappWidgetGeneratorPage() {
  const { activeProject } = useProject();
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [isLoading, startLoading] = useTransition();

  const fetchProjectData = React.useCallback(async () => {
    const id = activeProject?._id?.toString();
    if (id) {
      const data = await getProjectById(id);
      setProject(data);
    }
  }, [activeProject]);

  useEffect(() => {
    startLoading(() => {
      fetchProjectData();
    });
  }, [activeProject, fetchProjectData]);

  const stats = project?.widgetSettings?.stats || { loads: 0, opens: 0, clicks: 0 };

  return (
    <WaPage>
      <PageHeader
        title="Website widget"
        description="Embed a floating WhatsApp chat widget on your site."
        kicker="Wachat · integrations"
        backHref="/wachat/integrations"
        eyebrowIcon={Code2}
        actions={
          project ? (
            <WaButton
              variant="outline"
              size="sm"
              leftIcon={RefreshCw}
              onClick={() => startLoading(() => { fetchProjectData(); })}
            >
              Refresh stats
            </WaButton>
          ) : null
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          <div className="h-80 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        </div>
      ) : !project ? (
        <EmptyState
          icon={FolderX}
          title="No project selected"
          description="Pick a project from the Wachat home page to generate a widget."
        />
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MetricTile label="Widget loads" value={stats.loads.toLocaleString('en-IN')} icon={Eye} delay={0.05} />
            <MetricTile label="Chat opens" value={stats.opens.toLocaleString('en-IN')} icon={Users} delay={0.1} />
            <MetricTile label="Clicks to WhatsApp" value={stats.clicks.toLocaleString('en-IN')} icon={BarChart3} delay={0.15} />
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Section title="Configure widget" description="Brand color, prompt, and target number.">
              <ErrorBoundary>
                <WhatsAppWidgetGenerator project={project} />
              </ErrorBoundary>
            </Section>

            <Section title="Live preview" description="How it looks on your site once embedded.">
              <PhoneFrame title={project.name || 'Your business'} subtitle="online">
                <ChatBubble who="us" text="Hi! How can we help today?" time="9:41" delay={0.1} />
                <ChatBubble who="them" text="I want to chat about pricing" time="9:42" delay={0.3} />
                <ChatBubble who="us" kind="cta" text="Great, click to continue on WhatsApp." time="9:42" delay={0.5} />
              </PhoneFrame>
            </Section>
          </div>
        </div>
      )}
    </WaPage>
  );
}
