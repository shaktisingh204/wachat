import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { LandingHeader } from '@/components/landing/landing-header';
import Link from 'next/link';

const CONTENT_DIR = path.join(process.cwd(), 'content/changelog');

type ChangelogEntry = {
  slug: string;
  version: string;
  date: string;
  title: string;
  description: string;
  tags: string[];
  contentHtml: string;
};

async function getChangelogs(): Promise<ChangelogEntry[]> {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  
  const entries = await Promise.all(files.map(async (filename) => {
    const slug = filename.replace(/\.md$/, '');
    const fullPath = path.join(CONTENT_DIR, filename);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    
    // Convert markdown content to HTML
    const contentHtml = await marked.parse(content);
    
    return {
      slug,
      version: data.version || slug,
      date: data.date || '',
      title: data.title || '',
      description: data.description || '',
      tags: data.tags || [],
      contentHtml
    };
  }));
  
  // Sort by date descending
  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

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
                   <div className="inline-block bg-white text-black font-mono text-xs font-bold px-2 py-1 mb-2">
                     {entry.version}
                   </div>
                   <time className="font-mono text-neutral-400 text-sm">{entry.date}</time>
                   
                   <div className="mt-4 flex flex-wrap justify-start md:justify-end gap-1">
                     {entry.tags.map(t => (
                       <span key={t} className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider">#{t}</span>
                     ))}
                   </div>
                </div>

                {/* Content Column */}
                <div className="md:col-span-9 p-8">
                  <h2 className="text-2xl font-bold tracking-tight text-white mb-4">{entry.title}</h2>
                  <p className="text-neutral-400 text-base leading-relaxed mb-6 font-mono text-sm">
                    {entry.description}
                  </p>
                  
                  <div className="bg-neutral-900 border border-neutral-800 p-6 prose prose-invert prose-sm max-w-none prose-p:font-mono prose-li:font-mono prose-headings:font-sans"
                    dangerouslySetInnerHTML={{ __html: entry.contentHtml }}
                  />
                </div>
              </div>
            </div>
          ))}
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-8 flex items-center justify-between border-t border-neutral-800">
              {currentPage > 1 ? (
                <Link 
                  href={`/blog?page=${currentPage - 1}${tag ? `&tag=${tag}` : ''}`}
                  className="px-4 py-2 bg-neutral-900 border border-neutral-800 text-white font-mono text-sm hover:bg-neutral-800 transition-colors"
                >
                  &larr; Newer
                </Link>
              ) : <div />}
              
              <span className="font-mono text-sm text-neutral-500">Page {currentPage} of {totalPages}</span>
              
              {currentPage < totalPages ? (
                <Link 
                  href={`/blog?page=${currentPage + 1}${tag ? `&tag=${tag}` : ''}`}
                  className="px-4 py-2 bg-neutral-900 border border-neutral-800 text-white font-mono text-sm hover:bg-neutral-800 transition-colors"
                >
                  Older &rarr;
                </Link>
              ) : <div />}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
