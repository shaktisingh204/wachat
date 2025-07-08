
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DownloadsPage() {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">My Downloads</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                    <CardDescription>
                       This is where you'll be able to access your downloadable products.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>This feature is under construction.</p>
                </CardContent>
            </Card>
        </div>
    );
}
