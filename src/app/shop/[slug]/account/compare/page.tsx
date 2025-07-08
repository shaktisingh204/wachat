
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CompareProductsPage() {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Compare Products</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                    <CardDescription>
                       This is where you'll be able to compare products side-by-side.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>This feature is under construction.</p>
                </CardContent>
            </Card>
        </div>
    );
}
