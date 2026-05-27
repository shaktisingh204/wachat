'use client';

import * as React from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  BarChart3,
  Code2,
  Copy,
  Eye,
  FolderX,
  Gauge,
  MousePointerClick,
  RefreshCw,
  Send,
  Users,
} from 'lucide-react';
import type { WithId } from 'mongodb';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  useZoruToast,
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
  const { toast } = useZoruToast();
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
    startLoading(() => { fetchProjectData(); });
  }, [activeProject, fetchProjectData]);

  const stats = project?.widgetSettings?.stats || { loads: 0, opens: 0, clicks: 0 };

  const kpis = useMemo(() => {
    const openRate = stats.loads === 0 ? 0 : Math.round((stats.opens / stats.loads) * 100);
    const clickRate = stats.opens === 0 ? 0 : Math.round((stats.clicks / stats.opens) * 100);
    return { openRate, clickRate };
  }, [stats]);

  const projectId = project?._id?.toString();
  const embedSrc = projectId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/widget/${projectId}.js`
    : '';
  const embedCode = projectId
    ? `<script async src="${embedSrc}"></script>`
    : '';

  const copyEmbed = () => {
    if (!embedCode) return;
    navigator.clipboard.writeText(embedCode);
    toast({ title: 'Embed code copied' });
  };

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
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricTile label="Loads" value={stats.loads.toLocaleString('en-IN')} icon={Eye} delay={0.04} />
            <MetricTile label="Opens" value={stats.opens.toLocaleString('en-IN')} icon={Users} delay={0.06} />
            <MetricTile label="Clicks" value={stats.clicks.toLocaleString('en-IN')} icon={MousePointerClick} delay={0.08} />
            <MetricTile label="Open rate" value={<span className="text-[15px]">{kpis.openRate}%</span>} icon={Gauge} delay={0.1} />
            <MetricTile label="Click-through" value={<span className="text-[15px]">{kpis.clickRate}%</span>} icon={BarChart3} delay={0.12} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Section title="Configure widget" description="Brand color, prompt, and target number.">
              <ErrorBoundary>
                <WhatsAppWidgetGenerator project={project} />
              </ErrorBoundary>
            </Section>

            <Section title="Live preview" description="How it looks on your site once embedded.">
              <PhoneFrame title={project.name || 'Your business'} subtitle="online">
                <ChatBubble who="us" text={project.widgetSettings?.welcomeMessage || 'Hi! How can we help today?'} time="9:41" delay={0.1} />
                <ChatBubble who="them" text="I want to chat about pricing" time="9:42" delay={0.3} />
                <ChatBubble who="us" kind="cta" text={project.widgetSettings?.ctaText || 'Great, click to continue on WhatsApp.'} time="9:42" delay={0.5} />
              </PhoneFrame>
            </Section>
          </div>

          <Section
            title="Embed code"
            description="Drop this single line into the <head> of your site. The widget hydrates with your current configuration."
            action={
              <WaButton size="sm" variant="outline" leftIcon={Copy} onClick={copyEmbed}>
                Copy snippet
              </WaButton>
            }
          >
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-[12px] leading-relaxed text-zinc-700">
                {embedCode || '<!-- save settings first to mint your snippet -->'}
              </pre>
            </div>
            <p className="mt-2 text-[11.5px] text-zinc-500">
              Position {project.widgetSettings?.position || 'bottom-right'} · button color{' '}
              <span className="font-mono">{project.widgetSettings?.buttonColor || '#25D366'}</span> · radius{' '}
              {project.widgetSettings?.borderRadius ?? 16}px
            </p>
          </Section>
        </div>
      )}
    </WaPage>
  );
}
