import catalog from '../../_data/catalog.json';
import { notFound } from 'next/navigation';
import {
  Breadcrumb,
  ZoruBreadcrumbList,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbSeparator,
  ZoruBreadcrumbPage,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
  Button,
  Table,
  ZoruTableHeader,
  ZoruTableHead,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableCell,
} from '@/components/zoruui';

export const revalidate = 3600;
export const dynamicParams = true;

interface Row {
  module: string;
  slug: string;
  method: string;
  path: string;
  summary: string;
  scope: string;
  tier: string;
}

const rows = catalog as Row[];

export async function generateStaticParams() {
  const modules = new Set(rows.map((r) => r.module));
  return Array.from(modules).map((module) => ({ module }));
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-zoru-ink/20 text-zoru-ink-muted border-zoru-line/40',
    POST: 'bg-zoru-ink/20 text-zoru-ink-muted border-zoru-line/40',
    PATCH: 'bg-zoru-ink/20 text-zoru-ink-muted border-zoru-line/40',
    PUT: 'bg-zoru-ink/20 text-zoru-ink-muted border-zoru-line/40',
    DELETE: 'bg-zoru-ink/20 text-zoru-ink-muted border-zoru-line/40',
  };
  const cls = colors[method] ?? 'bg-zoru-ink/20 text-zoru-ink-muted border-zoru-line/40';
  return (
    <span className={'inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border w-14 text-center ' + cls}>
      {method}
    </span>
  );
}

export default async function Page({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const moduleRows = rows.filter((r) => r.module === module);
  
  if (moduleRows.length === 0) notFound();

  const methodOrder: Record<string, number> = {
    GET: 1,
    POST: 2,
    PUT: 3,
    PATCH: 4,
    DELETE: 5,
  };

  const groupedRows = moduleRows.reduce((acc, row) => {
    if (!acc[row.method]) acc[row.method] = [];
    acc[row.method].push(row);
    return acc;
  }, {} as Record<string, Row[]>);

  const sortedMethods = Object.keys(groupedRows).sort((a, b) => {
    return (methodOrder[a] || 99) - (methodOrder[b] || 99);
  });

  for (const method of sortedMethods) {
    groupedRows[method].sort((a, b) => a.path.localeCompare(b.path));
  }

  return (
    <div className="zoruui min-h-screen bg-zoru-bg text-zoru-ink">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-6">
          <Breadcrumb>
            <ZoruBreadcrumbList>
              <ZoruBreadcrumbItem>
                <ZoruBreadcrumbLink href="/api/docs/modules">All modules</ZoruBreadcrumbLink>
              </ZoruBreadcrumbItem>
              <ZoruBreadcrumbSeparator />
              <ZoruBreadcrumbItem>
                <ZoruBreadcrumbPage className="capitalize">{module}</ZoruBreadcrumbPage>
              </ZoruBreadcrumbItem>
            </ZoruBreadcrumbList>
          </Breadcrumb>

          <PageHeader>
            <ZoruPageHeading>
              <ZoruPageTitle className="capitalize">{module}</ZoruPageTitle>
              <ZoruPageDescription>
                {moduleRows.length} endpoint{moduleRows.length === 1 ? '' : 's'}. Click any row for
                the deep page with code samples in 15+ languages and a live test runner.
              </ZoruPageDescription>
            </ZoruPageHeading>
            <ZoruPageActions>
              <Button variant="outline" size="sm">
                Try all in Postman
              </Button>
              <Button variant="primary" size="sm">
                Download OpenAPI
              </Button>
            </ZoruPageActions>
          </PageHeader>

          <div className="rounded-[var(--zoru-radius)] border border-zoru-line overflow-hidden">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead className="w-20">Method</ZoruTableHead>
                  <ZoruTableHead>Path</ZoruTableHead>
                  <ZoruTableHead className="hidden md:table-cell">Summary</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {sortedMethods.flatMap((method) => [
                  <ZoruTableRow key={`header-${method}`} className="bg-zoru-surface/50 hover:bg-zoru-surface/50">
                    <ZoruTableCell colSpan={3} className="py-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zoru-ink-muted">{method} Endpoints</span>
                    </ZoruTableCell>
                  </ZoruTableRow>,
                  ...groupedRows[method].map((r) => (
                    <ZoruTableRow
                      key={r.slug}
                      className="cursor-pointer hover:bg-zoru-surface-2 transition-colors"
                    >
                      <ZoruTableCell>
                        <a
                          href={'/api/docs/modules/' + module + '/' + r.slug}
                          className="flex items-center gap-3 w-full"
                          tabIndex={-1}
                        >
                          <MethodBadge method={r.method} />
                        </a>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <a href={'/api/docs/modules/' + module + '/' + r.slug} className="block w-full">
                          <code className="font-mono text-sm text-zoru-ink">{r.path}</code>
                        </a>
                      </ZoruTableCell>
                      <ZoruTableCell className="hidden md:table-cell text-zoru-ink-muted text-xs">
                        <a href={'/api/docs/modules/' + module + '/' + r.slug} className="block w-full">
                          {r.summary}
                        </a>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                ])}
              </ZoruTableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
