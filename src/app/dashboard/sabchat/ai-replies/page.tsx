
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Bot } from "lucide-react";

export default function AiRepliesPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <Bot className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">AI Replies & Knowledge Base</CardTitle>
                    <CardDescription>
                        Coming Soon: Train an AI on your business data to provide instant, accurate answers to visitors.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">This feature is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
