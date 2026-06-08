"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  Inbox,
  PackageCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Badge,
  type BadgeTone,
  Button,
  IconButton,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from "@/components/sabcrm/20ui";

type Fulfillment = "Fulfilled" | "Unfulfilled" | "Cancelled";
type Payment = "Paid" | "Unpaid" | "Refunded";

const ORDERS: Array<{
  id: string;
  date: string;
  customer: string;
  status: Fulfillment;
  payment: Payment;
  total: number;
}> = [
  { id: "ORD-7352", date: "Jun 3, 2026", customer: "Aanya Sharma", status: "Fulfilled", payment: "Paid", total: 12000 },
  { id: "ORD-7351", date: "Jun 3, 2026", customer: "Diego Alvarez", status: "Unfulfilled", payment: "Paid", total: 8550 },
  { id: "ORD-7350", date: "Jun 2, 2026", customer: "Mei Lin", status: "Fulfilled", payment: "Paid", total: 21000 },
  { id: "ORD-7349", date: "Jun 2, 2026", customer: "Olivia Brown", status: "Unfulfilled", payment: "Unpaid", total: 4500 },
  { id: "ORD-7348", date: "Jun 1, 2026", customer: "Sam Okoye", status: "Cancelled", payment: "Refunded", total: 0 },
  { id: "ORD-7347", date: "Jun 1, 2026", customer: "Priya Nair", status: "Fulfilled", payment: "Paid", total: 34020 },
  { id: "ORD-7346", date: "May 31, 2026", customer: "James Carter", status: "Unfulfilled", payment: "Unpaid", total: 1599 },
];

const FULFILLMENT_TONE: Record<Fulfillment, BadgeTone> = {
  Fulfilled: "success",
  Unfulfilled: "warning",
  Cancelled: "danger",
};

const PAYMENT_TONE: Record<Payment, BadgeTone> = {
  Paid: "success",
  Unpaid: "danger",
  Refunded: "neutral",
};

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function OrdersPage() {
  const router = useRouter();
  const params = useParams<{ storefrontId: string }>();
  const storefrontId = params.storefrontId;
  const [activeTab, setActiveTab] = useState("all");

  const filtered = useMemo(
    () =>
      ORDERS.filter((order) => {
        if (activeTab === "unfulfilled") return order.status === "Unfulfilled";
        if (activeTab === "unpaid") return order.payment === "Unpaid";
        return true;
      }),
    [activeTab],
  );

  const unfulfilled = ORDERS.filter((o) => o.status === "Unfulfilled").length;
  const fulfilled = ORDERS.filter((o) => o.status === "Fulfilled").length;
  const revenue = ORDERS.filter((o) => o.payment === "Paid").reduce((s, o) => s + o.total, 0);

  const openOrder = (orderId: string) => {
    router.push(`/dashboard/sabshop/${storefrontId}/orders/${orderId}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Orders</PageTitle>
          <PageDescription>Track and fulfill orders placed in your store.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" iconLeft={Download}>
            Export
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Order summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total orders"
          value={<span className="tabular-nums">{ORDERS.length}</span>}
          icon={ShoppingBag}
          accent="#3b7af5"
        />
        <StatCard
          label="Unfulfilled"
          value={<span className="tabular-nums">{unfulfilled}</span>}
          icon={Truck}
          accent="#d97706"
        />
        <StatCard
          label="Fulfilled"
          value={<span className="tabular-nums">{fulfilled}</span>}
          icon={PackageCheck}
          accent="#1f9d55"
        />
        <StatCard
          label="Collected"
          value={<span className="tabular-nums">{inr(revenue)}</span>}
          icon={CreditCard}
          accent="#7c3aed"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Order history</CardTitle>
          <CardDescription>Recent orders from your customers.</CardDescription>
        </CardHeader>
        <CardBody>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="mb-4 flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="all">All orders</TabsTrigger>
                <TabsTrigger value="unfulfilled">Unfulfilled</TabsTrigger>
                <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>

          <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
            <Table hover>
              <THead>
                <Tr>
                  <Th width={110}>Order</Th>
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th>Fulfillment</Th>
                  <Th>Payment</Th>
                  <Th align="right">Total</Th>
                  <Th width={64}>
                    <span className="sr-only">Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {filtered.length > 0 ? (
                  filtered.map((order) => (
                    <Tr
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => openOrder(order.id)}
                    >
                      <Td className="font-medium tabular-nums text-[var(--st-accent)]">
                        {order.id}
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">{order.date}</Td>
                      <Td className="font-medium">{order.customer}</Td>
                      <Td>
                        <Badge tone={FULFILLMENT_TONE[order.status]}>{order.status}</Badge>
                      </Td>
                      <Td>
                        <Badge tone={PAYMENT_TONE[order.payment]}>{order.payment}</Badge>
                      </Td>
                      <Td align="right" className="font-medium tabular-nums">
                        {inr(order.total)}
                      </Td>
                      <Td>
                        <IconButton
                          label={`View order ${order.id}`}
                          icon={Eye}
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openOrder(order.id);
                          }}
                        />
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={7}>
                      <EmptyState
                        icon={Inbox}
                        title="No orders found"
                        description="Orders matching this filter will appear here."
                      />
                    </Td>
                  </Tr>
                )}
              </TBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-[var(--st-text-secondary)]">
              Showing{" "}
              <strong className="tabular-nums text-[var(--st-text)]">{filtered.length}</strong> of{" "}
              <strong className="tabular-nums text-[var(--st-text)]">{ORDERS.length}</strong> orders
            </div>
            <div className="flex gap-2">
              <IconButton label="Previous page" icon={ChevronLeft} variant="outline" disabled />
              <IconButton label="Next page" icon={ChevronRight} variant="outline" disabled />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
