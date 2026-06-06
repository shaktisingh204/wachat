import { ArrowLeft, Database, Shield } from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  cn,
} from '@/components/sabcrm/20ui/compat';
import catalogData from './_data/catalog.json';
import { CodeTerminal, ModuleSelector } from './_components/ClientComponents';

export default async function ApiDocsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined }
}) {
  const resolvedSearchParams = await searchParams;
  const currentModule = (resolvedSearchParams.module as string) || 'wachat';

  // Get unique modules
  const modules = Array.from(new Set(catalogData.map((c: any) => c.module)));

  // Filter endpoints for current module
  const moduleEndpoints = catalogData.filter((c: any) => c.module === currentModule);

  return (
    <div className="zoruui max-w-6xl mx-auto space-y-12 pb-24">
      {/* HEADER SECTION */}
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-2 text-[var(--st-text)] hover:text-black">
          <Link href="/dashboard/api" className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-tight">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to API Keys
          </Link>
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-black font-mono uppercase">
            SABNODE // {currentModule}.DOCUMENTATION
          </h1>
          <p className="text-[13px] text-[var(--st-text)]">
            Integrate your applications with SabNode using our secure REST API protocol.
          </p>
        </div>
      </div>

      <ModuleSelector modules={modules} activeModule={currentModule} />

      {/* AUTHENTICATION SECTION */}
      <div className="grid gap-8 lg:grid-cols-5 pt-4">
        {/* Left Column: Docs & Table */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[var(--st-bg-muted)] border border-[var(--st-border)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--st-text)] uppercase tracking-wider">
              SECURE
            </span>
            <span className="font-mono text-[13px] text-black font-semibold">
              Bearer Token Security
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-black font-mono mt-1">
            Authentication Protocols
          </h2>
          <p className="text-[13px] text-[var(--st-text)] leading-relaxed">
            Authenticate your API requests by including your secret API key in the <code>Authorization</code> header of every request. All API requests must be made over HTTPS. Requests made over plain HTTP will fail.
          </p>

          <Card className="border border-[var(--st-border)] shadow-none">
            <ZoruCardHeader className="border-b border-[var(--st-border)] py-3 bg-[var(--st-bg-muted)]">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[var(--st-text-secondary)]" />
                <ZoruCardTitle className="text-[12px] font-mono uppercase tracking-wider text-[var(--st-text)]">
                  Header Parameters
                </ZoruCardTitle>
              </div>
            </ZoruCardHeader>
            <ZoruCardContent className="p-0">
              <Table>
                <ZoruTableHeader className="bg-[var(--st-bg-muted)]/50">
                  <ZoruTableRow>
                    <ZoruTableHead className="font-mono text-[11.5px] text-[var(--st-text)]">Parameter</ZoruTableHead>
                    <ZoruTableHead className="font-mono text-[11.5px] text-[var(--st-text)]">Type</ZoruTableHead>
                    <ZoruTableHead className="font-mono text-[11.5px] text-[var(--st-text)] text-right">Value</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  <ZoruTableRow>
                    <ZoruTableCell className="font-mono text-[12.5px] text-black font-bold">Authorization</ZoruTableCell>
                    <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text)]">string</ZoruTableCell>
                    <ZoruTableCell className="text-right text-[12px] font-mono text-[var(--st-text)]">Bearer YOUR_API_KEY</ZoruTableCell>
                  </ZoruTableRow>
                </ZoruTableBody>
              </Table>
            </ZoruCardContent>
          </Card>
        </div>

        {/* Right Column: Terminal Panel */}
        <div className="lg:col-span-2">
          <CodeTerminal
            title="Authorization Header"
            code="Authorization: Bearer YOUR_API_KEY"
          />
        </div>
      </div>

      {/* ENDPOINTS SECTION */}
      <div className="space-y-12">
        <div className="border-t border-[var(--st-border)] pt-8">
          <h2 className="text-2xl font-bold tracking-tight text-black font-mono capitalize">
            {currentModule} APIs
          </h2>
          <p className="text-[13px] text-[var(--st-text)] mt-1">
            Standard endpoint reference specifications for the {currentModule} module.
          </p>
        </div>

        {moduleEndpoints.map((endpoint: any, i: number) => {
          const method = endpoint.method;
          const path = endpoint.path;
          
          let exampleCode = `curl -X ${method} \\\n  https://api.sabnode.com/v1${path} \\\n  -H 'Authorization: Bearer YOUR_API_KEY'`;
          if (endpoint.hasBody) {
            exampleCode += ` \\\n  -H 'Content-Type: application/json' \\\n  -d '{
    // Request Payload
  }'`;
          }

          let responseCode = `{
  "success": true,
  "data": {}
}`;

          const params = [
            ...(endpoint.pathParams || []).map((p: any) => ({ ...p, in: 'path' })),
            ...(endpoint.queryParams || []).map((p: any) => ({ ...p, in: 'query' })),
          ];

          return (
            <div key={i} className="grid gap-8 lg:grid-cols-5 border-t border-[var(--st-border)] pt-8">
              {/* Left Column: Spec */}
              <div className="flex flex-col gap-4 lg:col-span-3">
                <div className="flex items-center gap-2.5">
                  <span className={cn(
                    "rounded font-mono text-[10px] font-bold px-2 py-0.5 border uppercase tracking-wider",
                    method === 'GET'
                      ? "bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]"
                      : "bg-black text-white border-black"
                  )}>
                    {method}
                  </span>
                  <span className="font-mono text-[13px] text-black font-bold tracking-tight break-all">
                    {path}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-black font-mono">
                    {endpoint.summary || 'Endpoint Specification'}
                  </h3>
                  {endpoint.description && (
                    <p className="text-[13px] text-[var(--st-text)] mt-1 leading-relaxed">
                      {endpoint.description}
                    </p>
                  )}
                  {endpoint.scope && (
                    <p className="text-[11px] text-[var(--st-text-secondary)] mt-2 font-mono">
                      Scope: {endpoint.scope} | Tier: {endpoint.tier}
                    </p>
                  )}
                </div>

                {params.length > 0 ? (
                  <Card className="border border-[var(--st-border)] shadow-none">
                    <ZoruCardHeader className="border-b border-[var(--st-border)] py-3 bg-[var(--st-bg-muted)]">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-[var(--st-text-secondary)]" />
                        <ZoruCardTitle className="text-[12px] font-mono uppercase tracking-wider text-[var(--st-text)]">
                          Parameters
                        </ZoruCardTitle>
                      </div>
                    </ZoruCardHeader>
                    <ZoruCardContent className="p-0 overflow-x-auto">
                      <Table>
                        <ZoruTableHeader className="bg-[var(--st-bg-muted)]/50">
                          <ZoruTableRow>
                            <ZoruTableHead className="font-mono text-[11.5px] text-[var(--st-text)]">Name</ZoruTableHead>
                            <ZoruTableHead className="font-mono text-[11.5px] text-[var(--st-text)]">In</ZoruTableHead>
                            <ZoruTableHead className="font-mono text-[11.5px] text-[var(--st-text)]">Type</ZoruTableHead>
                            <ZoruTableHead className="font-mono text-[11.5px] text-[var(--st-text)]">Description</ZoruTableHead>
                          </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                          {params.map(param => (
                            <ZoruTableRow key={param.name}>
                              <ZoruTableCell className="font-mono text-[12.5px] text-black font-bold whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {param.name}
                                  {param.required && <span className="text-[9px] text-[var(--st-text)] font-sans uppercase">Req</span>}
                                </div>
                              </ZoruTableCell>
                              <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text)]">{param.in}</ZoruTableCell>
                              <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text)]">{param.type}</ZoruTableCell>
                              <ZoruTableCell className="text-[var(--st-text)] text-[12px] leading-normal">{param.description}</ZoruTableCell>
                            </ZoruTableRow>
                          ))}
                        </ZoruTableBody>
                      </Table>
                    </ZoruCardContent>
                  </Card>
                ) : null}

                {endpoint.hasBody && (
                  <div className="rounded-md bg-[var(--st-bg-muted)] border border-[var(--st-border)] p-3 mt-2">
                    <p className="text-[12px] text-[var(--st-text)] font-mono">
                      <Database className="inline h-3.5 w-3.5 mr-1 text-[var(--st-text-secondary)]" />
                      This endpoint expects a JSON payload.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Code Terminal */}
              <div className="lg:col-span-2">
                <CodeTerminal
                  title={path}
                  code={exampleCode}
                  response={responseCode}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

