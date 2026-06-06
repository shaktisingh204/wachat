"use client";

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/sabcrm/20ui/compat';
import { Search } from 'lucide-react';

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

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-[var(--st-text)]/20 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
    POST: 'bg-[var(--st-text)]/20 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
    PATCH: 'bg-[var(--st-text)]/20 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
    PUT: 'bg-[var(--st-text)]/20 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
    DELETE: 'bg-[var(--st-text)]/20 text-[var(--st-text-secondary)] border-[var(--st-border)]/40',
  };
  const cls = colors[method] ?? 'bg-[var(--st-text)]/20 text-[var(--st-text-secondary)] border-[var(--st-border)]/40';
  return (
    <span className={'inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border w-14 text-center ' + cls}>
      {method}
    </span>
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

  return (
    <div className="zoruui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--st-text)]">
            API Reference
          </h1>
          <p className="text-sm text-[var(--st-text-secondary)] mt-2">
            {total.toLocaleString()} endpoints across {modules.length} module group
            {modules.length === 1 ? '' : 's'}. Each endpoint has its own page
            with code samples in 15+ languages and a live test runner.
          </p>

          <div className="mt-6 relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--st-text-secondary)]" />
            <Input
              type="text"
              placeholder="Search modules or endpoints globally..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 w-full bg-[var(--st-bg-secondary)] border-[var(--st-border)] text-[var(--st-text)] focus-visible:ring-[var(--st-accent)]"
            />
          </div>
        </header>

        {query && filteredEndpoints.length > 0 && filteredModules.length === 0 ? (
          <div>
            <h2 className="text-lg font-medium text-[var(--st-text)] mb-4">Endpoints</h2>
            <div className="flex flex-col gap-2">
              {filteredEndpoints.map((e) => (
                <a
                  key={e.id}
                  href={`/api/docs/modules/${e.module}/${e.slug}`}
                  className="flex items-center gap-4 p-3 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] shadow-[var(--zoru-shadow-sm)] hover:bg-[var(--st-bg-muted)] transition-colors"
                >
                  <MethodBadge method={e.method} />
                  <span className="font-mono text-[13px]">{e.path}</span>
                  <span className="text-[13px] text-[var(--st-text-secondary)] ml-auto truncate hidden sm:block">
                    {e.summary}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {filteredModules.length > 0 && (
              <h2 className="text-lg font-medium text-[var(--st-text)] mb-4">
                {query ? 'Modules' : ''}
              </h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredModules.map((m) => (
                <a
                  key={m.name}
                  href={'/api/docs/modules/' + m.name}
                  className="block p-4 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] shadow-[var(--zoru-shadow-sm)] transition-[border-color,box-shadow,background-color] hover:bg-[var(--st-bg-muted)] hover:border-[var(--st-border-strong)] hover:shadow-[var(--zoru-shadow-md)]"
                >
                  <div className="text-[14px] font-medium capitalize text-[var(--st-text)]">
                    {m.name}
                  </div>
                  <div className="text-[12.5px] text-[var(--st-text-secondary)] mt-1">
                    {m.count.toLocaleString()} endpoint
                    {m.count === 1 ? '' : 's'}
                  </div>
                </a>
              ))}
            </div>

            {filteredModules.length === 0 && filteredEndpoints.length === 0 && (
              <div className="py-12 text-center text-[var(--st-text-secondary)] border border-dashed border-[var(--st-border)] rounded-[var(--zoru-radius)]">
                No modules or endpoints found matching &quot;{query}&quot;.
              </div>
            )}

            {query && filteredEndpoints.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-medium text-[var(--st-text)] mb-4">Endpoints</h2>
                <div className="flex flex-col gap-2">
                  {filteredEndpoints.map((e) => (
                    <a
                      key={e.id}
                      href={`/api/docs/modules/${e.module}/${e.slug}`}
                      className="flex items-center gap-4 p-3 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] shadow-[var(--zoru-shadow-sm)] hover:bg-[var(--st-bg-muted)] transition-colors"
                    >
                      <MethodBadge method={e.method} />
                      <span className="font-mono text-[13px]">{e.path}</span>
                      <span className="text-[13px] text-[var(--st-text-secondary)] ml-auto truncate hidden sm:block">
                        {e.summary}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
