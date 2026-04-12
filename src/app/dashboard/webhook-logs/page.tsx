'use client';

/**
 * Wachat Webhook Logs — dedicated webhook event log viewer.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuWebhook, LuChevronDown, LuChevronRight, LuRefreshCw } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

interface WebhookLog {
  id: string;
  timestamp: string;
  event: string;
  status: 'success' | 'failed';
  payload: Record<string, unknown>;
}

const MOCK_LOGS: WebhookLog[] = [
  { id: '1', timestamp: '2026-04-12 14:32:08', event: 'message.received', status: 'success', payload: { from: '+1234567890', body: 'Hello!', type: 'text', messageId: 'msg_abc123' } },
  { id: '2', timestamp: '2026-04-12 14:30:15', event: 'message.sent', status: 'success', payload: { to: '+9876543210', body: 'Order confirmed', templateId: 'tpl_456' } },
  { id: '3', timestamp: '2026-04-12 14:28:42', event: 'message.delivered', status: 'failed', payload: { error: 'Timeout', statusCode: 504, messageId: 'msg_def789' } },
  { id: '4', timestamp: '2026-04-12 14:25:00', event: 'contact.created', status: 'success', payload: { contactId: 'ct_123', name: 'New User', phone: '+5551234567' } },
  { id: '5', timestamp: '2026-04-12 14:20:33', event: 'message.read', status: 'success', payload: { messageId: 'msg_ghi012', readAt: '2026-04-12T14:20:30Z' } },
  { id: '6', timestamp: '2026-04-12 14:15:10', event: 'broadcast.completed', status: 'failed', payload: { broadcastId: 'bc_999', error: 'Rate limit exceeded', sent: 450, total: 500 } },
];

const EVENT_COLORS: Record<string, string> = {
  'message.received': 'bg-green-100 text-green-700',
  'message.sent': 'bg-blue-100 text-blue-700',
  'message.delivered': 'bg-purple-100 text-purple-700',
  'message.read': 'bg-cyan-100 text-cyan-700',
  'contact.created': 'bg-amber-100 text-amber-700',
  'broadcast.completed': 'bg-pink-100 text-pink-700',
};

export default function WebhookLogsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [logs] = useState<WebhookLog[]>(MOCK_LOGS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const truncateJson = (obj: Record<string, unknown>) => {
    const str = JSON.stringify(obj);
    return str.length > 60 ? str.slice(0, 60) + '...' : str;
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Webhook Logs' },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Webhook Logs</h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">View incoming and outgoing webhook event logs.</p>
        </div>
        <ClayButton size="sm" variant="ghost" onClick={() => toast({ title: 'Refreshed', description: 'Logs reloaded.' })}>
          <LuRefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </ClayButton>
      </div>

      <ClayCard padded={false} className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
              <th className="px-5 py-3 w-8" />
              <th className="px-5 py-3">Timestamp</th>
              <th className="px-5 py-3">Event</th>
              <th className="px-5 py-3">Payload</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <React.Fragment key={log.id}>
                <tr
                  onClick={() => toggleExpand(log.id)}
                  className="border-b border-clay-border cursor-pointer hover:bg-clay-bg-2 transition-colors"
                >
                  <td className="px-5 py-3">
                    {expandedId === log.id
                      ? <LuChevronDown className="h-3.5 w-3.5 text-clay-ink-muted" />
                      : <LuChevronRight className="h-3.5 w-3.5 text-clay-ink-muted" />}
                  </td>
                  <td className="px-5 py-3 text-[13px] font-mono text-clay-ink-muted whitespace-nowrap">{log.timestamp}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${EVENT_COLORS[log.event] || 'bg-gray-100 text-gray-700'}`}>
                      {log.event}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[12px] font-mono text-clay-ink-muted max-w-[300px] truncate">
                    {truncateJson(log.payload)}
                  </td>
                  <td className="px-5 py-3">
                    <ClayBadge tone={log.status === 'success' ? 'green' : 'red'}>
                      {log.status}
                    </ClayBadge>
                  </td>
                </tr>
                {expandedId === log.id && (
                  <tr className="border-b border-clay-border bg-clay-bg-2">
                    <td colSpan={5} className="px-5 py-4">
                      <p className="text-[11px] font-semibold text-clay-ink-muted uppercase mb-2">Full Payload</p>
                      <pre className="rounded-lg bg-clay-bg p-4 text-[12px] font-mono text-clay-ink overflow-x-auto">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
