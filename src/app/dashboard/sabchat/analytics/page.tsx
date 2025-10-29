
'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart } from "lucide-react";

export default function SabChatAnalyticsPage() {
    return (
        <Card className="text-center py-20">
            <CardHeader>
                <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                    <BarChart className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="mt-4 text-2xl">Chat Analytics</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Coming Soon: Track chat volume, response times, and customer satisfaction.</p>
            </CardContent>
        </Card>
    );
}
