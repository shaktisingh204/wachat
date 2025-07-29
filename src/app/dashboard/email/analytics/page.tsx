
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { BarChart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function EmailAnalyticsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><BarChart /> Email Analytics</h1>
                <p className="text-muted-foreground">Analyze the performance of your email campaigns.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">Advanced email analytics, including open rates, click tracking, and heatmaps, are under development.</p>
                </CardContent>
            </Card>
        </div>
    );
}
