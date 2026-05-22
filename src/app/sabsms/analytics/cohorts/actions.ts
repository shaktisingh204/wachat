"use server";

import { getCachedSession } from "@/lib/server-cache";

export type CohortDefinition = "first-message" | "first-reply" | "first-click";
export type RetentionMetric = "sends" | "replies" | "clicks" | "conversions";
export type SplitBy = "none" | "locale" | "provider" | "template";

export interface CohortFilters {
  definition: CohortDefinition;
  metric: RetentionMetric;
  source?: string;
  campaign?: string;
  splitBy: SplitBy;
  q?: string;
}

export interface CohortCell {
  period: number; // e.g. 0 for week 0, 1 for week 1
  value: number; // percentage or absolute value
  absoluteValue: number;
}

export interface CohortRow {
  id: string; // The cohort label (e.g., "Jan 2026")
  size: number;
  cells: CohortCell[];
}

export interface CohortData {
  rows: CohortRow[];
  totalCohorts: number;
}

export async function loadCohorts(
  workspaceId: string,
  filters: CohortFilters
): Promise<CohortData> {
  // Simulating database latency
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Generate fake data
  const months = ["Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026"];
  const rows: CohortRow[] = months.map((month, i) => {
    const size = Math.floor(Math.random() * 5000) + 1000;
    const cells: CohortCell[] = [];
    let currentVal = size;

    for (let period = 0; period < 6 - i; period++) {
      if (period > 0) {
        // Dropoff simulation
        currentVal = Math.floor(currentVal * (Math.random() * 0.4 + 0.3));
      }
      cells.push({
        period,
        value: period === 0 ? 100 : Math.round((currentVal / size) * 100),
        absoluteValue: currentVal,
      });
    }

    return {
      id: month,
      size,
      cells,
    };
  });

  return {
    rows,
    totalCohorts: rows.length,
  };
}

export async function loadFilterOptions(workspaceId: string) {
  return {
    sources: [
      { label: "API", value: "api" },
      { label: "CSV Import", value: "csv" },
      { label: "CRM Sync", value: "crm" },
    ],
    campaigns: [
      { label: "Summer Promo", value: "c1" },
      { label: "Black Friday", value: "c2" },
      { label: "Onboarding Drip", value: "c3" },
    ],
  };
}
