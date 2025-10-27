
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LayoutList } from "lucide-react";

export default function LeadsSummaryPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><LayoutList /> Leads Summary</h1>
                <p className="text-muted-foreground">This page is under construction.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">A summary of your lead activity will be shown here.</p>
                </CardContent>
            </Card>
        </div>
    )
}
