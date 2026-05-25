'use client';

import React from 'react';
import type { FeatureUseCase } from '@/lib/features/types';

interface UseCasesSectionProps {
  color: string;
  useCases: FeatureUseCase[];
}

export function UseCasesSection({ color, useCases }: UseCasesSectionProps) {
  return (
    <section className="border-t sn-hair bg-[#121126] text-white">
      <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
        <div className="flex items-end justify-between mb-10 gap-6 flex-wrap">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
              Use cases
            </div>
            <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-white">
              Built for the way teams actually work.
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {useCases.map((u, i) => (
            <article
              key={u.title}
              className="relative rounded-2xl p-6 md:p-7 bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-full"
                    style={{ background: `${color}22`, color: color }}
                  >
                    {u.industry ?? 'General'}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-white/40 tabular-nums">
                  Case {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="mt-4 font-display text-[22px] leading-tight">
                {u.title}
              </h3>
              <p className="mt-3 text-[14px] leading-[1.7] text-white/70">
                {u.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
