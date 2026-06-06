'use client';

/**
 * Per-envelope audit log viewer. Each row is one event from the
 * append-only `esign_audit` collection.
 */

import * as React from 'react';
import { useParams } from 'next/navigation';
import { FileClock } from 'lucide-react';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageActions,
  Spinner,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import { getEnvelopeAudit } from '@/app/actions/sabsign.actions';
import type { EsignAuditEvent } from '@/lib/rust-client/esign-audit';

export default function EnvelopeAuditPage() {
  const params = useParams<{ id: string }>();
  const [events, setEvents] = React.useState<EsignAuditEvent[]>([]);
  const [chainValid, setChainValid] = React.useState(true);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getEnvelopeAudit(params.id);
        if (!mounted) return;
        setEvents(res.items);
        setChainValid(res.chainValid);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [params.id]);

  return (
    <div className="ui20 p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Audit trail</PageTitle>
        </PageHeaderHeading>
        <PageActions>
          <Badge tone={chainValid ? 'success' : 'danger'} kind="soft" dot>
            {chainValid ? 'Hash chain valid' : 'Tampered'}
          </Badge>
        </PageActions>
      </PageHeader>

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-[var(--st-text-secondary)]">
            <Spinner size="sm" label="Loading audit trail" />
            <span>Loading...</span>
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={FileClock}
            title="No events yet"
            description="Audit events appear here as this envelope moves through signing."
          />
        ) : (
          <Table density="compact">
            <THead>
              <Tr>
                <Th>Timestamp</Th>
                <Th>Event</Th>
                <Th>Signer</Th>
                <Th>IP</Th>
                <Th>Hash</Th>
              </Tr>
            </THead>
            <TBody>
              {events.map((ev) => (
                <Tr key={ev._id}>
                  <Td className="text-[var(--st-text-secondary)]">
                    {new Date(ev.ts).toLocaleString()}
                  </Td>
                  <Td>
                    <Badge tone="neutral" kind="outline">
                      {ev.eventType}
                    </Badge>
                  </Td>
                  <Td>{ev.signerId || '-'}</Td>
                  <Td className="text-[var(--st-text-secondary)]">{ev.ip || '-'}</Td>
                  <Td truncate className="font-mono text-xs text-[var(--st-text-secondary)] max-w-[200px]">
                    {ev.hash.slice(0, 16)}...
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
