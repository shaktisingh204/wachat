"use client";

import React from "react";
import { Plus, Search, Building, Clock, Star, Users, MoreHorizontal, Mail, Phone } from "lucide-react";
import { PageHeader } from '@/components/sabcrm/20ui/compat';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Input } from '@/components/sabcrm/20ui/compat';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/sabcrm/20ui/compat';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import { Badge } from '@/components/sabcrm/20ui/compat';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/sabcrm/20ui/compat';
import { StatCard } from '@/components/sabcrm/20ui/compat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/sabcrm/20ui/compat';

const mockSuppliers = [
  {
    id: "SUP-01",
    name: "Global Electronics Ltd.",
    category: "Electronics",
    contactName: "David Chen",
    email: "d.chen@globalelectronics.com",
    phone: "+1 (555) 123-4567",
    leadTime: "14 days",
    rating: 4.8,
    status: "Active",
    avatar: "GE"
  },
  {
    id: "SUP-02",
    name: "Pacific Textiles Inc.",
    category: "Apparel",
    contactName: "Maria Garcia",
    email: "maria@pacifictextiles.io",
    phone: "+1 (555) 987-6543",
    leadTime: "21 days",
    rating: 4.5,
    status: "Active",
    avatar: "PT"
  },
  {
    id: "SUP-03",
    name: "Nordic Home Goods",
    category: "Home & Garden",
    contactName: "Lars Jensen",
    email: "sales@nordichome.se",
    phone: "+46 8 123 45 67",
    leadTime: "30 days",
    rating: 4.9,
    status: "Active",
    avatar: "NH"
  },
  {
    id: "SUP-04",
    name: "TechSupply Co.",
    category: "Accessories",
    contactName: "Sarah Williams",
    email: "swilliams@techsupply.co",
    phone: "+1 (555) 321-7654",
    leadTime: "7 days",
    rating: 3.2,
    status: "Under Review",
    avatar: "TS"
  },
  {
    id: "SUP-05",
    name: "Apex Manufacturing",
    category: "Raw Materials",
    contactName: "Robert Taylor",
    email: "rtaylor@apex-mfg.com",
    phone: "+1 (555) 567-8901",
    leadTime: "45 days",
    rating: 4.1,
    status: "Inactive",
    avatar: "AM"
  },
];

export default function SuppliersPage() {
  const getRatingStars = (rating: number) => {
    return (
      <div className="flex items-center space-x-1">
        <Star className={`h-3 w-3 ${rating >= 4 ? 'text-yellow-400 fill-yellow-400' : 'text-yellow-400'}`} />
        <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Suppliers"
        description="Manage your vendor relationships, contacts, and performance metrics."
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Suppliers"
          value="42"
          icon={<Building className="h-4 w-4 text-muted-foreground" />}
          trend="+3 new this quarter"
          trendUp={true}
        />
        <StatCard
          title="Avg Lead Time"
          value="18 days"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          trend="-2 days from last year"
          trendUp={true}
        />
        <StatCard
          title="Avg Supplier Rating"
          value="4.6 / 5"
          icon={<Star className="h-4 w-4 text-muted-foreground" />}
          description="Based on quality and speed"
        />
        <StatCard
          title="Total Contacts"
          value="156"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          description="Across all supplier accounts"
        />
      </div>

      <Card className="col-span-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Supplier Database</CardTitle>
            <CardDescription>
              Directory of all vendors and manufacturing partners.
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search suppliers..."
                className="w-[200px] sm:w-[300px] pl-8"
              />
            </div>
            <Button variant="outline">Filters</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <Tr>
                <Th>Supplier</Th>
                <Th>Contact Info</Th>
                <Th>Category</Th>
                <Th>Lead Time</Th>
                <Th>Rating</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {mockSuppliers.map((supplier) => (
                <Tr key={supplier.id}>
                  <Td>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{supplier.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{supplier.name}</span>
                        <span className="text-xs text-muted-foreground">{supplier.id}</span>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col space-y-1 text-sm">
                      <span className="font-medium">{supplier.contactName}</span>
                      <div className="flex items-center text-muted-foreground text-xs">
                        <Mail className="mr-1 h-3 w-3" />
                        {supplier.email}
                      </div>
                      <div className="flex items-center text-muted-foreground text-xs">
                        <Phone className="mr-1 h-3 w-3" />
                        {supplier.phone}
                      </div>
                    </div>
                  </Td>
                  <Td>{supplier.category}</Td>
                  <Td>
                    <div className="flex items-center text-sm">
                      <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                      {supplier.leadTime}
                    </div>
                  </Td>
                  <Td>{getRatingStars(supplier.rating)}</Td>
                  <Td>
                    <Badge 
                      variant={
                        supplier.status === "Active" ? "default" :
                        supplier.status === "Under Review" ? "secondary" : "outline"
                      }
                    >
                      {supplier.status}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem>View profile</DropdownMenuItem>
                        <DropdownMenuItem>View POs</DropdownMenuItem>
                        <DropdownMenuItem>Edit details</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardContent>
        <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
          <div>Showing 1 to {mockSuppliers.length} of 42 suppliers</div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
