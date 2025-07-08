
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function WishlistPage() {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">My Wishlist</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                    <CardDescription>
                        This is where you'll see your saved favorite products.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>This feature is under construction.</p>
                </CardContent>
            </Card>
        </div>
    );
}
