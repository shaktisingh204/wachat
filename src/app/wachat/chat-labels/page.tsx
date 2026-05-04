'use client';

/**
 * /wachat/chat-labels — Manage colored labels for chat organization,
 * rebuilt on ZoruUI primitives. Color picker uses neutral swatches only.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback, useActionState } from 'react';
import { Tag, X, Loader2, Plus } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useZoruToast } from '@/components/zoruui';
import {
  getChatLabels,
  saveChatLabel,
  deleteChatLabel,
} from '@/app/actions/wachat-features.actions';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruEmptyState,
  ZoruBadge,
  cn,
} from '@/components/zoruui';

/**
 * Neutral palette swatches — labels still encode their accent color via
 * a small dot but the palette is restricted to greys/zoru-ink shades so
 * the surface stays palette-locked.
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
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbPage>Chat Labels</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="min-w-0">
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Chat Labels
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Create labels to organize and categorize your WhatsApp conversations.
        </p>
      </div>

      <ZoruCard className="p-6">
        <h2 className="mb-4 text-[16px] text-zoru-ink">Create a label</h2>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={projectId || ''} />
          <input type="hidden" name="color" value={selectedColor} />
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="label-name">Label name</ZoruLabel>
            <ZoruInput
              id="label-name"
              name="name"
              placeholder="Label name"
              required
              className="max-w-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[13px] text-zoru-ink-muted">Color:</span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSelectedColor(c.value)}
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition-all',
                  selectedColor === c.value
                    ? 'scale-110 border-zoru-ink'
                    : 'border-transparent',
                )}
                style={{ backgroundColor: c.value }}
                aria-label={c.name}
              />
            ))}
          </div>
          <div>
            <ZoruButton
              type="submit"
              size="md"
              disabled={isPending || !projectId}
            >
              <Plus />
              {isPending ? 'Saving...' : 'Create Label'}
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h2 className="mb-4 text-[16px] text-zoru-ink">
          Your Labels ({labels.length})
        </h2>
        {isLoading && labels.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
          </div>
        ) : labels.length === 0 ? (
          <ZoruEmptyState
            icon={<Tag />}
            title="No labels yet"
            description="Create your first label using the form above."
            compact
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <span
                key={label._id}
                className="inline-flex items-center gap-1.5 rounded-full border border-zoru-line bg-zoru-bg px-3 py-1.5 text-[13px] text-zoru-ink"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
                <button
                  type="button"
                  onClick={() => handleDelete(label._id)}
                  disabled={isDeletingId === label._id}
                  className="ml-1 rounded-full p-0.5 text-zoru-ink-muted transition-colors hover:bg-zoru-surface-2 hover:text-zoru-ink"
                  aria-label={`Delete ${label.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </ZoruCard>

      <div className="h-6" />
    </div>
  );
}
