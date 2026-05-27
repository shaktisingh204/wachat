"use client";

import React, { useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight, Mail, ArrowRight, Play, FileText, BookOpen, Clock, Calendar } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import ScrollTrigger from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

const RESOURCES = [
  { id: 1, title: 'Understanding SabNode Architecture', category: 'Blog', image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80', date: 'May 20, 2026', readTime: '5 min' },
  { id: 2, title: 'Scaling CRM Data in 2026', category: 'Whitepaper', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80', date: 'May 18, 2026', readTime: '15 min' },
  { id: 3, title: 'Getting Started with API Integration', category: 'Guide', image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80', date: 'May 15, 2026', readTime: '10 min' },
  { id: 4, title: 'Future of Automation', category: 'Video', image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80', date: 'May 10, 2026', readTime: '12 min' },
  { id: 5, title: 'Optimizing Query Performance', category: 'Blog', image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80', date: 'May 08, 2026', readTime: '7 min' },
  { id: 6, title: 'Security Best Practices for Enterprises', category: 'Whitepaper', image: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=800&q=80', date: 'May 05, 2026', readTime: '20 min' },
  { id: 7, title: 'Designing Intuitive UIs', category: 'Guide', image: 'https://images.unsplash.com/photo-1507238692062-5a04ec028aaa?auto=format&fit=crop&w=800&q=80', date: 'May 01, 2026', readTime: '8 min' },
  { id: 8, title: 'SabNode Community Townhall', category: 'Video', image: 'https://images.unsplash.com/photo-1591115765373-5207764f72e7?auto=format&fit=crop&w=800&q=80', date: 'Apr 28, 2026', readTime: '45 min' },
  { id: 9, title: 'Advanced Analytics Patterns', category: 'Blog', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80', date: 'Apr 20, 2026', readTime: '6 min' },
  { id: 10, title: 'Migration from Legacy CRMs', category: 'Guide', image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80', date: 'Apr 15, 2026', readTime: '12 min' },
  { id: 11, title: 'Data Sovereignty & Compliance', category: 'Whitepaper', image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80', date: 'Apr 10, 2026', readTime: '25 min' },
  { id: 12, title: 'Building Plugins for SabNode', category: 'Video', image: 'https://images.unsplash.com/photo-1505685296765-3a2736de412f?auto=format&fit=crop&w=800&q=80', date: 'Apr 05, 2026', readTime: '30 min' },
];

const CATEGORIES = ['All', 'Blog', 'Whitepaper', 'Guide', 'Video'];
const ITEMS_PER_PAGE = 6;

const CategoryIcon = ({ category }: { category: string }) => {
  switch (category) {
    case 'Blog': return <FileText className="w-4 h-4" />;
    case 'Whitepaper': return <BookOpen className="w-4 h-4" />;
    case 'Guide': return <Search className="w-4 h-4" />;
    case 'Video': return <Play className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
};

export default function ResourcesClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page to 1 when filters change
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleCategory = (cat: string) => {
    setActiveCategory(cat);
    setCurrentPage(1);
  };

  const filteredResources = useMemo(() => {
    return RESOURCES.filter((res) => {
      const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || res.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  const totalPages = Math.ceil(filteredResources.length / ITEMS_PER_PAGE);
  const currentResources = filteredResources.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useGSAP(() => {
    // Animate header and filters
    gsap.from('.header-elem', {
      y: 30,
      opacity: 0,
      duration: 0.8,
      stagger: 0.1,
      ease: 'power3.out',
    });

    // Animate newsletter section
    gsap.from('.newsletter-section', {
      scrollTrigger: {
        trigger: '.newsletter-section',
        start: 'top 85%',
      },
      y: 50,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
    });

  }, { scope: containerRef });

  // Separate useGSAP for resources grid so it animates when page/filters change
  useGSAP(() => {
    if (currentResources.length > 0) {
      gsap.fromTo('.resource-card', 
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: 'power2.out',
          overwrite: true
        }
      );
    }
  }, { scope: containerRef, dependencies: [currentResources, currentPage] });

  return (
    <div ref={containerRef} className="min-h-screen bg-zinc-50 text-black font-mono">
      {/* Hero Section */}
      <section className="bg-black text-white py-20 px-6 border-b-8 border-white">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="header-elem text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6">
            Resource Hub
          </h1>
          <p className="header-elem text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">
            Explore our collection of blogs, whitepapers, guides, and videos to help you scale your CRM data and architecture.
          </p>
          
          <div className="header-elem max-w-xl mx-auto relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-white transition-colors" />
            <input 
              type="text" 
              placeholder="Search resources..." 
              value={searchQuery}
              onChange={handleSearch}
              className="w-full bg-zinc-900 border-2 border-zinc-700 text-white px-12 py-4 focus:outline-none focus:border-white transition-colors rounded-none placeholder:text-zinc-500 font-bold"
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-12 header-elem">
            <span className="font-bold uppercase text-sm tracking-widest mr-4 text-zinc-500">Filters:</span>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategory(cat)}
                className={`px-4 py-2 text-sm font-bold uppercase transition-all border-2 ${
                  activeCategory === cat 
                    ? 'bg-black text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' 
                    : 'bg-white text-black border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          {currentResources.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {currentResources.map(resource => (
                <div 
                  key={resource.id} 
                  className="resource-card group bg-white border-2 border-black hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 flex flex-col h-full overflow-hidden"
                >
                  <div className="relative h-48 w-full border-b-2 border-black overflow-hidden bg-zinc-200">
                    <Image
                      src={resource.image}
                      alt={resource.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute top-4 left-4 bg-black text-white px-3 py-1 text-xs font-bold uppercase flex items-center gap-2">
                      <CategoryIcon category={resource.category} />
                      {resource.category}
                    </div>
                  </div>
                  
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-4 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {resource.date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {resource.readTime}</span>
                    </div>
                    <h3 className="text-xl font-black uppercase leading-tight mb-4 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {resource.title}
                    </h3>
                    
                    <div className="mt-auto pt-4 flex items-center justify-between border-t-2 border-dashed border-zinc-200">
                      <Link href="#" className="text-sm font-bold uppercase hover:underline flex items-center gap-2">
                        Read More <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center border-2 border-dashed border-zinc-300 bg-white">
              <p className="text-xl font-bold uppercase text-zinc-500 mb-2">No resources found</p>
              <p className="text-zinc-400">Try adjusting your search or category filters.</p>
              <button 
                onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
                className="mt-6 px-6 py-2 bg-black text-white font-bold uppercase text-sm"
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mb-20 header-elem">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-3 border-2 border-black bg-white hover:bg-black hover:text-white disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-black transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 flex items-center justify-center font-bold border-2 transition-all ${
                      currentPage === i + 1
                        ? 'bg-black text-white border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-white text-black border-black hover:bg-zinc-100'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-3 border-2 border-black bg-white hover:bg-black hover:text-white disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-black transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="newsletter-section bg-black text-white py-20 px-6 border-t-8 border-white border-b-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-4xl font-black uppercase tracking-tight mb-4 flex items-center justify-center md:justify-start gap-3">
              <Mail className="w-10 h-10" /> Stay Updated
            </h2>
            <p className="text-zinc-400 text-lg">
              Get the latest SabNode architectural updates, whitepapers, and guides delivered straight to your inbox.
            </p>
          </div>
          <div className="flex-1 w-full">
            <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="developer@company.com" 
                required
                className="w-full bg-zinc-900 border-2 border-zinc-700 text-white px-6 py-4 focus:outline-none focus:border-white transition-colors rounded-none placeholder:text-zinc-500 font-bold"
              />
              <button 
                type="submit"
                className="w-full bg-white text-black font-black uppercase tracking-widest px-6 py-4 hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
              >
                Subscribe <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
