'use client';

/**
 * "Your templates" + "Library" page client. A SegmentedControl switches between
 * the two sections (per the no-tab-UI directive). The new-template action
 * creates a draft and routes into the builder. Pure 20ui.
 */
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Library, Plus, SquarePen } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  PageHeader,
  PageHeading,
  PageTitle,
  PageDescription,
  PageActions,
  SegmentedControl,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
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
  const { toast } = useToast();

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
        toast.error({ title: 'Could not create template', description: res.error });
      }
    });
  };

  const handleDelete = async (t: EmailTemplateDoc) => {
    const res = await actionDeleteEmailTemplate(t._id);
    if (res.ok) {
      toast.success('Template deleted');
      reloadMine();
    } else {
      toast.error({ title: 'Delete failed', description: res.error });
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
          <Button
            type="button"
            iconLeft={Plus}
            onClick={handleCreate}
            loading={createPending}
          >
            {createPending ? 'Creating' : 'New template'}
          </Button>
        </PageActions>
      </PageHeader>

      <SegmentedControl<Section>
        aria-label="Section"
        value={section}
        onChange={setSection}
        items={[
          {
            value: 'mine',
            icon: SquarePen,
            label: <SectionLabel text="Your templates" count={mine?.length} />,
          },
          {
            value: 'library',
            icon: Library,
            label: <SectionLabel text="Library" count={library?.length} />,
          },
        ]}
      />

      {loadError ? (
        <Alert tone="danger" title="Failed to load templates">
          {loadError}
        </Alert>
      ) : null}

      {section === 'mine' ? (
        mine === null ? (
          <SectionSkeleton />
        ) : (
          <TemplateGrid
            templates={mine}
            onDelete={handleDelete}
            emptyCta={
              <Button
                type="button"
                iconLeft={Plus}
                onClick={handleCreate}
                loading={createPending}
              >
                New template
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

/** Segment label with an optional count badge folded in (SegmentedControl has no native count slot). */
function SectionLabel({ text, count }: { text: string; count?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      {text}
      {typeof count === 'number' ? (
        <Badge tone="neutral" kind="soft">
          {count}
        </Badge>
      ) : null}
    </span>
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
