"use client";

import React, { useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, Mail, ArrowRight, Play, FileText, BookOpen, Clock, Calendar, FolderOpen } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import ScrollTrigger from 'gsap/ScrollTrigger';

import {
  Button,
  Card,
  CardBody,
  Badge,
  Field,
  Input,
  EmptyState,
  Pagination,
  SegmentedControl,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  useToast,
  type SegmentedItem,
} from '@/components/sabcrm/20ui';

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
  { id: 11, title: 'Data Sovereignty and Compliance', category: 'Whitepaper', image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80', date: 'Apr 10, 2026', readTime: '25 min' },
  { id: 12, title: 'Building Plugins for SabNode', category: 'Video', image: 'https://images.unsplash.com/photo-1505685296765-3a2736de412f?auto=format&fit=crop&w=800&q=80', date: 'Apr 05, 2026', readTime: '30 min' },
];

const CATEGORY_ITEMS: SegmentedItem[] = [
  { value: 'All', label: 'All' },
  { value: 'Blog', label: 'Blog', icon: FileText },
  { value: 'Whitepaper', label: 'Whitepaper', icon: BookOpen },
  { value: 'Guide', label: 'Guide', icon: Search },
  { value: 'Video', label: 'Video', icon: Play },
];

const ITEMS_PER_PAGE = 6;

const CategoryIcon = ({ category }: { category: string }) => {
  switch (category) {
    case 'Blog': return <FileText className="w-3.5 h-3.5" aria-hidden="true" />;
    case 'Whitepaper': return <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />;
    case 'Guide': return <Search className="w-3.5 h-3.5" aria-hidden="true" />;
    case 'Video': return <Play className="w-3.5 h-3.5" aria-hidden="true" />;
    default: return <FileText className="w-3.5 h-3.5" aria-hidden="true" />;
  }
};

export default function ResourcesClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [email, setEmail] = useState('');

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

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Enter a valid email address.');
      return;
    }
    toast.success('You are subscribed. Watch your inbox for updates.');
    setEmail('');
  };

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
    <div ref={containerRef} className="20ui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      {/* Hero Section */}
      <section className="py-16 px-6 border-b border-[var(--st-border)]">
        <PageHeader bordered={false} className="header-elem max-w-4xl mx-auto !block text-center">
          <PageHeaderHeading className="items-center">
            <PageEyebrow>Resource Hub</PageEyebrow>
            <PageTitle>Learn, build, and scale with SabNode</PageTitle>
            <PageDescription className="mx-auto">
              Explore our collection of blogs, whitepapers, guides, and videos to help you scale your CRM data and architecture.
            </PageDescription>
          </PageHeaderHeading>
        </PageHeader>

        <div className="header-elem max-w-xl mx-auto mt-8">
          <Field label="Search resources" className="text-left">
            <Input
              type="text"
              placeholder="Search by title, e.g. API Integration"
              value={searchQuery}
              onChange={handleSearch}
              iconLeft={Search}
              inputSize="lg"
            />
          </Field>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Filters */}
          <div className="header-elem flex flex-wrap items-center gap-4 mb-10">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--st-text-secondary)]">
              Filter
            </span>
            <SegmentedControl
              items={CATEGORY_ITEMS}
              value={activeCategory}
              onChange={handleCategory}
              aria-label="Filter resources by category"
            />
          </div>

          {/* Grid */}
          {currentResources.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {currentResources.map(resource => (
                <Card
                  key={resource.id}
                  variant="interactive"
                  padding="none"
                  className="resource-card group flex flex-col h-full overflow-hidden"
                >
                  <div className="relative h-48 w-full overflow-hidden bg-[var(--st-bg-secondary)] border-b border-[var(--st-border)]">
                    <Image
                      src={resource.image}
                      alt={resource.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge tone="accent" kind="solid">
                        <CategoryIcon category={resource.category} />
                        {resource.category}
                      </Badge>
                    </div>
                  </div>

                  <CardBody className="flex flex-col flex-1">
                    <div className="flex items-center gap-4 text-xs font-medium text-[var(--st-text-secondary)] mb-3">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> {resource.date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {resource.readTime}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold leading-snug mb-4 line-clamp-2 text-[var(--st-text)] transition-colors group-hover:text-[var(--st-accent)]">
                      {resource.title}
                    </h3>

                    <div className="mt-auto pt-4 border-t border-[var(--st-border)]">
                      <Link href="#" tabIndex={-1}>
                        <Button variant="ghost" size="sm" iconRight={ArrowRight}>
                          Read more
                        </Button>
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : (
            <div className="py-12">
              <EmptyState
                icon={FolderOpen}
                title="No resources found"
                description="Try adjusting your search or category filters."
                action={
                  <Button
                    variant="primary"
                    onClick={() => { setSearchQuery(''); setActiveCategory('All'); setCurrentPage(1); }}
                  >
                    Clear filters
                  </Button>
                }
              />
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="header-elem flex items-center justify-center mb-20">
              <Pagination
                page={currentPage}
                pageCount={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="newsletter-section py-16 px-6 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <Card variant="elevated" padding="lg" className="max-w-4xl mx-auto">
          <CardBody className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-semibold tracking-tight mb-3 flex items-center justify-center md:justify-start gap-3 text-[var(--st-text)]">
                <Mail className="w-7 h-7 text-[var(--st-accent)]" aria-hidden="true" /> Stay updated
              </h2>
              <p className="text-[var(--st-text-secondary)] text-base">
                Get the latest SabNode architectural updates, whitepapers, and guides delivered straight to your inbox.
              </p>
            </div>
            <div className="flex-1 w-full">
              <form className="flex flex-col gap-4" onSubmit={handleSubscribe}>
                <Field label="Work email">
                  <Input
                    type="email"
                    placeholder="developer@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    iconLeft={Mail}
                    required
                  />
                </Field>
                <Button type="submit" variant="primary" block iconRight={ArrowRight}>
                  Subscribe
                </Button>
              </form>
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
