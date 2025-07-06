
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bot } from 'lucide-react';

export default function AgentsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Bot /> AI Agents</h1>
                <p className="text-muted-foreground">Build, manage, and deploy your conversational AI agents for Messenger.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">The AI Agent builder is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
