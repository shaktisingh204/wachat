"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Progress,
  Button,
  Input,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  StatCard,
  Switch,
  Label,
} from "@/components/zoruui";
import {
  Search,
  Filter,
  MoreHorizontal,
  Hash,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Plus,
} from "lucide-react";

const INITIAL_NUMBERS = [
  { id: "1", number: "+1 (555) 123-4567", country: "US", type: "Local", status: "Active", reputation: "High", throughputLimit: 100, currentThroughput: 85, messagesSent: 12450, errorRate: 0.2, provider: "Twilio" },
  { id: "2", number: "+1 (555) 987-6543", country: "US", type: "Toll-Free", status: "Active", reputation: "Medium", throughputLimit: 50, currentThroughput: 20, messagesSent: 5430, errorRate: 1.5, provider: "Bandwidth" },
  { id: "3", number: "+44 20 7123 4567", country: "UK", type: "Mobile", status: "Warning", reputation: "Low", throughputLimit: 10, currentThroughput: 9, messagesSent: 1200, errorRate: 5.4, provider: "Vonage" },
  { id: "4", number: "+61 4 1234 5678", country: "AU", type: "Mobile", status: "Active", reputation: "High", throughputLimit: 25, currentThroughput: 10, messagesSent: 8900, errorRate: 0.1, provider: "Twilio" },
  { id: "5", number: "+1 (555) 333-2222", country: "US", type: "Short Code", status: "Suspended", reputation: "Poor", throughputLimit: 1000, currentThroughput: 0, messagesSent: 450000, errorRate: 12.5, provider: "Sinch" },
];

function generatePhoneNumber() {
  const prefix = "+1 (555)";
  const part1 = Math.floor(Math.random() * 900 + 100);
  const part2 = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix} ${part1}-${part2}`;
}

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
  const [numbers, setNumbers] = useState(INITIAL_NUMBERS);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Feature states
  const [isStickySenderEnabled, setIsStickySenderEnabled] = useState(false);
  const [isAutoScalingEnabled, setIsAutoScalingEnabled] = useState(false);
  const [throughputThreshold, setThroughputThreshold] = useState(90);
  const [maxAutoBuy, setMaxAutoBuy] = useState(5);
  const [autoBuyCount, setAutoBuyCount] = useState(0);
  
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulating) {
      interval = setInterval(() => {
        setNumbers((prev) => {
          let updatedNumbers = [...prev];
          let needsNewNumber = false;

          updatedNumbers = updatedNumbers.map((num) => {
            if (num.status === "Suspended") return num;
            
            const change = Math.floor(Math.random() * 20) - 5; 
            let newThroughput = Math.max(0, num.currentThroughput + change);
            
            if (newThroughput > num.throughputLimit + 10) {
              newThroughput = num.throughputLimit + 10; 
            }

            const percent = (newThroughput / num.throughputLimit) * 100;
            if (percent >= throughputThreshold) {
              needsNewNumber = true;
            }

            return { ...num, currentThroughput: newThroughput };
          });

          if (needsNewNumber && isAutoScalingEnabled && autoBuyCount < maxAutoBuy) {
            const newNum = {
              id: Math.random().toString(36).substr(2, 9),
              number: generatePhoneNumber(),
              country: "US",
              type: "Local",
              status: "Active",
              reputation: "High",
              throughputLimit: 100,
              currentThroughput: 0,
              messagesSent: 0,
              errorRate: 0.0,
              provider: "Auto-Scale"
            };
            updatedNumbers.push(newNum);
            setAutoBuyCount(c => c + 1);
          }

          return updatedNumbers;
        });
      }, 2000);
    }

    return () => clearInterval(interval);
  }, [isSimulating, isAutoScalingEnabled, throughputThreshold, maxAutoBuy, autoBuyCount]);

  const filteredNumbers = numbers.filter(
    (n) => n.number.includes(searchTerm) || n.provider.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCapacity = numbers.reduce((acc, curr) => curr.status !== 'Suspended' ? acc + curr.throughputLimit : acc, 0);
  const currentTotalThroughput = numbers.reduce((acc, curr) => curr.status !== 'Suspended' ? acc + curr.currentThroughput : acc, 0);

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Number Pool</h2>
          <p className="text-zoru-ink-muted">
            Manage your dedicated numbers, monitor reputation, and analyze throughput.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant={isSimulating ? "destructive" : "secondary"} 
            onClick={() => setIsSimulating(!isSimulating)}
          >
            {isSimulating ? "Stop Traffic" : "Simulate Traffic"}
          </Button>
          <Button variant="outline">Download CSV</Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Buy Number
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Numbers"
          value={numbers.length}
          delta={numbers.length - INITIAL_NUMBERS.length}
          period="auto-scaled"
          icon={<Hash />}
        />
        <StatCard
          label="Active Routing"
          value={numbers.filter(n => n.status === "Active").length}
          delta={0}
          period="vs last month"
          icon={<CheckCircle2 />}
        />
        <StatCard
          label="Pool Throughput"
          value={`${Math.round(currentTotalThroughput)} / ${totalCapacity} MPS`}
          delta={currentTotalThroughput > 0 ? Number((currentTotalThroughput / totalCapacity * 100).toFixed(1)) : 0}
          period="% utilization"
          icon={<Activity />}
        />
        <StatCard
          label="At Risk (Reputation)"
          value={numbers.filter(n => n.reputation === "Low" || n.reputation === "Poor").length}
          delta={0}
          period="needs attention"
          icon={<AlertTriangle />}
          invertDelta
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-zoru-ink-muted" />
              <span>Pool Settings</span>
            </CardTitle>
            <CardDescription>
              Configure auto-scaling and routing logic for this number pool.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Sticky Sender</Label>
                  <p className="text-sm text-zoru-ink-muted">
                    Ensure recipients always receive messages from the same number.
                  </p>
                </div>
                <Switch
                  checked={isStickySenderEnabled}
                  onCheckedChange={setIsStickySenderEnabled}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Auto-Scaling</Label>
                  <p className="text-sm text-zoru-ink-muted">
                    Automatically buy numbers when limits are reached.
                  </p>
                </div>
                <Switch
                  checked={isAutoScalingEnabled}
                  onCheckedChange={setIsAutoScalingEnabled}
                />
              </div>

              {isAutoScalingEnabled && (
                <div className="space-y-4 rounded-lg border p-4 bg-zoru-surface-2/50">
                  <div className="space-y-2">
                    <Label>Throughput Threshold (%)</Label>
                    <Input 
                      type="number" 
                      min={10} 
                      max={100} 
                      value={throughputThreshold}
                      onChange={(e) => setThroughputThreshold(Number(e.target.value))}
                    />
                    <p className="text-xs text-zoru-ink-muted">
                      Scale when a number exceeds this capacity.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Auto-buys</Label>
                    <Input 
                      type="number" 
                      min={1} 
                      max={20} 
                      value={maxAutoBuy}
                      onChange={(e) => setMaxAutoBuy(Number(e.target.value))}
                    />
                    <p className="text-xs text-zoru-ink-muted">
                      Maximum numbers to purchase automatically ({autoBuyCount} used).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
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
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
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
            
            <div className="rounded-md border">
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
                    const throughputPercent = Math.min(
                      Math.round((num.currentThroughput / num.throughputLimit) * 100), 
                      100
                    );
                    const isOverloaded = throughputPercent >= throughputThreshold && isAutoScalingEnabled;
                    
                    return (
                      <TableRow key={num.id} className={isOverloaded ? "bg-zoru-danger/10" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{num.number}</span>
                            <span className="text-xs text-zoru-ink-muted">
                              {num.country} • {num.type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {num.provider === "Auto-Scale" ? (
                            <Badge variant="outline" className="text-zoru-primary border-zoru-primary">Auto-Scaled</Badge>
                          ) : num.provider}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(num.status)}
                        </TableCell>
                        <TableCell>
                          {getReputationBadge(num.reputation)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col space-y-1.5">
                            <div className="flex justify-between text-xs text-zoru-ink-muted">
                              <span>{Math.round(num.currentThroughput)} / {num.throughputLimit}</span>
                              <span className={throughputPercent > 90 ? "text-zoru-ink font-bold" : ""}>
                                {throughputPercent}%
                              </span>
                            </div>
                            <Progress 
                              value={throughputPercent} 
                              className="h-2"
                            />
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
                              <DropdownMenuItem className="text-zoru-ink">Release Number</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredNumbers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-zoru-ink-muted">
                        No numbers found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
