
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShoppingBag } from 'lucide-react';

export default function CollectionsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ShoppingBag /> Product Collections</h1>
                <p className="text-muted-foreground">Group your products into collections for promotions and easy browsing.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">This feature is under development and will be available soon.</p>
                </CardContent>
            </Card>
        </div>
    )
}
