'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ZoruInput } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';

export default function RobotsTxtTesterPage() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setContent('');
    try {
      const host = /^https?:\/\//.test(domain) ? domain.replace(/\/$/, '') : `https://${domain}`;
      const r = await apiFetchUrl(`${host}/robots.txt`);
      if (r.error) setError(r.error);
      else setContent(r.body);
    } finally { setLoading(false); }
  };

  return (
    <ToolShell title="Robots.txt Tester" description="Fetch and inspect a site's robots.txt file.">
      <div className="flex gap-2">
        <ZoruInput value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
        <ZoruButton onClick={run} disabled={loading}>{loading ? 'Fetching…' : 'Fetch'}</ZoruButton>
      </div>
      {error && <ZoruCard className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></ZoruCard>}
      {content && (
        <ZoruCard><ZoruCardContent className="p-4">
          <pre className="text-xs bg-muted p-3 rounded overflow-auto whitespace-pre-wrap max-h-96">{content}</pre>
        </ZoruCardContent></ZoruCard>
      )}
    </ToolShell>
  );
}
