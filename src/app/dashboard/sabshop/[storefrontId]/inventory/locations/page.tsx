"use client";

import React from "react";
import { Plus, MapPin, Building2, HardDrive, Settings, Search, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/zoruui/page-header";
import { Button } from "@/components/zoruui/button";
import { Input } from "@/components/zoruui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/zoruui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/zoruui/table";
import { Badge } from "@/components/zoruui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/zoruui/dropdown-menu";
import { StatCard } from "@/components/zoruui/stat-card";
import { Progress } from "@/components/zoruui/progress";

const mockLocations = [
  {
    id: "LOC-001",
    name: "Central US Distribution",
    type: "Distribution Center",
    address: "1234 Commerce Pkwy, Chicago, IL 60601",
    capacity: 50000,
    used: 42500,
    status: "Active",
    manager: "Alex Johnson",
  },
  {
    id: "LOC-002",
    name: "West Coast Fulfillment",
    type: "Fulfillment Center",
    address: "8899 Industrial Way, Los Angeles, CA 90001",
    capacity: 35000,
    used: 31000,
    status: "Active",
    manager: "Sarah Smith",
  },
  {
    id: "LOC-003",
    name: "East Coast Hub",
    type: "Warehouse",
    address: "45 Enterprise Blvd, Newark, NJ 07102",
    capacity: 40000,
    used: 15000,
    status: "Maintenance",
    manager: "Mike Davis",
  },
  {
    id: "LOC-004",
    name: "South Retail Storage",
    type: "Retail Backend",
    address: "776 Retail Row, Austin, TX 78701",
    capacity: 10000,
    used: 8500,
    status: "Active",
    manager: "Emily White",
  },
  {
    id: "LOC-005",
    name: "European Depot",
    type: "Distribution Center",
    address: "Logistikpark 1, 12345 Berlin, Germany",
    capacity: 60000,
    used: 58000,
    status: "Warning",
    manager: "Hans Muller",
  },
];

export default function LocationsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Locations"
        description="Manage your warehouses, distribution centers, and retail storage capacities."
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Location
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Locations"
          value="12"
          icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
          trend="+1 from last month"
          trendUp={true}
        />
        <StatCard
          title="Total Capacity"
          value="195,000"
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
          description="Pallet positions across all sites"
        />
        <StatCard
          title="Global Utilization"
          value="79%"
          icon={<HardDrive className="h-4 w-4 text-muted-foreground" />}
          trend="+5% from last month"
          trendUp={true}
        />
        <StatCard
          title="Locations in Maint."
          value="1"
          icon={<Settings className="h-4 w-4 text-muted-foreground" />}
          description="Requires attention"
          trend="Down 1 from last week"
          trendUp={false} // Technically good that it's down, but false shows as red/down depending on component
        />
      </div>

      <Card className="col-span-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Inventory Locations</CardTitle>
            <CardDescription>
              View and manage your network of inventory storage facilities.
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search locations..."
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
                <TableHead>Location Details</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Capacity / Utilization</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLocations.map((location) => {
                const utilPercentage = Math.round((location.used / location.capacity) * 100);
                return (
                  <TableRow key={location.id}>
                    <TableCell>
                      <div className="flex flex-col space-y-1">
                        <span className="font-medium">{location.name}</span>
                        <span className="text-xs text-muted-foreground">{location.address}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {location.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-2 w-[150px]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {location.used.toLocaleString()} / {location.capacity.toLocaleString()}
                          </span>
                          <span className="font-medium">{utilPercentage}%</span>
                        </div>
                        <Progress value={utilPercentage} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell>{location.manager}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          location.status === "Active" ? "default" :
                          location.status === "Maintenance" ? "outline" : "destructive"
                        }
                      >
                        {location.status}
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
                          <DropdownMenuItem>View inventory</DropdownMenuItem>
                          <DropdownMenuItem>Edit location</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
          <div>Showing 1 to {mockLocations.length} of 12 locations</div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
