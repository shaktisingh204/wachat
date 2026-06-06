'use client';

import { useState } from 'react';

import {
  Button,
  Input,
  Field,
  Card,
  CardBody,
  Alert,
  EmptyState,
  Table,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import { Globe, Search } from 'lucide-react';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiWhois } from '@/lib/seo-tools/api-client';

export default function WhoisLookupPage() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const run = async () => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const r = await apiWhois(domain);
      if (r.error) setError(r.error);
      else setData(r);
    } finally {
      setLoading(false);
    }
  };

  const parsedEntries = Object.entries(data?.parsed ?? {});

  return (
    <ToolShell title="WHOIS Lookup" description="Query WHOIS registration data for any domain.">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <Field label="Domain" className="flex-1">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            iconLeft={Globe}
            autoComplete="off"
          />
        </Field>
        <Button type="submit" variant="primary" iconLeft={Search} loading={loading} disabled={!domain.trim()}>
          {loading ? 'Looking up...' : 'Lookup'}
        </Button>
      </form>

      {error ? (
        <Alert tone="danger" title="Lookup failed">
          {error}
        </Alert>
      ) : null}

      {data ? (
        <>
          <Card>
            <CardBody>
              <div className="mb-3 text-xs text-[var(--st-text-secondary)]">
                Server: {data.server}
              </div>
              {parsedEntries.length > 0 ? (
                <Table density="compact" hover={false}>
                  <TBody>
                    {parsedEntries.map(([k, v]) => (
                      <Tr key={k}>
                        <Th scope="row" width={160} className="align-top text-[var(--st-text-secondary)]">
                          {k}
                        </Th>
                        <Td className="text-[var(--st-text)]">{String(v)}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <EmptyState
                  icon={Globe}
                  size="sm"
                  title="No parsed fields"
                  description="The registry returned no structured WHOIS fields. Check the raw record below."
                />
              )}
            </CardBody>
          </Card>

          <Button variant="outline" onClick={() => setShowRaw((s) => !s)}>
            {showRaw ? 'Hide raw WHOIS' : 'Show raw WHOIS'}
          </Button>

          {showRaw ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-xs text-[var(--st-text)]">
              {data.raw}
            </pre>
          ) : null}
        </>
      ) : null}
    </ToolShell>
  );
}
