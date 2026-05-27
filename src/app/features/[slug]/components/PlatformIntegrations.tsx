'use client';

import React from 'react';
import Link from 'next/link';
import { Settings, Puzzle, Code, ArrowRight } from 'lucide-react';

interface PlatformIntegrationsProps {
  color: string;
  integrations: string[];
}

export function PlatformIntegrations({ color, integrations }: PlatformIntegrationsProps) {
  return (
    <section className="border-t sn-hair bg-zoru-surface">
      <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
        <div className="grid grid-cols-12 gap-8 md:gap-12">
          <div className="col-span-12 lg:col-span-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zoru-ink">
              Plays well with
            </div>
            <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-zoru-ink max-w-3xl">
              Works with the tools you already ship on.
            </h2>
            <p className="mt-4 text-[15px] leading-[1.65] text-zoru-ink max-w-md">
              Connect directly with your existing stack or leverage the Platform Core tools to extend capabilities natively.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {integrations.map(i => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border sn-hair bg-white text-[13px] text-zoru-ink font-medium hover:border-zoru-line/30 transition-colors"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: color }}
                  />
                  {i}
                </span>
              ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-6">
            <div className="bg-white rounded-2xl p-6 border sn-hair shadow-sm h-full flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 mb-4">
                  <div className="p-2 bg-zoru-surface rounded-lg">
                    <Settings className="h-5 w-5 text-zoru-ink" />
                  </div>
                  <h3 className="font-display text-[20px] text-zoru-ink">Platform Core Tools</h3>
                </div>
                <p className="text-[14px] text-zoru-ink mb-6">
                  Enhance this feature with deep integrations into our core infrastructure. Connect via API, utilize webhooks, or embed directly using our SDKs.
                </p>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-start gap-3">
                    <Puzzle className="h-4 w-4 text-zoru-ink mt-0.5" />
                    <div>
                      <h4 className="text-[13px] font-semibold text-zoru-ink">Unified Dashboard Apps</h4>
                      <p className="text-[12px] text-zoru-ink">Manage all settings seamlessly within the core UI.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Code className="h-4 w-4 text-zoru-ink mt-0.5" />
                    <div>
                      <h4 className="text-[13px] font-semibold text-zoru-ink">Developer APIs & Webhooks</h4>
                      <p className="text-[12px] text-zoru-ink">Extend functionality with custom automated workflows.</p>
                    </div>
                  </li>
                </ul>
              </div>
              <Link 
                href="/developer" 
                className="inline-flex items-center justify-center gap-2 h-10 w-full rounded-xl bg-zoru-surface border sn-hair text-[13px] font-medium text-zoru-ink hover:bg-zoru-surface transition-colors"
              >
                View developer docs <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
