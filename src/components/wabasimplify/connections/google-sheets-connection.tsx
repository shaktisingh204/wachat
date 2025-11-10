
'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { useToast } from '@/hooks/use-toast';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useProject } from '@/context/project-context';

export function GoogleSheetsConnection({ flowId }: { flowId?: string }) {
    const { toast } = useToast();
    const { copy } = useCopyToClipboard();
    const webhookUrl = flowId ? `${process.env.NEXT_PUBLIC_APP_URL}/api/sabflow/trigger/${flowId}` : 'Save flow to generate URL';

    const appsScriptCode = `
function sendDataToSabFlow(e) {
  // If the event object doesn't exist (e.g., manual run), do nothing.
  if (!e || !e.source) {
    Logger.log("Manual run detected, skipping data send.");
    return;
  }
  
  var sheet = e.source.getActiveSheet();
  var range = e.range;

  // Optional: Only trigger for a specific sheet name
  // if (sheet.getName() !== "YourSheetName") return;

  // Get data from the edited row
  var row = range.getRow();
  var rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Map headers to a JSON object
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var data = {};
  for (var i = 0; i < headers.length; i++) {
    data[headers[i]] = rowData[i];
  }

  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(data)
  };

  UrlFetchApp.fetch("${webhookUrl}", options);
}

function createTrigger() {
  var sheet = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("sendDataToSabFlow")
    .forSpreadsheet(sheet)
    .onEdit()
    .create();
}
    `;
    
    return (
        <div className="space-y-6">
            <h3 className="font-semibold text-center">Connect via Webhook</h3>
            <div style={{ maxWidth: '90%' }}>
                <ol className="list-decimal list-inside space-y-4 text-sm">
                    <li>
                        <strong>Copy your unique Webhook URL:</strong>
                        <CodeBlock code={webhookUrl} />
                    </li>
                     <li>
                        <strong>Open your Google Sheet</strong> and go to <code className="bg-muted px-1 rounded-sm">Extensions &gt; Apps Script</code>.
                    </li>
                    <li>
                        <strong>Paste the Script:</strong> Delete any existing code and paste the following script into the editor.
                        <CodeBlock code={appsScriptCode} style={{overflow: 'scroll'}} />
                    </li>
                     <li>
                        <strong>Save and Run:</strong> Save the project. Then, from the dropdown menu that says "Select function", choose <strong>`createTrigger`</strong> and click the **Run** button. You will need to authorize the script's permissions the first time.
                    </li>
                </ol>
            </div>
             <p className="text-xs text-muted-foreground text-center">
                That's it! Now, whenever you edit a row in your sheet, the data will be sent to your SabFlow workflows that use the "Webhook Received" trigger.
            </p>
        </div>
    )
}
