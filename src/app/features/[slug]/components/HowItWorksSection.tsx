'use client';

import React from 'react';
import type { FeatureStep } from '@/lib/features/types';

interface HowItWorksSectionProps {
  featureName: string;
  color: string;
  howItWorks: FeatureStep[];
}

export function HowItWorksSection({ featureName, color, howItWorks }: HowItWorksSectionProps) {
  return (
    <section className="border-t sn-hair">
      <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
        <div className="grid grid-cols-12 gap-6 md:gap-10">
          <div className="col-span-12 md:col-span-4">
            <div className="md:sticky md:top-28">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zoru-ink">
                How it works
              </div>
              <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-zoru-ink">
                From signup to first send in minutes.
              </h2>
              <p className="mt-4 text-[14px] leading-[1.7] text-zoru-ink max-w-sm">
                {featureName} is included on every SabNode workspace. No
                separate billing, no extra setup — flip it on from your
                workspace settings.
              </p>
            </div>
          </div>

          <div className="col-span-12 md:col-span-8">
            <ol className="relative">
              <span
                aria-hidden
                className="absolute left-[19px] top-2 bottom-2 w-px"
                style={{ background: `linear-gradient(${color}, ${color}00)` }}
              />
              {howItWorks.map((s, i) => (
                <li key={s.step} className="relative pl-14 pb-7 last:pb-0">
                  <span
                    className="absolute left-0 top-0 h-10 w-10 rounded-full inline-flex items-center justify-center font-mono text-[12px] font-bold text-white"
                    style={{
                      background: color,
                      boxShadow: `0 8px 20px -8px ${color}`,
                    }}
                  >
                    {s.step}
                  </span>
                  <h3 className="font-display text-[20px] leading-tight text-zoru-ink">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[14.5px] leading-[1.7] text-zoru-ink">
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
