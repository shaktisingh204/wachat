
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function ClientPerformanceReportPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><TrendingUp /> Client Performance Report</h1>
                <p className="text-muted-foreground">This page is under construction.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">Detailed reports on client performance will be available here.</p>
                </CardContent>
            </Card>
        </div>
    )
}
