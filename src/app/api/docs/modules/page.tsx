/* eslint-disable */
import { Suspense } from 'react';
import catalog from '../_data/catalog.json';
import { ModuleDirectoryClient } from './_components/module-directory-client';

export const dynamic = 'force-static';

// Define the shape of the catalog item we care about
type CatalogEndpoint = {
  id: string;
  slug: string;
  module: string;
  method: string;
  path: string;
  summary: string;
};

export default function Page() {
  // Dynamically calculate the module counts at build-time
  const moduleMap = new Map<string, number>();
  const endpoints: CatalogEndpoint[] = [];
  
  for (const endpoint of catalog as any[]) {
    const mod = endpoint.module;
    if (mod) {
      moduleMap.set(mod, (moduleMap.get(mod) || 0) + 1);
    }
    
    // Extract only necessary fields to keep client payload minimal
    endpoints.push({
      id: endpoint.id,
      slug: endpoint.slug,
      module: endpoint.module,
      method: endpoint.method,
      path: endpoint.path,
      summary: endpoint.summary || '',
    });
  }
  
  const modules = Array.from(moduleMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
    
  const total = catalog.length;

  return (
    <Suspense fallback={<div className="p-8 text-center text-zoru-ink-muted">Loading module directory...</div>}>
      <ModuleDirectoryClient modules={modules} endpoints={endpoints} total={total} />
    </Suspense>
  );
}
