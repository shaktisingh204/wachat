'use client';

import * as React from 'react';
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  useCallback,
  useActionState,
} from 'react';
import { Tag, X, Loader2, Plus, Hash, Clock, Users } from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';

import {
  useZoruToast,
  Input,
  Label,
  cn,
} from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  MetricTile,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { fmtDate } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import {
  getChatLabels,
  saveChatLabel,
  deleteChatLabel,
} from '@/app/actions/wachat-features.actions';

/**
 * /wachat/chat-labels - Manage colored labels for chat organization,
 * enriched with per-label usage count, last-used timestamp, and the
 * list of agents who applied each label.
 */

const PRESET_COLORS = [
  { name: 'Slate', value: '#475569' },
  { name: 'Stone', value: '#78716c' },
  { name: 'Zinc', value: '#52525b' },
  { name: 'Graphite', value: '#1f2937' },
  { name: 'Charcoal', value: '#0f172a' },
  { name: 'Mist', value: '#94a3b8' },
];

export default function ChatLabelsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [labels, setLabels] = useState<any[]>([]);
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].value);
  const [isLoading, startLoading] = useTransition();
  const [isDeletingId, setDeletingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState(saveChatLabel, null);

  const fetchLabels = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getChatLabels(pid);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
          setLabels(res.labels || []);
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchLabels(projectId);
  }, [projectId, fetchLabels]);

  useEffect(() => {
    if (formState?.message) {
      toast({ title: 'Success', description: formState.message });
      if (projectId) fetchLabels(projectId);
    }
    if (formState?.error) {
      toast({ title: 'Error', description: formState.error, variant: 'destructive' });
    }
  }, [formState, toast, projectId, fetchLabels]);

  const handleDelete = async (labelId: string) => {
    setDeletingId(labelId);
    const res = await deleteChatLabel(labelId);
    setDeletingId(null);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      setLabels((prev) => prev.filter((l) => l._id !== labelId));
      toast({ title: 'Deleted', description: 'Label removed.' });
    }
  };

  const totalUsage = useMemo(
    () => labels.reduce((sum, l) => sum + (Number(l.usageCount) || 0), 0),
    [labels],
  );
  const mostUsed = useMemo(() => {
    if (labels.length === 0) return null;
    return [...labels].sort((a, b) => (Number(b.usageCount) || 0) - (Number(a.usageCount) || 0))[0];
  }, [labels]);
  const recentlyUsed = useMemo(() => {
    const dated = labels.filter((l) => l.lastUsedAt || l.updatedAt);
    if (dated.length === 0) return null;
    return [...dated].sort((a, b) => {
      const ta = new Date(a.lastUsedAt || a.updatedAt || 0).getTime();
      const tb = new Date(b.lastUsedAt || b.updatedAt || 0).getTime();
      return tb - ta;
    })[0];
  }, [labels]);

  return (
    <WaPage>
      <PageHeader
        title="Chat labels"
        description="Reusable labels to organize and categorize WhatsApp conversations."
        kicker="Wachat · labels"
        backHref="/wachat"
        eyebrowIcon={Tag}
      />

      {/* KPI strip */}
      <section aria-labelledby="labels-kpis" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <h2 id="labels-kpis" className="sr-only">Labels overview</h2>
        <MetricTile label="Total labels" value={labels.length.toLocaleString('en-IN')} icon={Tag} delay={0} />
        <MetricTile label="Total applications" value={totalUsage.toLocaleString('en-IN')} icon={Hash} delay={0.04} />
        <MetricTile
          label="Most used"
          value={mostUsed ? mostUsed.name : '--'}
          icon={Users}
          delay={0.08}
        />
        <MetricTile
          label="Recently used"
          value={
            recentlyUsed
              ? fmtDate(recentlyUsed.lastUsedAt || recentlyUsed.updatedAt)
              : '--'
          }
          icon={Clock}
          delay={0.12}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Section title="Create a label" description="Name and pick a swatch.">
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="projectId" value={projectId || ''} />
            <input type="hidden" name="color" value={selectedColor} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="label-name">Label name</Label>
              <Input
                id="label-name"
                name="name"
                placeholder="e.g. VIP customer"
                required
              />
            </div>
            <div>
              <Label className="mb-2 block">Color</Label>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setSelectedColor(c.value)}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 transition-transform duration-150 active:scale-[0.95]',
                      selectedColor === c.value ? 'scale-110 border-zinc-900' : 'border-transparent',
                    )}
                    style={{ backgroundColor: c.value }}
                    aria-label={c.name}
                    title={c.name}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                Picked: <span className="font-mono">{PRESET_COLORS.find((c) => c.value === selectedColor)?.name}</span>
              </p>
            </div>
            <div>
              <WaButton
                type="submit"
                leftIcon={Plus}
                disabled={isPending || !projectId}
              >
                {isPending ? 'Saving...' : 'Create label'}
              </WaButton>
            </div>
          </form>
        </Section>

        <Section
          title={`Your labels (${labels.length.toLocaleString('en-IN')})`}
          description="Usage count, last application, and contributors per label."
          padded={false}
        >
          {isLoading && labels.length === 0 ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : labels.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Tag}
                title="No labels yet"
                description="Create your first label using the form on the left."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              <AnimatePresence initial={false}>
                {labels.map((label, i) => {
                  const usage = Number(label.usageCount) || 0;
                  const lastUsed = label.lastUsedAt || label.updatedAt;
                  const agents: string[] = Array.isArray(label.appliedBy)
                    ? label.appliedBy.slice(0, 3)
                    : Array.isArray(label.agents)
                      ? label.agents.slice(0, 3)
                      : [];
                  const extraAgents =
                    (Array.isArray(label.appliedBy) ? label.appliedBy.length : 0) +
                    (Array.isArray(label.agents) ? label.agents.length : 0) -
                    agents.length;
                  return (
                    <m.li
                      key={label._id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.25, delay: i * 0.03, ease: EASE_OUT }}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-zinc-50/60"
                    >
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-800"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: label.color }}
                          aria-hidden
                        />
                        {label.name}
                      </span>
                      <div className="ml-2 flex min-w-0 flex-1 items-center gap-4 text-[11.5px] text-zinc-500">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Hash className="h-3 w-3" strokeWidth={2} aria-hidden />
                          {usage.toLocaleString('en-IN')} use{usage === 1 ? '' : 's'}
                        </span>
                        {lastUsed && (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock className="h-3 w-3" strokeWidth={2} aria-hidden />
                            {fmtDate(lastUsed)}
                          </span>
                        )}
                        {agents.length > 0 && (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <Users className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                            <span className="truncate">
                              {agents.join(', ')}
                              {extraAgents > 0 && ` +${extraAgents}`}
                            </span>
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(label._id)}
                        disabled={isDeletingId === label._id}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-400 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600 active:scale-[0.92]"
                        aria-label={`Delete ${label.name}`}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                    </m.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </Section>
      </div>
    </WaPage>
  );
}
