"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, Badge, Button, Table, TBody, Td, Th, THead, Tr, Separator, Avatar, AvatarFallback } from '@/components/sabcrm/20ui/compat';
import { 
  ArrowLeft, 
  Package, 
  Truck, 
  CheckCircle2, 
  CreditCard,
  MapPin,
  Mail,
  Phone,
  Calendar,
  MoreHorizontal,
  Printer
} from "lucide-react";
import { useRouter } from "next/navigation";

// Mock Order Details
const ORDER_DETAILS = {
  id: "ORD-7352",
  date: "June 3, 2026 at 2:30 PM",
  status: "Unfulfilled",
  payment: "Paid",
  customer: {
    name: "Liam Smith",
    email: "liam.smith@example.com",
    phone: "+1 (555) 123-4567",
    avatar: "LS",
  },
  shippingAddress: {
    line1: "123 Main Street",
    line2: "Apt 4B",
    city: "New York",
    state: "NY",
    zip: "10001",
    country: "United States"
  },
  items: [
    { id: "ITEM-1", name: "Premium Wireless Headphones", sku: "WH-1000", price: 299.00, quantity: 1, total: 299.00, image: "🎧" },
    { id: "ITEM-2", name: "Ergonomic Mouse", sku: "EM-200", price: 79.00, quantity: 2, total: 158.00, image: "🖱️" }
  ],
  subtotal: 457.00,
  tax: 38.85,
  shipping: 15.00,
  total: 510.85,
  timeline: [
    { id: 1, status: "Order Placed", date: "June 3, 2026, 2:30 PM", icon: Package, done: true },
    { id: 2, status: "Payment Confirmed", date: "June 3, 2026, 2:32 PM", icon: CreditCard, done: true },
    { id: 3, status: "Processing", date: "June 3, 2026, 3:00 PM", icon: Truck, done: false },
    { id: 4, status: "Delivered", date: "Pending", icon: CheckCircle2, done: false },
  ]
};

export default function OrderDetailsPage({ params }: { params: { storefrontId: string, orderId: string } }) {
  const router = useRouter();
  
  // Use params.orderId to fetch real data later, using mock for now
  const orderId = params.orderId || ORDER_DETAILS.id;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-[var(--st-text)]">Order {orderId}</h1>
              <Badge variant="secondary">{ORDER_DETAILS.status}</Badge>
              <Badge variant="default">{ORDER_DETAILS.payment}</Badge>
            </div>
            <p className="text-[var(--st-text-secondary)] mt-1 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" /> {ORDER_DETAILS.date}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button variant="outline" size="icon">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
          <Button className="gap-2">
            Fulfill Order
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-[var(--st-border)] overflow-hidden">
                <Table>
                  <THead className="bg-[var(--st-bg-secondary)]">
                    <Tr>
                      <Th>Product</Th>
                      <Th>SKU</Th>
                      <Th className="text-right">Price</Th>
                      <Th className="text-center">Qty</Th>
                      <Th className="text-right">Total</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {ORDER_DETAILS.items.map((item) => (
                      <Tr key={item.id}>
                        <Td>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-[var(--st-bg-secondary)] flex items-center justify-center text-xl border border-[var(--st-border)]">
                              {item.image}
                            </div>
                            <span className="font-medium text-[var(--st-text)]">{item.name}</span>
                          </div>
                        </Td>
                        <Td className="text-[var(--st-text-secondary)]">{item.sku}</Td>
                        <Td className="text-right">${item.price.toFixed(2)}</Td>
                        <Td className="text-center">{item.quantity}</Td>
                        <Td className="text-right font-medium">${item.total.toFixed(2)}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
              
              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--st-text-secondary)]">Subtotal</span>
                  <span className="text-[var(--st-text)] font-medium">${ORDER_DETAILS.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--st-text-secondary)]">Shipping</span>
                  <span className="text-[var(--st-text)] font-medium">${ORDER_DETAILS.shipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--st-text-secondary)]">Tax</span>
                  <span className="text-[var(--st-text)] font-medium">${ORDER_DETAILS.tax.toFixed(2)}</span>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between font-semibold text-lg text-[var(--st-text)]">
                  <span>Total</span>
                  <span>${ORDER_DETAILS.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-[var(--st-bg-secondary)]/50 border-t border-[var(--st-border)] flex justify-end">
              <Button variant="outline">Refund Order</Button>
            </CardFooter>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {ORDER_DETAILS.timeline.map((event, index) => {
                  const Icon = event.icon;
                  return (
                    <div key={event.id} className="flex gap-4 relative mb-6 last:mb-0">
                      {/* Timeline connecting line */}
                      {index !== ORDER_DETAILS.timeline.length - 1 && (
                        <div className={`absolute top-8 left-4 w-px h-[calc(100%+1.5rem)] -ml-[0.5px] ${event.done ? 'bg-[var(--st-accent)]' : 'bg-[var(--st-border)]'}`} />
                      )}
                      
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 ${
                        event.done 
                          ? 'bg-[var(--st-accent)] border-[var(--st-accent)] text-white' 
                          : 'bg-[var(--st-bg-secondary)] border-[var(--st-border)] text-[var(--st-text-secondary)]'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 pt-1">
                        <p className={`font-medium ${event.done ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]'}`}>
                          {event.status}
                        </p>
                        <p className="text-sm text-[var(--st-text-secondary)] mt-1">{event.date}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Right Column */}
        <div className="space-y-6">
          {/* Customer info */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-[var(--st-bg-secondary)] text-[var(--st-text)] font-semibold border border-[var(--st-border)]">
                    {ORDER_DETAILS.customer.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-[var(--st-text)]">{ORDER_DETAILS.customer.name}</p>
                  <p className="text-sm text-[var(--st-text-secondary)]">12 Orders</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-[var(--st-text)]">Contact Info</h4>
                <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                  <Mail className="w-4 h-4 shrink-0" />
                  <a href={`mailto:${ORDER_DETAILS.customer.email}`} className="hover:text-[var(--st-accent)] hover:underline transition-colors truncate">
                    {ORDER_DETAILS.customer.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>{ORDER_DETAILS.customer.phone}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Shipping Address</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 mt-2">
                <MapPin className="w-4 h-4 text-[var(--st-text-secondary)] mt-1 shrink-0" />
                <div className="text-sm text-[var(--st-text-secondary)] space-y-1">
                  <p className="text-[var(--st-text)] font-medium">{ORDER_DETAILS.customer.name}</p>
                  <p>{ORDER_DETAILS.shippingAddress.line1}</p>
                  <p>{ORDER_DETAILS.shippingAddress.line2}</p>
                  <p>
                    {ORDER_DETAILS.shippingAddress.city}, {ORDER_DETAILS.shippingAddress.state} {ORDER_DETAILS.shippingAddress.zip}
                  </p>
                  <p>{ORDER_DETAILS.shippingAddress.country}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing Address */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Billing Address</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--st-text-secondary)] mt-2">
                Same as shipping address
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
