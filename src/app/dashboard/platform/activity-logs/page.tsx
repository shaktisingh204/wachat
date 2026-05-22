'use client';

import { useEffect, useState } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Table, ZoruTableHeader, ZoruTableBody, ZoruTableRow, ZoruTableHead, ZoruTableCell, Card } from '@/components/zoruui';
import { getActivityLogs } from '@/app/actions/platform/activity-logs.actions';
import type { ActivityLog } from '@/types/platform';

export default function ActivityLogsPage() {
  const [data, setData] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getActivityLogs().then(res => {
      setData(res);
      setLoading(false);
    });
  }, []);

  const filteredData = data.filter(d => 
    d.action.toLowerCase().includes(query.toLowerCase()) || 
    d.entityType.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <EntityListShell
      title="Platform Activity Logs"
      subtitle="Audit trail of all actions across the system."
      search={{ value: query, onChange: setQuery, placeholder: 'Search logs...' }}
      loading={loading}
    >
      <Card className="border-zoru-line bg-zoru-bg overflow-hidden">
        <Table>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead>Timestamp</ZoruTableHead>
              <ZoruTableHead>Action</ZoruTableHead>
              <ZoruTableHead>Entity</ZoruTableHead>
              <ZoruTableHead>User ID</ZoruTableHead>
              <ZoruTableHead>IP Address</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filteredData.map(item => (
              <ZoruTableRow key={item.id}>
                <ZoruTableCell className="text-sm text-zoru-ink-light">{new Date(item.timestamp).toLocaleString()}</ZoruTableCell>
                <ZoruTableCell className="font-medium text-zoru-ink">{item.action}</ZoruTableCell>
                <ZoruTableCell className="text-sm">
                  <span className="bg-zoru-neutral-hover px-2 py-1 rounded-md mr-2">{item.entityType}</span>
                  <span className="text-zoru-ink-light font-mono text-xs">{item.entityId}</span>
                </ZoruTableCell>
                <ZoruTableCell className="font-mono text-xs">{item.userId || 'system'}</ZoruTableCell>
                <ZoruTableCell className="text-sm">{item.ipAddress || '—'}</ZoruTableCell>
              </ZoruTableRow>
            ))}
            {filteredData.length === 0 && !loading && (
              <ZoruTableRow>
                <ZoruTableCell colSpan={5} className="text-center py-8 text-zoru-ink-light">No logs found.</ZoruTableCell>
              </ZoruTableRow>
            )}
          </ZoruTableBody>
        </Table>
      </Card>
    </EntityListShell>
  );
}
