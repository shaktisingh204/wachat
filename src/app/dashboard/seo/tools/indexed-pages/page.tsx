'use client';

import {
  Button,
  Input,
  Card,
  ZoruCardContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function IndexedPagesPage() {
  const [domain, setDomain] = useState('');
  const [exactMatch, setExactMatch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [submittedExactMatch, setSubmittedExactMatch] = useState('');
  const [dateRange, setDateRange] = useState('any');
  const [error, setError] = useState('');

  const handleCheck = () => {
    let cleanedDomain = domain.trim();
    // Strip HTTP/HTTPS protocols automatically if users mistakenly paste a full URL.
    cleanedDomain = cleanedDomain.replace(/^https?:\/\//i, '');
    cleanedDomain = cleanedDomain.replace(/\/$/, '');
    
    if (!cleanedDomain) {
      setError('Please enter a valid domain.');
      setSubmitted('');
      return;
    }

    // Better internal validation: Allow domain, subdomain, and optional path
    const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/.*)?$/;
    if (!domainRegex.test(cleanedDomain) && !cleanedDomain.startsWith('localhost')) {
      setError('Invalid domain format. Please enter a valid domain like example.com or example.com/path.');
      setSubmitted('');
      return;
    }

    setError('');
    setDomain(cleanedDomain);
    setSubmitted(cleanedDomain);
    setSubmittedExactMatch(exactMatch.trim());
  };

  const getQueryString = () => {
    let query = `site:${submitted}`;
    if (submittedExactMatch) {
      query += ` "${submittedExactMatch}"`;
    }
    return encodeURIComponent(query);
  };

  const getGoogleUrl = () => {
    let url = `https://www.google.com/search?q=${getQueryString()}`;
    if (dateRange !== 'any') {
      url += `&tbs=qdr:${dateRange}`;
    }
    return url;
  };

  const getBingUrl = () => {
    let url = `https://www.bing.com/search?q=${getQueryString()}`;
    if (dateRange === 'd') {
      url += `&filters=ex1%3a%22ez1%22`;
    } else if (dateRange === 'w') {
      url += `&filters=ex1%3a%22ez2%22`;
    } else if (dateRange === 'm') {
      url += `&filters=ex1%3a%22ez3%22`;
    }
    return url;
  };

  return (
    <ToolShell title="Indexed Pages Checker" description="Open search engine site: queries to see indexed pages for a domain.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-2">
          <Input 
            value={domain} 
            onChange={(e) => {
              let val = e.target.value;
              if (/^https?:\/\//i.test(val)) {
                val = val.replace(/^https?:\/\//i, '');
              }
              setDomain(val);
              if (error) setError('');
            }} 
            placeholder="example.com" 
            className="flex-1"
          />
          <Input
            value={exactMatch}
            onChange={(e) => setExactMatch(e.target.value)}
            placeholder='Exact match keyword (optional)'
            className="flex-1"
          />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Any time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any time</SelectItem>
              <SelectItem value="h">Past hour</SelectItem>
              <SelectItem value="d">Past 24 hours</SelectItem>
              <SelectItem value="w">Past week</SelectItem>
              <SelectItem value="m">Past month</SelectItem>
              <SelectItem value="y">Past year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleCheck}>Check</Button>
        </div>
        
        {error && (
          <div className="text-zoru-ink text-sm font-medium">{error}</div>
        )}
      </div>

      {submitted && (
        <Card className="mt-4">
          <ZoruCardContent className="p-4 space-y-4">
            <h3 className="font-semibold text-lg text-zoru-ink dark:text-white">Search Engine Links</h3>
            <div className="flex flex-col gap-2">
              <a className="inline-flex items-center gap-2 p-3 bg-zoru-surface-2 dark:bg-zoru-ink/30 text-zoru-ink dark:text-zoru-ink-muted rounded-md hover:bg-zoru-surface-2 dark:hover:bg-zoru-ink/50 transition-colors" target="_blank" rel="noopener noreferrer" href={getGoogleUrl()}>
                <span className="text-xl">🔗</span>
                <span className="font-medium">Google:</span>
                <span className="opacity-90 break-all">site:{submitted} {submittedExactMatch ? `"${submittedExactMatch}"` : ''}</span>
              </a>
              <a className="inline-flex items-center gap-2 p-3 bg-zoru-surface-2 dark:bg-zoru-ink/30 text-zoru-ink dark:text-zoru-ink-muted rounded-md hover:bg-zoru-surface-2 dark:hover:bg-zoru-ink/50 transition-colors" target="_blank" rel="noopener noreferrer" href={getBingUrl()}>
                <span className="text-xl">🔗</span>
                <span className="font-medium">Bing:</span>
                <span className="opacity-90 break-all">site:{submitted} {submittedExactMatch ? `"${submittedExactMatch}"` : ''}</span>
              </a>
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
