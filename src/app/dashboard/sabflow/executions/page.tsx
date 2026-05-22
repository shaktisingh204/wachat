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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MoreHorizontal, 
  Search, 
  Filter, 
  Play, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RefreshCcw, 
  Eye, 
  Activity,
  Zap,
  Globe,
  Calendar
} from "lucide-react";

// Types
type ExecutionStatus = "success" | "failed" | "running" | "pending";
type TriggerType = "webhook" | "schedule" | "manual" | "api";

interface Execution {
  id: string;
  flowName: string;
  status: ExecutionStatus;
  trigger: TriggerType;
  duration: string;
  startedAt: string;
}

// Generate massive mock data
const MOCK_EXECUTIONS: Execution[] = Array.from({ length: 50 }).map((_, i) => {
  const statuses: ExecutionStatus[] = ["success", "success", "success", "failed", "running", "pending"];
  const triggers: TriggerType[] = ["webhook", "schedule", "manual", "api"];
  const flowNames = [
    "Customer Onboarding Sequence",
    "Weekly Report Generator",
    "Invoice Sync to ERP",
    "Lead Enrichment Workflow",
    "Daily Database Backup",
    "Slack Notification Router",
    "Order Fulfillment Process"
  ];

  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const trigger = triggers[Math.floor(Math.random() * triggers.length)];
  const flowName = flowNames[Math.floor(Math.random() * flowNames.length)];
  
  // Random duration logic based on status
  let duration = "0ms";
  if (status === "success") {
    duration = `${Math.floor(Math.random() * 2000) + 100}ms`;
    if (Math.random() > 0.8) duration = `${(Math.random() * 5 + 1).toFixed(2)}s`;
  } else if (status === "failed") {
    duration = `${Math.floor(Math.random() * 5000) + 50}ms`;
  } else if (status === "running") {
    duration = `${(Math.random() * 30 + 5).toFixed(1)}s`;
  } else {
    duration = "-";
  }

  // Random time within the last 24 hours
  const date = new Date(Date.now() - Math.floor(Math.random() * 86400000));
  
  return {
    id: `exe_${Math.random().toString(36).substr(2, 9)}`,
    flowName,
    status,
    trigger,
    duration,
    startedAt: date.toLocaleString(),
  };
}).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

export default function ExecutionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");

  const filteredData = MOCK_EXECUTIONS.filter(exe => {
    const matchesSearch = 
      exe.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exe.flowName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || exe.status === statusFilter;
    const matchesTrigger = triggerFilter === "all" || exe.trigger === triggerFilter;

    return matchesSearch && matchesStatus && matchesTrigger;
  });

  const getStatusBadge = (status: ExecutionStatus) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Success</Badge>;
      case "failed":
        return <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-rose-500/20"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case "running":
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20"><RefreshCcw className="w-3 h-3 mr-1 animate-spin" /> Running</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-muted-foreground"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  };

  const getTriggerIcon = (trigger: TriggerType) => {
    switch (trigger) {
      case "webhook": return <Globe className="w-4 h-4 text-purple-500" />;
      case "schedule": return <Calendar className="w-4 h-4 text-blue-500" />;
      case "manual": return <Zap className="w-4 h-4 text-orange-500" />;
      case "api": return <Activity className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flow Executions</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and debug all your automated workflow runs in real-time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Play className="w-4 h-4 mr-2" />
            Trigger Flow
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Executions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,453</div>
            <p className="text-xs text-muted-foreground mt-1">+14% from last month</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.2%</div>
            <p className="text-xs text-muted-foreground mt-1">+0.2% from last week</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed (24h)</CardTitle>
            <XCircle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.2s</div>
            <p className="text-xs text-muted-foreground mt-1">-0.1s from last week</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Data Table */}
      <Card className="border-border shadow-sm">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Execution Logs</CardTitle>
            
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search execution ID or flow..."
                  className="pl-9 bg-background"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-background">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={triggerFilter} onValueChange={setTriggerFilter}>
                <SelectTrigger className="w-[140px] bg-background">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <SelectValue placeholder="Trigger" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Triggers</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="schedule">Schedule</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[120px]">Execution ID</TableHead>
                <TableHead>Flow</TableHead>
                <TableHead className="w-[150px]">Status</TableHead>
                <TableHead className="w-[150px]">Trigger</TableHead>
                <TableHead className="w-[100px]">Duration</TableHead>
                <TableHead className="w-[180px]">Started At</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                    No executions found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((exe) => (
                  <TableRow key={exe.id} className="group">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {exe.id}
                    </TableCell>
                    <TableCell className="font-medium">
                      {exe.flowName}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(exe.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 capitalize text-sm text-muted-foreground">
                        {getTriggerIcon(exe.trigger)}
                        {exe.trigger}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {exe.duration}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {exe.startedAt}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <RefreshCcw className="w-4 h-4 mr-2" />
                            Replay Run
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {exe.status === "running" ? (
                            <DropdownMenuItem className="text-destructive">
                              <XCircle className="w-4 h-4 mr-2" />
                              Stop Execution
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-destructive">
                              Delete Record
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
