'use client';

import {
  Button,
  Input,
  Card,
  ZoruCardContent,
  cn,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function IndexedPagesPage() {
  const [domain, setDomain] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [dateRange, setDateRange] = useState('any');

  const handleCheck = () => {
    let cleanedDomain = domain.trim().replace(/^https?:\/\//i, '');
    // Also remove trailing slashes if any, just in case
    cleanedDomain = cleanedDomain.replace(/\/$/, '');
    setDomain(cleanedDomain);
    setSubmitted(cleanedDomain);
  };

  const getGoogleUrl = () => {
    let url = `https://www.google.com/search?q=site:${encodeURIComponent(submitted)}`;
    if (dateRange !== 'any') {
      url += `&tbs=qdr:${dateRange}`;
    }
    return url;
  };

  // Bing doesn't support the same simple qdr parameter, so we just use the query.
  // We can add Bing date filters if needed, but Google is the primary use case.
  const getBingUrl = () => {
    let url = `https://www.bing.com/search?q=site:${encodeURIComponent(submitted)}`;
    if (dateRange === 'd') {
      url += `&filters=ex1%3a"ez1"`;
    } else if (dateRange === 'w') {
      url += `&filters=ex1%3a"ez2"`;
    } else if (dateRange === 'm') {
      url += `&filters=ex1%3a"ez3"`;
    }
    // Bing doesn't have an exact 'past hour' or 'past year' in the ez1-ez3 standard range (ez1=24h, ez2=7d, ez3=30d) 
    return url;
  };

  return (
    <ToolShell title="Indexed Pages Checker" description="Open Google's site: query to see indexed pages for a domain.">
      <div className="flex gap-2">
        <Input 
          value={domain} 
          onChange={(e) => {
            let val = e.target.value;
            if (/^https?:\/\//i.test(val)) {
              val = val.replace(/^https?:\/\//i, '');
            }
            setDomain(val);
          }} 
          placeholder="example.com" 
          className="flex-1"
        />
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
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
      {submitted && (
        <Card className="mt-4">
          <ZoruCardContent className="p-4 space-y-2">
            <a className="block text-sm text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" href={getGoogleUrl()}>🔗 Google: site:{submitted}</a>
            <a className="block text-sm text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" href={getBingUrl()}>🔗 Bing: site:{submitted}</a>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
