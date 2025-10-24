
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { CodeBlock } from "@/components/wabasimplify/code-block";
import { Button } from "@/components/ui/button";
import { Key, Server, Webhook } from 'lucide-react';
import Link from 'next/link';

export default function SmsIntegrationsPage() {
    const apiKey = "YOUR_API_KEY"; // Placeholder
    const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/sms/dlr` : '';

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> API Access</CardTitle>
                    <CardDescription>Use your account API key to send SMS programmatically.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm">First, get your API key from the main <Link href="/dashboard/api" className="text-primary hover:underline">API settings page</Link>. Then, use it in the `Authorization` header of your requests.</p>
                     <div>
                        <h4 className="font-semibold text-sm mb-2">Send Single SMS</h4>
                        <CodeBlock language="bash" code={`curl -X POST \\
  https://yourapp.com/api/v1/messages/send-text \\
  -H 'Authorization: Bearer ${apiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "phoneNumberId": "YOUR_TWILIO_NUMBER_ID", 
    "waId": "RECIPIENT_PHONE_NUMBER", 
    "messageText": "Hello from the API!"
  }'`} />
                    </div>
                     <div>
                        <h4 className="font-semibold text-sm mb-2">Send DLT Template</h4>
                        <CodeBlock language="bash" code={`curl -X POST \\
  https://yourapp.com/api/v1/sms/send-template \\
  -H 'Authorization: Bearer ${apiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "recipient": "RECIPIENT_PHONE_NUMBER",
    "dltTemplateId": "YOUR_DLT_TEMPLATE_ID",
    "headerId": "YOUR_SENDER_ID",
    "variables": {
        "var1": "John",
        "var2": "your appointment"
    }
  }'`} />
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" /> Webhook Management</CardTitle>
                    <CardDescription>Configure webhooks to receive real-time status updates.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm">To get delivery reports (DLRs) from your SMS provider, set the following URL in your provider's dashboard (e.g., Twilio's phone number configuration).</p>
                    <CodeBlock code={webhookUrl} />
                </CardContent>
            </Card>
        </div>
    )
}
