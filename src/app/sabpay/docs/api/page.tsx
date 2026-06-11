import * as React from 'react';

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type BadgeTone,
} from '@/components/sabcrm/20ui';

import { SabpayPage } from '../../_components/sabpay-page';
import { CodeBlock } from '../../_components/code-block';
import { DocsNav } from '../_components/docs-nav';
import {
  SABPAY_API_REFERENCE,
  type SabpayDocEndpoint,
  type SabpayDocMethod,
} from '../_content/api-reference';

export const metadata = { title: 'SabPay — API reference' };

const mono: React.CSSProperties = {
  fontFamily: 'var(--st-font-mono, monospace)',
  fontSize: 12.5,
};

const METHOD_TONE: Record<SabpayDocMethod, BadgeTone> = {
  GET: 'info',
  POST: 'success',
  PATCH: 'warning',
  DELETE: 'danger',
};

function MethodBadge({ method }: { method: SabpayDocMethod }): React.JSX.Element {
  return (
    <Badge tone={METHOD_TONE[method]}>
      <span style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 11 }}>{method}</span>
    </Badge>
  );
}

function EndpointExample({ endpoint }: { endpoint: SabpayDocEndpoint }): React.JSX.Element | null {
  if (!endpoint.curl && !endpoint.response) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
        Example —{' '}
        <span style={mono}>
          {endpoint.method} {endpoint.path}
        </span>
      </p>
      {endpoint.curl ? <CodeBlock language="bash" code={endpoint.curl} /> : null}
      {endpoint.response ? (
        <>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--st-text-muted)' }}>Response</p>
          <CodeBlock language="json" code={endpoint.response} />
        </>
      ) : null}
    </div>
  );
}

export default function SabpayDocsApiPage(): React.JSX.Element {
  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Docs', href: '/sabpay/docs' },
        { label: 'API reference' },
      ]}
      eyebrow="Developers"
      title="API reference"
      description={
        <>
          Every endpoint under <span style={mono}>https://sabnode.com/api/sabpay/v1</span> —
          authenticated with <span style={mono}>Authorization: Bearer sk_test_… | sk_live_…</span>.
        </>
      }
      width="wide"
    >
      <DocsNav active="/sabpay/docs/api" />

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Sticky in-page anchor nav */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            position: 'sticky',
            top: 16,
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
          }}
        >
          <Card>
            <CardBody>
              <nav
                aria-label="API reference sections"
                style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                <a
                  href="#conventions"
                  style={{
                    display: 'block',
                    padding: '5px 8px',
                    borderRadius: 6,
                    fontSize: 13,
                    color: 'var(--st-text-muted)',
                    textDecoration: 'none',
                  }}
                >
                  Conventions
                </a>
                {SABPAY_API_REFERENCE.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    style={{
                      display: 'block',
                      padding: '5px 8px',
                      borderRadius: 6,
                      fontSize: 13,
                      color: 'var(--st-text-muted)',
                      textDecoration: 'none',
                    }}
                  >
                    {section.entity}
                  </a>
                ))}
              </nav>
            </CardBody>
          </Card>
        </div>

        {/* Sections */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--st-space-5, 20px)',
          }}
        >
          <section id="conventions" style={{ scrollMarginTop: 16 }}>
            <Card>
              <CardHeader>
                <CardTitle>Conventions</CardTitle>
              </CardHeader>
              <CardBody>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: 'var(--st-text-muted)',
                  }}
                >
                  <li>
                    All amounts are <strong>integer paise</strong> (₹499.00 →{' '}
                    <span style={mono}>49900</span>). Min <span style={mono}>100</span>, max{' '}
                    <span style={mono}>100000000</span> (₹10,00,000). Currency is{' '}
                    <span style={mono}>INR</span> only.
                  </li>
                  <li>
                    <span style={mono}>notes</span> / <span style={mono}>metadata</span> objects:
                    ≤ 20 keys, string values only, key ≤ 40 chars, value ≤ 500 chars.
                  </li>
                  <li>
                    Timestamps are ISO-8601 strings (
                    <span style={mono}>2026-06-11T08:30:00.000Z</span>).
                  </li>
                  <li>
                    Lists return <span style={mono}>{'{ "object": "list", "data": [ … ] }'}</span>,
                    cursor-paginated newest first via <span style={mono}>?limit=</span> /{' '}
                    <span style={mono}>?before=</span> / <span style={mono}>?status=</span>.
                  </li>
                  <li>
                    REST responses use <strong>snake_case</strong>; webhook payloads carry the raw
                    engine objects in <strong>camelCase</strong>.
                  </li>
                  <li>
                    The key prefix decides the mode: <span style={mono}>sk_test_…</span> operates
                    on test data, <span style={mono}>sk_live_…</span> on live data. Mutating
                    requests may send an <span style={mono}>Idempotency-Key</span> header.
                  </li>
                </ul>
              </CardBody>
            </Card>
          </section>

          {SABPAY_API_REFERENCE.map((section) => (
            <section key={section.id} id={section.id} style={{ scrollMarginTop: 16 }}>
              <Card>
                <CardHeader>
                  <CardTitle>{section.entity}</CardTitle>
                </CardHeader>
                <CardBody>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        lineHeight: 1.65,
                        color: 'var(--st-text-muted)',
                      }}
                    >
                      {section.description}
                    </p>
                    <Table>
                      <THead>
                        <Tr>
                          <Th>Method</Th>
                          <Th>Path</Th>
                          <Th>Summary</Th>
                        </Tr>
                      </THead>
                      <TBody>
                        {section.endpoints.map((endpoint) => (
                          <Tr key={`${endpoint.method} ${endpoint.path}`}>
                            <Td>
                              <MethodBadge method={endpoint.method} />
                            </Td>
                            <Td style={{ ...mono, whiteSpace: 'nowrap' }}>{endpoint.path}</Td>
                            <Td>{endpoint.summary}</Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                    {section.endpoints.map((endpoint) =>
                      endpoint.curl || endpoint.response ? (
                        <EndpointExample
                          key={`example-${endpoint.method} ${endpoint.path}`}
                          endpoint={endpoint}
                        />
                      ) : null,
                    )}
                  </div>
                </CardBody>
              </Card>
            </section>
          ))}
        </div>
      </div>
    </SabpayPage>
  );
}
