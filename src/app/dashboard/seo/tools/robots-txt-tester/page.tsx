'use client';

import { Button, Input, Card, CardBody, Label } from '@/components/sabcrm/20ui/compat';
import { useState, useMemo } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';

function testRobots(content: string, userAgent: string, path: string) {
  const rulesByUa: Record<string, { allow: string[], disallow: string[] }> = {};
  let currentUas: string[] = [];
  let isParsingDirectives = false;
  
  const lines = content.split('\n');
  for (let line of lines) {
    line = line.split('#')[0].trim();
    if (!line) continue;
    
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    
    const key = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();
    
    if (key === 'user-agent') {
      if (isParsingDirectives) {
        currentUas = [];
        isParsingDirectives = false;
      }
      currentUas.push(value.toLowerCase());
      if (!rulesByUa[value.toLowerCase()]) {
        rulesByUa[value.toLowerCase()] = { allow: [], disallow: [] };
      }
    } else if (key === 'allow') {
      isParsingDirectives = true;
      currentUas.forEach(ua => {
        if (rulesByUa[ua]) rulesByUa[ua].allow.push(value);
      });
    } else if (key === 'disallow') {
      isParsingDirectives = true;
      currentUas.forEach(ua => {
        if (rulesByUa[ua]) rulesByUa[ua].disallow.push(value);
      });
    }
  }
  
  const uaToUse = userAgent.toLowerCase();
  let appliedUa = '*';
  let bestUaMatchLength = 0;
  for (const ua of Object.keys(rulesByUa)) {
    if (ua !== '*' && uaToUse.includes(ua)) {
      if (ua.length > bestUaMatchLength) {
        appliedUa = ua;
        bestUaMatchLength = ua.length;
      }
    }
  }
  
  if (appliedUa === '*' && !rulesByUa['*']) {
    return { allowed: true, appliedUa, matchedRule: '' };
  }
  
  const rules = rulesByUa[appliedUa] || { allow: [], disallow: [] };
  
  const escapeRegex = (s: string) => s.replace(/([.+?^=!:${}()|\[\]\/\\])/g, '\\$1');
  const makeRegex = (pattern: string) => {
    let re = escapeRegex(pattern).replace(/\\\*/g, '.*');
    if (re.endsWith('\\$')) {
      re = re.slice(0, -2) + '$';
    }
    return new RegExp('^' + re);
  };
  
  let longestMatchLength = -1;
  let isAllowed = true;
  let matchedRule = '';
  
  for (const p of rules.allow) {
    if (!p) continue;
    try {
      const re = makeRegex(p);
      if (re.test(path)) {
        if (p.length > longestMatchLength) {
          longestMatchLength = p.length;
          isAllowed = true;
          matchedRule = `Allow: ${p}`;
        }
      }
    } catch(e) {}
  }
  
  for (const p of rules.disallow) {
    if (!p) continue; 
    try {
      const re = makeRegex(p);
      if (re.test(path)) {
        if (p.length > longestMatchLength) {
          longestMatchLength = p.length;
          isAllowed = false;
          matchedRule = `Disallow: ${p}`;
        } else if (p.length === longestMatchLength && !isAllowed) {
          matchedRule = `Disallow: ${p}`;
        }
      }
    } catch(e) {}
  }
  
  return { allowed: isAllowed, appliedUa, matchedRule };
}

export default function RobotsTxtTesterPage() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  
  const [testPath, setTestPath] = useState('/');
  const [testUa, setTestUa] = useState('Googlebot');

  const run = async () => {
    setLoading(true); 
    setError(''); 
    setContent('');
    try {
      let host = domain.trim();
      if (!host) {
        setError('Please enter a domain.');
        return;
      }
      if (!/^https?:\/\//i.test(host)) {
        host = `https://${host}`;
      }
      try {
        const urlObj = new URL(host);
        host = urlObj.origin;
      } catch (e) {
        setError('Invalid URL format.');
        return;
      }
      
      const r = await apiFetchUrl(`${host}/robots.txt`);
      if (r.error) setError(r.error);
      else setContent(r.body);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally { 
      setLoading(false); 
    }
  };

  const testResult = useMemo(() => {
    if (!content) return null;
    return testRobots(content, testUa || '*', testPath || '/');
  }, [content, testUa, testPath]);

  return (
    <ToolShell title="Robots.txt Tester" description="Fetch and inspect a site's robots.txt file.">
      <div className="flex gap-2">
        <Input 
          value={domain} 
          onChange={(e) => setDomain(e.target.value)} 
          placeholder="example.com" 
          onKeyDown={(e) => e.key === 'Enter' && !loading && run()}
        />
        <Button onClick={run} disabled={loading}>{loading ? 'Fetching…' : 'Fetch'}</Button>
      </div>
      {error && (
        <Card className="border-[var(--st-border)]">
          <CardBody className="p-4 text-[var(--st-text)] text-sm">{error}</CardBody>
        </Card>
      )}
      {content && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="flex flex-col h-[500px]">
            <div className="p-4 border-b font-medium bg-[var(--st-bg-muted)]/50">robots.txt Content</div>
            <CardBody className="p-0 flex-1 overflow-hidden">
              <pre className="text-xs p-4 h-full overflow-auto whitespace-pre-wrap">{content}</pre>
            </CardBody>
          </Card>
          
          <Card className="flex flex-col h-[500px]">
            <div className="p-4 border-b font-medium bg-[var(--st-bg-muted)]/50">Test URL Block</div>
            <CardBody className="p-4 flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-path">Path to Test</Label>
                <Input 
                  id="test-path"
                  value={testPath}
                  onChange={(e) => setTestPath(e.target.value)}
                  placeholder="/example/path"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-ua">User Agent</Label>
                <Input 
                  id="test-ua"
                  value={testUa}
                  onChange={(e) => setTestUa(e.target.value)}
                  placeholder="Googlebot, Bingbot, *"
                />
              </div>
              
              <div className="mt-4 p-4 rounded-lg bg-[var(--st-bg-muted)]">
                <h4 className="text-sm font-semibold mb-2">Test Result</h4>
                {testResult ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--st-text-secondary)]">Status:</span>
                      {testResult.allowed ? (
                        <span className="inline-flex items-center rounded-md bg-[var(--st-bg-muted)] px-2 py-1 text-xs font-medium text-[var(--st-text)] ring-1 ring-inset ring-[var(--st-border)]/20">
                          ALLOWED
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-[var(--st-bg-muted)] px-2 py-1 text-xs font-medium text-[var(--st-text)] ring-1 ring-inset ring-[var(--st-border)]/10">
                          BLOCKED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--st-text-secondary)]">Applied User-Agent:</span>
                      <code className="text-xs">{testResult.appliedUa}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--st-text-secondary)]">Matched Rule:</span>
                      <code className="text-xs">{testResult.matchedRule || 'Default (Allow all)'}</code>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </ToolShell>
  );
}
