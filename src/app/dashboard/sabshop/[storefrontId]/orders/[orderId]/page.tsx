"use client";

import React from "react";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardFooter,
  Badge,
  Button,
  IconButton,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Separator,
  Avatar,
  AvatarFallback,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageActions,
} from "@/components/sabcrm/20ui";
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
  Printer,
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
    country: "United States",
  },
  items: [
    { id: "ITEM-1", name: "Premium Wireless Headphones", sku: "WH-1000", price: 299.0, quantity: 1, total: 299.0, image: "🎧" },
    { id: "ITEM-2", name: "Ergonomic Mouse", sku: "EM-200", price: 79.0, quantity: 2, total: 158.0, image: "🖱️" },
  ],
  subtotal: 457.0,
  tax: 38.85,
  shipping: 15.0,
  total: 510.85,
  timeline: [
    { id: 1, status: "Order Placed", date: "June 3, 2026, 2:30 PM", icon: Package, done: true },
    { id: 2, status: "Payment Confirmed", date: "June 3, 2026, 2:32 PM", icon: CreditCard, done: true },
    { id: 3, status: "Processing", date: "June 3, 2026, 3:00 PM", icon: Truck, done: false },
    { id: 4, status: "Delivered", date: "Pending", icon: CheckCircle2, done: false },
  ],
};

export default function OrderDetailsPage({ params }: { params: { storefrontId: string; orderId: string } }) {
  const router = useRouter();

  // Use params.orderId to fetch real data later, using mock for now
  const orderId = params.orderId || ORDER_DETAILS.id;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader bordered={false} className="mb-2">
        <div className="flex items-center gap-4">
          <IconButton
            label="Go back"
            icon={ArrowLeft}
            variant="outline"
            onClick={() => router.back()}
            className="shrink-0"
          />
          <PageHeaderHeading>
            <div className="flex flex-wrap items-center gap-3">
              <PageTitle>Order {orderId}</PageTitle>
              <Badge tone="neutral">{ORDER_DETAILS.status}</Badge>
              <Badge tone="success">{ORDER_DETAILS.payment}</Badge>
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
              <Calendar className="w-4 h-4" aria-hidden="true" /> {ORDER_DETAILS.date}
            </p>
          </PageHeaderHeading>
        </div>
        <PageActions>
          <Button variant="outline" iconLeft={Printer}>
            Print
          </Button>
          <IconButton label="More order actions" icon={MoreHorizontal} variant="outline" />
          <Button variant="primary">Fulfill Order</Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] overflow-hidden">
                <Table>
                  <THead className="bg-[var(--st-bg-secondary)]">
                    <Tr>
                      <Th>Product</Th>
                      <Th>SKU</Th>
                      <Th align="right">Price</Th>
                      <Th align="center">Qty</Th>
                      <Th align="right">Total</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {ORDER_DETAILS.items.map((item) => (
                      <Tr key={item.id}>
                        <Td>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] flex items-center justify-center text-xl border border-[var(--st-border)]">
                              {item.image}
                            </div>
                            <span className="font-medium text-[var(--st-text)]">{item.name}</span>
                          </div>
                        </Td>
                        <Td className="text-[var(--st-text-secondary)]">{item.sku}</Td>
                        <Td align="right">${item.price.toFixed(2)}</Td>
                        <Td align="center">{item.quantity}</Td>
                        <Td align="right" className="font-medium">
                          ${item.total.toFixed(2)}
                        </Td>
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
            </CardBody>
            <CardFooter className="flex justify-end">
              <Button variant="outline">Refund Order</Button>
            </CardFooter>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-0">
                {ORDER_DETAILS.timeline.map((event, index) => {
                  const Icon = event.icon;
                  return (
                    <div key={event.id} className="flex gap-4 relative mb-6 last:mb-0">
                      {/* Timeline connecting line */}
                      {index !== ORDER_DETAILS.timeline.length - 1 && (
                        <div
                          className={`absolute top-8 left-4 w-px h-[calc(100%+1.5rem)] -ml-[0.5px] ${
                            event.done ? "bg-[var(--st-accent)]" : "bg-[var(--st-border)]"
                          }`}
                          aria-hidden="true"
                        />
                      )}

                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 ${
                          event.done
                            ? "bg-[var(--st-accent)] border-[var(--st-accent)] text-[var(--st-accent-contrast)]"
                            : "bg-[var(--st-bg-secondary)] border-[var(--st-border)] text-[var(--st-text-secondary)]"
                        }`}
                        aria-hidden="true"
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 pt-1">
                        <p className={`font-medium ${event.done ? "text-[var(--st-text)]" : "text-[var(--st-text-secondary)]"}`}>
                          {event.status}
                        </p>
                        <p className="text-sm text-[var(--st-text-secondary)] mt-1">{event.date}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Sidebar - Right Column */}
        <div className="space-y-6">
          {/* Customer info */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardBody className="space-y-6">
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
                  <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <a
                    href={`mailto:${ORDER_DETAILS.customer.email}`}
                    className="hover:text-[var(--st-accent)] hover:underline transition-colors truncate"
                  >
                    {ORDER_DETAILS.customer.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                  <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{ORDER_DETAILS.customer.phone}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Shipping Address</CardTitle>
              <IconButton label="Edit shipping address" icon={MoreHorizontal} variant="ghost" size="sm" />
            </CardHeader>
            <CardBody>
              <div className="flex items-start gap-3 mt-2">
                <MapPin className="w-4 h-4 text-[var(--st-text-secondary)] mt-1 shrink-0" aria-hidden="true" />
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
            </CardBody>
          </Card>

          {/* Billing Address */}
          <Card>
            <CardHeader>
              <CardTitle>Billing Address</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-[var(--st-text-secondary)] mt-2">Same as shipping address</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
