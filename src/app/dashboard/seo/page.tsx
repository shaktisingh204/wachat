
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function SeoDashboardPage() {
    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <TrendingUp className="h-8 w-8"/>
                    SEO Suite
                </h1>
                <p className="text-muted-foreground mt-2">
                    Your central hub for search engine optimization tools and analytics.
                </p>
            </div>
            <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg card-gradient card-gradient-orange">
                <CardContent>
                    <p className="text-lg font-semibold">Coming Soon!</p>
                    <p>This module is under construction. Exciting new SEO tools are on the way!</p>
                </CardContent>
            </Card>
        </div>
    );
}
