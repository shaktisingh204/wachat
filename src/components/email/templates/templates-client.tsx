'use client';

/**
 * `Your templates` + `Library` page client. Segmented button switches
 * between the two sections (per the no-tab-UI directive). New-template
 * action creates a draft and routes into the builder.
 */
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Library, Plus, SquarePen } from 'lucide-react';

import { Button, PageHeader, PageHeading, PageTitle, PageDescription, PageActions, Skeleton, cn, toast } from '@/components/sabcrm/20ui/compat';
import {
  actionCreateEmailTemplate,
  actionDeleteEmailTemplate,
  actionListEmailTemplates,
  actionListLibraryEmailTemplates,
} from '@/app/actions/email/templates.actions';
import type { EmailTemplateDoc } from '@/lib/rust-client/email-templates';
import { TemplateGrid } from './template-grid';
import { LibraryGallery } from './library-gallery';
import { emptyDocument } from './builder/block-defaults';

type Section = 'mine' | 'library';

export function TemplatesClient() {
  const router = useRouter();

  const [section, setSection] = useState<Section>('mine');
  const [mine, setMine] = useState<EmailTemplateDoc[] | null>(null);
  const [library, setLibrary] = useState<EmailTemplateDoc[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createPending, startCreate] = useTransition();

  const reloadMine = useCallback(async () => {
    const res = await actionListEmailTemplates({ limit: 100 });
    if (res.ok) {
      setMine(res.data.items);
    } else {
      setLoadError(res.error);
    }
  }, []);

  const reloadLibrary = useCallback(async () => {
    const res = await actionListLibraryEmailTemplates();
    if (res.ok) {
      setLibrary(res.data);
    } else {
      setLoadError(res.error);
    }
  }, []);

  useEffect(() => {
    reloadMine();
    reloadLibrary();
  }, [reloadMine, reloadLibrary]);

  const handleCreate = () => {
    startCreate(async () => {
      const res = await actionCreateEmailTemplate({
        name: 'Untitled template',
        builderJson: emptyDocument(),
      });
      if (res.ok) {
        router.push(`/dashboard/email/templates/${res.data._id}/builder`);
      } else {
        toast({ title: 'Could not create template', description: res.error, variant: 'destructive' });
      }
    });
  };

  const handleDelete = async (t: EmailTemplateDoc) => {
    const res = await actionDeleteEmailTemplate(t._id);
    if (res.ok) {
      toast({ title: 'Template deleted' });
      reloadMine();
    } else {
      toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-3">
              <SquarePen className="h-7 w-7" /> Email templates
            </span>
          </PageTitle>
          <PageDescription>
            Build reusable templates with the block editor or fork one from the library.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button type="button" onClick={handleCreate} disabled={createPending}>
            <Plus /> {createPending ? 'Creating…' : 'New template'}
          </Button>
        </PageActions>
      </PageHeader>

      <SegmentedButton
        value={section}
        onChange={setSection}
        options={[
          { value: 'mine',    label: 'Your templates', icon: SquarePen, count: mine?.length },
          { value: 'library', label: 'Library',        icon: Library,   count: library?.length },
        ]}
      />

      {loadError ? (
        <p className="rounded border border-[var(--st-danger)]/40 bg-[var(--st-danger)]/10 p-3 text-sm text-[var(--st-danger)]">
          Failed to load: {loadError}
        </p>
      ) : null}

      {section === 'mine' ? (
        mine === null ? (
          <SectionSkeleton />
        ) : (
          <TemplateGrid
            templates={mine}
            onDelete={handleDelete}
            emptyCta={
              <Button type="button" onClick={handleCreate} disabled={createPending}>
                <Plus /> New template
              </Button>
            }
          />
        )
      ) : library === null ? (
        <SectionSkeleton />
      ) : (
        <LibraryGallery templates={library} />
      )}
    </div>
  );
}

/* ────────── Segmented button (no tabs primitive per directive) ────────── */

interface SegOption<V extends string> {
  value: V;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

function SegmentedButton<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V;
  onChange: (v: V) => void;
  options: SegOption<V>[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Section"
      className="inline-flex overflow-hidden rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm transition-colors',
              active
                ? 'bg-[var(--st-text)] text-[var(--st-text-inverted)]'
                : 'text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]',
            )}
          >
            <Icon className="h-4 w-4" />
            {opt.label}
            {typeof opt.count === 'number' ? (
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-xs',
                active ? 'bg-white/20' : 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]',
              )}>
                {opt.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[4/3] w-full rounded-md" />
      ))}
    </div>
  );
}
