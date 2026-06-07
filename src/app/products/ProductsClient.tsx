"use client";

import React, { useState, useRef } from 'react';
import { Box, Activity, Users, Zap, ShoppingCart, BarChart, ChevronRight, Filter, Play, Copy } from 'lucide-react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  Button,
  IconButton,
  Field,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Badge,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  useToast,
} from '@/components/sabcrm/20ui';

gsap.registerPlugin(useGSAP);

const products = [
  {
    id: 'conversations',
    name: 'Conversations API',
    description: 'Unified messaging layer connecting multiple channels (SMS, WhatsApp, Email) into a single threaded interface.',
    method: 'GET',
    endpoint: '/v1/conversations',
    icon: Box,
    category: 'API',
    response: `{
  "data": {
    "id": "conv_123",
    "channel": "whatsapp",
    "status": "active",
    "messages": [
      {
        "id": "msg_001",
        "direction": "inbound",
        "text": "Hello, I need help."
      }
    ]
  }
}`
  },
  {
    id: 'automation',
    name: 'Automation Engine',
    description: 'Create visual workflows and execute complex business logic triggered by events across the platform.',
    method: 'POST',
    endpoint: '/v1/workflows/trigger',
    icon: Zap,
    category: 'Tools',
    response: `{
  "execution_id": "exec_abc890",
  "status": "running",
  "started_at": "2026-05-23T00:00:00Z",
  "steps_total": 5,
  "steps_completed": 1
}`
  },
  {
    id: 'crm',
    name: 'CRM Records',
    description: 'Maintain stateful profiles of contacts, tracking lifecycle stages, attributes, and interaction history.',
    method: 'GET',
    endpoint: '/v1/contacts/{id}',
    icon: Users,
    category: 'Data',
    response: `{
  "contact": {
    "id": "cnt_888",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "lifecycle": "lead",
    "tags": ["enterprise", "active"]
  }
}`
  },
  {
    id: 'campaigns',
    name: 'Campaigns Builder',
    description: 'Segment audiences and dispatch high-volume, personalized outbound messages across channels.',
    method: 'POST',
    endpoint: '/v1/campaigns/dispatch',
    icon: Activity,
    category: 'Tools',
    response: `{
  "batch_id": "batch_999",
  "audience_size": 15000,
  "status": "queued",
  "estimated_completion": "5m"
}`
  },
  {
    id: 'commerce',
    name: 'Commerce API',
    description: 'Process transactions, manage catalogs, and handle subscriptions seamlessly over chat interfaces.',
    method: 'POST',
    endpoint: '/v1/orders',
    icon: ShoppingCart,
    category: 'API',
    response: `{
  "order_id": "ord_555",
  "amount": 9900,
  "currency": "USD",
  "status": "paid",
  "items": [
    {
      "sku": "SAB-PRO",
      "quantity": 1
    }
  ]
}`
  },
  {
    id: 'analytics',
    name: 'Analytics API',
    description: 'Extract raw event streams and aggregated metrics for visualization and BI tool ingestion.',
    method: 'GET',
    endpoint: '/v1/metrics',
    icon: BarChart,
    category: 'Data',
    response: `{
  "period": "24h",
  "metrics": {
    "messages_sent": 125000,
    "delivery_rate": 0.998,
    "active_workflows": 45
  }
}`
  }
];

const categories = ['All', 'API', 'Tools', 'Data'];

type Product = (typeof products)[number];

// Sub-component for interactive demo / video placeholder
function ProductDemo({ product }: { product: Product }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const { contextSafe } = useGSAP({ scope: containerRef });

  const playDemo = contextSafe(() => {
    if (isPlaying) return;
    setIsPlaying(true);

    const tl = gsap.timeline({
      onComplete: () => setIsPlaying(false)
    });

    if (product.id === 'conversations') {
      tl.fromTo('.msg-1', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4 })
        .fromTo('.msg-2', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4 }, "+=0.3")
        .fromTo('.msg-3', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4 }, "+=0.3");
    } else if (product.id === 'automation') {
      tl.fromTo('.node-1', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' })
        .fromTo('.line-1', { opacity: 0, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: 0.3 })
        .fromTo('.node-2', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' })
        .fromTo('.line-2', { opacity: 0, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: 0.3 })
        .fromTo('.node-3', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' });
    } else if (product.id === 'crm') {
      tl.fromTo('.crm-header', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4 })
        .fromTo('.crm-field', { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.15 });
    } else if (product.id === 'campaigns') {
      tl.fromTo('.camp-card', { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' })
        .fromTo('.camp-bar', { width: '0%' }, { width: '83%', duration: 1.5, ease: 'power2.out' }, "+=0.2");
    } else if (product.id === 'commerce') {
      tl.fromTo('.cart-item', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.2 })
        .fromTo('.cart-total', { opacity: 0 }, { opacity: 1, duration: 0.4 })
        .fromTo('.cart-stamp', { opacity: 0, scale: 1.5, rotation: 0 }, { opacity: 1, scale: 1, rotation: -5, duration: 0.4, ease: 'back.out(2)' }, "+=0.2");
    } else if (product.id === 'analytics') {
      tl.fromTo('.chart-bar',
        { opacity: 0, height: 0 },
        {
          opacity: 1,
          height: (i, el) => el.getAttribute('data-h') || '0%',
          duration: 0.6,
          stagger: 0.1,
          ease: 'power2.out'
        }
      );
    }
  });

  const renderVisual = () => {
    switch (product.id) {
      case 'conversations':
        return (
          <div className="flex flex-col space-y-2 p-4 h-full justify-center w-full">
            <div className="demo-element msg-1 self-start bg-[var(--st-bg-secondary)] text-[var(--st-text)] px-3 py-2 rounded-[var(--st-radius)] max-w-[80%] text-xs opacity-0 translate-y-4">Hi, I need support.</div>
            <div className="demo-element msg-2 self-end bg-[var(--st-accent)] text-[var(--st-text-inverted)] px-3 py-2 rounded-[var(--st-radius)] max-w-[80%] text-xs opacity-0 translate-y-4">Sure, what seems to be the issue?</div>
            <div className="demo-element msg-3 self-start bg-[var(--st-bg-secondary)] text-[var(--st-text)] px-3 py-2 rounded-[var(--st-radius)] max-w-[80%] text-xs opacity-0 translate-y-4">My order has not arrived yet.</div>
          </div>
        );
      case 'automation':
        return (
          <div className="flex items-center justify-center h-full space-x-2 p-4 w-full">
            <div className="demo-element node-1 w-12 h-12 rounded-full bg-[var(--st-accent)] text-[var(--st-text-inverted)] flex items-center justify-center text-xs font-bold opacity-0 scale-50 z-10">Trigger</div>
            <div className="demo-element line-1 w-8 h-1 bg-[var(--st-border)] opacity-0 origin-left -ml-3 -mr-3"></div>
            <div className="demo-element node-2 w-12 h-12 rounded-[var(--st-radius)] bg-[var(--st-status-ok)] text-[var(--st-text-inverted)] flex items-center justify-center text-xs font-bold opacity-0 scale-50 z-10">Action</div>
            <div className="demo-element line-2 w-8 h-1 bg-[var(--st-border)] opacity-0 origin-left -ml-3 -mr-3"></div>
            <div className="demo-element node-3 w-12 h-12 rounded-full bg-[var(--st-text)] text-[var(--st-bg)] flex items-center justify-center text-xs font-bold opacity-0 scale-50 z-10">End</div>
          </div>
        );
      case 'crm':
        return (
          <div className="flex flex-col p-4 h-full justify-center space-y-4 w-full max-w-sm mx-auto">
            <div className="demo-element crm-header flex items-center space-x-3 opacity-0 -translate-x-5">
               <div className="w-12 h-12 rounded-full bg-[var(--st-accent)] text-[var(--st-text-inverted)] flex items-center justify-center font-bold text-lg">JD</div>
               <div>
                 <div className="text-sm font-bold text-[var(--st-text)] mb-1">Jane Doe</div>
                 <div className="text-xs text-[var(--st-text-secondary)]">jane@example.com</div>
               </div>
            </div>
            <div className="space-y-3 bg-[var(--st-bg-secondary)] p-3 rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <div className="demo-element crm-field flex justify-between opacity-0">
                 <span className="text-xs text-[var(--st-text-secondary)]">Lifecycle</span>
                 <Badge tone="success" kind="soft">Lead</Badge>
              </div>
              <div className="demo-element crm-field flex justify-between opacity-0">
                 <span className="text-xs text-[var(--st-text-secondary)]">Tags</span>
                 <Badge tone="info" kind="soft">Enterprise</Badge>
              </div>
            </div>
          </div>
        );
      case 'campaigns':
        return (
          <div className="flex flex-col p-4 h-full justify-center space-y-4 w-full max-w-sm mx-auto">
            <div className="demo-element camp-card bg-[var(--st-bg-secondary)] p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] opacity-0 scale-95">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-[var(--st-text)]">Black Friday Promo</span>
                  <Badge tone="accent" kind="soft">Sending</Badge>
                </div>
                <div className="flex justify-between text-xs text-[var(--st-text-secondary)] mb-2">
                  <span>12,450 / 15,000 sent</span>
                  <span>83%</span>
                </div>
                <div className="w-full h-2 bg-[var(--st-bg)] rounded-full overflow-hidden border border-[var(--st-border)]">
                  <div className="demo-element camp-bar h-full bg-[var(--st-accent)] w-0"></div>
                </div>
            </div>
          </div>
        );
      case 'commerce':
        return (
          <div className="flex flex-col p-4 h-full justify-center space-y-2 w-full max-w-sm mx-auto">
            <div className="bg-[var(--st-bg)] text-[var(--st-text)] p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] relative overflow-hidden">
                <div className="text-center font-bold mb-4 border-b border-[var(--st-border)] pb-2">Receipt</div>
                <div className="demo-element cart-item flex justify-between text-sm opacity-0 translate-y-2 mb-2">
                  <span>SAB-PRO (x1)</span><span>$99.00</span>
                </div>
                <div className="demo-element cart-item flex justify-between text-sm opacity-0 translate-y-2 mb-2">
                  <span>API-Overage</span><span>$10.00</span>
                </div>
                <div className="demo-element cart-total flex justify-between text-sm font-bold opacity-0 pt-2 border-t border-[var(--st-border)] mt-2">
                  <span>Total Paid</span><span>$109.00</span>
                </div>
                <div className="demo-element cart-stamp absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 text-[var(--st-status-ok)] font-black text-2xl tracking-widest border-4 border-[var(--st-status-ok)] py-1 px-3 rotate-[-15deg] pointer-events-none">
                  PAID
                </div>
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="flex flex-col items-center justify-end p-4 h-full w-full max-w-sm mx-auto">
             <div className="flex items-end justify-between w-full h-32 border-b-2 border-l-2 border-[var(--st-border)] p-2 space-x-2">
                <div className="demo-element chart-bar w-full bg-[var(--st-accent)] opacity-0 h-0" data-h="40%"></div>
                <div className="demo-element chart-bar w-full bg-[var(--st-accent)] opacity-0 h-0" data-h="75%"></div>
                <div className="demo-element chart-bar w-full bg-[var(--st-accent)] opacity-0 h-0" data-h="55%"></div>
                <div className="demo-element chart-bar w-full bg-[var(--st-accent)] opacity-0 h-0" data-h="90%"></div>
                <div className="demo-element chart-bar w-full bg-[var(--st-accent)] opacity-0 h-0" data-h="65%"></div>
             </div>
          </div>
        );
      default:
        return (
           <div className="text-[var(--st-text-tertiary)]">Interactive demo not available.</div>
        );
    }
  };

  return (
    <div ref={containerRef} className="mt-8 border border-[var(--st-border)] p-1 bg-[var(--st-bg-secondary)] text-[var(--st-text)] rounded-[var(--st-radius)] relative overflow-hidden group h-64 flex flex-col">
      <div className="flex items-center justify-between border-b border-[var(--st-border)] pb-2 mb-2 px-2 pt-2 z-20">
        <div className="flex space-x-2">
           <div className="w-3 h-3 bg-[var(--st-text-tertiary)] rounded-full"></div>
           <div className="w-3 h-3 bg-[var(--st-text-tertiary)] rounded-full"></div>
           <div className="w-3 h-3 bg-[var(--st-text-tertiary)] rounded-full"></div>
        </div>
        <div className="text-xs font-bold tracking-widest uppercase text-[var(--st-text-secondary)]">Interactive Demo</div>
      </div>

      <div className="flex-1 relative font-mono text-sm overflow-hidden flex items-center justify-center">

        {renderVisual()}

        {/* Play button overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 m-auto w-16 h-16 z-20">
            <IconButton
              label="Play demo"
              icon={Play}
              variant="primary"
              size="lg"
              onClick={playDemo}
              className="w-16 h-16 rounded-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductsClient() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const containerRef = useRef<HTMLDivElement>(null);

  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  useGSAP(() => {
    gsap.fromTo('.product-card',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, stagger: 0.1, duration: 0.4, ease: 'power2.out', clearProps: "all" }
    );
  }, { scope: containerRef, dependencies: [activeCategory, searchQuery] });

  const copyResponse = (product: Product) => {
    void navigator.clipboard
      .writeText(product.response)
      .then(() => toast.success(`Copied ${product.name} response`))
      .catch(() => toast.error('Could not copy to clipboard'));
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-81px)] bg-[var(--st-bg)]" ref={containerRef}>
      {/* Navigation Sidebar */}
      <aside className="w-full lg:w-72 border-r border-[var(--st-border)] p-6 bg-[var(--st-bg)] flex-shrink-0 lg:sticky top-[81px] lg:h-[calc(100vh-81px)] overflow-y-auto">
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase mb-4 tracking-widest border-b border-[var(--st-border)] pb-2 flex items-center text-[var(--st-text)]">
            <Filter className="w-4 h-4 mr-2" aria-hidden="true" />
            Filters
          </h2>

          <div className="mb-6">
            <Field label="Search products">
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </Field>
          </div>

          <h3 className="text-xs font-bold uppercase mb-3 text-[var(--st-text-secondary)] tracking-widest">Categories</h3>
          <div className="space-y-2">
            {categories.map(category => (
              <Button
                key={category}
                onClick={() => setActiveCategory(category)}
                variant={activeCategory === category ? 'primary' : 'ghost'}
                size="sm"
                block
                className="justify-start"
                aria-pressed={activeCategory === category}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        <h2 className="text-sm font-bold uppercase mb-4 tracking-widest border-b border-[var(--st-border)] pb-2 text-[var(--st-text)]">Endpoints</h2>
        <nav className="space-y-1">
          {filteredProducts.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className="flex items-center justify-between text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] px-2 py-2 transition-colors rounded-[var(--st-radius)] border border-transparent hover:border-[var(--st-border)] group"
            >
              <span className="font-semibold">{p.name}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100" aria-hidden="true" />
            </a>
          ))}
          {filteredProducts.length === 0 && (
            <div className="text-sm text-[var(--st-text-tertiary)] py-2">No endpoints found.</div>
          )}
        </nav>
      </aside>

      {/* Content Area */}
      <div className="flex-1 bg-[var(--st-bg)]">
        {filteredProducts.length === 0 ? (
          <div className="p-12 flex items-center justify-center h-full min-h-[500px]">
            <EmptyState
              icon={Box}
              title="No products found"
              description="Try adjusting your filters or search query."
              action={
                <Button
                  variant="primary"
                  onClick={() => { setActiveCategory('All'); setSearchQuery(''); }}
                >
                  Clear filters
                </Button>
              }
            />
          </div>
        ) : (
          filteredProducts.map((product, idx) => (
            <div key={product.id} id={product.id} className={`product-card grid grid-cols-1 xl:grid-cols-2 ${idx !== 0 ? 'border-t border-[var(--st-border)]' : ''}`}>

              {/* Documentation Column (Left) */}
              <div className="p-8 xl:p-12 xl:border-r border-[var(--st-border)] bg-[var(--st-bg)] flex flex-col justify-center">
                <PageHeader bordered={false} className="mb-6">
                  <PageHeaderHeading>
                    <div className="flex items-center gap-4">
                      <span className="p-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] inline-flex">
                        <product.icon className="w-6 h-6 text-[var(--st-text)]" aria-hidden="true" />
                      </span>
                      <PageTitle className="!mb-0">{product.name}</PageTitle>
                    </div>
                    <PageDescription className="mt-4 text-[var(--st-text-secondary)]">
                      {product.description}
                    </PageDescription>
                  </PageHeaderHeading>
                </PageHeader>

                <div className="mb-8">
                  <Badge tone="neutral" kind="outline">Category: {product.category}</Badge>
                </div>

                <div className="mt-auto">
                  <h3 className="text-xs font-bold uppercase tracking-widest border-b border-[var(--st-border)] pb-2 mb-4 text-[var(--st-text)]">HTTP Request</h3>
                  <div className="flex items-stretch text-sm border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden">
                    <div className="bg-[var(--st-accent)] text-[var(--st-text-inverted)] px-4 py-3 font-bold uppercase w-24 text-center shrink-0">
                      {product.method}
                    </div>
                    <div className="px-4 py-3 text-[var(--st-text)] font-semibold break-all w-full bg-[var(--st-bg-secondary)]">
                      https://api.sabnode.com{product.endpoint}
                    </div>
                  </div>
                </div>

                {/* Interactive Demo */}
                <ProductDemo product={product} />

              </div>

              {/* Code Snippet Column (Right) */}
              <div className="p-8 xl:p-12 bg-[var(--st-bg-secondary)] flex flex-col justify-center">
                <Card variant="outlined" padding="none" className="overflow-hidden">
                  <CardHeader className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest">Example Response</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={Copy}
                      onClick={() => copyResponse(product)}
                    >
                      Copy
                    </Button>
                  </CardHeader>
                  <CardBody className="overflow-x-auto">
                    <pre className="text-sm font-mono text-[var(--st-text)] whitespace-pre">
                      <code>{product.response}</code>
                    </pre>
                  </CardBody>
                </Card>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
}
