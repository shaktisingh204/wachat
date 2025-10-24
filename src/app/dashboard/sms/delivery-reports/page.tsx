

'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Webhook, CheckCircle } from 'lucide-react';
import { CodeBlock } from "@/components/wabasimplify/code-block";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProject } from "@/context/project-context";
import { Skeleton } from "@/components/ui/skeleton";

export default function DeliveryReportsPage() {
    const { activeProject } = useProject();

    const webhookUrl = activeProject?.smsProviderSettings?.twilio?.fromNumber
        ? `https://www.twilio.com/console/phone-numbers/${activeProject.smsProviderSettings.twilio.fromNumber}`
        : 'https://www.twilio.com/console';

    const dlrWebhookUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/webhooks/sms/dlr`
        : '';
        
    if (!activeProject) {
        return <Skeleton className="h-96 w-full" />
    }

    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Webhook />DLR Webhook Setup</CardTitle>
                        <CardDescription>
                            To receive real-time delivery reports, configure a webhook in your Twilio account.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm">Go to your Twilio phone number settings and paste the following URL into the "A MESSAGE COMES IN" webhook field, and set the method to HTTP POST.</p>
                        <CodeBlock code={dlrWebhookUrl} />
                        <Button asChild variant="outline">
                            <a href={webhookUrl} target="_blank" rel="noopener noreferrer">Go to Twilio Console</a>
                        </Button>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Real-time Status</CardTitle>
                         <CardDescription>
                            A live feed of delivery status updates from your provider.
                        </CardDescription>
                    </CardHeader>
                     <CardContent>
                        <div className="h-48 flex items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-lg">
                            <p>Real-time log coming soon.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
             <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>How DLR Works</AlertTitle>
                <AlertDescription>
                    When you send an SMS, Twilio receives it and forwards it to the carrier. The carrier then attempts to deliver it to the recipient's phone. Once the delivery status is known (e.g., delivered, undelivered, failed), Twilio sends this information back to the webhook URL you configured. Our system listens to this URL to update your message history in real time.
                </AlertDescription>
            </Alert>
        </div>
    )
}
