
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WaPayIcon } from "@/components/wabasimplify/custom-sidebar-components";

export default function WhatsAppPayPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <WaPayIcon className="h-8 w-8" />
                    WhatsApp Pay
                </h1>
                <p className="text-muted-foreground mt-2">
                    Manage your payment configurations and view transaction history.
                </p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">The WhatsApp Pay integration is under development and will be available soon.</p>
                </CardContent>
            </Card>
        </div>
    );
}
