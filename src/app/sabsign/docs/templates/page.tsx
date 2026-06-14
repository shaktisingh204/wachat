'use client';

/**
 * SabWriter template gallery. Pick a starter (public or personal) and
 * instantiate a fresh document from it.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Layers, Plus } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  IconButton,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageActions,
  SegmentedControl,
  Spinner,
} from '@/components/sabcrm/20ui';
import {
  listSabwriterTemplates,
  createDocumentFromTemplate,
} from '@/app/actions/sabwriter.actions';
import type { SabwriterTemplateDoc } from '@/lib/rust-client/sabwriter-templates';

type Scope = 'all' | 'mine' | 'public';

const SCOPE_ITEMS: ReadonlyArray<{ value: Scope; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'public', label: 'Public' },
  { value: 'mine', label: 'My templates' },
];

export default function SabwriterTemplateGalleryPage() {
  const router = useRouter();
  const [templates, setTemplates] = React.useState<SabwriterTemplateDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [scope, setScope] = React.useState<Scope>('all');
  const [creatingFrom, setCreatingFrom] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSabwriterTemplates({ scope, limit: 100 });
      setTemplates(res.items);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleUse = async (t: SabwriterTemplateDoc) => {
    setCreatingFrom(t._id);
    try {
      const created = await createDocumentFromTemplate(t._id);
      router.push(`/sabsign/docs/${created.id}`);
    } finally {
      setCreatingFrom(null);
    }
  };

  return (
    <div className="20ui p-6 max-w-5xl mx-auto">
      <PageHeader>
        <div className="flex items-center gap-2">
          <IconButton
            label="Back to documents"
            icon={ArrowLeft}
            variant="ghost"
            size="sm"
            onClick={() => router.push('/sabsign/docs')}
          />
          <PageHeaderHeading>
            <PageTitle className="inline-flex items-center gap-2">
              <Layers className="h-5 w-5" aria-hidden="true" /> Document templates
            </PageTitle>
          </PageHeaderHeading>
        </div>
        <PageActions>
          <SegmentedControl<Scope>
            items={SCOPE_ITEMS}
            value={scope}
            onChange={setScope}
            size="sm"
            aria-label="Filter templates by scope"
          />
        </PageActions>
      </PageHeader>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-[var(--st-text-secondary)]">
          <Spinner size="sm" label="Loading templates" />
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Layers}
            title="No templates yet"
            description="No templates in this scope yet."
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((t) => (
            <Card key={t._id} padding="none">
              <CardBody className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-[var(--st-text)] line-clamp-1">
                    {t.name}
                  </h3>
                  {t.public ? (
                    <Badge tone="accent" kind="outline">
                      Public
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Mine</Badge>
                  )}
                </div>
                {t.category ? (
                  <Badge tone="neutral" kind="outline" className="w-fit">
                    {t.category}
                  </Badge>
                ) : null}
                {t.description ? (
                  <p className="text-xs text-[var(--st-text-secondary)] line-clamp-3">
                    {t.description}
                  </p>
                ) : null}
                <Button
                  size="sm"
                  variant="primary"
                  className="mt-2"
                  iconLeft={Plus}
                  loading={creatingFrom === t._id}
                  onClick={() => handleUse(t)}
                >
                  {creatingFrom === t._id ? 'Creating...' : 'Use template'}
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
