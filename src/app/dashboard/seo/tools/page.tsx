'use client';

import { useMemo, useState, useEffect, type ElementType } from 'react';
import Link from 'next/link';
import {
  Wrench,
  Search,
  Star,
  FileText,
  Key,
  Tag as TagIcon,
  Link as LinkIcon,
  Globe,
  Image as ImageIcon,
  Code,
  LineChart,
  MousePointerClick,
  Settings,
  type LucideIcon,
} from 'lucide-react';

import {
  Card,
  CardBody,
  Input,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';

import {
  SEO_TOOLS,
  SEO_TOOL_CATEGORIES,
  type SeoToolCategory,
} from '@/lib/seo-tools/registry';

const CATEGORY_ICONS: Record<SeoToolCategory, LucideIcon> = {
  text: FileText,
  keyword: Key,
  meta: TagIcon,
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
      <PageHeader bordered={false}>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-3">
            <Wrench className="h-7 w-7" aria-hidden="true" />
            SEO Tools
          </PageTitle>
          <PageDescription>
            {SEO_TOOLS.length} tools across {SEO_TOOL_CATEGORIES.length} categories, {readyCount} ready
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="max-w-md">
        <Input
          iconLeft={Search}
          placeholder="Search tools..."
          aria-label="Search SEO tools"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={category === 'all' ? 'primary' : 'secondary'}
          onClick={() => setCategory('all')}
        >
          All ({SEO_TOOLS.length})
        </Button>
        {SEO_TOOL_CATEGORIES.map((c) => {
          const count = SEO_TOOLS.filter((t) => t.category === c.id).length;
          const Icon = CATEGORY_ICONS[c.id];
          return (
            <Button
              key={c.id}
              size="sm"
              variant={category === c.id ? 'primary' : 'secondary'}
              iconLeft={Icon}
              onClick={() => setCategory(c.id)}
            >
              {c.label} ({count})
            </Button>
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
                variant={tool.status === 'ready' ? 'interactive' : 'outlined'}
                padding="none"
                className={`relative h-full group ${
                  tool.status === 'ready' ? 'cursor-pointer' : 'opacity-70 cursor-not-allowed'
                }`}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className={`absolute top-2 right-2 z-10 ${
                    isFav ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  aria-pressed={isFav}
                  onClick={(e) => toggleFavorite(e, tool.slug)}
                >
                  <Star
                    className="h-4 w-4"
                    fill={isFav ? 'currentColor' : 'none'}
                    aria-hidden="true"
                  />
                </Button>
                <CardBody className="flex h-full flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2 pr-8">
                    <h3 className="text-sm font-semibold leading-tight text-[var(--st-text)]">
                      {tool.name}
                    </h3>
                    {tool.status === 'soon' && (
                      <Badge tone="neutral" kind="outline" className="text-[10px]">
                        Soon
                      </Badge>
                    )}
                  </div>
                  <p className="flex-1 text-xs text-[var(--st-text-secondary)]">
                    {tool.description}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                    {SEO_TOOL_CATEGORIES.find((c) => c.id === tool.category)?.label}
                  </div>
                </CardBody>
              </Card>
            </Wrapper>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={Search}
          title="No tools match your search"
          description="Try a different keyword or clear the category filter."
        />
      )}
    </div>
  );
}
