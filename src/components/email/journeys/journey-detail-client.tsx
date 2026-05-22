'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  GitBranch,
  Pause,
  Play,
  Save,
  Settings,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Skeleton,
  StatCard,
  Textarea,
  cn,
  zoruToast,
} from '@/components/zoruui';
import {
  actionActivateEmailJourney,
  actionGetEmailJourney,
  actionGetEmailJourneyReport,
  actionPauseEmailJourney,
  actionUpdateEmailJourney,
} from '@/app/actions/email/journeys.actions';
import type {
  EmailJourneyDoc,
  EmailJourneyReport,
  EmailJourneyStatus,
} from '@/lib/rust-client/email-journeys';
import type { EmailJourneyEdge, EmailJourneyNode } from '@/lib/email/types';
import { JourneyCanvas } from './canvas/journey-canvas';
import { InspectorPanel } from './canvas/inspector-panel';

type TabKey = 'canvas' | 'settings' | 'report';

const STATUS_VARIANTS: Record<EmailJourneyStatus, 'default' | 'secondary' | 'outline'> = {
  draft:    'outline',
  active:   'default',
  paused:   'secondary',
  archived: 'outline',
};

interface JourneyDetailClientProps {
  journeyId: string;
}

export function JourneyDetailClient({ journeyId }: JourneyDetailClientProps) {
  const router = useRouter();
  const [journey, setJourney] = useState<EmailJourneyDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('canvas');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Local editable state — keeps the canvas snappy without round-tripping.
  const [nodes, setNodes] = useState<EmailJourneyNode[]>([]);
  const [edges, setEdges] = useState<EmailJourneyEdge[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dirty, setDirty] = useState(false);

  const [saving, startSaving] = useTransition();
  const lastLoadedAt = useRef<number>(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await actionGetEmailJourney(journeyId);
    if (!r.ok) {
      zoruToast({ title: 'Failed to load journey', description: r.error, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setJourney(r.data);
    setNodes(r.data.nodes);
    setEdges(r.data.edges);
    setName(r.data.name);
    setDescription(r.data.description ?? '');
    setDirty(false);
    lastLoadedAt.current = Date.now();
    setLoading(false);
  }, [journeyId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const updateSelectedNode = (next: EmailJourneyNode) => {
    setNodes((prev) => prev.map((n) => (n.id === next.id ? next : n)));
    setDirty(true);
  };

  const onCanvasChange = (next: { nodes: EmailJourneyNode[]; edges: EmailJourneyEdge[] }) => {
    setNodes(next.nodes);
    setEdges(next.edges);
    setDirty(true);
  };

  const save = () => {
    startSaving(async () => {
      const r = await actionUpdateEmailJourney(journeyId, {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        nodes,
        edges,
      });
      if (!r.ok) { zoruToast({ title: 'Save failed', description: r.error, variant: 'destructive' }); return; }
      zoruToast({ title: 'Journey saved' });
      setJourney(r.data);
      setDirty(false);
    });
  };

  const activate = async () => {
    const r = await actionActivateEmailJourney(journeyId);
    if (!r.ok) { zoruToast({ title: 'Activate failed', description: r.error, variant: 'destructive' }); return; }
    zoruToast({ title: 'Journey activated' });
    setJourney(r.data);
  };

  const pause = async () => {
    const r = await actionPauseEmailJourney(journeyId);
    if (!r.ok) { zoruToast({ title: 'Pause failed', description: r.error, variant: 'destructive' }); return; }
    zoruToast({ title: 'Journey paused' });
    setJourney(r.data);
  };

  if (loading || !journey) {
    return <ZoruSkeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ZoruButton variant="ghost" size="icon" onClick={() => router.push('/dashboard/email/journeys')} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </ZoruButton>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold">{journey.name}</h1>
              <ZoruBadge variant={STATUS_VARIANTS[journey.status]}>{journey.status}</ZoruBadge>
              {dirty ? <ZoruBadge variant="secondary">Unsaved</ZoruBadge> : null}
            </div>
            {journey.description ? (
              <p className="text-xs text-zoru-ink-muted line-clamp-1">{journey.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {journey.status === 'active' ? (
            <ZoruButton variant="outline" onClick={pause}>
              <Pause className="h-4 w-4" /> Pause
            </ZoruButton>
          ) : (
            <ZoruButton variant="outline" onClick={activate}>
              <Play className="h-4 w-4" /> Activate
            </ZoruButton>
          )}
          <ZoruButton onClick={save} disabled={saving || !dirty}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
          </ZoruButton>
        </div>
      </div>

      {/* Segmented button group — intentionally NOT the Tabs primitive. */}
      <div
        role="tablist"
        aria-label="Journey view"
        className="inline-flex items-center rounded-lg border border-border bg-zoru-surface-2 p-1"
      >
        <SegmentedButton active={tab === 'canvas'}   onClick={() => setTab('canvas')}>
          <GitBranch className="h-4 w-4" /> Canvas
        </SegmentedButton>
        <SegmentedButton active={tab === 'settings'} onClick={() => setTab('settings')}>
          <Settings className="h-4 w-4" /> Settings
        </SegmentedButton>
        <SegmentedButton active={tab === 'report'}   onClick={() => setTab('report')}>
          <BarChart3 className="h-4 w-4" /> Report
        </SegmentedButton>
      </div>

      {tab === 'canvas' ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <ZoruCard className="p-6 overflow-x-auto">
            <JourneyCanvas
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNodeId}
              onSelect={setSelectedNodeId}
              onChange={onCanvasChange}
              readOnly={journey.status === 'active'}
            />
          </ZoruCard>
          <InspectorPanel node={selectedNode} onChange={updateSelectedNode} />
        </div>
      ) : null}

      {tab === 'settings' ? (
        <ZoruCard className="p-6 space-y-4 max-w-xl">
          <div className="space-y-1">
            <ZoruLabel htmlFor="j-name">Name</ZoruLabel>
            <ZoruInput id="j-name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
          </div>
          <div className="space-y-1">
            <ZoruLabel htmlFor="j-desc">Description</ZoruLabel>
            <ZoruTextarea id="j-desc" rows={4} value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} />
          </div>
          <p className="text-xs text-zoru-ink-muted">
            Re-entry policy and trigger detail edits live on the trigger node — open the Canvas tab and pick the trigger step.
          </p>
          <div>
            <Link
              href={`/dashboard/email/journeys/${journeyId}#runs`}
              className="text-sm text-zoru-accent hover:underline"
            >
              View enrolment runs →
            </Link>
          </div>
        </ZoruCard>
      ) : null}

      {tab === 'report' ? <ReportTab journeyId={journeyId} /> : null}
    </div>
  );
}

function SegmentedButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition',
        active
          ? 'bg-zoru-surface-1 text-zoru-ink shadow-sm'
          : 'text-zoru-ink-muted hover:text-zoru-ink',
      )}
    >
      {children}
    </button>
  );
}

function ReportTab({ journeyId }: { journeyId: string }) {
  const [report, setReport] = useState<EmailJourneyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await actionGetEmailJourneyReport(journeyId);
      if (cancelled) return;
      if (!r.ok) {
        zoruToast({ title: 'Failed to load report', description: r.error, variant: 'destructive' });
        setLoading(false);
        return;
      }
      setReport(r.data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [journeyId]);

  if (loading) return <ZoruSkeleton className="h-48 w-full" />;
  if (!report) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <ZoruStatCard label="Entered"   value={report.entered.toLocaleString()} />
        <ZoruStatCard label="Active"    value={report.active.toLocaleString()} />
        <ZoruStatCard label="Waiting"   value={report.waiting.toLocaleString()} />
        <ZoruStatCard label="Completed" value={report.completed.toLocaleString()} />
        <ZoruStatCard label="Exited"    value={report.exited.toLocaleString()} />
        <ZoruStatCard label="Errored"   value={report.errored.toLocaleString()} />
      </div>

      <ZoruCard className="p-4">
        <p className="text-sm font-medium mb-3">Per-node breakdown</p>
        {Object.keys(report.perNode).length === 0 ? (
          <p className="text-sm text-zoru-ink-muted">No node-level data yet — runs haven't accumulated.</p>
        ) : (
          <ul className="divide-y divide-border">
            {Object.entries(report.perNode).map(([nodeId, stats]) => (
              <li key={nodeId} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono text-xs">{nodeId}</span>
                <span className="text-zoru-ink-muted">
                  {stats.trueCount !== undefined || stats.falseCount !== undefined
                    ? `true: ${stats.trueCount ?? 0} · false: ${stats.falseCount ?? 0}`
                    : `count: ${stats.count ?? 0}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ZoruCard>
    </div>
  );
}
