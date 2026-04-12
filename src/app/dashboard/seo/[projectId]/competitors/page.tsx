'use client';

import { use } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Swords, Lock } from 'lucide-react';

export default function CompetitorsPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Swords className="h-8 w-8 text-primary" />
                        Competitor Gap
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Analyze where competitors are beating you.
                    </p>
                </div>
                <Button variant="outline">Add Competitor</Button>
            </div>

            <Card className="border-dashed bg-muted/20">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="bg-background p-4 rounded-full mb-4 shadow-sm">
                        <Swords className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Gap Analysis Ready</h3>
                    <p className="text-muted-foreground max-w-md mb-6">
                        We have identified 12 keywords where your competitor ranks in Top 3 but you are missing.
                    </p>

                    {/* Placeholder for DataForSEO Integration */}
                    <div className="flex flex-col gap-2 w-full max-w-md border rounded-md bg-background p-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-bold text-sm">Keyword</span>
                            <span className="font-bold text-sm">Vol</span>
                            <span className="font-bold text-sm">Diff</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span>best seo software</span>
                            <span>2.4k</span>
                            <span className="text-red-500">85</span>
                        </div>
                        <div className="flex justify-between items-center py-2 bg-muted/30">
                            <span>rank tracker tool</span>
                            <span>1.1k</span>
                            <span className="text-orange-500">62</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span>site audit checklist</span>
                            <span>800</span>
                            <span className="text-green-500">35</span>
                        </div>
                    </div>

                    <Button className="mt-8" disabled>
                        <Lock className="mr-2 h-4 w-4" /> Unlock Full Report (Premium)
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
