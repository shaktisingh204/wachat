"use client";

import React from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/zoruui/card";
import { Button } from "@/components/zoruui/button";
import { Badge } from "@/components/zoruui/badge";
import { Switch } from "@/components/zoruui/switch";
import { 
  Store, 
  ShoppingCart, 
  Globe, 
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  RefreshCcw,
  ShoppingBag
} from "lucide-react";

export default function MarketplacesPage() {
  const marketplaces = [
    {
      id: "amazon",
      name: "Amazon Seller Central",
      description: "Sync inventory and fulfill orders via Amazon FBA or FBM.",
      status: "connected",
      syncStatus: "Syncing normally",
      lastSync: "10 mins ago",
      logo: (props: any) => (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
          <path d="M13.25 14.5c-2.5 1.5-5.5 2-8.5 1.5-1-.2-2-.6-3-1 0 0-.5-.2 0-.5.5-.2 1.5-.5 2.5-.2 2.5.5 5.5 0 8-1.5 2-1 3.5-2.5 4.5-4 1-1.5 1-2.5 1-2.5s0-.5-.5 0c-.5.5-2 1.5-4 2.5-2.5 1.5-6 2-9 1-1-.5-2-1.5-2.5-2.5C1 6.5 1.5 5 2 4.5c.5-.5 1.5-.5 2 0 1.5 1 2.5 2.5 3 4 .5 1.5 0 3-.5 4.5 2-1 4-2.5 5-4.5 1-2 1-3.5 1-3.5s0-.5-.5 0c-.5.5-1.5 1.5-3 2.5-1 1-2.5 1.5-4 2-1 .5-2 1-2 1.5 0 .5.5 1 1 1 2 0 4.5-.5 6.5-1.5 2-1 4-2.5 5-4 1-1.5 2-3 2-3s.5 0 .5.5c0 .5-.5 2-1.5 3.5-1.5 2-3.5 3.5-5.5 4.5zM20.5 18c-1.5 1-3.5 1.5-5.5 1.5s-4-.5-5.5-1.5c-1-.5-1.5-1.5-1.5-2s.5-1 1-1c.5 0 1 .5 1.5 1 1 .5 2.5 1 4.5 1s3.5-.5 4.5-1c.5-.5 1-1 1.5-1s1 .5 1 1c0 .5-.5 1.5-1.5 2z"/>
        </svg>
      )
    },
    {
      id: "tiktok",
      name: "TikTok Shop",
      description: "Sell directly in-feed and on LIVE. Auto-sync catalogs.",
      status: "connected",
      syncStatus: "Warning: Missing category mapping",
      lastSync: "1 hour ago",
      logo: (props: any) => (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
          <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93v7.26c0 1.58-.32 3.12-1 4.52-1.39 2.87-4.32 4.88-7.53 5.09-2.92.19-5.83-.82-7.93-2.91-2.02-2.01-3.11-4.75-3.08-7.6-.03-3.13 1.34-6.13 3.73-8.1 2.37-1.95 5.5-2.88 8.52-2.58V8.1c-1.66-.23-3.34.12-4.76 1.05-1.48.97-2.48 2.55-2.73 4.3-.23 1.59.18 3.23 1.13 4.54 1.29 1.78 3.51 2.62 5.67 2.14 1.71-.38 3.16-1.6 3.86-3.2.45-1.02.66-2.14.63-3.26V.02h2.4z"/>
        </svg>
      )
    },
    {
      id: "ebay",
      name: "eBay",
      description: "Reach global buyers with automated auction and BIN listings.",
      status: "disconnected",
      syncStatus: null,
      lastSync: null,
      logo: (props: any) => <ShoppingCart {...props} />
    },
    {
      id: "google",
      name: "Google Merchant Center",
      description: "List products on Google Shopping, Search, and Maps.",
      status: "disconnected",
      syncStatus: null,
      lastSync: null,
      logo: (props: any) => <Globe {...props} />
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Store className="h-8 w-8 text-primary" />
            Marketplace Integrations
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect your catalog to global marketplaces and sync orders in real-time.
          </p>
        </div>
        <Button><ShoppingBag className="mr-2 h-4 w-4" /> Browse App Store</Button>
      </div>

      {/* Stats/Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Marketplace Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$24,590.00</div>
            <p className="text-xs text-green-500 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" /> +14.5% this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2 / 8</div>
            <p className="text-xs text-muted-foreground mt-1">
              Available integrations connected
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orders Pending Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <RefreshCcw className="h-3 w-3 mr-1" /> Auto-syncs every 15m
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {marketplaces.map((channel) => (
          <Card key={channel.id} className={`relative overflow-hidden flex flex-col ${channel.status === "connected" ? "border-primary/20" : ""}`}>
            {channel.status === "connected" && (
              <div className="absolute top-0 right-0 p-4">
                <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">Active</Badge>
              </div>
            )}
            <CardHeader className="pb-4">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4 text-foreground">
                <channel.logo className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">{channel.name}</CardTitle>
              <CardDescription className="line-clamp-2 h-10 mt-2">
                {channel.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="flex-grow">
              {channel.status === "connected" ? (
                <div className="space-y-3 bg-muted/30 p-3 rounded-lg border">
                  <div className="flex items-start gap-2">
                    {channel.syncStatus?.includes("Warning") ? (
                      <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium leading-none">{channel.syncStatus}</p>
                      <p className="text-xs text-muted-foreground mt-1">Last sync: {channel.lastSync}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="flex h-2 w-2 rounded-full bg-muted-foreground/30"></span>
                  Not connected
                </div>
              )}
            </CardContent>
            
            <CardFooter className="pt-4 border-t bg-muted/10 mt-auto">
              {channel.status === "connected" ? (
                <div className="flex items-center justify-between w-full">
                  <Button variant="ghost" size="sm">Manage Settings</Button>
                  <Switch defaultChecked />
                </div>
              ) : (
                <Button variant="outline" className="w-full group">
                  Connect Channel 
                  <ArrowUpRight className="ml-2 h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
