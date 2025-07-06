
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookCopy } from 'lucide-react';

export default function KnowledgePage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><BookCopy /> Knowledge Base</h1>
                <p className="text-muted-foreground">Manage the knowledge sources for your AI agents.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">The Knowledge Base manager is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
