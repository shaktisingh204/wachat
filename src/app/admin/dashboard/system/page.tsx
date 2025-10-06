
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscribeAllButton } from "@/components/wabasimplify/subscribe-all-button";
import { ShieldCheck } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RunCronJobsButton } from "@/components/wabasimplify/run-cron-jobs-button";
import { PhonePeSettingsForm } from "@/components/wabasimplify/phonepe-settings-form";
import { getPaymentGatewaySettings } from "@/app/actions";
import { SyncLocalTemplatesButton } from "@/components/wabasimplify/sync-local-templates-button";
import { WebhookProcessingToggle } from "@/components/wabasimplify/webhook-processing-toggle";

export default async function SystemHealthPage() {
    const phonePeSettings = await getPaymentGatewaySettings();

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-3xl font-bold font-headline">System Health & Actions</h1>
                <p className="text-muted-foreground">
                    Perform system-wide administrative tasks. Use these actions with caution.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5" />
                        System Controls
                    </CardTitle>
                    <CardDescription>
                        These actions help maintain the system, sync data with Meta, and run scheduled tasks on demand.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <SubscribeAllButton />
                        <RunCronJobsButton />
                        <SyncLocalTemplatesButton />
                    </div>
                     <Separator />
                    <WebhookProcessingToggle />
                </CardContent>
            </Card>

            <Separator />

            <PhonePeSettingsForm settings={phonePeSettings} />

            <Separator />

        </div>
    );
}
