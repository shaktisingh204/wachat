
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Newspaper } from 'lucide-react';

export default function PagePostsPage() {
    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Newspaper className="h-8 w-8"/>
                    Page Posts
                </h1>
                <p className="text-muted-foreground mt-2">
                    View and manage your Facebook Page posts.
                </p>
            </div>
            <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                <CardContent>
                    <p className="text-lg font-semibold">Coming Soon!</p>
                    <p>This feature is on our roadmap.</p>
                </CardContent>
            </Card>
        </div>
    );
}
