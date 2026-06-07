'use client';

import * as React from 'react';
import { InquiryRecord } from '../types';
import {
  Input,
  Field,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
  EmptyState,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { Search, Inbox } from 'lucide-react';

const STATUS_TONE: Record<InquiryRecord['status'], BadgeTone> = {
  approved: 'success',
  rejected: 'danger',
  error: 'danger',
  pending: 'warning',
};

export function RequestsTable({ requests, isLoading }: { requests: InquiryRecord[], isLoading: boolean }) {
  const [filter, setFilter] = React.useState('');
  const [sortField, setSortField] = React.useState<keyof InquiryRecord>('createdAt');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const handleSort = (field: keyof InquiryRecord) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filtered = React.useMemo(() => {
    return requests.filter(r =>
      r.organization.toLowerCase().includes(filter.toLowerCase()) ||
      r.email.toLowerCase().includes(filter.toLowerCase())
    ).sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [requests, filter, sortField, sortDir]);

  const sortDirOf = (field: keyof InquiryRecord) => (sortField === field ? sortDir : null);

  if (!mounted) return null; // Prevent hydration mismatch on dates if rendered immediately

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <Field>
          <Input
            inputSize="sm"
            iconLeft={Search}
            placeholder="Filter by organization or email..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            aria-label="Filter requests by organization or email"
          />
        </Field>
      </div>

      <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
        <Table density="compact" hover>
          <THead>
            <Tr>
              <Th sortable sortDirection={sortDirOf('organization')} onSort={() => handleSort('organization')}>
                Organization
              </Th>
              <Th sortable sortDirection={sortDirOf('email')} onSort={() => handleSort('email')}>
                Email
              </Th>
              <Th sortable sortDirection={sortDirOf('volume')} onSort={() => handleSort('volume')}>
                Volume
              </Th>
              <Th sortable sortDirection={sortDirOf('status')} onSort={() => handleSort('status')}>
                Status
              </Th>
              <Th sortable sortDirection={sortDirOf('createdAt')} onSort={() => handleSort('createdAt')}>
                Date
              </Th>
            </Tr>
          </THead>
          <TBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Tr key={i}>
                  <Td><div className="h-3 w-24 animate-pulse rounded bg-[var(--st-bg-secondary)]" /></Td>
                  <Td><div className="h-3 w-32 animate-pulse rounded bg-[var(--st-bg-secondary)]" /></Td>
                  <Td><div className="h-3 w-16 animate-pulse rounded bg-[var(--st-bg-secondary)]" /></Td>
                  <Td><div className="h-3 w-16 animate-pulse rounded bg-[var(--st-bg-secondary)]" /></Td>
                  <Td><div className="h-3 w-20 animate-pulse rounded bg-[var(--st-bg-secondary)]" /></Td>
                </Tr>
              ))
            ) : filtered.length === 0 ? (
              <Tr>
                <Td colSpan={5}>
                  <EmptyState
                    icon={Inbox}
                    size="sm"
                    title="No inquiries found"
                    description="No enterprise requests match your filter yet."
                  />
                </Td>
              </Tr>
            ) : (
              filtered.map(req => (
                <Tr key={req.id}>
                  <Td className="font-medium text-[var(--st-text)]">{req.organization}</Td>
                  <Td className="text-[var(--st-text-secondary)]">{req.email}</Td>
                  <Td className="text-[var(--st-text-secondary)]">{req.volume}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[req.status]} className="uppercase">
                      {req.status}
                    </Badge>
                  </Td>
                  <Td className="text-[var(--st-text-tertiary)]">{new Date(req.createdAt).toLocaleString()}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
