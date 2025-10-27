
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GitFork } from "lucide-react";

export default function AllPipelinesPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><GitFork /> All Pipelines</h1>
                <p className="text-muted-foreground">This page is under construction.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">Manage all your sales pipelines from this central location.</p>
                </CardContent>
            </Card>
        </div>
    )
}
