
import { Card, CardContent } from '@/components/ui/card';
import { Link as LinkIcon } from 'lucide-react';

export default function UrlShortenerPage() {
    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <LinkIcon className="h-8 w-8"/>
                    URL Shortener
                </h1>
                <p className="text-muted-foreground mt-2">
                    Create short, branded links for your campaigns.
                </p>
            </div>
            <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg card-gradient card-gradient-blue">
                <CardContent>
                    <p className="text-lg font-semibold">Coming Soon!</p>
                    <p>This feature is on our roadmap.</p>
                </CardContent>
            </Card>
        </div>
    );
}
