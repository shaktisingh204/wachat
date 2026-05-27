'use client';

import * as React from 'react';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useActionState,
} from 'react';
import { Tag, X, Loader2, Plus } from 'lucide-react';
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
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { useProject } from '@/context/project-context';
import {
  getChatLabels,
  saveChatLabel,
  deleteChatLabel,
} from '@/app/actions/wachat-features.actions';

/**
 * /wachat/chat-labels — Manage colored labels for chat organization,
 * rebuilt on wachat-ui primitives. Color picker uses a neutral
 * swatch palette so labels stay distinguishable without clashing
 * with the emerald module accent.
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

  return (
    <WaPage>
      <PageHeader
        title="Chat labels"
        description="Create reusable labels to organize and categorize WhatsApp conversations."
        kicker="Wachat · labels"
        backHref="/wachat"
        eyebrowIcon={Tag}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
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
                  />
                ))}
              </div>
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
          title={`Your labels (${labels.length})`}
          description="Click the close icon on any label to remove it."
        >
          {isLoading && labels.length === 0 ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : labels.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No labels yet"
              description="Create your first label using the form on the left."
            />
          ) : (
            <ul className="flex flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {labels.map((label, i) => (
                  <m.li
                    key={label._id}
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ duration: 0.22, delay: i * 0.02, ease: EASE_OUT }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-800"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: label.color }}
                      aria-hidden
                    />
                    {label.name}
                    <button
                      type="button"
                      onClick={() => handleDelete(label._id)}
                      disabled={isDeletingId === label._id}
                      className="ml-1 grid h-5 w-5 place-items-center rounded-full text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.92]"
                      aria-label={`Delete ${label.name}`}
                    >
                      <X className="h-3 w-3" strokeWidth={2.25} />
                    </button>
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Section>
      </div>
    </WaPage>
  );
}
