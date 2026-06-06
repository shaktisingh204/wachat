"use client";

import React from "react";
import { Plus, Search, ArrowRightLeft, Truck, PackageCheck, AlertTriangle, MoreHorizontal, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/sabcrm/20ui/zoru/page-header";
import { Button } from "@/components/sabcrm/20ui/zoru/button";
import { Input } from "@/components/sabcrm/20ui/zoru/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/sabcrm/20ui/zoru/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/sabcrm/20ui/zoru/table";
import { Badge } from "@/components/sabcrm/20ui/zoru/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/sabcrm/20ui/zoru/dropdown-menu";
import { StatCard } from "@/components/sabcrm/20ui/zoru/stat-card";

const mockTransfers = [
  {
    id: "TRN-0091",
    origin: "Central US Distribution",
    destination: "West Coast Fulfillment",
    date: "2023-10-24",
    items: 450,
    status: "In Transit",
    priority: "High",
  },
  {
    id: "TRN-0092",
    origin: "East Coast Hub",
    destination: "Central US Distribution",
    date: "2023-10-25",
    items: 120,
    status: "Preparing",
    priority: "Normal",
  },
  {
    id: "TRN-0093",
    origin: "West Coast Fulfillment",
    destination: "South Retail Storage",
    date: "2023-10-22",
    items: 85,
    status: "Delivered",
    priority: "Normal",
  },
  {
    id: "TRN-0094",
    origin: "European Depot",
    destination: "East Coast Hub",
    date: "2023-10-20",
    items: 1500,
    status: "Delayed",
    priority: "Urgent",
  },
  {
    id: "TRN-0095",
    origin: "Central US Distribution",
    destination: "South Retail Storage",
    date: "2023-10-26",
    items: 30,
    status: "Draft",
    priority: "Low",
  },
];

export default function TransfersPage() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Delivered': return <Badge variant="default">{status}</Badge>;
      case 'In Transit': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200">{status}</Badge>;
      case 'Preparing': return <Badge variant="outline">{status}</Badge>;
      case 'Delayed': return <Badge variant="destructive">{status}</Badge>;
      case 'Draft': return <Badge variant="secondary" className="opacity-50">{status}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === 'Urgent') return <AlertTriangle className="h-3 w-3 text-red-500 mr-1" />;
    if (priority === 'High') return <AlertTriangle className="h-3 w-3 text-orange-500 mr-1" />;
    return null;
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Stock Transfers"
        description="Manage inventory movement between your warehouses and retail locations."
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Transfer
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Transfers"
          value="12"
          icon={<ArrowRightLeft className="h-4 w-4 text-muted-foreground" />}
          description="Preparing or In Transit"
        />
        <StatCard
          title="Items In Transit"
          value="2,450"
          icon={<Truck className="h-4 w-4 text-muted-foreground" />}
          trend="+300 from last week"
          trendUp={true}
        />
        <StatCard
          title="Delivered (MTD)"
          value="45"
          icon={<PackageCheck className="h-4 w-4 text-muted-foreground" />}
          description="Successfully received"
        />
        <StatCard
          title="Delayed Shipments"
          value="2"
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          trend="Needs attention"
          trendUp={false}
        />
      </div>

      <Card className="col-span-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Transfer History</CardTitle>
            <CardDescription>
              Track internal stock movements across your supply chain network.
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search transfers..."
                className="w-[200px] sm:w-[300px] pl-8"
              />
            </div>
            <Button variant="outline">Filters</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transfer ID</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTransfers.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell className="font-medium">{transfer.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="truncate max-w-[120px]">{transfer.origin}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate max-w-[120px]">{transfer.destination}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{transfer.date}</TableCell>
                  <TableCell>{transfer.items}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      {getPriorityIcon(transfer.priority)}
                      <span className="text-sm">{transfer.priority}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(transfer.status)}</TableCell>
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
                        <DropdownMenuItem>Print packing slip</DropdownMenuItem>
                        <DropdownMenuItem>Update status</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">Cancel transfer</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
          <div>Showing 1 to {mockTransfers.length} of 84 transfers</div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
