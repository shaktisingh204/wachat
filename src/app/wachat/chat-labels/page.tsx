'use client';

/**
 * Wachat Chat Labels — create and manage colored labels for chat
 * organization, built on Clay primitives.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback, useActionState } from 'react';
import { LuTag, LuX, LuLoader, LuPlus } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  getChatLabels,
  saveChatLabel,
  deleteChatLabel,
} from '@/app/actions/wachat-features.actions';

const PRESET_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
];

export default function ChatLabelsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/dashboard' },
          { label: activeProject?.name || 'Project', href: '/wachat' },
          { label: 'Chat Labels' },
        ]}
      />

      <div className="min-w-0">
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
          Chat Labels
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Create colored labels to organize and categorize your WhatsApp conversations.
        </p>
      </div>

      {/* Create form */}
      <ClayCard padded={false} className="p-6">
        <h2 className="text-[16px] font-semibold text-foreground mb-4">Create a label</h2>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={projectId || ''} />
          <input type="hidden" name="color" value={selectedColor} />
          <Input name="name" placeholder="Label name" required className="max-w-sm" />
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground mr-1">Color:</span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSelectedColor(c.value)}
                className={`h-7 w-7 rounded-full border-2 transition-all ${
                  selectedColor === c.value ? 'border-foreground scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c.value }}
                aria-label={c.name}
              />
            ))}
          </div>
          <div>
            <ClayButton
              type="submit"
              variant="obsidian"
              size="md"
              disabled={isPending || !projectId}
              leading={<LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            >
              {isPending ? 'Saving...' : 'Create Label'}
            </ClayButton>
          </div>
        </form>
      </ClayCard>

      {/* Labels list */}
      <ClayCard padded={false} className="p-6">
        <h2 className="text-[16px] font-semibold text-foreground mb-4">
          Your Labels ({labels.length})
        </h2>
        {isLoading && labels.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <LuLoader className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.75} />
          </div>
        ) : labels.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-secondary px-4 py-10 text-center">
            <LuTag className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <div className="text-[13px] font-semibold text-foreground">No labels yet</div>
            <div className="text-[11.5px] text-muted-foreground">Create your first label above.</div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <Badge
                key={label._id}
                variant="outline"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
                style={{ borderColor: label.color, color: label.color }}
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
                  className="ml-1 rounded-full p-0.5 hover:bg-muted transition-colors"
                  aria-label={`Delete ${label.name}`}
                >
                  <LuX className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </ClayCard>

      <div className="h-6" />
    </div>
  );
}
