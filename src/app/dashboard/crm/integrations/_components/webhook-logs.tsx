import { Card } from '@/components/sabcrm/20ui';
import { getWebhookLogs } from '@/app/actions/crm-integrations.actions';

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: 'UTC'
    }).format(d);
}

export async function WebhookLogsPreview({ integrationId }: { integrationId: string }) {
    const logs = await getWebhookLogs(integrationId);

    return (
        <Card className="p-6">
            <div className="mb-4 text-[14px] font-medium text-[var(--st-text)]">
                Webhook Logs
            </div>
            {logs.length === 0 ? (
                <p className="text-[13px] text-[var(--st-text-secondary)]">
                    No webhook logs found for this integration yet.
                </p>
            ) : (
                <div className="space-y-4">
                    {logs.map(log => (
                        <div key={log._id} className="rounded-md border border-[var(--st-border)] p-3 text-[12.5px] bg-[var(--st-bg-secondary)]">
                            <div className="mb-2 flex items-center justify-between font-mono">
                                <span className="font-semibold text-[var(--st-text)]">{log.method} {log.status}</span>
                                <span className="text-[var(--st-text-secondary)]">{fmtDate(log.timestamp)}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-[var(--st-text-secondary)] mb-1 font-semibold">Payload</div>
                                    <pre className="whitespace-pre-wrap max-h-32 overflow-auto bg-[var(--st-bg-muted)] p-2 rounded text-[var(--st-text)]">
                                        {JSON.stringify(log.payload, null, 2) || '—'}
                                    </pre>
                                </div>
                                <div>
                                    <div className="text-xs text-[var(--st-text-secondary)] mb-1 font-semibold">Response</div>
                                    <pre className="whitespace-pre-wrap max-h-32 overflow-auto bg-[var(--st-bg-muted)] p-2 rounded text-[var(--st-text)]">
                                        {JSON.stringify(log.response, null, 2) || '—'}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
