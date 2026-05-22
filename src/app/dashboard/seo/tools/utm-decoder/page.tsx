'use client';

import {
  Card,
  ZoruCardContent,
  Input,
  Label,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  cn,
} from '@/components/zoruui';
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
      <ZoruCard>
        <ZoruCardContent className="p-4 space-y-3">
          <ZoruLabel htmlFor="utm-url">URL</ZoruLabel>
          <ZoruInput
            id="utm-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/?utm_source=..."
          />
        </ZoruCardContent>
      </ZoruCard>

      {!parsed.valid ? (
        <p className="text-sm text-muted-foreground">{parsed.error}</p>
      ) : (
        <div className="space-y-4">
          <ZoruCard>
            <ZoruCardContent className="p-4">
              <div className="text-xs text-muted-foreground">Base URL</div>
              <div className="font-mono text-sm break-all">{parsed.base}</div>
            </ZoruCardContent>
          </ZoruCard>

          <div className="space-y-2">
            <ZoruLabel>UTM parameters ({parsed.utm.length})</ZoruLabel>
            <ZoruCard>
              <ZoruCardContent className="p-0">
                <ZoruTable>
                  <ZoruTableHeader>
                    <ZoruTableRow>
                      <ZoruTableHead>Parameter</ZoruTableHead>
                      <ZoruTableHead>Value</ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {parsed.utm.length === 0 ? (
                      <ZoruTableRow>
                        <ZoruTableCell colSpan={2} className="text-sm text-muted-foreground">
                          No UTM parameters found.
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ) : (
                      parsed.utm.map((p) => (
                        <ZoruTableRow key={p.key}>
                          <ZoruTableCell className="font-mono text-xs">{p.key}</ZoruTableCell>
                          <ZoruTableCell className="font-mono text-xs">{p.value}</ZoruTableCell>
                        </ZoruTableRow>
                      ))
                    )}
                  </ZoruTableBody>
                </ZoruTable>
              </ZoruCardContent>
            </ZoruCard>
          </div>

          {parsed.other.length > 0 && (
            <div className="space-y-2">
              <ZoruLabel>Other query parameters ({parsed.other.length})</ZoruLabel>
              <ZoruCard>
                <ZoruCardContent className="p-0">
                  <ZoruTable>
                    <ZoruTableHeader>
                      <ZoruTableRow>
                        <ZoruTableHead>Parameter</ZoruTableHead>
                        <ZoruTableHead>Value</ZoruTableHead>
                      </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                      {parsed.other.map((p) => (
                        <ZoruTableRow key={p.key}>
                          <ZoruTableCell className="font-mono text-xs">{p.key}</ZoruTableCell>
                          <ZoruTableCell className="font-mono text-xs">{p.value}</ZoruTableCell>
                        </ZoruTableRow>
                      ))}
                    </ZoruTableBody>
                  </ZoruTable>
                </ZoruCardContent>
              </ZoruCard>
            </div>
          )}
        </div>
      )}
    </ToolShell>
  );
}
