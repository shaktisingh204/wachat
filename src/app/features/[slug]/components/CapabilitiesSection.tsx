'use client';

import React, { useState, useMemo } from 'react';
import { Search, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageActions,
  Field,
  Input,
  IconButton,
  EmptyState,
  Card,
  Button,
} from '@/components/sabcrm/20ui';
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

  const count = filteredAndSorted.length;

  return (
    <section className="ui20 border-t border-[var(--st-border)]">
      <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
        <PageHeader className="mb-10">
          <PageHeaderHeading>
            <PageEyebrow>Capabilities</PageEyebrow>
            <PageTitle>Everything you get with {featureName}.</PageTitle>
          </PageHeaderHeading>
          <PageActions>
            <Field className="w-full md:w-64">
              <Input
                type="text"
                placeholder="Filter capabilities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                iconLeft={Search}
                aria-label="Filter capabilities"
              />
            </Field>
            <IconButton
              label="Toggle sort order"
              icon={sortOrder === 'desc' ? ArrowUpZA : ArrowDownAZ}
              variant="outline"
              onClick={() =>
                setSortOrder(prev => (prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none'))
              }
            />
            <span className="hidden sm:block text-[12px] tabular-nums text-[var(--st-text-secondary)] ml-2">
              {count} {count === 1 ? 'capability' : 'capabilities'}
            </span>
          </PageActions>
        </PageHeader>

        {count === 0 ? (
          <EmptyState
            icon={Search}
            title={`No capabilities found matching "${searchTerm}".`}
            description="Try a different search term to find what you are looking for."
            action={
              <Button variant="ghost" onClick={() => setSearchTerm('')}>
                Clear filter
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredAndSorted.map((c, i) => (
              <Card
                key={c.title}
                variant="interactive"
                padding="lg"
                className="relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-0 h-full w-[3px]"
                  style={{ background: color }}
                />
                <div className="flex items-baseline gap-3">
                  <span className="tabular-nums text-[10.5px] text-[var(--st-text-tertiary)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-[18px] leading-tight text-[var(--st-text)]">
                    {c.title}
                  </h3>
                </div>
                <p className="mt-3 text-[13.5px] leading-[1.65] text-[var(--st-text-secondary)]">
                  {c.body}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
