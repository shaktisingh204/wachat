
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShoppingBag } from 'lucide-react';

export default function ProductsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ShoppingBag /> Products</h1>
                <p className="text-muted-foreground">Manage products for your custom shop.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">Product management is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
