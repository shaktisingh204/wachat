'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  GitBranch,
  Inbox,
  Pause,
  Play,
  Save,
  Settings,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  SegmentedControl,
  Skeleton,
  StatCard,
  Textarea,
  useToast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
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

// Status colour carries meaning: live (success), paused (warning), the rest neutral.
const STATUS_TONES: Record<EmailJourneyStatus, BadgeTone> = {
  draft: 'neutral',
  active: 'success',
  paused: 'warning',
  archived: 'neutral',
};

const TAB_ITEMS = [
  { value: 'canvas' as const, label: 'Canvas', icon: GitBranch },
  { value: 'settings' as const, label: 'Settings', icon: Settings },
  { value: 'report' as const, label: 'Report', icon: BarChart3 },
];

interface JourneyDetailClientProps {
  journeyId: string;
}

export function JourneyDetailClient({ journeyId }: JourneyDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [journey, setJourney] = useState<EmailJourneyDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('canvas');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Local editable state. Keeps the canvas snappy without round-tripping.
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
      toast.error({ title: 'Failed to load journey', description: r.error });
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
  }, [journeyId, toast]);

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
      if (!r.ok) { toast.error({ title: 'Save failed', description: r.error }); return; }
      toast.success('Journey saved');
      setJourney(r.data);
      setDirty(false);
    });
  };

  const activate = async () => {
    const r = await actionActivateEmailJourney(journeyId);
    if (!r.ok) { toast.error({ title: 'Activate failed', description: r.error }); return; }
    toast.success('Journey activated');
    setJourney(r.data);
  };

  const pause = async () => {
    const r = await actionPauseEmailJourney(journeyId);
    if (!r.ok) { toast.error({ title: 'Pause failed', description: r.error }); return; }
    toast.success('Journey paused');
    setJourney(r.data);
  };

  if (loading || !journey) {
    return <Skeleton height="24rem" width="100%" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <IconButton
            label="Back to journeys"
            icon={ArrowLeft}
            onClick={() => router.push('/dashboard/email/journeys')}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold text-[var(--st-text)]">{journey.name}</h1>
              <Badge tone={STATUS_TONES[journey.status]}>{journey.status}</Badge>
              {dirty ? <Badge tone="accent">Unsaved</Badge> : null}
            </div>
            {journey.description ? (
              <p className="text-xs text-[var(--st-text-secondary)] line-clamp-1">{journey.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {journey.status === 'active' ? (
            <Button variant="outline" iconLeft={Pause} onClick={pause}>
              Pause
            </Button>
          ) : (
            <Button variant="outline" iconLeft={Play} onClick={activate}>
              Activate
            </Button>
          )}
          <Button variant="primary" iconLeft={Save} onClick={save} loading={saving} disabled={!dirty}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <SegmentedControl
        aria-label="Journey view"
        items={TAB_ITEMS}
        value={tab}
        onChange={setTab}
      />

      {tab === 'canvas' ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card padding="lg" className="overflow-x-auto">
            <JourneyCanvas
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNodeId}
              onSelect={setSelectedNodeId}
              onChange={onCanvasChange}
              readOnly={journey.status === 'active'}
            />
          </Card>
          <InspectorPanel node={selectedNode} onChange={updateSelectedNode} />
        </div>
      ) : null}

      {tab === 'settings' ? (
        <Card padding="lg" className="space-y-4 max-w-xl">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setDirty(true); }}
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
            />
          </Field>
          <p className="text-xs text-[var(--st-text-secondary)]">
            Re-entry policy and trigger detail edits live on the trigger node. Open the Canvas tab and pick the trigger step.
          </p>
          <div>
            <Link
              href={`/dashboard/email/journeys/${journeyId}#runs`}
              className="inline-flex items-center gap-1 text-sm text-[var(--st-accent)] hover:underline"
            >
              View enrolment runs
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </Card>
      ) : null}

      {tab === 'report' ? <ReportTab journeyId={journeyId} /> : null}
    </div>
  );
}

function ReportTab({ journeyId }: { journeyId: string }) {
  const { toast } = useToast();
  const [report, setReport] = useState<EmailJourneyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await actionGetEmailJourneyReport(journeyId);
      if (cancelled) return;
      if (!r.ok) {
        toast.error({ title: 'Failed to load report', description: r.error });
        setLoading(false);
        return;
      }
      setReport(r.data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [journeyId, toast]);

  if (loading) return <Skeleton height="12rem" width="100%" />;
  if (!report) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Entered"   value={report.entered.toLocaleString()} />
        <StatCard label="Active"    value={report.active.toLocaleString()} />
        <StatCard label="Waiting"   value={report.waiting.toLocaleString()} />
        <StatCard label="Completed" value={report.completed.toLocaleString()} />
        <StatCard label="Exited"    value={report.exited.toLocaleString()} />
        <StatCard label="Errored"   value={report.errored.toLocaleString()} />
      </div>

      <Card padding="md">
        <p className="text-sm font-medium mb-3 text-[var(--st-text)]">Per-node breakdown</p>
        {Object.keys(report.perNode).length === 0 ? (
          <EmptyState
            icon={Inbox}
            size="sm"
            title="No node-level data yet"
            description="Runs have not accumulated. Once contacts enter this journey, per-node counts appear here."
          />
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {Object.entries(report.perNode).map(([nodeId, stats]) => (
              <li key={nodeId} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono text-xs text-[var(--st-text)]">{nodeId}</span>
                <span className="text-[var(--st-text-secondary)]">
                  {stats.trueCount !== undefined || stats.falseCount !== undefined
                    ? `true: ${stats.trueCount ?? 0}, false: ${stats.falseCount ?? 0}`
                    : `count: ${stats.count ?? 0}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
