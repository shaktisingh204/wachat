'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCart } from '@/context/cart-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { createEcommOrder } from '@/app/actions/custom-ecommerce.actions';
import { useState, useTransition } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

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

export function CheckoutForm() {
    const { cart, cartTotal, clearCart } = useCart();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const params = useParams();
    const router = useRouter();

    const form = useForm<z.infer typeof checkoutSchema>>({
        resolver: zodResolver(checkoutSchema),
        defaultValues: {
            name: '', email: '', phone: '',
            street: '', city: '', state: '', zip: '', country: 'India'
        }
    });

    async function onSubmit(values: z.infer typeof checkoutSchema) {
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
                // No payment gateway configured, go to confirmation directly
                toast({ title: "Order Placed!", description: "Your order has been placed successfully." });
                clearCart();
                router.push(`/shop/${params.slug}/order-confirmation/${result.orderId}`);
            }
        });
    }

    return (
         div className="grid md:grid-cols-2 gap-8"
            div
                h2 className="text-2xl font-bold mb-4"Shipping Information/h2
                Form {...form}
                    form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4"
                         FormField control={form.control} name="name" render={({ field }) => (
                            FormItem
                                FormLabelFull Name/FormLabel
                                FormControl
                                    Input {...field} /
                                FormControl
                                FormMessage /
                            FormItem
                        )} /
                         FormField control={form.control} name="email" render={({ field }) => (
                            FormItem
                                FormLabelEmail/FormLabel
                                FormControl
                                    Input {...field} /
                                FormControl
                                FormMessage /
                            FormItem
                        )} /
                         FormField control={form.control} name="phone" render={({ field }) => (
                            FormItem
                                FormLabelPhone (Optional)/FormLabel
                                FormControl
                                    Input {...field} /
                                FormControl
                                FormMessage /
                            FormItem
                        )} /
                         FormField control={form.control} name="street" render={({ field }) => (
                             FormItem
                                FormLabelStreet Address/FormLabel
                                FormControl
                                    Input {...field} /
                                FormControl
                                FormMessage /
                            FormItem
                        )} /
                        div className="grid grid-cols-2 gap-4"
                             FormField control={form.control} name="city" render={({ field }) => (
                                FormItem
                                    FormLabelCity/FormLabel
                                    FormControl
                                        Input {...field} /
                                    FormControl
                                    FormMessage /
                                FormItem
                            )} /
                             FormField control={form.control} name="state" render={({ field }) => (
                                FormItem
                                    FormLabelState/FormLabel
                                    FormControl
                                        Input {...field} /
                                    FormControl
                                    FormMessage /
                                FormItem
                            )} /
                        div
                        div className="grid grid-cols-2 gap-4"
                             FormField control={form.control} name="zip" render={({ field }) => (
                                FormItem
                                    FormLabelZIP Code/FormLabel
                                    FormControl
                                        Input {...field} /
                                    FormControl
                                    FormMessage /
                                FormItem
                            )} /
                             FormField control={form.control} name="country" render={({ field }) => (
                                FormItem
                                    FormLabelCountry/FormLabel
                                    FormControl
                                        Input {...field} /
                                    FormControl
                                    FormMessage /
                                FormItem
                            )} /
                        div
                        Button type="submit" size="lg" className="w-full mt-6" disabled={isPending}
                            {isPending &&  LoaderCircle className="mr-2 h-4 w-4 animate-spin"/}
                            Place Order & Proceed to Payment
                        Button
                    form
                Form
            div
            div
                Card
                    CardHeaderCardTitleYour OrderCardTitle/CardHeader
                    CardContent className="space-y-4"
                        {cart.map(item => (
                             div key={item.productId} className="flex justify-between items-center text-sm"
                                span{item.name} x {item.quantity}span
                                span className="font-medium"{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.price * item.quantity)}/span
                             div
                        ))}
                        Separator /
                        div className="flex justify-between font-bold text-lg"
                            spanTotal/span
                            span{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cartTotal)}/span
                        div
                    CardContent
                    CardFooter
                        Button asChild size="lg" className="w-full"
                             Link href={`/shop/${params.slug}/checkout`}Proceed to Checkout/Link
                        Button
                    CardFooter
                Card
            div
        div
    );
}
