'use client';

import { Card, ZoruCardContent, Input, Badge, cn } from '@/components/sabcrm/20ui/compat';
import {
  cn as _zoruCn,
  useMemo,
  useState,
  useEffect,
  ElementType
} from 'react';
import Link from 'next/link';

void _zoruCn;

import { 
  Wrench, Search, Star, 
  FileText, Key, Tag, Link as LinkIcon, Globe, 
  Image as ImageIcon, Code, LineChart, MousePointerClick, Settings 
} from 'lucide-react';
import {
  SEO_TOOLS,
  SEO_TOOL_CATEGORIES,
  type SeoToolCategory,
} from '@/lib/seo-tools/registry';

const CATEGORY_ICONS: Record<SeoToolCategory, ElementType> = {
  text: FileText,
  keyword: Key,
  meta: Tag,
  url: LinkIcon,
  domain: Globe,
  image: ImageIcon,
  code: Code,
  tracking: LineChart,
  ppc: MousePointerClick,
  misc: Settings,
};

export default function SeoToolsHubPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SeoToolCategory | 'all'>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [clicks, setClicks] = useState<Record<string, number>>({});
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const favs = JSON.parse(localStorage.getItem('seo-tools-favorites') || '[]');
      setFavorites(new Set(favs));
    } catch {}
    
    try {
      const cls = JSON.parse(localStorage.getItem('seo-tools-clicks') || '{}');
      setClicks(cls);
    } catch {}
  }, []);

  const toggleFavorite = (e: React.MouseEvent, slug: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      localStorage.setItem('seo-tools-favorites', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const trackClick = (slug: string) => {
    setClicks((prev) => {
      const next = { ...prev, [slug]: (prev[slug] || 0) + 1 };
      localStorage.setItem('seo-tools-clicks', JSON.stringify(next));
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = SEO_TOOLS.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.slug.includes(q)
      );
    });

    if (!isClient) return result;

    return result.sort((a, b) => {
      const aFav = favorites.has(a.slug);
      const bFav = favorites.has(b.slug);
      if (aFav !== bFav) return aFav ? -1 : 1;

      const aClicks = clicks[a.slug] || 0;
      const bClicks = clicks[b.slug] || 0;
      if (aClicks !== bClicks) return bClicks - aClicks;

      return 0;
    });
  }, [query, category, favorites, clicks, isClient]);

  const readyCount = SEO_TOOLS.filter((t) => t.status === 'ready').length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
          <Wrench className="h-8 w-8 text-zoru-ink" />
          SEO Tools
        </h1>
        <p className="text-zoru-ink-muted mt-1">
          {SEO_TOOLS.length} tools across {SEO_TOOL_CATEGORIES.length} categories · {readyCount} ready
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zoru-ink-muted" />
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
          className={`px-3 py-1.5 text-sm rounded-full border transition flex items-center gap-2 ${
            category === 'all' ? 'bg-zoru-ink text-white border-primary' : 'bg-zoru-surface hover:bg-zoru-surface-2'
          }`}
        >
          All ({SEO_TOOLS.length})
        </button>
        {SEO_TOOL_CATEGORIES.map((c) => {
          const count = SEO_TOOLS.filter((t) => t.category === c.id).length;
          const Icon = CATEGORY_ICONS[c.id];
          return (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-3 py-1.5 text-sm rounded-full border transition flex items-center gap-2 ${
                category === c.id ? 'bg-zoru-ink text-white border-primary' : 'bg-zoru-surface hover:bg-zoru-surface-2'
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((tool) => {
          const href = tool.status === 'ready' ? `/dashboard/seo/tools/${tool.slug}` : '#';
          const Wrapper: ElementType = tool.status === 'ready' ? Link : 'div';
          const Icon = CATEGORY_ICONS[tool.category];
          const isFav = favorites.has(tool.slug);

          return (
            <Wrapper 
              key={tool.slug} 
              href={href} 
              className="block"
              onClick={() => {
                if (tool.status === 'ready') trackClick(tool.slug);
              }}
            >
              <Card
                className={`h-full transition relative group ${
                  tool.status === 'ready'
                    ? 'hover:border-primary hover:shadow-md cursor-pointer'
                    : 'opacity-70 cursor-not-allowed'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(e, tool.slug)}
                  className={`absolute top-3 right-3 p-1.5 rounded-md transition-opacity z-10 ${
                    isFav ? 'opacity-100 text-zoru-ink hover:text-zoru-ink' : 'opacity-0 group-hover:opacity-100 text-zoru-ink-muted hover:bg-zoru-surface-2'
                  }`}
                  aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star className="w-4 h-4" fill={isFav ? "currentColor" : "none"} />
                </button>
                <ZoruCardContent className="p-4 flex flex-col gap-2 h-full">
                  <div className="flex items-start justify-between gap-2 pr-8">
                    <h3 className="font-semibold text-sm leading-tight">{tool.name}</h3>
                    {tool.status === 'soon' && (
                      <Badge variant="outline" className="text-[10px]">
                        Soon
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-zoru-ink-muted flex-1">{tool.description}</p>
                  <div className="text-[10px] uppercase tracking-wide text-zoru-ink-muted flex items-center gap-1.5 mt-2">
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {SEO_TOOL_CATEGORIES.find((c) => c.id === tool.category)?.label}
                  </div>
                </ZoruCardContent>
              </Card>
            </Wrapper>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="border-dashed">
          <ZoruCardContent className="p-12 text-center text-zoru-ink-muted">
            No tools match your search.
          </ZoruCardContent>
        </Card>
      )}
    </div>
  );
}
