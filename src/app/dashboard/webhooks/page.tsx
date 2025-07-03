

import { WebhookInfo } from "@/components/wabasimplify/webhook-info";
import { WebhookLogs } from "@/components/wabasimplify/webhook-logs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lightbulb } from "lucide-react";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Webhooks | SabNode",
};

export default function WebhooksPage() {
    const verifyToken = process.env.META_VERIFY_TOKEN;
    const webhookPath = '/api/webhooks/meta';

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Webhooks Configuration</h1>
                <p className="text-muted-foreground">
                    Use this information to set up your webhook in the Meta for Developers dashboard.
                </p>
            </div>

            <WebhookInfo webhookPath={webhookPath} verifyToken={verifyToken} />
            
            <Card className="card-gradient card-gradient-orange">
                <CardHeader>
                    <CardTitle>How to Use This Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-foreground/90">
                    <ol className="list-decimal list-inside space-y-2">
                        <li>Go to your Meta App's dashboard and select the **Webhooks** product.</li>
                        <li>Click **Edit subscription** for the "WhatsApp Business Account" object.</li>
                        <li>In the popup, paste the **Callback URL** and the **Verify token** from above into the corresponding fields.</li>
                        <li>Click **Verify and save**.</li>
                        <li>**This is the most important step:** After verifying, go to the Webhook Fields section for `whatsapp_business_account` and click **Edit**.</li>
                        <li>Subscribe to the events you want to receive. For full functionality, it is recommended to subscribe to all events, especially `messages`, `message_template_status_update`, and `phone_number_quality_update`.</li>
                    </ol>
                    <Alert>
                        <Lightbulb className="h-4 w-4" />
                        <AlertTitle>Important</AlertTitle>
                        <AlertDescription>
                            Your application must be deployed to a public URL for Meta's servers to be able to send requests to your Callback URL. Test events work from the dashboard, but real events require a public endpoint.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            <WebhookLogs />
        </div>
    )
}
