"use client";

import React, { useState } from "react";
import { 
  Users, 
  Filter, 
  Plus, 
  MoreHorizontal, 
  Settings, 
  Trash2, 
  PenTool, 
  Sparkles,
  Search,
  Activity
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/sabcrm/20ui/zoru/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from "@/components/sabcrm/20ui/zoru/table";
import { Button } from "@/components/sabcrm/20ui/zoru/button";
import { Badge } from "@/components/sabcrm/20ui/zoru/badge";
import { Input } from "@/components/sabcrm/20ui/zoru/input";

const mockSegments = [
  {
    id: "seg_1",
    name: "High Spenders",
    description: "Customers who spent > $1000 in the last 30 days",
    customerCount: 1245,
    status: "Active",
    lastUpdated: "2 hours ago",
    rules: 2
  },
  {
    id: "seg_2",
    name: "Churn Risk",
    description: "No purchases in 90+ days, previously active",
    customerCount: 389,
    status: "Active",
    lastUpdated: "1 day ago",
    rules: 3
  },
  {
    id: "seg_3",
    name: "VIP Members",
    description: "Gold tier loyalty members",
    customerCount: 150,
    status: "Active",
    lastUpdated: "5 mins ago",
    rules: 1
  },
  {
    id: "seg_4",
    name: "Holiday Shoppers",
    description: "Purchased during Black Friday / Cyber Monday",
    customerCount: 5200,
    status: "Inactive",
    lastUpdated: "2 months ago",
    rules: 4
  }
];

export default function CustomerSegmentsPage() {
  const [search, setSearch] = useState("");

  const filteredSegments = mockSegments.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--st-text)] tracking-tight flex items-center gap-2">
            <Filter className="w-6 h-6 text-indigo-500" />
            Customer Segments
          </h1>
          <p className="text-sm text-[var(--st-text-secondary)] mt-1">
            Build dynamic segments using powerful rule criteria to target specific audiences.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            AI Generator
          </Button>
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Segment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/10 rounded-[var(--st-radius)]">
                <Users className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--st-text-secondary)]">Total Segmented</p>
                <p className="text-2xl font-bold text-[var(--st-text)]">6,984</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-[var(--st-radius)]">
                <Activity className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--st-text-secondary)]">Active Rules</p>
                <p className="text-2xl font-bold text-[var(--st-text)]">24</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-[var(--st-radius)]">
                <Settings className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--st-text-secondary)]">Dynamic Updates</p>
                <p className="text-2xl font-bold text-[var(--st-text)]">Real-time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--st-border)] pb-4">
          <div>
            <CardTitle>All Segments</CardTitle>
            <CardDescription>Manage and track your customer segments.</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--st-text-secondary)]" />
            <Input 
              placeholder="Search segments..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead>Customers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSegments.length > 0 ? (
                filteredSegments.map((segment) => (
                  <TableRow key={segment.id}>
                    <TableCell className="font-medium text-[var(--st-text)]">
                      {segment.name}
                    </TableCell>
                    <TableCell className="text-[var(--st-text-tertiary)]">
                      {segment.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-[var(--st-bg-secondary)] font-mono">
                        {segment.rules} Rules
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {segment.customerCount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={segment.status === "Active" ? "default" : "secondary"} className={segment.status === "Active" ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : ""}>
                        {segment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[var(--st-text-tertiary)]">
                      {segment.lastUpdated}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PenTool className="w-4 h-4 text-[var(--st-text-tertiary)]" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4 text-[var(--st-text-tertiary)]" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-[var(--st-text-secondary)]">
                    No segments found matching "{search}"
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
