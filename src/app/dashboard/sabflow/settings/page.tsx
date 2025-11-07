
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Settings, Zap } from 'lucide-react';

export default function SabFlowSettingsPage() {
    return (
        <div className="flex justify-center items-center h-full p-4">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <Settings className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">SabFlow Settings</CardTitle>
                    <CardDescription>
                        Coming Soon: Manage global settings, API keys for your connections, and view usage logs.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">This feature is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
