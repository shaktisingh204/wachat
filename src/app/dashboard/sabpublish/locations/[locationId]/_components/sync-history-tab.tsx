'use client';

import * as React from 'react';

import {
  Badge,
  EmptyState,
  Table,
} from '@/components/sabcrm/20ui/compat';
import type { SabpublishSyncJobDoc } from '@/lib/rust-client/sabpublish-sync-jobs';

export function SabpublishSyncHistoryTab({
  initial,
}: {
  initial: SabpublishSyncJobDoc[];
}) {
  if (initial.length === 0) {
    return (
      <EmptyState
        title="No sync history yet"
        description="Run a profile sync from the Profile tab to create job rows."
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <thead>
          <tr className="text-left text-xs uppercase text-zoru-ink-muted">
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Started</th>
            <th className="px-3 py-2">Finished</th>
            <th className="px-3 py-2">Changed</th>
            <th className="px-3 py-2">Error</th>
          </tr>
        </thead>
        <tbody>
          {initial.map((j) => (
            <tr key={j._id} className="border-t text-sm">
              <td className="px-3 py-2">{j.providerId}</td>
              <td className="px-3 py-2">{j.kind}</td>
              <td className="px-3 py-2">
                <Badge variant="outline">{j.status}</Badge>
              </td>
              <td className="px-3 py-2">
                {new Date(j.startedAt).toLocaleString()}
              </td>
              <td className="px-3 py-2">
                {j.finishedAt
                  ? new Date(j.finishedAt).toLocaleString()
                  : '—'}
              </td>
              <td className="px-3 py-2">{j.changedFieldsCount}</td>
              <td className="px-3 py-2 text-zoru-ink">
                {j.errorMessage ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
