'use client';

import {
  useToast,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Field,
  Input,
  EmptyState,
  Spinner,
  Tag,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useActionState } from 'react';
import { Tag as TagIcon,
  Plus } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getChatLabels, saveChatLabel, deleteChatLabel } from '@/app/actions/wachat-features.actions';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * /wachat/chat-labels — Manage colored labels for chat organization,
 * rebuilt on 20ui primitives. Color picker uses neutral swatches only.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

/**
 * Neutral palette swatches — labels still encode their accent color via
 * a small dot but the palette is restricted to greys/ink shades so
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
          toast({ title: 'Error', description: res.error, tone: 'danger' });
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
      toast({ title: 'Success', description: formState.message, tone: 'success' });
      if (projectId) fetchLabels(projectId);
    }
    if (formState?.error) {
      toast({ title: 'Error', description: formState.error, tone: 'danger' });
    }
  }, [formState, toast, projectId, fetchLabels]);

  const handleDelete = async (labelId: string) => {
    if (isDeletingId) return;
    setDeletingId(labelId);
    const res = await deleteChatLabel(labelId);
    setDeletingId(null);
    if (res.error) {
      toast({ title: 'Error', description: res.error, tone: 'danger' });
    } else {
      setLabels((prev) => prev.filter((l) => l._id !== labelId));
      toast({ title: 'Deleted', description: 'Label removed.', tone: 'success' });
    }
  };

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Chat Labels' },
      ]}
      title="Chat Labels"
      description="Create labels to organize and categorize your WhatsApp conversations."
      width="narrow"
    >
      <div className="flex flex-col gap-6">
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Create a label</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={formAction} className="flex flex-col gap-4">
              <input type="hidden" name="projectId" value={projectId || ''} />
              <input type="hidden" name="color" value={selectedColor} />
              <Field label="Label name">
                <Input
                  id="label-name"
                  name="name"
                  placeholder="Label name"
                  required
                  className="max-w-sm"
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="mr-1 text-[13px]"
                  style={{ color: 'var(--st-text-secondary)' }}
                >
                  Color:
                </span>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setSelectedColor(c.value)}
                    className={cx(
                      'h-7 w-7 rounded-full border-2 transition-all',
                      selectedColor === c.value ? 'scale-110' : 'border-transparent',
                    )}
                    style={{
                      backgroundColor: c.value,
                      borderColor: selectedColor === c.value ? 'var(--st-text)' : undefined,
                    }}
                    aria-label={c.name}
                    aria-pressed={selectedColor === c.value}
                  />
                ))}
              </div>
              <div>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  iconLeft={Plus}
                  loading={isPending}
                  disabled={isPending || !projectId}
                >
                  {isPending ? 'Saving...' : 'Create Label'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card padding="lg">
          <CardHeader>
            <CardTitle>Your Labels ({labels.length})</CardTitle>
          </CardHeader>
          <CardBody>
            {isLoading && labels.length === 0 ? (
              <div className="flex h-20 items-center justify-center">
                <Spinner size="md" label="Loading labels" />
              </div>
            ) : labels.length === 0 ? (
              <EmptyState
                icon={TagIcon}
                title="No labels yet"
                description="Create your first label using the form above."
                size="sm"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <Tag
                    key={label._id}
                    color={label.color}
                    onRemove={() => handleDelete(label._id)}
                    removeLabel={`Delete ${label.name}`}
                  >
                    {label.name}
                  </Tag>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </WachatPage>
  );
}
