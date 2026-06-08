"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CreditCard,
  Mail,
  MapPin,
  MoreHorizontal,
  Package,
  Phone,
  Printer,
  Truck,
} from "lucide-react";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardFooter,
  Avatar,
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
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageActions,
} from "@/components/sabcrm/20ui";

const ORDER = {
  id: "ORD-7352",
  date: "June 3, 2026 at 2:30 PM",
  status: "Unfulfilled",
  payment: "Paid",
  customer: {
    name: "Aanya Sharma",
    email: "aanya.sharma@example.com",
    phone: "+91 98765 43210",
    orders: 12,
  },
  shippingAddress: {
    line1: "14 Koregaon Park Road",
    line2: "Flat 4B",
    city: "Pune",
    state: "MH",
    zip: "411001",
    country: "India",
  },
  items: [
    { id: "ITEM-1", name: "Aura wireless headphones", sku: "WH-1000", price: 24999, quantity: 1, total: 24999 },
    { id: "ITEM-2", name: "Ergonomic mouse", sku: "EM-200", price: 7900, quantity: 2, total: 15800 },
  ],
  subtotal: 40799,
  tax: 3471,
  shipping: 150,
  total: 44420,
  timeline: [
    { id: 1, status: "Order placed", date: "Jun 3, 2026, 2:30 PM", icon: Package, done: true },
    { id: 2, status: "Payment confirmed", date: "Jun 3, 2026, 2:32 PM", icon: CreditCard, done: true },
    { id: 3, status: "Processing", date: "Jun 3, 2026, 3:00 PM", icon: Truck, done: false },
    { id: 4, status: "Delivered", date: "Pending", icon: CheckCircle2, done: false },
  ],
};

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams<{ storefrontId: string; orderId: string }>();
  const orderId = params.orderId || ORDER.id;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader bordered={false}>
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
              <Badge tone="warning">{ORDER.status}</Badge>
              <Badge tone="success">{ORDER.payment}</Badge>
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
              <Calendar size={14} aria-hidden="true" /> {ORDER.date}
            </p>
          </PageHeaderHeading>
        </div>
        <PageActions>
          <Button variant="outline" iconLeft={Printer}>
            Print
          </Button>
          <IconButton label="More order actions" icon={MoreHorizontal} variant="outline" />
          <Button variant="primary">Fulfill order</Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package size={16} aria-hidden="true" className="text-[var(--st-text-secondary)]" />
                <CardTitle>Order items</CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Product</Th>
                      <Th>SKU</Th>
                      <Th align="right">Price</Th>
                      <Th align="center">Qty</Th>
                      <Th align="right">Total</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {ORDER.items.map((item) => (
                      <Tr key={item.id}>
                        <Td>
                          <div className="flex items-center gap-3">
                            <span
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] ring-1 ring-inset ring-[var(--st-border)]"
                              aria-hidden="true"
                            >
                              <Package size={16} />
                            </span>
                            <span className="font-medium text-[var(--st-text)]">{item.name}</span>
                          </div>
                        </Td>
                        <Td className="tabular-nums text-[var(--st-text-secondary)]">{item.sku}</Td>
                        <Td align="right" className="tabular-nums">{inr(item.price)}</Td>
                        <Td align="center" className="tabular-nums">{item.quantity}</Td>
                        <Td align="right" className="font-medium tabular-nums">{inr(item.total)}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>

              <dl className="mt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <dt className="text-[var(--st-text-secondary)]">Subtotal</dt>
                  <dd className="font-medium tabular-nums text-[var(--st-text)]">{inr(ORDER.subtotal)}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-[var(--st-text-secondary)]">Shipping</dt>
                  <dd className="font-medium tabular-nums text-[var(--st-text)]">{inr(ORDER.shipping)}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-[var(--st-text-secondary)]">Tax</dt>
                  <dd className="font-medium tabular-nums text-[var(--st-text)]">{inr(ORDER.tax)}</dd>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between text-lg font-semibold text-[var(--st-text)]">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{inr(ORDER.total)}</dd>
                </div>
              </dl>
            </CardBody>
            <CardFooter className="flex justify-end">
              <Button variant="outline">Refund order</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Truck size={16} aria-hidden="true" className="text-[var(--st-text-secondary)]" />
                <CardTitle>Timeline</CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              <ol className="space-y-0">
                {ORDER.timeline.map((event, index) => {
                  const Icon = event.icon;
                  const isLast = index === ORDER.timeline.length - 1;
                  return (
                    <li key={event.id} className="relative mb-6 flex gap-4 last:mb-0">
                      {!isLast ? (
                        <div
                          className={`absolute left-4 top-8 -ml-px h-[calc(100%+1.5rem)] w-px ${
                            event.done ? "bg-[var(--st-accent)]" : "bg-[var(--st-border)]"
                          }`}
                          aria-hidden="true"
                        />
                      ) : null}
                      <div
                        className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                          event.done
                            ? "border-[var(--st-accent)] bg-[var(--st-accent)] text-[var(--st-text-inverted)]"
                            : "border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                        }`}
                        aria-hidden="true"
                      >
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 pt-1">
                        <p
                          className={`font-medium ${
                            event.done ? "text-[var(--st-text)]" : "text-[var(--st-text-secondary)]"
                          }`}
                        >
                          {event.status}
                        </p>
                        <p className="mt-1 text-sm text-[var(--st-text-secondary)]">{event.date}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="flex items-center gap-3">
                <Avatar name={ORDER.customer.name} shape="round" />
                <div>
                  <p className="font-medium text-[var(--st-text)]">{ORDER.customer.name}</p>
                  <p className="text-sm tabular-nums text-[var(--st-text-secondary)]">
                    {ORDER.customer.orders} orders
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-[var(--st-text)]">Contact</h4>
                <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                  <Mail size={16} className="shrink-0" aria-hidden="true" />
                  <a
                    href={`mailto:${ORDER.customer.email}`}
                    className="truncate transition-colors hover:text-[var(--st-accent)] hover:underline"
                  >
                    {ORDER.customer.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                  <Phone size={16} className="shrink-0" aria-hidden="true" />
                  <span className="tabular-nums">{ORDER.customer.phone}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Shipping address</CardTitle>
              <IconButton label="Edit shipping address" icon={MoreHorizontal} variant="ghost" size="sm" />
            </CardHeader>
            <CardBody>
              <address className="flex items-start gap-3 not-italic">
                <MapPin size={16} className="mt-1 shrink-0 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <div className="space-y-1 text-sm text-[var(--st-text-secondary)]">
                  <p className="font-medium text-[var(--st-text)]">{ORDER.customer.name}</p>
                  <p>{ORDER.shippingAddress.line1}</p>
                  <p>{ORDER.shippingAddress.line2}</p>
                  <p>
                    {ORDER.shippingAddress.city}, {ORDER.shippingAddress.state}{" "}
                    {ORDER.shippingAddress.zip}
                  </p>
                  <p>{ORDER.shippingAddress.country}</p>
                </div>
              </address>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing address</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-[var(--st-text-secondary)]">Same as shipping address.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
