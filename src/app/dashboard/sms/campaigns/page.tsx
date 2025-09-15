
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Send } from 'lucide-react';

export default function SmsCampaignsPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <Send className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">SMS Campaigns</CardTitle>
                    <CardDescription>
                        Bulk SMS campaigns are coming soon. You'll be able to send messages to thousands of contacts with just a few clicks.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">This feature is under development.</p>
                </CardContent>
            </Card>
        </div>
    );
}
