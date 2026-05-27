import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { LandingHeader } from '@/components/landing/landing-header';
import Link from 'next/link';

// ZoruUI Components
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

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

// Map HTML tags to ZoruUI / Tailwind styled components for MDX
const mdxComponents = {
  h1: (props: any) => <h1 className="text-2xl font-bold mt-6 mb-4 text-white font-sans" {...props} />,
  h2: (props: any) => <h2 className="text-xl font-bold mt-5 mb-3 text-white font-sans border-b border-neutral-800 pb-2" {...props} />,
  h3: (props: any) => <h3 className="text-lg font-semibold mt-4 mb-2 text-white font-sans" {...props} />,
  p: (props: any) => <p className="text-neutral-400 mb-4 leading-relaxed font-mono text-sm" {...props} />,
  ul: (props: any) => <ul className="list-disc list-inside mb-4 text-neutral-400 font-mono text-sm" {...props} />,
  ol: (props: any) => <ol className="list-decimal list-inside mb-4 text-neutral-400 font-mono text-sm" {...props} />,
  li: (props: any) => <li className="mb-1" {...props} />,
  a: (props: any) => <a className="text-blue-400 hover:underline font-mono text-sm" {...props} />,
  blockquote: (props: any) => <blockquote className="border-l-4 border-neutral-700 pl-4 italic my-4 text-neutral-300 font-mono text-sm" {...props} />,
  code: (props: any) => <code className="bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />,
  pre: (props: any) => <pre className="bg-neutral-900 border border-neutral-800 p-4 rounded-md overflow-x-auto mb-4" {...props} />,
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
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      <LandingHeader active="resources" />
      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto border-x border-neutral-800 min-h-[calc(100vh-64px)]">
        
        {/* Left Sidebar - Meta */}
        <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-neutral-800 p-8 flex flex-col justify-start">
          <h1 className="text-3xl font-bold tracking-tighter mb-4 uppercase">Changelog</h1>
          <p className="font-mono text-xs text-neutral-500 uppercase tracking-widest leading-relaxed mb-8">
            System Updates<br/>
            Release Notes<br/>
            API Changes
          </p>
          
          <div className="mb-4">
            <h3 className="font-mono text-xs text-white uppercase tracking-widest mb-3 border-b border-neutral-800 pb-2">Filter by Tag</h3>
            <div className="flex flex-wrap gap-2">
              <Link 
                href="/blog" 
                className={`text-xs px-2 py-1 rounded font-mono ${!tag ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'}`}
              >
                all
              </Link>
              {allTags.map(t => (
                <Link 
                  key={t} 
                  href={`/blog?tag=${t}`} 
                  className={`text-xs px-2 py-1 rounded font-mono ${tag === t ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'}`}
                >
                  {t}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content - Timeline */}
        <div className="flex-1">
          {paginatedEntries.length === 0 ? (
            <div className="p-8 text-neutral-500 font-mono text-sm">No entries found for the selected filter.</div>
          ) : paginatedEntries.map((entry) => (
            <div key={entry.slug} className="border-b border-neutral-800 last:border-b-0">
              <div className="grid grid-cols-1 md:grid-cols-12">
                
                {/* Timeline Column */}
                <div className="md:col-span-3 border-b md:border-b-0 md:border-r border-neutral-800 p-8 flex flex-col justify-start items-start md:items-end">
                   <Badge variant="default" className="font-mono text-xs font-bold px-2 py-1 mb-2 rounded-sm bg-white text-black hover:bg-neutral-200">
                     {entry.version}
                   </Badge>
                   <time className="font-mono text-neutral-400 text-sm">{entry.date}</time>
                   
                   <div className="mt-4 flex flex-wrap justify-start md:justify-end gap-1">
                     {entry.tags.map(t => (
                       <Badge key={t} variant="secondary" className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider rounded bg-neutral-900 border-neutral-800 text-neutral-400">
                         #{t}
                       </Badge>
                     ))}
                   </div>
                </div>

                {/* Content Column */}
                <div className="md:col-span-9 p-8">
                  <h2 className="text-2xl font-bold tracking-tight text-white mb-4">{entry.title}</h2>
                  <p className="text-neutral-400 text-base leading-relaxed mb-6 font-mono text-sm">
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
            <div className="p-8 flex items-center justify-between border-t border-neutral-800">
              {currentPage > 1 ? (
                <Button variant="outline" className="font-mono text-sm" asChild>
                  <Link href={`/blog?page=${currentPage - 1}${tag ? `&tag=${tag}` : ''}`}>
                    &larr; Newer
                  </Link>
                </Button>
              ) : <div />}
              
              <span className="font-mono text-sm text-neutral-500">Page {currentPage} of {totalPages}</span>
              
              {currentPage < totalPages ? (
                <Button variant="outline" className="font-mono text-sm" asChild>
                  <Link href={`/blog?page=${currentPage + 1}${tag ? `&tag=${tag}` : ''}`}>
                    Older &rarr;
                  </Link>
                </Button>
              ) : <div />}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
