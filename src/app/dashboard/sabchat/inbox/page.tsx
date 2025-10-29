
'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Inbox } from 'lucide-react';

export default function SabChatInboxPage() {
    return (
        <Card className="text-center py-20">
            <CardHeader>
                <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                    <Inbox className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="mt-4 text-2xl">Unified Inbox</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Coming Soon: View all your website live chats in one place.</p>
            </CardContent>
        </Card>
    );
}
