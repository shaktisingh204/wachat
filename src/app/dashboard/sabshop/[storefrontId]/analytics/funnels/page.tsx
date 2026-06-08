"use client";

import React from "react";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Eye,
  Lightbulb,
  MousePointerClick,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Progress,
  StatCard,
} from "@/components/sabcrm/20ui";

interface FunnelStep {
  id: string;
  name: string;
  icon: LucideIcon;
  count: number;
  dropoff: number | null;
  conversionFromPrevious: number | null;
  trend: string;
}

const FUNNEL_STEPS: FunnelStep[] = [
  { id: "view", name: "Product views", icon: Eye, count: 45200, dropoff: null, conversionFromPrevious: null, trend: "+12%" },
  { id: "click", name: "Product clicks", icon: MousePointerClick, count: 18450, dropoff: 26750, conversionFromPrevious: 40.8, trend: "+8%" },
  { id: "cart", name: "Added to cart", icon: ShoppingCart, count: 6200, dropoff: 12250, conversionFromPrevious: 33.6, trend: "+15%" },
  { id: "checkout", name: "Checkout started", icon: CreditCard, count: 3100, dropoff: 3100, conversionFromPrevious: 50.0, trend: "-2%" },
  { id: "purchase", name: "Purchase completed", icon: CheckCircle2, count: 1850, dropoff: 1250, conversionFromPrevious: 59.6, trend: "+5%" },
];

export default function FunnelsPage() {
  const maxCount = FUNNEL_STEPS[0].count;
  const overallConversion = (
    (FUNNEL_STEPS[FUNNEL_STEPS.length - 1].count / maxCount) *
    100
  ).toFixed(2);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Conversion funnels</PageTitle>
          <PageDescription>
            Track the user journey from product discovery to purchase.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <StatCard
            label="Overall conversion"
            value={<span className="tabular-nums">{overallConversion}%</span>}
            icon={TrendingUp}
            accent="#1f9d55"
          />
        </PageActions>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Main purchase funnel</CardTitle>
          <CardDescription>Last 30 days across all active campaigns.</CardDescription>
        </CardHeader>
        <CardBody>
          <ol className="grid gap-4 md:grid-cols-5">
            {FUNNEL_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isLast = index === FUNNEL_STEPS.length - 1;
              const percentageOfTotal = (step.count / maxCount) * 100;
              const positive = step.trend.startsWith("+");
              return (
                <li
                  key={step.id}
                  className="relative flex flex-col rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                      aria-hidden="true"
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <Badge tone={positive ? "success" : "danger"}>
                      {positive ? (
                        <TrendingUp className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="h-3 w-3" aria-hidden="true" />
                      )}
                      {step.trend}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-medium text-[var(--st-text)]">{step.name}</h3>
                  <div className="mb-3 mt-1 text-2xl font-semibold tabular-nums text-[var(--st-text)]">
                    {step.count.toLocaleString()}
                  </div>
                  <div className="mt-auto space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--st-text-secondary)]">Of total</span>
                      <span className="font-medium tabular-nums text-[var(--st-text)]">
                        {percentageOfTotal.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={percentageOfTotal} tone="accent" />
                    {step.conversionFromPrevious != null ? (
                      <p className="pt-1 text-xs text-[var(--st-text-secondary)]">
                        <span className="tabular-nums text-[var(--st-status-ok)]">
                          {step.conversionFromPrevious}%
                        </span>{" "}
                        from previous step
                      </p>
                    ) : null}
                  </div>
                  {!isLast ? (
                    <ArrowRight
                      className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-[var(--st-text-tertiary)] md:block"
                      aria-hidden="true"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Drop-off analysis</CardTitle>
            <CardDescription>Where users leave the funnel.</CardDescription>
          </CardHeader>
          <CardBody>
            <div className="space-y-6">
              {FUNNEL_STEPS.slice(1).map((step, i) => {
                const dropoffPercent = step.dropoff
                  ? ((step.dropoff / FUNNEL_STEPS[i].count) * 100).toFixed(1)
                  : "0";
                return (
                  <div key={step.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[var(--st-text)]">
                        {FUNNEL_STEPS[i].name} to {step.name}
                      </span>
                      <span className="font-medium tabular-nums text-[var(--st-danger)]">
                        {dropoffPercent}% drop
                      </span>
                    </div>
                    <Progress value={Number(dropoffPercent)} tone="danger" />
                    <p className="text-right text-xs tabular-nums text-[var(--st-text-secondary)]">
                      {step.dropoff?.toLocaleString()} users lost
                    </p>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opportunities</CardTitle>
            <CardDescription>Suggestions to improve conversion.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <Callout tone="warning" title="High cart abandonment">
              Half of shoppers who add to cart do not start checkout. Send an
              abandoned-cart email with a 5% code within two hours.
            </Callout>
            <Callout tone="info" title="Checkout friction">
              Drop-off between checkout and purchase is 40.4%. Adding guest
              checkout and UPI could recover an estimated 12%.
            </Callout>
            <p className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
              <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
              Insights refresh daily from the last 30 days of traffic.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
