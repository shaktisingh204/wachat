"use client";

import * as React from "react";
import { Clock, MapPin, Wallet } from "lucide-react";

import { cn } from "./lib/cn";

export interface ZoruJob {
  id: string;
  company: React.ReactNode;
  title: React.ReactNode;
  /** Optional company logo / mark. */
  logo?: React.ReactNode;
  description: React.ReactNode;
  salary?: React.ReactNode;
  location?: React.ReactNode;
  remote?: React.ReactNode;
  schedule?: React.ReactNode;
}

export interface ZoruJobListingProps {
  jobs: ZoruJob[];
  onJobClick?: (job: ZoruJob) => void;
  className?: string;
}

/**
 * ZoruJobListing — careers-page job board. Each row is a card with
 * company / title and tagged metadata; click opens via `onJobClick`
 * so the page owner can swap in a drawer or detail dialog.
 */
export function ZoruJobListing({
  jobs,
  onJobClick,
  className,
}: ZoruJobListingProps) {
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {jobs.map((job) => (
        <li key={job.id}>
          <button
            type="button"
            onClick={() => onJobClick?.(job)}
            className="group flex w-full flex-col gap-3 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-5 text-left transition-shadow hover:shadow-[var(--zoru-shadow-md)] focus-visible:outline-none"
          >
            <div className="flex items-start gap-4">
              {job.logo && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface text-zoru-ink-muted [&_svg]:size-5">
                  {job.logo}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-zoru-ink-subtle">
                  {job.company}
                </p>
                <h3 className="mt-0.5 text-base font-semibold text-zoru-ink">
                  {job.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zoru-ink-muted">
                  {job.description}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zoru-ink-muted">
              {job.salary && (
                <span className="inline-flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> {job.salary}
                </span>
              )}
              {job.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {job.location}
                </span>
              )}
              {job.remote && (
                <span className="inline-flex items-center rounded-full border border-zoru-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  {job.remote}
                </span>
              )}
              {job.schedule && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {job.schedule}
                </span>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
