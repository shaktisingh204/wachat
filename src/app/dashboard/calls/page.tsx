
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PhoneCall } from 'lucide-react';

export default function CallsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <PhoneCall className="h-8 w-8" />
                    Call Logs
                </h1>
                <p className="text-muted-foreground mt-2">
                    View a history of all incoming and outgoing WhatsApp calls.
                </p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">The Call Logs feature is under development and will be available soon.</p>
                </CardContent>
            </Card>
        </div>
    );
}
