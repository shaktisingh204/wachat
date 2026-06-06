'use client';

/**
 * SabWriter version history — timeline of `saveSabwriterVersion` snapshots
 * with single-click restore.
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, History, RotateCcw } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
} from '@/components/sabcrm/20ui/compat';
import {
  listSabwriterVersions,
  restoreSabwriterVersion,
} from '@/app/actions/sabwriter.actions';
import type { SabwriterDocumentVersionDoc } from '@/lib/rust-client/sabwriter-versions';

export default function SabwriterVersionHistoryPage() {
  const params = useParams<{ docId: string }>();
  const router = useRouter();
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
    } finally {
      setLoading(false);
    }
  }, [docId]);

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
      router.push(`/dashboard/sabsign/docs/${docId}`);
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link
            href={`/dashboard/sabsign/docs/${docId}`}
            aria-label="Back to editor"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-zoru-ink inline-flex items-center gap-2">
          <History className="h-5 w-5" /> Version history
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-zoru-ink-muted">Loading versions…</p>
      ) : versions.length === 0 ? (
        <p className="text-sm text-zoru-ink-muted">
          No saved versions yet. Use "Save version" from the editor to create
          one.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {versions.map((v) => (
            <li key={v._id}>
              <Card>
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">v{v.version}</Badge>
                      <span className="text-sm text-zoru-ink">
                        {new Date(v.savedAt).toLocaleString()}
                      </span>
                    </div>
                    {v.comment ? (
                      <p className="text-sm text-zoru-ink-muted mt-1">
                        {v.comment}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestore(v._id)}
                    disabled={restoring === v._id}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {restoring === v._id ? 'Restoring…' : 'Restore'}
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
