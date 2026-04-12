'use client';

import { Zap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function AutomatedRulesPage() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Zap className="h-6 w-6" /> Automated rules
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Automatically pause, scale or notify based on performance thresholds.
                    </p>
                </div>
                <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                    <Plus className="h-4 w-4 mr-1" /> Create rule
                </Button>
            </div>

            <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                    <Zap className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="mt-3 font-semibold">No automated rules yet</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                        Examples: pause ads with CTR below 0.5%, increase budget by 20% when ROAS exceeds 4x,
                        or send a notification when daily spend crosses a threshold.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
