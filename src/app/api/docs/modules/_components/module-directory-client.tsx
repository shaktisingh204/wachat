"use client";

import React, { useState, useMemo } from 'react';
import {
  Input,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { Search, FileQuestion } from 'lucide-react';

export type Endpoint = {
  id: string;
  slug: string;
  module: string;
  method: string;
  path: string;
  summary: string;
};

export type ModuleCount = {
  name: string;
  count: number;
};

const METHOD_TONE: Record<string, BadgeTone> = {
  GET: 'info',
  POST: 'success',
  PATCH: 'warning',
  PUT: 'accent',
  DELETE: 'danger',
};

function MethodBadge({ method }: { method: string }) {
  const tone = METHOD_TONE[method] ?? 'neutral';
  return (
    <Badge tone={tone} kind="soft" className="w-14 justify-center font-mono">
      {method}
    </Badge>
  );
}

export function ModuleDirectoryClient({
  modules,
  endpoints,
  total,
}: {
  modules: ModuleCount[];
  endpoints: Endpoint[];
  total: number;
}) {
  const [query, setQuery] = useState('');

  const filteredModules = useMemo(() => {
    if (!query) return modules;
    const lowerQuery = query.toLowerCase();
    return modules.filter((m) => m.name.toLowerCase().includes(lowerQuery));
  }, [modules, query]);

  const filteredEndpoints = useMemo(() => {
    if (!query || query.length < 2) return [];
    const lowerQuery = query.toLowerCase();
    return endpoints
      .filter(
        (e) =>
          e.path.toLowerCase().includes(lowerQuery) ||
          e.summary.toLowerCase().includes(lowerQuery) ||
          e.module.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 100); // Limit to 100 to keep UI responsive
  }, [endpoints, query]);

  const endpointList = (
    <div className="flex flex-col gap-2">
      {filteredEndpoints.map((e) => (
        <a
          key={e.id}
          href={`/api/docs/modules/${e.module}/${e.slug}`}
          className="flex items-center gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-[var(--st-text)] shadow-[var(--st-shadow-sm)] transition-colors hover:bg-[var(--st-bg-muted)]"
        >
          <MethodBadge method={e.method} />
          <span className="font-mono text-[13px]">{e.path}</span>
          <span className="ml-auto hidden truncate text-[13px] text-[var(--st-text-secondary)] sm:block">
            {e.summary}
          </span>
        </a>
      ))}
    </div>
  );

  return (
    <div className="ui20 min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader bordered={false} className="mb-8">
          <PageHeaderHeading>
            <PageTitle>API Reference</PageTitle>
            <PageDescription>
              {total.toLocaleString()} endpoints across {modules.length} module group
              {modules.length === 1 ? '' : 's'}. Each endpoint has its own page
              with code samples in 15+ languages and a live test runner.
            </PageDescription>
          </PageHeaderHeading>

          <div className="mt-6 w-full sm:max-w-md">
            <Input
              type="text"
              iconLeft={Search}
              placeholder="Search modules or endpoints globally..."
              aria-label="Search modules or endpoints"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </PageHeader>

        {query && filteredEndpoints.length > 0 && filteredModules.length === 0 ? (
          <div>
            <h2 className="mb-4 text-lg font-medium text-[var(--st-text)]">Endpoints</h2>
            {endpointList}
          </div>
        ) : (
          <div>
            {filteredModules.length > 0 && query && (
              <h2 className="mb-4 text-lg font-medium text-[var(--st-text)]">Modules</h2>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredModules.map((m) => (
                <a
                  key={m.name}
                  href={'/api/docs/modules/' + m.name}
                  className="block rounded-[var(--st-radius)]"
                >
                  <Card variant="interactive" padding="md">
                    <div className="text-[14px] font-medium capitalize text-[var(--st-text)]">
                      {m.name}
                    </div>
                    <div className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
                      {m.count.toLocaleString()} endpoint
                      {m.count === 1 ? '' : 's'}
                    </div>
                  </Card>
                </a>
              ))}
            </div>

            {filteredModules.length === 0 && filteredEndpoints.length === 0 && (
              <EmptyState
                icon={FileQuestion}
                title="No matches found"
                description={`No modules or endpoints match "${query}".`}
              />
            )}

            {query && filteredEndpoints.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-4 text-lg font-medium text-[var(--st-text)]">Endpoints</h2>
                {endpointList}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
