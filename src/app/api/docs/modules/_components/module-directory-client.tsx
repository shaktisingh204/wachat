"use client";

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/zoruui';
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
    GET: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    POST: 'bg-green-500/20 text-green-300 border-green-500/40',
    PATCH: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    PUT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    DELETE: 'bg-red-500/20 text-red-300 border-red-500/40',
  };
  const cls = colors[method] ?? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40';
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
    <div className="zoruui min-h-screen bg-zoru-bg text-zoru-ink">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-zoru-ink">
            API Reference
          </h1>
          <p className="text-sm text-zoru-ink-muted mt-2">
            {total.toLocaleString()} endpoints across {modules.length} module group
            {modules.length === 1 ? '' : 's'}. Each endpoint has its own page
            with code samples in 15+ languages and a live test runner.
          </p>

          <div className="mt-6 relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zoru-ink-muted" />
            <Input
              type="text"
              placeholder="Search modules or endpoints globally..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 w-full bg-zoru-surface border-zoru-line text-zoru-ink focus-visible:ring-zoru-brand"
            />
          </div>
        </header>

        {query && filteredEndpoints.length > 0 && filteredModules.length === 0 ? (
          <div>
            <h2 className="text-lg font-medium text-zoru-ink mb-4">Endpoints</h2>
            <div className="flex flex-col gap-2">
              {filteredEndpoints.map((e) => (
                <a
                  key={e.id}
                  href={`/api/docs/modules/${e.module}/${e.slug}`}
                  className="flex items-center gap-4 p-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface text-zoru-ink shadow-[var(--zoru-shadow-sm)] hover:bg-zoru-surface-2 transition-colors"
                >
                  <MethodBadge method={e.method} />
                  <span className="font-mono text-[13px]">{e.path}</span>
                  <span className="text-[13px] text-zoru-ink-muted ml-auto truncate hidden sm:block">
                    {e.summary}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {filteredModules.length > 0 && (
              <h2 className="text-lg font-medium text-zoru-ink mb-4">
                {query ? 'Modules' : ''}
              </h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredModules.map((m) => (
                <a
                  key={m.name}
                  href={'/api/docs/modules/' + m.name}
                  className="block p-4 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface text-zoru-ink shadow-[var(--zoru-shadow-sm)] transition-[border-color,box-shadow,background-color] hover:bg-zoru-surface-2 hover:border-zoru-line-strong hover:shadow-[var(--zoru-shadow-md)]"
                >
                  <div className="text-[14px] font-medium capitalize text-zoru-ink">
                    {m.name}
                  </div>
                  <div className="text-[12.5px] text-zoru-ink-muted mt-1">
                    {m.count.toLocaleString()} endpoint
                    {m.count === 1 ? '' : 's'}
                  </div>
                </a>
              ))}
            </div>

            {filteredModules.length === 0 && filteredEndpoints.length === 0 && (
              <div className="py-12 text-center text-zoru-ink-muted border border-dashed border-zoru-line rounded-[var(--zoru-radius)]">
                No modules or endpoints found matching &quot;{query}&quot;.
              </div>
            )}

            {query && filteredEndpoints.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-medium text-zoru-ink mb-4">Endpoints</h2>
                <div className="flex flex-col gap-2">
                  {filteredEndpoints.map((e) => (
                    <a
                      key={e.id}
                      href={`/api/docs/modules/${e.module}/${e.slug}`}
                      className="flex items-center gap-4 p-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface text-zoru-ink shadow-[var(--zoru-shadow-sm)] hover:bg-zoru-surface-2 transition-colors"
                    >
                      <MethodBadge method={e.method} />
                      <span className="font-mono text-[13px]">{e.path}</span>
                      <span className="text-[13px] text-zoru-ink-muted ml-auto truncate hidden sm:block">
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
