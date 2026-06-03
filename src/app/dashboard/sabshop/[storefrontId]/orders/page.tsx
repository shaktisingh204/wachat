"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/zoruui";
import { Filter, ChevronLeft, ChevronRight, Eye } from "lucide-react";
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

  const filteredOrders = MOCK_ORDERS.filter(order => {
    if (activeTab === "all") return true;
    if (activeTab === "unfulfilled") return order.status === "Unfulfilled";
    if (activeTab === "unpaid") return order.payment === "Unpaid";
    return true;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch(status) {
      case "Fulfilled": return "default";
      case "Unfulfilled": return "secondary";
      case "Cancelled": return "destructive";
      default: return "outline";
    }
  };
  
  const getPaymentBadgeVariant = (payment: string) => {
    switch(payment) {
      case "Paid": return "default";
      case "Unpaid": return "destructive";
      case "Refunded": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zoru-ink">Orders</h1>
          <p className="text-zoru-ink-muted mt-1 text-sm">Manage and track your storefront orders.</p>
        </div>
        <Button onClick={() => console.log("Export")} variant="outline" className="gap-2">
          <Filter className="w-4 h-4" /> Export
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Order History</CardTitle>
          <CardDescription>View all recent orders from your customers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="all">All Orders</TabsTrigger>
                <TabsTrigger value="unfulfilled">Unfulfilled</TabsTrigger>
                <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="rounded-md border border-zoru-line overflow-hidden">
              <Table>
                <TableHeader className="bg-zoru-surface">
                  <TableRow>
                    <TableHead className="w-[100px]">Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Fulfillment</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order) => (
                      <TableRow 
                        key={order.id} 
                        className="hover:bg-zoru-surface-2 cursor-pointer transition-colors" 
                        onClick={() => router.push(`/dashboard/sabshop/${params.storefrontId}/orders/${order.id}`)}
                      >
                        <TableCell className="font-medium text-zoru-brand">{order.id}</TableCell>
                        <TableCell className="text-zoru-ink-muted">{order.date}</TableCell>
                        <TableCell className="font-medium">{order.customer}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(order.status) as any}>{order.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPaymentBadgeVariant(order.payment) as any}>{order.payment}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{order.total}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="hover:bg-zoru-surface" onClick={(e) => { 
                            e.stopPropagation(); 
                            router.push(`/dashboard/sabshop/${params.storefrontId}/orders/${order.id}`)
                          }}>
                            <Eye className="w-4 h-4 text-zoru-ink-muted" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-zoru-ink-muted">
                        No orders found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Tabs>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-zoru-ink-muted">
              Showing <strong className="text-zoru-ink">1</strong> to <strong className="text-zoru-ink">{filteredOrders.length}</strong> of <strong className="text-zoru-ink">{filteredOrders.length}</strong> orders
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" disabled>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" disabled>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
