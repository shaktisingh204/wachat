'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Wrench, Search } from 'lucide-react';
import {
  SEO_TOOLS,
  SEO_TOOL_CATEGORIES,
  type SeoToolCategory,
} from '@/lib/seo-tools/registry';

export default function SeoToolsHubPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SeoToolCategory | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SEO_TOOLS.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.slug.includes(q)
      );
    });
  }, [query, category]);

  const readyCount = SEO_TOOLS.filter((t) => t.status === 'ready').length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
          <Wrench className="h-8 w-8 text-primary" />
          SEO Tools
        </h1>
        <p className="text-muted-foreground mt-1">
          {SEO_TOOLS.length} tools across {SEO_TOOL_CATEGORIES.length} categories · {readyCount} ready
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search tools…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategory('all')}
          className={`px-3 py-1.5 text-sm rounded-full border transition ${
            category === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
          }`}
        >
          All ({SEO_TOOLS.length})
        </button>
        {SEO_TOOL_CATEGORIES.map((c) => {
          const count = SEO_TOOLS.filter((t) => t.category === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-3 py-1.5 text-sm rounded-full border transition ${
                category === c.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
              }`}
            >
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((tool) => {
          const href = tool.status === 'ready' ? `/dashboard/seo/tools/${tool.slug}` : '#';
          const Wrapper: any = tool.status === 'ready' ? Link : 'div';
          return (
            <Wrapper key={tool.slug} href={href} className="block">
              <Card
                className={`h-full transition ${
                  tool.status === 'ready'
                    ? 'hover:border-primary hover:shadow-md cursor-pointer'
                    : 'opacity-70 cursor-not-allowed'
                }`}
              >
                <CardContent className="p-4 flex flex-col gap-2 h-full">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight">{tool.name}</h3>
                    {tool.status === 'soon' && (
                      <Badge variant="outline" className="text-[10px]">
                        Soon
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex-1">{tool.description}</p>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {SEO_TOOL_CATEGORIES.find((c) => c.id === tool.category)?.label}
                  </div>
                </CardContent>
              </Card>
            </Wrapper>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground">
            No tools match your search.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
