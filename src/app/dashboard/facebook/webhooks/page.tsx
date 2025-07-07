
'use client';

import { WebhookLogs } from "@/components/wabasimplify/webhook-logs";
import { Webhook } from "lucide-react";


export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Facebook Webhooks | SabNode",
};

export default function FacebookWebhooksPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Webhook className="h-8 w-8"/>
                    Facebook Webhook Logs
                </h1>
                <p className="text-muted-foreground">
                    A real-time log of events received from Meta for your Facebook Page.
                </p>
            </div>
            <WebhookLogs />
        </div>
    )
}
