
'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function SabChatSettingsPage() {
    return (
        <Card className="text-center py-20">
            <CardHeader>
                <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                    <Settings className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="mt-4 text-2xl">General Settings</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Coming Soon: Configure business hours, automated messages, and more.</p>
            </CardContent>
        </Card>
    );
}
