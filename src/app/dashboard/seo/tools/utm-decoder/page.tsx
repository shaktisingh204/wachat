'use client';

import { Card, CardBody, Input, Label, Table, TBody, Td, Th, THead, Tr, cn } from '@/components/sabcrm/20ui';
import {
  cn as _zoruCn,
  useMemo,
  useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

type Parsed = {
  valid: boolean;
  error?: string;
  base?: string;
  utm: { key: string; value: string }[];
  other: { key: string; value: string }[];
};

export default function UtmDecoderPage() {
  const [url, setUrl] = useState(
    'https://example.com/?utm_source=newsletter&utm_medium=email&utm_campaign=spring_sale&utm_term=shoes&utm_content=cta1',
  );

  const parsed = useMemo<Parsed>(() => {
    const trimmed = (url || '').trim();
    if (!trimmed) return { valid: false, error: 'Enter a URL to decode.', utm: [], other: [] };
    try {
      const u = new URL(trimmed);
      const params = new URLSearchParams(u.search);
      const utm: { key: string; value: string }[] = [];
      const other: { key: string; value: string }[] = [];
      params.forEach((value, key) => {
        if (key.toLowerCase().startsWith('utm_')) {
          utm.push({ key, value });
        } else {
          other.push({ key, value });
        }
      });
      return {
        valid: true,
        base: `${u.origin}${u.pathname}`,
        utm,
        other,
      };
    } catch {
      return { valid: false, error: 'Not a valid URL.', utm: [], other: [] };
    }
  }, [url]);

  return (
    <ToolShell
      title="UTM Decoder"
      description="Paste a URL to extract and inspect its UTM tracking parameters."
    >
      <Card>
        <CardBody className="p-4 space-y-3">
          <Label htmlFor="utm-url">URL</Label>
          <Input
            id="utm-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/?utm_source=..."
          />
        </CardBody>
      </Card>

      {!parsed.valid ? (
        <p className="text-sm text-[var(--st-text-secondary)]">{parsed.error}</p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardBody className="p-4">
              <div className="text-xs text-[var(--st-text-secondary)]">Base URL</div>
              <div className="font-mono text-sm break-all">{parsed.base}</div>
            </CardBody>
          </Card>

          <div className="space-y-2">
            <Label>UTM parameters ({parsed.utm.length})</Label>
            <Card>
              <CardBody className="p-0">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Parameter</Th>
                      <Th>Value</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {parsed.utm.length === 0 ? (
                      <Tr>
                        <Td colSpan={2} className="text-sm text-[var(--st-text-secondary)]">
                          No UTM parameters found.
                        </Td>
                      </Tr>
                    ) : (
                      parsed.utm.map((p) => (
                        <Tr key={p.key}>
                          <Td className="font-mono text-xs">{p.key}</Td>
                          <Td className="font-mono text-xs">{p.value}</Td>
                        </Tr>
                      ))
                    )}
                  </TBody>
                </Table>
              </CardBody>
            </Card>
          </div>

          {parsed.other.length > 0 && (
            <div className="space-y-2">
              <Label>Other query parameters ({parsed.other.length})</Label>
              <Card>
                <CardBody className="p-0">
                  <Table>
                    <THead>
                      <Tr>
                        <Th>Parameter</Th>
                        <Th>Value</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {parsed.other.map((p) => (
                        <Tr key={p.key}>
                          <Td className="font-mono text-xs">{p.key}</Td>
                          <Td className="font-mono text-xs">{p.value}</Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      )}
    </ToolShell>
  );
}
