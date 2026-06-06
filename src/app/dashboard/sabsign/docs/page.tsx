'use client';

/**
 * SabWriter documents list, an extension of the e-signatures module.
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
  Search,
  Send,
  CheckCircle2,
  Clock,
  PenLine,
  Trash2,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SegmentedControl,
  Skeleton,
  useToast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
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

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  in_review: 'warning',
  approved: 'success',
  sent_for_signature: 'info',
};

function StatusIcon({ status }: { status: SabwriterDocumentStatus }) {
  switch (status) {
    case 'sent_for_signature':
      return <Send className="h-3.5 w-3.5" aria-hidden="true" />;
    case 'approved':
      return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
    case 'in_review':
      return <Clock className="h-3.5 w-3.5" aria-hidden="true" />;
    default:
      return <PenLine className="h-3.5 w-3.5" aria-hidden="true" />;
  }
}

export default function SabwriterDocumentsListPage() {
  const router = useRouter();
  const { toast } = useToast();
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
      toast.error('Could not load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, toast]);

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
    } catch (err) {
      console.error(err);
      toast.error('Could not create the document. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    try {
      await deleteSabwriterDocument(id);
      toast.success('Document deleted.');
      load();
    } catch (err) {
      console.error(err);
      toast.error('Could not delete the document. Please try again.');
    }
  };

  const showEmpty = !loading && data.length === 0;

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Documents</PageTitle>
          <PageDescription>
            Draft, review and approve documents before sending them out for
            signature.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="outline"
            size="sm"
            iconLeft={Layers}
            onClick={() => router.push('/dashboard/sabsign/docs/templates')}
          >
            From template
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            onClick={handleNew}
            loading={creating}
          >
            {creating ? 'Creating' : 'New document'}
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          aria-label="Filter documents by status"
          items={STATUS_FILTERS}
          value={statusFilter}
          onChange={setStatusFilter}
          size="sm"
        />
        <div className="w-full sm:w-72">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents by title"
            iconLeft={Search}
            aria-label="Search documents by title"
          />
        </div>
      </div>

      {loading ? (
        <div
          className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
          aria-live="polite"
          aria-busy="true"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={108} radius="var(--st-radius)" />
          ))}
        </div>
      ) : showEmpty ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Draft a document, collaborate with reviewers, then send it for signature."
          action={
            <Button
              variant="primary"
              iconLeft={Plus}
              onClick={handleNew}
              loading={creating}
            >
              {creating ? 'Creating' : 'Create your first document'}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((doc) => (
            <Card key={doc._id} variant="interactive" padding="none">
              <CardBody className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/dashboard/sabsign/docs/${doc._id}`}
                    className="line-clamp-1 font-medium text-[var(--st-text)] hover:underline"
                  >
                    {doc.title}
                  </Link>
                  <Badge tone={STATUS_TONE[doc.status] ?? 'neutral'}>
                    <span className="inline-flex items-center gap-1">
                      <StatusIcon status={doc.status} />
                      {doc.status.replace(/_/g, ' ')}
                    </span>
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
                  <span>
                    v{doc.version ?? 0} ·{' '}
                    {doc.updatedAt
                      ? new Date(doc.updatedAt).toLocaleString()
                      : new Date(doc.createdAt).toLocaleString()}
                  </span>
                  <IconButton
                    label="Delete document"
                    icon={Trash2}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(doc._id)}
                  />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
