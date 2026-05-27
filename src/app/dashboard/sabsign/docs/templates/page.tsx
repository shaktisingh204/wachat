'use client';

/**
 * SabWriter template gallery — pick a starter (public or personal) and
 * instantiate a fresh document from it.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Layers, Plus } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
} from '@/components/zoruui';
import {
  listSabwriterTemplates,
  createDocumentFromTemplate,
} from '@/app/actions/sabwriter.actions';
import type { SabwriterTemplateDoc } from '@/lib/rust-client/sabwriter-templates';

type Scope = 'all' | 'mine' | 'public';

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
      router.push(`/dashboard/sabsign/docs/${created.id}`);
    } finally {
      setCreatingFrom(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/sabsign/docs" aria-label="Back to documents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-zoru-ink inline-flex items-center gap-2">
          <Layers className="h-5 w-5" /> Document templates
        </h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'public', 'mine'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={scope === s ? 'default' : 'outline'}
            onClick={() => setScope(s)}
          >
            {s === 'all' ? 'All' : s === 'public' ? 'Public' : 'My templates'}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-zoru-ink-muted">Loading templates…</p>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zoru-line p-12 text-center">
          <p className="text-sm text-zoru-ink-muted">
            No templates in this scope yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((t) => (
            <Card key={t._id}>
              <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-zoru-ink line-clamp-1">
                    {t.name}
                  </h3>
                  {t.public ? (
                    <Badge variant="outline">Public</Badge>
                  ) : (
                    <Badge variant="secondary">Mine</Badge>
                  )}
                </div>
                {t.category ? (
                  <Badge variant="outline" className="w-fit">
                    {t.category}
                  </Badge>
                ) : null}
                {t.description ? (
                  <p className="text-xs text-zoru-ink-muted line-clamp-3">
                    {t.description}
                  </p>
                ) : null}
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => handleUse(t)}
                  disabled={creatingFrom === t._id}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {creatingFrom === t._id ? 'Creating…' : 'Use template'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
