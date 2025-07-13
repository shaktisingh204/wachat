
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { FolderKan } from 'lucide-react';

export default function TasksPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><FolderKan /> Tasks</h1>
                <p className="text-muted-foreground">Organize and track your sales and support tasks.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">Task management is under development and will be available soon.</p>
                </CardContent>
            </Card>
        </div>
    );
}
