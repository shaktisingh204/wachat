'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function UrlParserPage() {
  const [url, setUrl] = useState('');
  const [parts, setParts] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState('');

  const run = () => {
    setError('');
    setParts(null);
    try {
      const u = new URL(url);
      setParts({
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port,
        pathname: u.pathname,
        search: u.search,
        hash: u.hash,
        username: u.username,
        password: u.password,
        origin: u.origin,
        href: u.href,
      });
    } catch (e: any) {
      setError(e?.message || 'Invalid URL.');
    }
  };

  return (
    <ToolShell title="URL Parser" description="Break a URL into its component parts using the WHATWG URL parser.">
      <div className="flex gap-2">
        <Input
          placeholder="https://user:pass@example.com:8080/path?x=1#hash"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button onClick={run} disabled={!url}>
          Parse
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/50">
          <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
        </Card>
      )}

      {parts && (
        <Card>
          <CardContent className="p-4">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(parts).map(([k, v]) => (
                  <tr key={k} className="border-b">
                    <td className="p-2 font-semibold w-40">{k}</td>
                    <td className="p-2 font-mono text-xs break-all">{v || <span className="text-muted-foreground">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
