
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Palette } from 'lucide-react';

export default function AppearancePage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Palette /> Appearance</h1>
                <p className="text-muted-foreground">Customize the look and feel of your shop.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">Shop customization is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
