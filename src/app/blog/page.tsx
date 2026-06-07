import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LandingHeader } from '@/components/landing/landing-header';
import Link from 'next/link';

// 20ui design system
import {
  Badge,
  Button,
  Alert,
  AlertTitle,
  AlertDescription,
  EmptyState,
} from '@/components/sabcrm/20ui';

const CONTENT_DIR = path.join(process.cwd(), 'content/changelog');

type ChangelogEntry = {
  slug: string;
  version: string;
  date: string;
  title: string;
  description: string;
  tags: string[];
  content: string;
};

async function getChangelogs(): Promise<ChangelogEntry[]> {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));

  const entries = await Promise.all(files.map(async (filename) => {
    const slug = filename.replace(/\.mdx?$/, '');
    const fullPath = path.join(CONTENT_DIR, filename);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    return {
      slug,
      version: data.version || slug,
      date: data.date || '',
      title: data.title || '',
      description: data.description || '',
      tags: data.tags || [],
      content
    };
  }));

  // Sort by date descending
  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Map HTML tags to 20ui-token styled components for MDX
const mdxComponents = {
  h1: (props: any) => (
    <h1
      className="text-2xl font-bold mt-6 mb-4 text-[var(--st-text)]"
      {...props}
    />
  ),
  h2: (props: any) => (
    <h2
      className="text-xl font-bold mt-5 mb-3 text-[var(--st-text)] border-b border-[var(--st-border)] pb-2"
      {...props}
    />
  ),
  h3: (props: any) => (
    <h3
      className="text-lg font-semibold mt-4 mb-2 text-[var(--st-text)]"
      {...props}
    />
  ),
  p: (props: any) => (
    <p
      className="text-[var(--st-text-secondary)] mb-4 leading-relaxed text-sm"
      {...props}
    />
  ),
  ul: (props: any) => (
    <ul
      className="list-disc list-inside mb-4 text-[var(--st-text-secondary)] text-sm"
      {...props}
    />
  ),
  ol: (props: any) => (
    <ol
      className="list-decimal list-inside mb-4 text-[var(--st-text-secondary)] text-sm"
      {...props}
    />
  ),
  li: (props: any) => <li className="mb-1" {...props} />,
  a: (props: any) => (
    <a
      className="text-[var(--st-accent)] hover:underline text-sm"
      {...props}
    />
  ),
  blockquote: (props: any) => (
    <blockquote
      className="border-l-4 border-[var(--st-border-strong)] pl-4 italic my-4 text-[var(--st-text)] text-sm"
      {...props}
    />
  ),
  code: (props: any) => (
    <code
      className="bg-[var(--st-bg-muted)] text-[var(--st-text)] px-1.5 py-0.5 rounded-[var(--st-radius)] text-xs font-mono"
      {...props}
    />
  ),
  pre: (props: any) => (
    <pre
      className="bg-[var(--st-bg-secondary)] border border-[var(--st-border)] p-4 rounded-[var(--st-radius)] overflow-x-auto mb-4"
      {...props}
    />
  ),
  Badge,
  Button,
  Alert,
  AlertTitle,
  AlertDescription,
};

export default async function ChangelogPage({ searchParams }: { searchParams: Promise<{ tag?: string, page?: string }> }) {
  const { tag, page } = await searchParams;
  const allEntries = await getChangelogs();

  // Tag filtering
  const filteredEntries = tag
    ? allEntries.filter(entry => entry.tags.includes(tag))
    : allEntries;

  // Pagination
  const pageSize = 5;
  const currentPage = page ? parseInt(page, 10) : 1;
  const totalPages = Math.ceil(filteredEntries.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + pageSize);

  // Extract all unique tags
  const allTags = Array.from(new Set(allEntries.flatMap(e => e.tags))).sort();

  return (
    <div className="ui20 min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <LandingHeader active="resources" />
      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto border-x border-[var(--st-border)] min-h-[calc(100vh-64px)]">

        {/* Left Sidebar - Meta */}
        <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-[var(--st-border)] p-8 flex flex-col justify-start">
          <h1 className="text-3xl font-bold tracking-tighter mb-4 uppercase text-[var(--st-text)]">Changelog</h1>
          <p className="text-xs text-[var(--st-text-tertiary)] uppercase tracking-widest leading-relaxed mb-8">
            System updates<br/>
            Release notes<br/>
            API changes
          </p>

          <div className="mb-4">
            <h3 className="text-xs text-[var(--st-text)] uppercase tracking-widest mb-3 border-b border-[var(--st-border)] pb-2">Filter by tag</h3>
            <div className="flex flex-wrap gap-2">
              <Link href="/blog" aria-current={!tag ? 'page' : undefined}>
                <Badge tone={!tag ? 'accent' : 'neutral'} kind={!tag ? 'solid' : 'outline'}>
                  all
                </Badge>
              </Link>
              {allTags.map(t => (
                <Link key={t} href={`/blog?tag=${t}`} aria-current={tag === t ? 'page' : undefined}>
                  <Badge tone={tag === t ? 'accent' : 'neutral'} kind={tag === t ? 'solid' : 'outline'}>
                    {t}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content - Timeline */}
        <div className="flex-1">
          {paginatedEntries.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No entries found"
                description="No changelog entries match the selected filter. Try clearing the tag filter."
                action={
                  <Link href="/blog">
                    <Badge tone="accent" kind="solid">Clear filter</Badge>
                  </Link>
                }
              />
            </div>
          ) : paginatedEntries.map((entry) => (
            <div key={entry.slug} className="border-b border-[var(--st-border)] last:border-b-0">
              <div className="grid grid-cols-1 md:grid-cols-12">

                {/* Timeline Column */}
                <div className="md:col-span-3 border-b md:border-b-0 md:border-r border-[var(--st-border)] p-8 flex flex-col justify-start items-start md:items-end">
                   <Badge tone="accent" kind="solid" className="mb-2 font-semibold">
                     {entry.version}
                   </Badge>
                   <time className="text-[var(--st-text-secondary)] text-sm">{entry.date}</time>

                   <div className="mt-4 flex flex-wrap justify-start md:justify-end gap-1">
                     {entry.tags.map(t => (
                       <Badge key={t} tone="neutral" kind="outline" className="uppercase tracking-wider">
                         #{t}
                       </Badge>
                     ))}
                   </div>
                </div>

                {/* Content Column */}
                <div className="md:col-span-9 p-8">
                  <h2 className="text-2xl font-bold tracking-tight text-[var(--st-text)] mb-4">{entry.title}</h2>
                  <p className="text-[var(--st-text-secondary)] leading-relaxed mb-6 text-sm">
                    {entry.description}
                  </p>

                  <div className="mt-6">
                    <MDXRemote source={entry.content} components={mdxComponents} />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-8 flex items-center justify-between border-t border-[var(--st-border)]">
              {currentPage > 1 ? (
                <Link href={`/blog?page=${currentPage - 1}${tag ? `&tag=${tag}` : ''}`} aria-label="Newer entries">
                  <Button variant="outline" iconLeft={ChevronLeft} type="button">
                    Newer
                  </Button>
                </Link>
              ) : <div />}

              <span className="text-sm text-[var(--st-text-tertiary)]">Page {currentPage} of {totalPages}</span>

              {currentPage < totalPages ? (
                <Link href={`/blog?page=${currentPage + 1}${tag ? `&tag=${tag}` : ''}`} aria-label="Older entries">
                  <Button variant="outline" iconRight={ChevronRight} type="button">
                    Older
                  </Button>
                </Link>
              ) : <div />}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
