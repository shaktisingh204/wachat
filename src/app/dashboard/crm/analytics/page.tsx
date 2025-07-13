
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { BarChart } from 'lucide-react';

export default function AnalyticsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><BarChart /> Analytics</h1>
                <p className="text-muted-foreground">Analyze your CRM data and sales performance.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">Advanced CRM analytics are under development.</p>
                </CardContent>
            </Card>
        </div>
    );
}
