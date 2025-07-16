

'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PhoneCall } from 'lucide-react';

export default function CallsPage() {
    return (
        <div className="flex flex-col gap-8">
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Call Logs</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">The Call Logs feature is under development and will be available soon.</p>
                </CardContent>
            </Card>
        </div>
    );
}
