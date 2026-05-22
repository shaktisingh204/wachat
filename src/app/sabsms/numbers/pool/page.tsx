"use client";

import React, { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Hash,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/ui/stat-card";

const MOCK_NUMBERS = [
  { id: "1", number: "+1 (555) 123-4567", country: "US", type: "Local", status: "Active", reputation: "High", throughputLimit: 100, currentThroughput: 85, messagesSent: 12450, errorRate: 0.2, provider: "Twilio" },
  { id: "2", number: "+1 (555) 987-6543", country: "US", type: "Toll-Free", status: "Active", reputation: "Medium", throughputLimit: 50, currentThroughput: 20, messagesSent: 5430, errorRate: 1.5, provider: "Bandwidth" },
  { id: "3", number: "+44 20 7123 4567", country: "UK", type: "Mobile", status: "Warning", reputation: "Low", throughputLimit: 10, currentThroughput: 9, messagesSent: 1200, errorRate: 5.4, provider: "Vonage" },
  { id: "4", number: "+61 4 1234 5678", country: "AU", type: "Mobile", status: "Active", reputation: "High", throughputLimit: 25, currentThroughput: 10, messagesSent: 8900, errorRate: 0.1, provider: "Twilio" },
  { id: "5", number: "+1 (555) 333-2222", country: "US", type: "Short Code", status: "Suspended", reputation: "Poor", throughputLimit: 1000, currentThroughput: 0, messagesSent: 450000, errorRate: 12.5, provider: "Sinch" },
];

function getReputationBadge(reputation: string) {
  switch (reputation.toLowerCase()) {
    case "high":
      return <Badge variant="success">High</Badge>;
    case "medium":
      return <Badge variant="warning">Medium</Badge>;
    case "low":
    case "poor":
      return <Badge variant="destructive">{reputation}</Badge>;
    default:
      return <Badge variant="secondary">{reputation}</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status.toLowerCase()) {
    case "active":
      return <Badge variant="info">Active</Badge>;
    case "warning":
      return <Badge variant="warning">Warning</Badge>;
    case "suspended":
      return <Badge variant="destructive">Suspended</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function NumberPoolPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredNumbers = MOCK_NUMBERS.filter(
    (n) => n.number.includes(searchTerm) || n.provider.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Number Pool</h2>
          <p className="text-muted-foreground">
            Manage your dedicated numbers, monitor reputation, and analyze throughput.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">Download CSV</Button>
          <Button>Buy Number</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Numbers"
          value={124}
          delta={12}
          deltaLabel="vs last month"
          icon={Hash}
          tone="indigo"
        />
        <StatCard
          label="Active Routing"
          value={118}
          delta={4}
          deltaLabel="vs last month"
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Avg. Throughput"
          value="45 MPS"
          delta={-2.5}
          deltaLabel="vs last week"
          icon={Activity}
          tone="cyan"
        />
        <StatCard
          label="At Risk (Reputation)"
          value={3}
          delta={1}
          deltaLabel="needs attention"
          icon={AlertTriangle}
          tone="coral"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Numbers & Routing Rules</CardTitle>
          <CardDescription>
            Detailed view of all your numbers, their health, and current throughput limits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-1 items-center space-x-2">
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search numbers or providers..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="UK">United Kingdom</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reputation</TableHead>
                <TableHead className="w-[200px]">Throughput (MPS)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNumbers.map((num) => {
                const throughputPercent = Math.round((num.currentThroughput / num.throughputLimit) * 100);
                
                return (
                  <TableRow key={num.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{num.number}</span>
                        <span className="text-xs text-muted-foreground">
                          {num.country} • {num.type}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {num.provider}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(num.status)}
                    </TableCell>
                    <TableCell>
                      {getReputationBadge(num.reputation)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{num.currentThroughput} / {num.throughputLimit}</span>
                          <span>{throughputPercent}%</span>
                        </div>
                        <Progress value={throughputPercent} className="h-2" />
                      </div>
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
                          <DropdownMenuItem>View Analytics</DropdownMenuItem>
                          <DropdownMenuItem>Edit Routing</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">Release Number</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
