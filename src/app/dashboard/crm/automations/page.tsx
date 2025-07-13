'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Zap } from 'lucide-react';

export default function CrmAutomationsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Zap /> Automations</h1>
                <p className="text-muted-foreground">Create automated workflows to nurture leads and manage tasks.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">A visual campaign and automation builder is under development.</p>
                </CardContent>
            </Card>
        </div>
    );
}
