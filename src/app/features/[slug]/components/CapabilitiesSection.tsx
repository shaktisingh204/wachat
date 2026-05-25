'use client';

import React, { useState, useMemo } from 'react';
import { Search, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import type { FeatureCapability } from '@/lib/features/types';

interface CapabilitiesSectionProps {
  featureName: string;
  color: string;
  capabilities: FeatureCapability[];
}

export function CapabilitiesSection({ featureName, color, capabilities }: CapabilitiesSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');

  const filteredAndSorted = useMemo(() => {
    let result = [...capabilities];
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        c => c.title.toLowerCase().includes(lower) || c.body.toLowerCase().includes(lower)
      );
    }
    
    if (sortOrder === 'asc') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOrder === 'desc') {
      result.sort((a, b) => b.title.localeCompare(a.title));
    }
    
    return result;
  }, [capabilities, searchTerm, sortOrder]);

  return (
    <section className="border-t sn-hair">
      <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
        <div className="flex items-end justify-between mb-10 gap-6 flex-wrap">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7878A1]">
              Capabilities
            </div>
            <h2 className="mt-3 font-display tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-[#121126]">
              Everything you get with {featureName}.
            </h2>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-grow md:flex-grow-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7878A1]" />
              <input
                type="text"
                placeholder="Filter capabilities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 pl-9 pr-4 py-2 bg-[#FAF9F4] border sn-hair rounded-full text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#121126]/10 transition-shadow"
              />
            </div>
            <button
              onClick={() => setSortOrder(prev => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none')}
              className="flex items-center justify-center h-10 w-10 bg-[#FAF9F4] border sn-hair rounded-full text-[#7878A1] hover:text-[#121126] hover:bg-black/[0.02] transition-colors"
              title="Toggle sort order"
            >
              {sortOrder === 'desc' ? <ArrowUpZA className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
            </button>
            <div className="text-[12px] font-mono tabular-nums text-[#7878A1] hidden sm:block ml-2">
              {filteredAndSorted.length} {filteredAndSorted.length === 1 ? 'capability' : 'capabilities'}
            </div>
          </div>
        </div>

        {filteredAndSorted.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-2xl bg-gray-50/50">
            <p className="text-[#4A4A6B] text-[14px]">No capabilities found matching "{searchTerm}".</p>
            <button 
              onClick={() => setSearchTerm('')} 
              className="mt-3 text-[13px] font-medium text-[#4F46E5] hover:underline"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredAndSorted.map((c, i) => (
              <article
                key={c.title}
                className="group relative rounded-2xl p-6 border sn-hair bg-white transition-all hover:bg-white hover:-translate-y-0.5"
                style={{
                  boxShadow: `0 14px 30px -22px rgba(17,17,38,0.18)`,
                }}
              >
                <div
                  aria-hidden
                  className="absolute left-0 top-0 h-full w-[3px] rounded-l-2xl"
                  style={{ background: color }}
                />
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[10.5px] tabular-nums text-[#7878A1]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-display text-[18px] leading-tight text-[#121126]">
                    {c.title}
                  </h3>
                </div>
                <p className="mt-3 text-[13.5px] leading-[1.65] text-[#4A4A6B]">
                  {c.body}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
