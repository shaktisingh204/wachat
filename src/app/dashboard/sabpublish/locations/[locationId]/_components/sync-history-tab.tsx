'use client';

import * as React from 'react';
import { History } from 'lucide-react';

import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import type { SabpublishSyncJobDoc } from '@/lib/rust-client/sabpublish-sync-jobs';

function statusTone(status: string): BadgeTone {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
    case 'succeeded':
      return 'success';
    case 'failed':
    case 'error':
      return 'danger';
    case 'running':
    case 'in_progress':
    case 'pending':
    case 'queued':
      return 'info';
    default:
      return 'neutral';
  }
}

export function SabpublishSyncHistoryTab({
  initial,
}: {
  initial: SabpublishSyncJobDoc[];
}) {
  if (initial.length === 0) {
    return (
      <Card>
        <CardBody className="p-6">
          <EmptyState
            icon={History}
            title="No sync history yet"
            description="Run a profile sync from the Profile tab to create job rows here."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <Table>
          <THead>
            <Tr>
              <Th>Provider</Th>
              <Th>Job</Th>
              <Th align="right">Status</Th>
              <Th>Started</Th>
              <Th>Finished</Th>
              <Th align="right">Changed</Th>
              <Th>Error</Th>
            </Tr>
          </THead>
          <TBody>
            {initial.map((j) => (
              <Tr key={j._id}>
                <Td>
                  <span className="font-medium">{j.providerId}</span>
                </Td>
                <Td>{j.kind}</Td>
                <Td align="right">
                  <Badge tone={statusTone(j.status)}>{j.status}</Badge>
                </Td>
                <Td className="tabular-nums text-[var(--st-text-secondary)]">
                  {new Date(j.startedAt).toLocaleString()}
                </Td>
                <Td className="tabular-nums text-[var(--st-text-secondary)]">
                  {j.finishedAt
                    ? new Date(j.finishedAt).toLocaleString()
                    : '—'}
                </Td>
                <Td align="right" className="tabular-nums">
                  {j.changedFieldsCount}
                </Td>
                <Td className="text-[var(--st-danger)]">
                  {j.errorMessage ?? ''}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
