"use client";

import React, { useState } from "react";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Download, ChevronLeft, ChevronRight, Eye, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";

// Mock Data
const MOCK_ORDERS = [
  { id: "ORD-7352", date: "2026-06-03", customer: "Liam Smith", status: "Fulfilled", payment: "Paid", total: "$120.00" },
  { id: "ORD-7351", date: "2026-06-03", customer: "Emma Johnson", status: "Unfulfilled", payment: "Paid", total: "$85.50" },
  { id: "ORD-7350", date: "2026-06-02", customer: "Noah Williams", status: "Fulfilled", payment: "Paid", total: "$210.00" },
  { id: "ORD-7349", date: "2026-06-02", customer: "Olivia Brown", status: "Unfulfilled", payment: "Unpaid", total: "$45.00" },
  { id: "ORD-7348", date: "2026-06-01", customer: "William Jones", status: "Cancelled", payment: "Refunded", total: "$0.00" },
  { id: "ORD-7347", date: "2026-06-01", customer: "Ava Garcia", status: "Fulfilled", payment: "Paid", total: "$340.20" },
  { id: "ORD-7346", date: "2026-05-31", customer: "James Miller", status: "Unfulfilled", payment: "Unpaid", total: "$15.99" },
];

export default function OrdersPage({ params }: { params: { storefrontId: string } }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");

  const filteredOrders = MOCK_ORDERS.filter((order) => {
    if (activeTab === "all") return true;
    if (activeTab === "unfulfilled") return order.status === "Unfulfilled";
    if (activeTab === "unpaid") return order.payment === "Unpaid";
    return true;
  });

  const getStatusBadgeTone = (status: string): BadgeTone => {
    switch (status) {
      case "Fulfilled":
        return "success";
      case "Unfulfilled":
        return "warning";
      case "Cancelled":
        return "danger";
      default:
        return "neutral";
    }
  };

  const getPaymentBadgeTone = (payment: string): BadgeTone => {
    switch (payment) {
      case "Paid":
        return "success";
      case "Unpaid":
        return "danger";
      case "Refunded":
        return "neutral";
      default:
        return "neutral";
    }
  };

  const openOrder = (orderId: string) => {
    router.push(`/dashboard/sabshop/${params.storefrontId}/orders/${orderId}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Orders</PageTitle>
          <PageDescription>Manage and track your storefront orders.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" iconLeft={Download} onClick={() => console.log("Export")}>
            Export
          </Button>
        </PageActions>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
          <CardDescription>View all recent orders from your customers.</CardDescription>
        </CardHeader>
        <CardBody>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="all">All Orders</TabsTrigger>
                <TabsTrigger value="unfulfilled">Unfulfilled</TabsTrigger>
                <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>

          <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] overflow-hidden">
            <Table>
              <THead>
                <Tr>
                  <Th width={100}>Order</Th>
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th>Fulfillment</Th>
                  <Th>Payment</Th>
                  <Th align="right">Total</Th>
                  <Th width={80}>
                    <span className="sr-only">Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => (
                    <Tr
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => openOrder(order.id)}
                    >
                      <Td className="font-medium text-[var(--st-accent)]">{order.id}</Td>
                      <Td className="text-[var(--st-text-secondary)]">{order.date}</Td>
                      <Td className="font-medium">{order.customer}</Td>
                      <Td>
                        <Badge tone={getStatusBadgeTone(order.status)}>{order.status}</Badge>
                      </Td>
                      <Td>
                        <Badge tone={getPaymentBadgeTone(order.payment)}>{order.payment}</Badge>
                      </Td>
                      <Td align="right" className="font-medium">
                        {order.total}
                      </Td>
                      <Td>
                        <IconButton
                          label={`View order ${order.id}`}
                          icon={Eye}
                          size="sm"
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
                      <EmptyState icon={Inbox} title="No orders found" description="Orders matching this filter will appear here." />
                    </Td>
                  </Tr>
                )}
              </TBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-[var(--st-text-secondary)]">
              Showing <strong className="text-[var(--st-text)]">1</strong> to{" "}
              <strong className="text-[var(--st-text)]">{filteredOrders.length}</strong> of{" "}
              <strong className="text-[var(--st-text)]">{filteredOrders.length}</strong> orders
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
