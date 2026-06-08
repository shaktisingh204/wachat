'use client';

import React from 'react';
import {
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';
import type { FeatureStep } from '@/lib/features/types';

interface HowItWorksSectionProps {
  featureName: string;
  color: string;
  howItWorks: FeatureStep[];
}

export function HowItWorksSection({ featureName, color, howItWorks }: HowItWorksSectionProps) {
  return (
    <section className="20ui border-t border-[var(--st-border)]">
      <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
        <div className="grid grid-cols-12 gap-6 md:gap-10">
          <div className="col-span-12 md:col-span-4">
            <div className="md:sticky md:top-28">
              <PageHeaderHeading>
                <PageEyebrow>How it works</PageEyebrow>
                <PageTitle>From signup to first send in minutes.</PageTitle>
                <PageDescription>
                  {featureName} is included on every SabNode workspace. No
                  separate billing, no extra setup, flip it on from your
                  workspace settings.
                </PageDescription>
              </PageHeaderHeading>
            </div>
          </div>

          <div className="col-span-12 md:col-span-8">
            <ol className="relative">
              <span
                aria-hidden="true"
                className="absolute left-[19px] top-2 bottom-2 w-px"
                style={{ background: `linear-gradient(${color}, ${color}00)` }}
              />
              {howItWorks.map((s) => (
                <li key={s.step} className="relative pl-14 pb-7 last:pb-0">
                  <span
                    className="absolute left-0 top-0 h-10 w-10 rounded-[var(--st-radius-pill)] inline-flex items-center justify-center font-mono text-[12px] font-bold text-[var(--st-text-inverted)]"
                    style={{
                      background: color,
                      boxShadow: `0 8px 20px -8px ${color}`,
                    }}
                  >
                    {s.step}
                  </span>
                  <h3 className="text-[20px] leading-tight text-[var(--st-text)]">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[14.5px] leading-[1.7] text-[var(--st-text-secondary)]">
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
