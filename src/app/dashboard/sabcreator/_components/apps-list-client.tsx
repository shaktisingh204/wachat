'use client';

/**
 * SabCreator, apps grid. 20ui primitives only; SabFiles for icons.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutGrid, Plus, Rocket } from 'lucide-react';

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
  PageTitle,
  PageDescription,
  PageActions,
  EmptyState,
  Badge,
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
    <div className="px-6 py-8 space-y-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>SabCreator</PageTitle>
          <PageDescription>
            Build internal low-code apps backed by SabTables and SabFlow.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
            New app
          </Button>
        </PageActions>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No apps yet"
          description="Spin up your first low-code app. Forms write to SabTables, workflows fire SabFlow."
          action={
            <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
              Create your first app
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((app) => (
            <Card key={app._id} padding="md" className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="size-10 rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] flex items-center justify-center shrink-0">
                    <LayoutGrid className="size-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold truncate text-[var(--st-text)]">{app.name}</div>
                    <div className="text-xs text-[var(--st-text-secondary)] truncate">/{app.slug}</div>
                  </div>
                </div>
                <Badge tone={app.status === 'published' ? 'success' : 'neutral'} kind={app.status === 'published' ? 'soft' : 'outline'}>
                  {app.status}
                </Badge>
              </div>
              {app.description ? (
                <p className="text-sm text-[var(--st-text-secondary)] line-clamp-2">{app.description}</p>
              ) : null}
              <div className="flex gap-2 mt-auto pt-2">
                <Link
                  href={`/dashboard/sabcreator/${app._id}/builder`}
                  className="u-btn u-btn--outline u-btn--sm flex-1"
                >
                  <span className="u-btn__label">Open builder</span>
                </Link>
                <Link
                  href={`/dashboard/sabcreator/${app._id}/preview`}
                  className="u-btn u-btn--ghost u-btn--sm"
                >
                  <span className="u-btn__label">Preview</span>
                </Link>
              </div>
            </Card>
          ))}
        </div>
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
    </div>
  );
}
