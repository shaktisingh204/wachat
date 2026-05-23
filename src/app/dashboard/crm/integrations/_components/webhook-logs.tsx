import { Card } from '@/components/zoruui';
import { getWebhookLogs } from '@/app/actions/crm-integrations.actions';

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'short',
        timeStyle: 'medium',
    }).format(d);
}

export async function WebhookLogsPreview({ integrationId }: { integrationId: string }) {
    const logs = await getWebhookLogs(integrationId);

    return (
        <Card className="p-6">
            <div className="mb-4 text-[14px] font-medium text-zoru-ink">
                Webhook Logs
            </div>
            {logs.length === 0 ? (
                <p className="text-[13px] text-zoru-ink-muted">
                    No webhook logs found for this integration yet.
                </p>
            ) : (
                <div className="space-y-4">
                    {logs.map(log => (
                        <div key={log._id} className="rounded-md border border-zoru-line p-3 text-[12.5px] bg-zoru-surface">
                            <div className="mb-2 flex items-center justify-between font-mono">
                                <span className="font-semibold text-zoru-ink">{log.method} {log.status}</span>
                                <span className="text-zoru-ink-muted">{fmtDate(log.timestamp)}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-zoru-ink-muted mb-1 font-semibold">Payload</div>
                                    <pre className="whitespace-pre-wrap max-h-32 overflow-auto bg-zoru-surface-2 p-2 rounded text-zoru-ink">
                                        {JSON.stringify(log.payload, null, 2) || '—'}
                                    </pre>
                                </div>
                                <div>
                                    <div className="text-xs text-zoru-ink-muted mb-1 font-semibold">Response</div>
                                    <pre className="whitespace-pre-wrap max-h-32 overflow-auto bg-zoru-surface-2 p-2 rounded text-zoru-ink">
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
