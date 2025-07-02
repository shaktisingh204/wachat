
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CleanDatabaseButton } from "@/components/wabasimplify/clean-database-button";
import { SubscribeAllButton } from "@/components/wabasimplify/subscribe-all-button";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RunCronJobsButton } from "@/components/wabasimplify/run-cron-jobs-button";
import { PhonePeSettingsForm } from "@/components/wabasimplify/phonepe-settings-form";
import { getPaymentGatewaySettings } from "@/app/actions";

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

            <Card className="card-gradient card-gradient-green">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5" />
                        System Actions
                    </CardTitle>
                    <CardDescription>
                        These actions help maintain the system, sync data with Meta, and run scheduled tasks on demand.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <SubscribeAllButton />
                    <RunCronJobsButton />
                </CardContent>
            </Card>

            <Separator />

            <PhonePeSettingsForm settings={phonePeSettings} />

            <Separator />

             <Card className="border-destructive card-gradient">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                         <AlertTriangle className="h-5 w-5" />
                        Dangerous Actions
                    </CardTitle>
                    <CardDescription>
                        This action can result in permanent data loss.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CleanDatabaseButton />
                </CardContent>
            </Card>
        </div>
    );
}
