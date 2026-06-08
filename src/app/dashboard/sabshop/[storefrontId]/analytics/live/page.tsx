"use client";

import React, { useEffect, useState } from "react";
import { Activity, MapPin, ShoppingCart, Users } from "lucide-react";
import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dot,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Progress,
  StatCard,
} from "@/components/sabcrm/20ui";

const ACTIVE_COUNTRIES = [
  { name: "India", visitors: 45, percentage: 32 },
  { name: "United States", visitors: 28, percentage: 20 },
  { name: "Germany", visitors: 22, percentage: 15 },
  { name: "United Kingdom", visitors: 18, percentage: 13 },
  { name: "Australia", visitors: 17, percentage: 12 },
  { name: "Canada", visitors: 12, percentage: 8 },
].sort((a, b) => b.visitors - a.visitors);

const TOP_PAGES = [
  { path: "/products/new-arrivals", visitors: 34 },
  { path: "/checkout", visitors: 22 },
  { path: "/products/summer-sale", visitors: 18 },
  { path: "/", visitors: 15 },
  { path: "/cart", visitors: 12 },
];

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function LiveAnalyticsPage() {
  const [activeVisitors, setActiveVisitors] = useState(142);
  const [liveCartTotal, setLiveCartTotal] = useState(124505);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveVisitors((prev) => Math.max(0, prev + Math.floor(Math.random() * 5) - 2));
      setLiveCartTotal((prev) => Math.max(0, prev + Math.floor(Math.random() * 500) - 200));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Live analytics</PageTitle>
          <PageDescription>Real-time monitoring of your storefront activity.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Badge tone="success">
            <Dot tone="success" pulse /> Live connection
          </Badge>
        </PageActions>
      </PageHeader>

      <section aria-label="Live metrics" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active visitors"
          value={<span className="tabular-nums">{activeVisitors}</span>}
          icon={Users}
          accent="#3b7af5"
          delta={{ value: "+12% vs last hour", tone: "up" }}
        />
        <StatCard
          label="Live cart total"
          value={<span className="tabular-nums">{inr(liveCartTotal)}</span>}
          icon={ShoppingCart}
          accent="#1f9d55"
          delta={{ value: "Updating in real time", tone: "neutral" }}
        />
        <StatCard
          label="Active carts"
          value={<span className="tabular-nums">{Math.floor(activeVisitors * 0.45)}</span>}
          icon={ShoppingCart}
          accent="#7c3aed"
          delta={{ value: "45% of visitors", tone: "neutral" }}
        />
        <StatCard
          label="Checkouts in progress"
          value={<span className="tabular-nums">14</span>}
          icon={Activity}
          accent="#d97706"
          delta={{ value: "-2 in last 5 minutes", tone: "down" }}
        />
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Active countries</CardTitle>
            <CardDescription>Where your current visitors are browsing from.</CardDescription>
          </CardHeader>
          <CardBody>
            <ul className="space-y-5">
              {ACTIVE_COUNTRIES.map((country) => (
                <li key={country.name} className="flex items-center gap-4">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                    aria-hidden="true"
                  >
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-none text-[var(--st-text)]">
                      {country.name}
                    </p>
                    <p className="mt-1 text-sm tabular-nums text-[var(--st-text-secondary)]">
                      {country.visitors} active visitors
                    </p>
                  </div>
                  <div className="flex w-1/3 items-center gap-2">
                    <Progress value={country.percentage} tone="accent" />
                    <span className="w-8 text-right text-xs font-medium tabular-nums text-[var(--st-text)]">
                      {country.percentage}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Top active pages</CardTitle>
            <CardDescription>Pages with the most visitors right now.</CardDescription>
          </CardHeader>
          <CardBody>
            <ul className="space-y-3">
              {TOP_PAGES.map((page) => (
                <li
                  key={page.path}
                  className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-3 transition-colors hover:bg-[var(--st-hover)]"
                >
                  <span className="max-w-[200px] truncate font-mono text-sm text-[var(--st-text)] sm:max-w-[250px]">
                    {page.path}
                  </span>
                  <Badge tone="neutral">{page.visitors}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
          <CardFooter>
            <p className="w-full text-center text-xs text-[var(--st-text-secondary)]">
              Updated every 5 seconds
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
