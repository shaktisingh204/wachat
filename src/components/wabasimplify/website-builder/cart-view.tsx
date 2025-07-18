
'use client';

import Link from 'next/link';
import { useCart } from '@/context/cart-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart } from 'lucide-react';
import Image from 'next/image';
import { Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';

export function CartView() {
    const { cart, updateQuantity, removeFromCart, itemCount, cartTotal } = useCart();
    const params = useParams();
    const shopSlug = params.slug as string;

    if (itemCount === 0) {
        return (
            <div className="text-center py-20">
                <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground" />
                <h2 className="mt-4 text-2xl font-semibold">Your cart is empty</h2>
                <p className="mt-2 text-muted-foreground">Looks like you haven't added anything to your cart yet.</p>
                <Button asChild className="mt-6">
                     <Link href={`/shop/${shopSlug}`}>Continue Shopping</Link>
                </Button>
            </div>
        );
    }

    return (
         <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
                {cart.map(item => (
                     <Card key={item.productId} className="flex items-center p-4 gap-4">
                         <div className="relative h-24 w-24 bg-muted rounded-md overflow-hidden">
                            <Image src={item.imageUrl || 'https://placehold.co/100x100.png'} alt={item.name} layout="fill" objectFit="cover" data-ai-hint="product image" />
                         </div>
                         <div className="flex-1">
                            <h3 className="font-semibold">{item.name}</h3>
                            <p className="text-muted-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.price)}</p>
                         </div>
                         <div className="flex items-center border rounded-md">
                            <Button variant="ghost" size="icon" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>-</Button>
                            <span className="w-10 text-center">{item.quantity}</span>
                            <Button variant="ghost" size="icon" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>+</Button>
                         </div>
                         <p className="font-semibold w-24 text-right">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.price * item.quantity)}</p>
                         <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.productId)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                         </Button>
                    </Card>
                ))}
            </div>
            <div className="md:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Order Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between">
                            <span>Subtotal ({itemCount} items)</span>
                            <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Shipping</span>
                            <span>Calculated at checkout</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cartTotal)}</span>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button asChild size="lg" className="w-full">
                             <Link href={`/shop/${shopSlug}/checkout`}>Proceed to Checkout</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
