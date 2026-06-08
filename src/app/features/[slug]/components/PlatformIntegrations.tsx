'use client';

import React from 'react';
import Link from 'next/link';
import { Settings, Puzzle, Code, ArrowRight } from 'lucide-react';
import {
  Card,
  CardBody,
  CardFooter,
  Button,
  Tag,
} from '@/components/sabcrm/20ui';

interface PlatformIntegrationsProps {
  color: string;
  integrations: string[];
}

export function PlatformIntegrations({ color, integrations }: PlatformIntegrationsProps) {
  return (
    <section className="20ui border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
      <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
        <div className="grid grid-cols-12 gap-8 md:gap-12">
          <div className="col-span-12 lg:col-span-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--st-text-secondary)]">
              Plays well with
            </div>
            <h2 className="mt-3 tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.05] text-[var(--st-text)] max-w-3xl">
              Works with the tools you already ship on.
            </h2>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--st-text-secondary)] max-w-md">
              Connect directly with your existing stack or leverage the Platform Core tools to extend capabilities natively.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {integrations.map((i) => (
                <Tag key={i} color={color}>
                  {i}
                </Tag>
              ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-6">
            <Card variant="elevated" padding="lg" className="h-full flex flex-col justify-between">
              <CardBody className="p-0">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="p-2 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)]">
                    <Settings className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                  </span>
                  <h3 className="text-[20px] text-[var(--st-text)]">Platform Core Tools</h3>
                </div>
                <p className="text-[14px] text-[var(--st-text-secondary)] mb-6">
                  Enhance this feature with deep integrations into our core infrastructure. Connect via API, utilize webhooks, or embed directly using our SDKs.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Puzzle className="h-4 w-4 text-[var(--st-accent)] mt-0.5" aria-hidden="true" />
                    <div>
                      <h4 className="text-[13px] font-semibold text-[var(--st-text)]">Unified Dashboard Apps</h4>
                      <p className="text-[12px] text-[var(--st-text-tertiary)]">Manage all settings seamlessly within the core UI.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Code className="h-4 w-4 text-[var(--st-accent)] mt-0.5" aria-hidden="true" />
                    <div>
                      <h4 className="text-[13px] font-semibold text-[var(--st-text)]">Developer APIs and Webhooks</h4>
                      <p className="text-[12px] text-[var(--st-text-tertiary)]">Extend functionality with custom automated workflows.</p>
                    </div>
                  </li>
                </ul>
              </CardBody>
              <CardFooter className="p-0 pt-8">
                <Link href="/developer" className="block w-full">
                  <Button variant="secondary" block iconRight={ArrowRight}>
                    View developer docs
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
