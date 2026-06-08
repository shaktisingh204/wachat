'use client';

/**
 * SabCreator, apps grid. 20ui primitives only; SabFiles for icons.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  CheckCircle2,
  Eye,
  LayoutGrid,
  PencilRuler,
  Plus,
  Rocket,
} from 'lucide-react';

import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Field,
  Input,
  Textarea,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  EmptyState,
  Badge,
  StatCard,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { createSabcreatorApp } from '@/app/actions/sabcreator.actions';
import type { SabcreatorAppDoc } from '@/lib/rust-client/sabcreator-apps';

interface Props {
  initialItems: SabcreatorAppDoc[];
}

export function AppsListClient({ initialItems }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconFileId, setIconFileId] = useState<string | undefined>(undefined);
  const [iconName, setIconName] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  const stats = useMemo(() => {
    const published = items.filter((a) => a.status === 'published').length;
    return {
      total: items.length,
      published,
      drafts: items.length - published,
    };
  }, [items]);

  const reset = () => {
    setName('');
    setDescription('');
    setIconFileId(undefined);
    setIconName(undefined);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const res = await createSabcreatorApp({
          name: name.trim(),
          description: description.trim() || undefined,
          iconFileId,
        });
        setItems((prev) => [res.entity, ...prev]);
        setOpen(false);
        reset();
        router.refresh();
        toast.success('App created');
      } catch (err) {
        console.error('[sabcreator] createApp failed', err);
        toast.error('Could not create the app. Please try again.');
      }
    });
  };

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8 space-y-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <span className="inline-flex items-center gap-1.5">
              <Rocket className="size-3.5" aria-hidden="true" />
              SabCreator
            </span>
          </PageEyebrow>
          <PageTitle>Apps</PageTitle>
          <PageDescription>
            Build internal low-code apps. Forms write to SabTables and workflows fire SabFlow.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
            New app
          </Button>
        </PageActions>
      </PageHeader>

      {items.length > 0 ? (
        <section
          aria-label="App summary"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <StatCard
            label="Total apps"
            value={<span className="tabular-nums">{stats.total}</span>}
            icon={LayoutGrid}
            accent="#6366f1"
          />
          <StatCard
            label="Published"
            value={<span className="tabular-nums">{stats.published}</span>}
            icon={CheckCircle2}
            accent="#16a34a"
          />
          <StatCard
            label="Drafts"
            value={<span className="tabular-nums">{stats.drafts}</span>}
            icon={PencilRuler}
            accent="#d97706"
          />
        </section>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No apps yet"
          description="Spin up your first low-code app. Forms write to SabTables and workflows fire SabFlow."
          action={
            <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
              Create your first app
            </Button>
          }
        />
      ) : (
        <section
          aria-label="Apps"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {items.map((app) => {
            const isPublished = app.status === 'published';
            return (
              <Card
                key={app._id}
                variant="interactive"
                padding="md"
                className="group flex flex-col gap-4 cursor-pointer"
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/dashboard/sabcreator/${app._id}/builder`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/dashboard/sabcreator/${app._id}/builder`);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="size-10 rounded-[var(--st-radius)] flex items-center justify-center shrink-0"
                      style={{ background: '#6366f11a', color: '#6366f1' }}
                      aria-hidden="true"
                    >
                      <LayoutGrid className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-semibold truncate text-[var(--st-text)]">
                        {app.name}
                      </h2>
                      <p className="text-xs text-[var(--st-text-secondary)] truncate">
                        /{app.slug}
                      </p>
                    </div>
                  </div>
                  <Badge
                    tone={isPublished ? 'success' : 'neutral'}
                    kind={isPublished ? 'soft' : 'outline'}
                    dot
                  >
                    {isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                <p className="text-sm text-[var(--st-text-secondary)] line-clamp-2 min-h-[2.5rem]">
                  {app.description || 'No description yet.'}
                </p>
                <div className="flex gap-2 mt-auto pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    block
                    iconRight={ArrowUpRight}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/sabcreator/${app._id}/builder`);
                    }}
                  >
                    Open builder
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={Eye}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/sabcreator/${app._id}/preview`);
                    }}
                  >
                    Preview
                  </Button>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new app</DialogTitle>
            <DialogDescription>
              Forms write to SabTables and workflows fire SabFlow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="App name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Inventory Tracker"
                autoFocus
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short summary of what this app does."
                rows={3}
              />
            </Field>
            <Field label="App icon">
              <SabFilePickerButton
                accept="image"
                onPick={(pick: SabFilePick) => {
                  setIconFileId(pick.id);
                  setIconName(pick.name);
                }}
              >
                {iconName ? `Icon: ${iconName}` : 'Choose icon from SabFiles'}
              </SabFilePickerButton>
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={pending}
              disabled={pending || !name.trim()}
            >
              {pending ? 'Creating' : 'Create app'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
