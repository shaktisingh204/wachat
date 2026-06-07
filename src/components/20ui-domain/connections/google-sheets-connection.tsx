'use client';

import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    CardDescription,
    Label,
} from '@/components/sabcrm/20ui';
import { CodeBlock } from '@/components/20ui-domain/code-block';

export function GoogleSheetsConnection({ flowId }: { flowId?: string }) {
    const webhookUrl = flowId ? `${process.env.NEXT_PUBLIC_APP_URL}/api/sabflow/trigger/${flowId}` : 'Save flow to generate URL';

    return (
        <div className="max-w-[90%] space-y-6 text-sm">
            <Card variant="outlined" padding="lg" className="space-y-6">
                <div className="space-y-2">
                    <Label className="text-base font-semibold">Webhook URL</Label>
                    <p className="text-xs text-[var(--st-text-secondary)]">
                        Copy this URL and paste it into the SabFlow Webhooks add-on in your Google Sheet.
                    </p>
                    <div className="overflow-x-auto">
                        <CodeBlock code={webhookUrl} />
                    </div>
                </div>

                <Card variant="ghost" padding="none" className="mt-6">
                    <CardHeader>
                        <CardTitle>Setup Instructions</CardTitle>
                        <CardDescription>Follow these steps to connect your Google Sheet.</CardDescription>
                    </CardHeader>
                    <CardBody>
                        <ol className="list-decimal list-inside space-y-3 text-[var(--st-text-secondary)]">
                            <li>Log into your Google Sheets account.</li>
                            <li>
                                Create a new spreadsheet and navigate to{' '}
                                <code className="rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] px-1">Extensions &gt; Add-ons &gt; Get add-ons</code>.
                            </li>
                            <li>
                                Search for and install the <strong className="text-[var(--st-text)]">"SabFlow Webhooks"</strong> add-on, then refresh the page.
                            </li>
                            <li>
                                Go back to{' '}
                                <code className="rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] px-1">Extensions</code>, select{' '}
                                <strong className="text-[var(--st-text)]">SabFlow Webhooks</strong>, and choose "Initial Setup".
                            </li>
                            <li>
                                Paste the Webhook URL from above and select your trigger column (the column that, when updated, will send the data).
                            </li>
                            <li>
                                Click "Send Test" to verify the webhook, then click on the "Submit" button to save the Initial setup.
                            </li>
                            <li>
                                From the SabFlow Webhooks menu under Extensions, ensure you enable the event trigger (e.g., "Send on Edit").
                            </li>
                        </ol>
                    </CardBody>
                </Card>
            </Card>
        </div>
    );
}
