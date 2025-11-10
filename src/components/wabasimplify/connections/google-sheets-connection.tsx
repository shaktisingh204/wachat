
'use client';

import { Label } from '@/components/ui/label';
import { CodeBlock } from '@/components/wabasimplify/code-block';

export function GoogleSheetsConnection({ flowId }: { flowId?: string }) {
    const webhookUrl = flowId ? `${process.env.NEXT_PUBLIC_APP_URL}/api/sabflow/trigger/${flowId}` : 'Save flow to generate URL';

    return (
        <div className="space-y-6 text-sm">
            <style>{`
                .instruction-list > li { margin-bottom: 0.75rem; }
            `}</style>
            <div style={{ maxWidth: '90%' }}>
                 <div className="space-y-2">
                    <Label className="text-base font-semibold">Webhook URL</Label>
                    <p className="text-xs text-muted-foreground">Copy this URL and paste it into the SabFlow Webhooks add-on in your Google Sheet.</p>
                    <CodeBlock code={webhookUrl} />
                </div>
                
                <div className="mt-6">
                    <h4 className="font-semibold mb-2">Setup Instructions</h4>
                    <ol className="list-decimal list-inside space-y-3 instruction-list text-muted-foreground">
                        <li>
                            Log into your Google Sheets account.
                        </li>
                        <li>
                            Create a new spreadsheet and navigate to <code className="bg-muted px-1 rounded-sm">Extensions &gt; Add-ons &gt; Get add-ons</code>.
                        </li>
                        <li>
                            Search for and install the <strong>"SabFlow Webhooks"</strong> add-on, then refresh the page.
                        </li>
                        <li>
                            Go back to <code className="bg-muted px-1 rounded-sm">Extensions</code>, select <strong>SabFlow Webhooks</strong>, and choose "Initial Setup".
                        </li>
                        <li>
                            Paste the Webhook URL from above and select your trigger column (the column that, when updated, will send the data).
                        </li>
                        <li>
                            Click "Send Test" to verify the webhook, then click "Submit" to save the setup.
                        </li>
                        <li>
                           From the SabFlow Webhooks menu under Extensions, ensure you enable the event trigger (e.g., "Send on Edit").
                        </li>
                    </ol>
                </div>
            </div>
        </div>
    )
}
