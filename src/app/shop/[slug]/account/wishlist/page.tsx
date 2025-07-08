
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Trash2 } from "lucide-react";
import Image from "next/image";

const mockWishlist = [
    { id: 1, name: "Cool T-Shirt", price: 25.00, imageUrl: "https://placehold.co/400x500.png" },
    { id: 2, name: "Stylish Sunglasses", price: 75.00, imageUrl: "https://placehold.co/400x500.png" },
];

export default function WishlistPage() {
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">My Wishlist</h1>
            {mockWishlist.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {mockWishlist.map(item => (
                        <Card key={item.id}>
                            <CardContent className="p-4">
                                <div className="relative aspect-[4/5] bg-muted mb-4 rounded-md overflow-hidden">
                                     <Image src={item.imageUrl} alt={item.name} layout="fill" objectFit="cover" data-ai-hint="fashion product"/>
                                </div>
                                <h3 className="font-semibold">{item.name}</h3>
                                <p className="text-lg font-bold text-primary">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.price)}</p>
                                <div className="flex gap-2 mt-4">
                                    <Button className="w-full"><ShoppingCart className="mr-2 h-4 w-4"/>Add to Cart</Button>
                                    <Button variant="outline" size="icon"><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        <p>You have no items in your wishlist.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
