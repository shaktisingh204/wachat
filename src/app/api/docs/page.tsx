import { ArrowLeft, Database, Shield } from 'lucide-react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
} from '@/components/sabcrm/20ui';
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
    <div className="ui20 max-w-6xl mx-auto space-y-12 pb-24">
      {/* HEADER SECTION */}
      <div>
        <Link href="/dashboard/api" className="inline-flex mb-4 -ml-2">
          <Button variant="ghost" iconLeft={ArrowLeft} className="font-mono text-xs uppercase tracking-tight">
            Back to API Keys
          </Button>
        </Link>
        <PageHeader bordered={false}>
          <PageHeaderHeading>
            <PageEyebrow className="font-mono uppercase tracking-tight">SabNode</PageEyebrow>
            <PageTitle className="font-mono uppercase tracking-tight">
              SABNODE // {currentModule}.DOCUMENTATION
            </PageTitle>
            <PageDescription>
              Integrate your applications with SabNode using our secure REST API protocol.
            </PageDescription>
          </PageHeaderHeading>
        </PageHeader>
      </div>

      <ModuleSelector modules={modules} activeModule={currentModule} />

      {/* AUTHENTICATION SECTION */}
      <div className="grid gap-8 lg:grid-cols-5 pt-4">
        {/* Left Column: Docs & Table */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          <div className="flex items-center gap-2">
            <Badge tone="accent" kind="outline" className="font-mono text-[10px] font-bold uppercase tracking-wider">
              SECURE
            </Badge>
            <span className="font-mono text-[13px] text-[var(--st-text)] font-semibold">
              Bearer Token Security
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--st-text)] font-mono mt-1">
            Authentication Protocols
          </h2>
          <p className="text-[13px] text-[var(--st-text-secondary)] leading-relaxed">
            Authenticate your API requests by including your secret API key in the <code>Authorization</code> header of every request. All API requests must be made over HTTPS. Requests made over plain HTTP will fail.
          </p>

          <Card padding="none" className="border border-[var(--st-border)] shadow-none">
            <CardHeader className="border-b border-[var(--st-border)] py-3 bg-[var(--st-bg-muted)]">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <CardTitle className="text-[12px] font-mono uppercase tracking-wider text-[var(--st-text)]">
                  Header Parameters
                </CardTitle>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <Table>
                <THead className="bg-[var(--st-bg-muted)]/50">
                  <Tr>
                    <Th className="font-mono text-[11.5px] text-[var(--st-text)]">Parameter</Th>
                    <Th className="font-mono text-[11.5px] text-[var(--st-text)]">Type</Th>
                    <Th align="right" className="font-mono text-[11.5px] text-[var(--st-text)]">Value</Th>
                  </Tr>
                </THead>
                <TBody>
                  <Tr>
                    <Td className="font-mono text-[12.5px] text-[var(--st-text)] font-bold">Authorization</Td>
                    <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</Td>
                    <Td align="right" className="text-[12px] font-mono text-[var(--st-text-secondary)]">Bearer YOUR_API_KEY</Td>
                  </Tr>
                </TBody>
              </Table>
            </CardBody>
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
          <h2 className="text-2xl font-bold tracking-tight text-[var(--st-text)] font-mono capitalize">
            {currentModule} APIs
          </h2>
          <p className="text-[13px] text-[var(--st-text-secondary)] mt-1">
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
                  <Badge
                    tone={method === 'GET' ? 'neutral' : 'accent'}
                    kind={method === 'GET' ? 'outline' : 'solid'}
                    className="font-mono text-[10px] font-bold uppercase tracking-wider"
                  >
                    {method}
                  </Badge>
                  <span className="font-mono text-[13px] text-[var(--st-text)] font-bold tracking-tight break-all">
                    {path}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-[var(--st-text)] font-mono">
                    {endpoint.summary || 'Endpoint Specification'}
                  </h3>
                  {endpoint.description && (
                    <p className="text-[13px] text-[var(--st-text-secondary)] mt-1 leading-relaxed">
                      {endpoint.description}
                    </p>
                  )}
                  {endpoint.scope && (
                    <p className="text-[11px] text-[var(--st-text-tertiary)] mt-2 font-mono">
                      Scope: {endpoint.scope} | Tier: {endpoint.tier}
                    </p>
                  )}
                </div>

                {params.length > 0 ? (
                  <Card padding="none" className="border border-[var(--st-border)] shadow-none">
                    <CardHeader className="border-b border-[var(--st-border)] py-3 bg-[var(--st-bg-muted)]">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                        <CardTitle className="text-[12px] font-mono uppercase tracking-wider text-[var(--st-text)]">
                          Parameters
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardBody className="p-0 overflow-x-auto">
                      <Table>
                        <THead className="bg-[var(--st-bg-muted)]/50">
                          <Tr>
                            <Th className="font-mono text-[11.5px] text-[var(--st-text)]">Name</Th>
                            <Th className="font-mono text-[11.5px] text-[var(--st-text)]">In</Th>
                            <Th className="font-mono text-[11.5px] text-[var(--st-text)]">Type</Th>
                            <Th className="font-mono text-[11.5px] text-[var(--st-text)]">Description</Th>
                          </Tr>
                        </THead>
                        <TBody>
                          {params.map(param => (
                            <Tr key={param.name}>
                              <Td className="font-mono text-[12.5px] text-[var(--st-text)] font-bold whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {param.name}
                                  {param.required && <span className="text-[9px] text-[var(--st-text-secondary)] font-sans uppercase">Req</span>}
                                </div>
                              </Td>
                              <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">{param.in}</Td>
                              <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">{param.type}</Td>
                              <Td className="text-[var(--st-text-secondary)] text-[12px] leading-normal">{param.description}</Td>
                            </Tr>
                          ))}
                        </TBody>
                      </Table>
                    </CardBody>
                  </Card>
                ) : null}

                {endpoint.hasBody && (
                  <div className="rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] border border-[var(--st-border)] p-3 mt-2">
                    <p className="text-[12px] text-[var(--st-text-secondary)] font-mono">
                      <Database className="inline h-3.5 w-3.5 mr-1 text-[var(--st-text-secondary)]" aria-hidden="true" />
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
