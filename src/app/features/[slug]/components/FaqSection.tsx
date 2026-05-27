'use client';

import React from 'react';
import Link from 'next/link';
import { Plus, Minus } from 'lucide-react';
import type { FeatureFAQ } from '@/lib/features/types';

interface FaqSectionProps {
  featureName: string;
  faqs: FeatureFAQ[];
}

export function FaqSection({ featureName, faqs }: FaqSectionProps) {
  return (
    <section className="border-t sn-hair">
      <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
        <div className="grid grid-cols-12 gap-6 md:gap-10">
          <div className="col-span-12 md:col-span-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7878A1]">
              Frequently asked
            </div>
            <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-[#121126]">
              Questions about {featureName}.
            </h2>
            <p className="mt-4 text-[14px] leading-[1.7] text-[#4A4A6B] max-w-sm">
              Can't find what you're looking for?{' '}
              <Link href="/contact" className="font-semibold text-[#121126] underline decoration-[#4F46E5]/40 underline-offset-2 hover:decoration-[#4F46E5]">
                Talk to our team
              </Link>
              .
            </p>
          </div>

          <div className="col-span-12 md:col-span-8">
            <div className="rounded-2xl border sn-hair bg-white overflow-hidden divide-y divide-[rgba(17,17,38,0.06)]">
              {faqs.map((f, i) => (
                <details key={i} className="group">
                  <summary className="cursor-pointer list-none flex items-start justify-between gap-4 px-5 md:px-6 py-4 md:py-5 hover:bg-black/[0.02]">
                    <span className="font-display text-[16px] md:text-[17px] leading-snug text-[#121126]">
                      {f.q}
                    </span>
                    <span
                      className="mt-1 h-7 w-7 rounded-full inline-flex items-center justify-center flex-shrink-0 border sn-hair text-[#4A4A6B] group-open:rotate-180 group-open:bg-[#121126] group-open:text-white transition-all"
                    >
                      <Plus className="h-4 w-4 group-open:hidden" />
                      <Minus className="h-4 w-4 hidden group-open:block" />
                    </span>
                  </summary>
                  <div className="px-5 md:px-6 pb-5 md:pb-6 text-[14.5px] leading-[1.75] text-[#4A4A6B]">
                    {f.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
