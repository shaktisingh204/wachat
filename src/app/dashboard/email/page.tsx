
'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Mail } from 'lucide-react';

export default function EmailDashboardPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Mail /> Email Suite</h1>
                <p className="text-muted-foreground">Your central hub for email communications.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">The unified inbox to view and manage all your synced emails is under development.</p>
                </CardContent>
            </Card>
        </div>
    );
}
