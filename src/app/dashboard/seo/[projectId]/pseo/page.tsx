'use client';

import { use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Upload, Lock } from 'lucide-react';

export default function PseoPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Database className="h-8 w-8 text-primary" />
                        pSEO Clustering
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Group thousands of keywords by semantic intent.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Keywords</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer">
                            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                            <h3 className="font-semibold mb-1">Upload CSV</h3>
                            <p className="text-xs text-muted-foreground">Up to 10,000 rows</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-muted/30">
                    <CardHeader>
                        <CardTitle>Cluster Results</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center h-[200px] text-center">
                        <Lock className="h-8 w-8 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground mb-4">
                            Vector processing required for clustering.
                        </p>
                        <Button disabled>Start Clustering Job</Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
