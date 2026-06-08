"use client";

import React from "react";
import { BarChart3, IndianRupee, TrendingUp, UserCheck } from "lucide-react";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/sabcrm/20ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

const COHORT_DATA: Array<{ month: string; users: number; retention: Array<number | null> }> = [
  { month: "Jan 2026", users: 1240, retention: [100, 45, 32, 28, 25, 22, 18] },
  { month: "Feb 2026", users: 1450, retention: [100, 48, 35, 31, 28, 24, null] },
  { month: "Mar 2026", users: 1820, retention: [100, 52, 38, 33, 29, null, null] },
  { month: "Apr 2026", users: 2100, retention: [100, 55, 41, 36, null, null, null] },
  { month: "May 2026", users: 2450, retention: [100, 58, 44, null, null, null, null] },
  { month: "Jun 2026", users: 2890, retention: [100, 62, null, null, null, null, null] },
  { month: "Jul 2026", users: 3200, retention: [100, null, null, null, null, null, null] },
];

/** Cell intensity scales the single accent token by retention strength. */
function cellStyle(value: number): React.CSSProperties {
  const alpha = 0.12 + (value / 100) * 0.78;
  const strong = value >= 55;
  return {
    background: `color-mix(in srgb, var(--st-accent) ${Math.round(alpha * 100)}%, transparent)`,
    color: strong ? "var(--st-text-inverted)" : "var(--st-text)",
  };
}

export default function CohortsPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Cohorts and retention</PageTitle>
          <PageDescription>
            Customer lifecycle, retention rates, and lifetime value.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <section aria-label="Retention summary" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Average lifetime value"
          value={<span className="tabular-nums">₹48,550</span>}
          icon={IndianRupee}
          accent="#1f9d55"
          delta={{ value: "+8% vs last year", tone: "up" }}
        />
        <StatCard
          label="Orders per customer"
          value={<span className="tabular-nums">3.2</span>}
          icon={BarChart3}
          accent="#3b7af5"
          delta={{ value: "+0.4 vs last year", tone: "up" }}
        />
        <StatCard
          label="Day 30 retention"
          value={<span className="tabular-nums">52.4%</span>}
          icon={UserCheck}
          accent="#7c3aed"
          delta={{ value: "+12% vs last year", tone: "up" }}
        />
        <StatCard
          label="Repeat purchase rate"
          value={<span className="tabular-nums">38%</span>}
          icon={TrendingUp}
          accent="#d97706"
          delta={{ value: "+4% vs last year", tone: "up" }}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Customer retention matrix</CardTitle>
          <CardDescription>
            Percentage of customers returning in the months after their first purchase.
          </CardDescription>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <THead>
              <Tr>
                <Th width={150}>Cohort</Th>
                <Th width={100} align="right">Users</Th>
                {MONTHS.map((_, i) => (
                  <Th key={i} align="center" width={80}>
                    Month {i}
                  </Th>
                ))}
              </Tr>
            </THead>
            <TBody>
              {COHORT_DATA.map((row) => (
                <Tr key={row.month}>
                  <Td className="font-medium">{row.month}</Td>
                  <Td align="right" className="font-medium tabular-nums">
                    {row.users.toLocaleString()}
                  </Td>
                  {row.retention.map((val, j) => (
                    <Td key={j} align="center" className="p-1">
                      {val !== null ? (
                        <div
                          className="flex h-10 w-full items-center justify-center rounded-[var(--st-radius-sm)] text-sm font-medium tabular-nums"
                          style={cellStyle(val)}
                        >
                          {val}%
                        </div>
                      ) : (
                        <div
                          className="flex h-10 w-full items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] text-sm text-[var(--st-text-tertiary)]"
                          aria-hidden="true"
                        >
                          &ndash;
                        </div>
                      )}
                    </Td>
                  ))}
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
