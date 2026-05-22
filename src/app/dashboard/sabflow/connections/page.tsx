"use client"

import React, { useState } from "react"
import { m } from "motion/react"
import {
  Cloud,
  MessageSquare,
  CloudCog,
  Github,
  CreditCard,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCcw,
  MoreVertical,
  Plus,
  Search,
  Filter,
  Activity,
  Box,
  Key
} from "lucide-react"

import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { fadeInUp, staggerContainer } from "@/lib/motion"

type ConnectionStatus = "Connected" | "Expired" | "Error"

interface Connection {
  id: string
  name: string
  provider: string
  type: string
  status: ConnectionStatus
  account: string
  lastSync: string
  icon: React.ElementType
  color: string
  metrics?: { label: string; value: string }[]
  usage?: number // percentage 0-100
  errorMessage?: string
}

const mockConnections: Connection[] = [
  {
    id: "conn_01",
    name: "Google Drive",
    provider: "Google",
    type: "OAuth2",
    status: "Connected",
    account: "harsh@example.com",
    lastSync: "10 mins ago",
    icon: Cloud,
    color: "text-blue-500",
    usage: 15,
    metrics: [
      { label: "Storage", value: "15GB / 100GB" },
      { label: "Files Synced", value: "1,204" }
    ]
  },
  {
    id: "conn_02",
    name: "Slack Integration",
    provider: "Slack",
    type: "OAuth2",
    status: "Expired",
    account: "sabnode-workspace",
    lastSync: "2 days ago",
    icon: MessageSquare,
    color: "text-purple-500",
    metrics: [
      { label: "Active Channels", value: "12" },
      { label: "Messages Processed", value: "45k" }
    ],
    errorMessage: "OAuth token expired. Please reconnect."
  },
  {
    id: "conn_03",
    name: "Salesforce CRM",
    provider: "Salesforce",
    type: "OAuth2",
    status: "Error",
    account: "admin@company.com",
    lastSync: "Failed 1 hr ago",
    icon: CloudCog,
    color: "text-blue-400",
    metrics: [
      { label: "Leads", value: "12,400" },
      { label: "API Calls", value: "940/10k" }
    ],
    errorMessage: "Invalid Refresh Token. Re-authentication required."
  },
  {
    id: "conn_04",
    name: "GitHub Repositories",
    provider: "GitHub",
    type: "OAuth2",
    status: "Connected",
    account: "@harshkhandelwal",
    lastSync: "Just now",
    icon: Github,
    color: "text-zinc-800 dark:text-zinc-200",
    metrics: [
      { label: "Synced Repos", value: "45" },
      { label: "Webhooks", value: "8 Active" }
    ]
  },
  {
    id: "conn_05",
    name: "Stripe Billing",
    provider: "Stripe",
    type: "API Key",
    status: "Connected",
    account: "acct_1H2x...",
    lastSync: "1 hr ago",
    icon: CreditCard,
    color: "text-indigo-500",
    metrics: [
      { label: "Mode", value: "Live" },
      { label: "Events/hr", value: "342" }
    ]
  },
  {
    id: "conn_06",
    name: "AWS S3 Backup",
    provider: "AWS",
    type: "IAM Role",
    status: "Connected",
    account: "us-east-1",
    lastSync: "5 mins ago",
    icon: Database,
    color: "text-orange-500",
    metrics: [
      { label: "Buckets", value: "8" },
      { label: "Transfer", value: "4.2 TB" }
    ]
  }
]

export default function ConnectionsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isReconnecting, setIsReconnecting] = useState<string | null>(null)

  const handleReconnect = (id: string) => {
    setIsReconnecting(id)
    setTimeout(() => {
      setIsReconnecting(null)
    }, 2000)
  }

  const filteredConnections = mockConnections.filter(
    (conn) =>
      conn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conn.provider.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: ConnectionStatus) => {
    switch (status) {
      case "Connected":
        return <Badge variant="success" className="gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Connected</Badge>
      case "Expired":
        return <Badge variant="warning" className="gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Expired</Badge>
      case "Error":
        return <Badge variant="destructive" className="gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Error</Badge>
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-6">
      <PageHeader
        title="Connections & Integrations"
        subtitle="Manage your connected apps, OAuth grants, and API keys."
        icon={Box}
        mesh
        actions={
          <Button variant="premium">
            <Plus className="w-4 h-4 mr-2" />
            New Connection
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search connections..." 
            className="pl-9 bg-background shadow-sm border-muted"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" className="w-full sm:w-auto">
            <Activity className="w-4 h-4 mr-2" />
            Activity Log
          </Button>
        </div>
      </div>

      <m.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {filteredConnections.map((conn) => (
          <m.div key={conn.id} variants={fadeInUp}>
            <Card variant="interactive" className="h-full flex flex-col group relative overflow-hidden">
              {/* Top Accent Line */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
                conn.status === "Connected" ? "from-emerald-400 to-teal-400" :
                conn.status === "Expired" ? "from-amber-400 to-orange-400" :
                "from-rose-400 to-red-500"
              }`} />
              
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center border ${conn.color} shadow-sm group-hover:scale-105 transition-transform`}>
                    <conn.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base leading-tight tracking-tight">{conn.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Key className="w-3.5 h-3.5" />
                      <span>{conn.type}</span>
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="-mr-2 text-muted-foreground">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View Details</DropdownMenuItem>
                    <DropdownMenuItem>Test Connection</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Revoke Access</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              
              <CardContent className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Account</p>
                    <p className="text-sm font-medium">{conn.account}</p>
                  </div>
                  {getStatusBadge(conn.status)}
                </div>

                {conn.errorMessage && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20 flex gap-2 items-start">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="leading-snug">{conn.errorMessage}</p>
                  </div>
                )}

                {(conn.metrics || conn.usage !== undefined) && (
                  <div className="pt-4 border-t border-border/50 grid grid-cols-2 gap-4">
                    {conn.metrics?.map((m, idx) => (
                      <div key={idx}>
                        <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                        <p className="text-sm font-semibold">{m.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {conn.usage !== undefined && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Storage Usage</span>
                      <span className="font-medium">{conn.usage}%</span>
                    </div>
                    <Progress value={conn.usage} className="h-1.5" />
                  </div>
                )}
              </CardContent>

              <CardFooter className="bg-muted/30 pt-4 pb-4 border-t border-border/50 flex items-center justify-between mt-auto">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <RefreshCcw className="w-3.5 h-3.5" />
                  Last sync: {conn.lastSync}
                </div>
                
                {conn.status !== "Connected" && (
                  <Button 
                    size="sm" 
                    variant={conn.status === "Error" ? "destructive" : "default"}
                    onClick={() => handleReconnect(conn.id)}
                    disabled={isReconnecting === conn.id}
                  >
                    {isReconnecting === conn.id ? (
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    {isReconnecting === conn.id ? "Connecting..." : "Reconnect"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          </m.div>
        ))}
      </m.div>

      {filteredConnections.length === 0 && (
        <div className="py-24 text-center text-muted-foreground flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-2xl">
          <Box className="w-12 h-12 mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No connections found</h3>
          <p>Try adjusting your search or filters to find what you're looking for.</p>
          <Button variant="outline" className="mt-6" onClick={() => setSearchTerm("")}>
            Clear Search
          </Button>
        </div>
      )}
    </div>
  )
}
