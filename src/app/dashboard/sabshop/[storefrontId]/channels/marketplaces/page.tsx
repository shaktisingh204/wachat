"use client";

import React from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Globe,
  RefreshCcw,
  ShoppingBag,
  ShoppingCart,
  Store,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  StatCard,
  Switch,
} from "@/components/sabcrm/20ui";

interface Marketplace {
  id: string;
  name: string;
  description: string;
  status: "connected" | "disconnected";
  syncStatus: string | null;
  lastSync: string | null;
  icon: LucideIcon;
}

const MARKETPLACES: Marketplace[] = [
  {
    id: "amazon",
    name: "Amazon Seller Central",
    description: "Sync inventory and fulfill orders via Amazon FBA or FBM.",
    status: "connected",
    syncStatus: "Syncing normally",
    lastSync: "10 minutes ago",
    icon: ShoppingBag,
  },
  {
    id: "flipkart",
    name: "Flipkart Seller Hub",
    description: "List products and manage orders across the Flipkart catalog.",
    status: "connected",
    syncStatus: "Warning: missing category mapping",
    lastSync: "1 hour ago",
    icon: Store,
  },
  {
    id: "ebay",
    name: "eBay",
    description: "Reach global buyers with automated auction and buy-it-now listings.",
    status: "disconnected",
    syncStatus: null,
    lastSync: null,
    icon: ShoppingCart,
  },
  {
    id: "google",
    name: "Google Merchant Center",
    description: "List products on Google Shopping, Search, and Maps.",
    status: "disconnected",
    syncStatus: null,
    lastSync: null,
    icon: Globe,
  },
];

export default function MarketplacesPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Marketplace integrations</PageTitle>
          <PageDescription>
            Connect your catalog to global marketplaces and sync orders automatically.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={ShoppingBag}>
            Browse integrations
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Marketplace summary" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Marketplace revenue"
          value={<span className="tabular-nums">₹24,590</span>}
          icon={TrendingUp}
          accent="#1f9d55"
          delta={{ value: "+14.5% this month", tone: "up" }}
        />
        <StatCard
          label="Active channels"
          value={<span className="tabular-nums">2 / 8</span>}
          icon={Store}
          accent="#3b7af5"
        />
        <StatCard
          label="Orders pending sync"
          value={<span className="tabular-nums">4</span>}
          icon={RefreshCcw}
          accent="#d97706"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {MARKETPLACES.map((channel) => {
          const Icon = channel.icon;
          const connected = channel.status === "connected";
          const warning = channel.syncStatus?.includes("Warning");
          return (
            <Card
              key={channel.id}
              variant={connected ? "elevated" : "outlined"}
              className="relative flex flex-col"
            >
              {connected ? (
                <div className="absolute right-4 top-4">
                  <Badge tone="success">Active</Badge>
                </div>
              ) : null}
              <CardHeader>
                <span
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] ring-1 ring-inset ring-[var(--st-border)]"
                  aria-hidden="true"
                >
                  <Icon className="h-6 w-6" />
                </span>
                <CardTitle>{channel.name}</CardTitle>
                <CardDescription className="line-clamp-2 min-h-10">
                  {channel.description}
                </CardDescription>
              </CardHeader>

              <CardBody className="flex-1">
                {connected ? (
                  <div className="flex items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                    {warning ? (
                      <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--st-warn)]" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--st-status-ok)]" aria-hidden="true" />
                    )}
                    <div>
                      <p className="text-sm font-medium leading-none text-[var(--st-text)]">
                        {channel.syncStatus}
                      </p>
                      <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                        Last sync {channel.lastSync}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                    <span
                      className="h-2 w-2 rounded-full bg-[var(--st-border-strong)]"
                      aria-hidden="true"
                    />
                    Not connected
                  </div>
                )}
              </CardBody>

              <CardFooter>
                {connected ? (
                  <div className="flex w-full items-center justify-between">
                    <Button variant="ghost" size="sm">Manage settings</Button>
                    <Switch defaultChecked aria-label={`Toggle ${channel.name}`} />
                  </div>
                ) : (
                  <Button variant="outline" block iconRight={ArrowUpRight}>
                    Connect channel
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
