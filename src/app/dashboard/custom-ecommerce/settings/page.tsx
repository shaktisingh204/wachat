
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Settings /> Shop Settings</h1>
                <p className="text-muted-foreground">Configure your shop name, currency, and custom domain.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">Shop settings are under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
