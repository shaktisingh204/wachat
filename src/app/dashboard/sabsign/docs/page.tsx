'use client';

/**
 * SabWriter documents list — extension of the e-signatures module.
 *
 * Lives at `/dashboard/sabsign/docs`. Surfaces drafts, in-review docs,
 * approved docs and docs already sent for signature, with quick CTAs to
 * create a fresh document or seed one from a SabWriter template.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Layers,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  PenLine,
  Trash2,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
} from '@/components/zoruui';
import {
  listSabwriterDocuments,
  createSabwriterDocument,
  deleteSabwriterDocument,
} from '@/app/actions/sabwriter.actions';
import type {
  SabwriterDocumentDoc,
  SabwriterDocumentStatus,
} from '@/lib/rust-client/sabwriter-documents';

type StatusFilterValue = SabwriterDocumentStatus | 'shared' | 'all';

const STATUS_FILTERS: Array<{ value: StatusFilterValue; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent_for_signature', label: 'Sent for signature' },
  { value: 'shared', label: 'Shared with me' },
];

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  in_review: 'secondary',
  approved: 'default',
  sent_for_signature: 'default',
};

function StatusIcon({ status }: { status: SabwriterDocumentStatus }) {
  switch (status) {
    case 'sent_for_signature':
      return <Send className="h-4 w-4" aria-hidden />;
    case 'approved':
      return <CheckCircle2 className="h-4 w-4" aria-hidden />;
    case 'in_review':
      return <Clock className="h-4 w-4" aria-hidden />;
    default:
      return <PenLine className="h-4 w-4" aria-hidden />;
  }
}

export default function SabwriterDocumentsListPage() {
  const router = useRouter();
  const [data, setData] = React.useState<SabwriterDocumentDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] =
    React.useState<StatusFilterValue>('all');
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSabwriterDocuments({
        status: statusFilter,
        q: search || undefined,
        limit: 100,
      });
      setData(res.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleNew = async () => {
    setCreating(true);
    try {
      const created = await createSabwriterDocument({
        title: 'Untitled document',
        contentJson: { type: 'doc', content: [] },
      });
      router.push(`/dashboard/sabsign/docs/${created.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    await deleteSabwriterDocument(id);
    load();
  };

  return (
    <EntityListShell
      title="Documents"
      subtitle="Draft, review and approve documents before sending them out for signature."
      primaryAction={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/sabsign/docs/templates">
              <Layers className="h-4 w-4 mr-2" />
              From template
            </Link>
          </Button>
          <Button onClick={handleNew} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" />
            {creating ? 'Creating…' : 'New document'}
          </Button>
        </div>
      }
      search={{
        value: search,
        onChange: setSearch,
        placeholder: 'Search documents by title…',
      }}
      loading={loading}
      empty={
        !loading && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed border-zoru-line">
            <div className="w-12 h-12 bg-zoru-surface rounded-full flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-zoru-ink-muted" />
            </div>
            <h3 className="text-lg font-medium text-zoru-ink">
              No documents yet
            </h3>
            <p className="text-sm text-zoru-ink-muted mt-1">
              Draft a document, collaborate with reviewers, then send it for
              signature.
            </p>
            <Button className="mt-4" onClick={handleNew} disabled={creating}>
              <Plus className="h-4 w-4 mr-2" />
              {creating ? 'Creating…' : 'Create your first document'}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={statusFilter === f.value ? 'default' : 'outline'}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {data.map((doc) => (
          <Card key={doc._id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/dashboard/sabsign/docs/${doc._id}`}
                  className="font-medium text-zoru-ink hover:underline line-clamp-1"
                >
                  {doc.title}
                </Link>
                <Badge variant={STATUS_BADGE[doc.status] ?? 'outline'}>
                  <span className="inline-flex items-center gap-1">
                    <StatusIcon status={doc.status} />
                    {doc.status.replace(/_/g, ' ')}
                  </span>
                </Badge>
              </div>
              <div className="text-xs text-zoru-ink-muted flex items-center justify-between">
                <span>
                  v{doc.version ?? 0} ·{' '}
                  {doc.updatedAt
                    ? new Date(doc.updatedAt).toLocaleString()
                    : new Date(doc.createdAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(doc._id)}
                  className="text-zoru-ink-muted hover:text-zoru-danger inline-flex items-center gap-1"
                  aria-label="Delete document"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </EntityListShell>
  );
}
