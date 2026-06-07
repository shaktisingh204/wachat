'use client';

import React from 'react';
import {
  Badge,
  Card,
  CardDescription,
  CardTitle,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';
import type { FeatureUseCase } from '@/lib/features/types';

interface UseCasesSectionProps {
  color: string;
  useCases: FeatureUseCase[];
}

export function UseCasesSection({ color, useCases }: UseCasesSectionProps) {
  return (
    <section className="ui20 dark border-t border-[var(--st-border)] bg-[#121126] text-[var(--st-text)]">
      <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
        <PageHeader bordered={false} className="mb-10">
          <PageHeaderHeading>
            <PageEyebrow>Use cases</PageEyebrow>
            <PageTitle>Built for the way teams actually work.</PageTitle>
          </PageHeaderHeading>
        </PageHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {useCases.map((u, i) => (
            <Card
              key={u.title}
              variant="interactive"
              padding="lg"
              className="relative"
            >
              <div className="flex items-center justify-between gap-3">
                <Badge tone="accent" style={{ background: `${color}22`, color }}>
                  {u.industry ?? 'General'}
                </Badge>
                <span className="font-mono text-[10px] text-[var(--st-text-tertiary)] tabular-nums">
                  Case {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <CardTitle className="mt-4 text-[22px] leading-tight">
                {u.title}
              </CardTitle>
              <CardDescription className="mt-3 text-[14px] leading-[1.7] text-[var(--st-text-secondary)]">
                {u.body}
              </CardDescription>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
