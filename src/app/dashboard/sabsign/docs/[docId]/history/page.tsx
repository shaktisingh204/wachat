'use client';

/**
 * SabWriter version history. Timeline of `saveSabwriterVersion` snapshots
 * with single-click restore.
 */

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, History, RotateCcw } from 'lucide-react';

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
  Spinner,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  listSabwriterVersions,
  restoreSabwriterVersion,
} from '@/app/actions/sabwriter.actions';
import type { SabwriterDocumentVersionDoc } from '@/lib/rust-client/sabwriter-versions';

export default function SabwriterVersionHistoryPage() {
  const params = useParams<{ docId: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const docId = params?.docId ?? '';
  const [versions, setVersions] = React.useState<SabwriterDocumentVersionDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [restoring, setRestoring] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    try {
      const res = await listSabwriterVersions(docId);
      setVersions(res.items);
    } catch {
      toast.error('Could not load version history.');
    } finally {
      setLoading(false);
    }
  }, [docId, toast]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleRestore = async (id: string) => {
    if (!confirm('Restore this version? The current draft will be replaced.')) {
      return;
    }
    setRestoring(id);
    try {
      await restoreSabwriterVersion(id);
      toast.success('Version restored.');
      router.push(`/dashboard/sabsign/docs/${docId}`);
    } catch {
      toast.error('Could not restore this version.');
      setRestoring(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader bordered={false} className="mb-6">
        <PageHeaderHeading>
          <div className="flex items-center gap-2">
            <IconButton
              label="Back to editor"
              icon={ArrowLeft}
              size="sm"
              onClick={() => router.push(`/dashboard/sabsign/docs/${docId}`)}
            />
            <PageTitle className="inline-flex items-center gap-2">
              <History className="h-5 w-5" aria-hidden="true" /> Version history
            </PageTitle>
          </div>
        </PageHeaderHeading>
      </PageHeader>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
          <Spinner size="sm" label="Loading versions" />
          Loading versions
        </div>
      ) : versions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No saved versions yet"
          description='Use "Save version" from the editor to create one.'
          action={
            <Button
              variant="outline"
              size="sm"
              iconLeft={ArrowLeft}
              onClick={() => router.push(`/dashboard/sabsign/docs/${docId}`)}
            >
              Back to editor
            </Button>
          }
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {versions.map((v) => (
            <li key={v._id}>
              <Card>
                <CardBody className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">v{v.version}</Badge>
                      <span className="text-sm text-[var(--st-text)]">
                        {new Date(v.savedAt).toLocaleString()}
                      </span>
                    </div>
                    {v.comment ? (
                      <p className="text-sm text-[var(--st-text-secondary)] mt-1">
                        {v.comment}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    iconLeft={RotateCcw}
                    loading={restoring === v._id}
                    onClick={() => handleRestore(v._id)}
                  >
                    {restoring === v._id ? 'Restoring' : 'Restore'}
                  </Button>
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
