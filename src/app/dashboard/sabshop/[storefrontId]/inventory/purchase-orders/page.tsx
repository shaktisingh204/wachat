"use client";

import React from "react";
import { Plus, Search, FileText, PackageCheck, Clock, AlertCircle, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/zoruui/page-header";
import { Button } from "@/components/zoruui/button";
import { Input } from "@/components/zoruui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/zoruui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/zoruui/table";
import { Badge } from "@/components/zoruui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/zoruui/dropdown-menu";
import { StatCard } from "@/components/zoruui/stat-card";

const mockPurchaseOrders = [
  {
    id: "PO-2023-1042",
    supplier: "Global Electronics Ltd.",
    orderDate: "2023-10-15",
    expectedDate: "2023-10-22",
    totalAmount: 14500.00,
    items: 450,
    status: "Pending",
  },
  {
    id: "PO-2023-1043",
    supplier: "Pacific Textiles Inc.",
    orderDate: "2023-10-16",
    expectedDate: "2023-10-25",
    totalAmount: 8240.50,
    items: 1200,
    status: "Draft",
  },
  {
    id: "PO-2023-1044",
    supplier: "Nordic Home Goods",
    orderDate: "2023-10-10",
    expectedDate: "2023-10-18",
    totalAmount: 22100.00,
    items: 320,
    status: "Receiving",
  },
  {
    id: "PO-2023-1045",
    supplier: "TechSupply Co.",
    orderDate: "2023-10-05",
    expectedDate: "2023-10-12",
    totalAmount: 4500.00,
    items: 50,
    status: "Completed",
  },
  {
    id: "PO-2023-1046",
    supplier: "Global Electronics Ltd.",
    orderDate: "2023-10-18",
    expectedDate: "2023-11-01",
    totalAmount: 56000.00,
    items: 2000,
    status: "Pending",
  },
];

export default function PurchaseOrdersPage() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Completed': return 'default';
      case 'Receiving': return 'secondary';
      case 'Pending': return 'outline';
      case 'Draft': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Purchase Orders"
        description="Manage incoming procurement from your suppliers and vendors."
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create PO
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active POs"
          value="24"
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
          description="Pending and Receiving"
        />
        <StatCard
          title="Pending Value"
          value="$124,500"
          icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
          trend="+12% from last month"
          trendUp={true}
        />
        <StatCard
          title="Expected Today"
          value="3"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          description="Shipments arriving today"
        />
        <StatCard
          title="Received (MTD)"
          value="18"
          icon={<PackageCheck className="h-4 w-4 text-muted-foreground" />}
          trend="+4 from last month"
          trendUp={true}
        />
      </div>

      <Card className="col-span-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Procurement Orders</CardTitle>
            <CardDescription>
              Track all your purchase orders and their current fulfillment status.
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search POs..."
                className="w-[200px] sm:w-[300px] pl-8"
              />
            </div>
            <Button variant="outline">Filter Status</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected Date</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPurchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.id}</TableCell>
                  <TableCell>{po.supplier}</TableCell>
                  <TableCell className="text-muted-foreground">{po.orderDate}</TableCell>
                  <TableCell className="text-muted-foreground">{po.expectedDate}</TableCell>
                  <TableCell>{formatCurrency(po.totalAmount)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(po.status)} className={po.status === 'Draft' ? 'opacity-50' : ''}>
                      {po.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem>View details</DropdownMenuItem>
                        <DropdownMenuItem>Edit PO</DropdownMenuItem>
                        <DropdownMenuItem>Mark as Received</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">Cancel PO</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
          <div>Showing 1 to {mockPurchaseOrders.length} of 156 purchase orders</div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
