'use client';

import {
  Button,
  Input,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Separator,
} from '@/components/sabcrm/20ui/compat';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCart } from '@/context/cart-context';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/sabcrm/20ui/compat';
import { useToast } from '@/hooks/use-toast';
import { createEcommOrder } from '@/app/actions/custom-ecommerce.actions';
import { useTransition } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { formatPrice } from '../utils';
import Link from 'next/link';

const checkoutSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  street: z.string().min(5, "Street address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  zip: z.string().min(5, "ZIP code is required"),
  country: z.string().min(2, "Country is required"),
});

export function CheckoutForm({ currency }: { currency: string }) {
    const { cart, cartTotal, clearCart } = useCart();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const params = useParams();
    const router = useRouter();

    const form = useForm<z.infer<typeof checkoutSchema>>({
        resolver: zodResolver(checkoutSchema),
        defaultValues: {
            name: '', email: '', phone: '',
            street: '', city: '', state: '', zip: '', country: 'India'
        }
    });

    async function onSubmit(values: z.infer<typeof checkoutSchema>) {
        if (cart.length === 0) {
            toast({ title: 'Error', description: 'Your cart is empty.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            const result = await createEcommOrder({
                shopSlug: params.slug as string,
                cart,
                customerInfo: { name: values.name, email: values.email, phone: values.phone },
                shippingAddress: { street: values.street, city: values.city, state: values.state, zip: values.zip, country: values.country }
            });

            if (result.error) {
                toast({ title: "Order Error", description: result.error, variant: 'destructive' });
            } else if (result.orderId && result.paymentUrl) {
                toast({ title: "Redirecting to Payment..." });
                clearCart();
                window.location.href = result.paymentUrl;
            } else if (result.orderId) {
                toast({ title: "Order Placed!", description: "Your order has been placed successfully." });
                clearCart();
                router.push(`/shop/${params.slug}/order-confirmation/${result.orderId}`);
            }
        });
    }
    
    return (
         <div className="grid md:grid-cols-2 gap-8">
            <div>
                <div className="flex flex-col mb-6 gap-2">
                  <h2 className="text-2xl font-bold">Guest Checkout</h2>
                  <p className="text-sm text-zoru-ink-muted">
                    Checking out as a guest. Already have an account?{' '}
                    <Link href={`/shop/${params.slug}/account/login`} className="text-zoru-ink hover:underline">
                      Log in here
                    </Link>.
                  </p>
                </div>
                
                <h3 className="text-lg font-semibold mb-4">Shipping Information</h3>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                         <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Full Name</FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="phone" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Phone (Optional)</FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="street" render={({ field }) => (
                             <FormItem>
                                <FormLabel>Street Address</FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                             <FormField control={form.control} name="city" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>City</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="state" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>State</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <FormField control={form.control} name="zip" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>ZIP Code</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="country" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Country</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <Button type="submit" size="lg" className="w-full mt-6" disabled={isPending}>
                            {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                            Place Order & Proceed to Payment
                        </Button>
                    </form>
                </Form>
            </div>
            <div>
                <Card>
                    <ZoruCardHeader><ZoruCardTitle>Your Order</ZoruCardTitle></ZoruCardHeader>
                    <ZoruCardContent className="space-y-4">
                        {cart.length === 0 ? (
                          <div className="text-sm text-zoru-ink-muted text-center py-4">Your cart is empty</div>
                        ) : (
                          cart.map(item => (
                               <div key={item.productId} className="flex justify-between items-center text-sm">
                                  <span>{item.name} x {item.quantity}</span>
                                  <span className="font-medium">{formatPrice(item.price * item.quantity, currency)}</span>
                               </div>
                          ))
                        )}
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span>{formatPrice(cartTotal, currency)}</span>
                        </div>
                    </ZoruCardContent>
                </Card>
            </div>
        </div>
    );
}
