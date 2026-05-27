"use client";

import React, { useState, useRef } from 'react';
import { Box, Activity, Users, Zap, ShoppingCart, BarChart, ChevronRight, Filter, Play } from 'lucide-react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

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

// Sub-component for interactive demo / video placeholder
function ProductDemo({ product }: { product: any }) {
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
            <div className="demo-element msg-1 self-start bg-zoru-ink text-white px-3 py-2 rounded-lg max-w-[80%] text-xs opacity-0 translate-y-4">Hi, I need support.</div>
            <div className="demo-element msg-2 self-end bg-zoru-ink text-white px-3 py-2 rounded-lg max-w-[80%] text-xs opacity-0 translate-y-4">Sure, what seems to be the issue?</div>
            <div className="demo-element msg-3 self-start bg-zoru-ink text-white px-3 py-2 rounded-lg max-w-[80%] text-xs opacity-0 translate-y-4">My order hasn't arrived yet.</div>
          </div>
        );
      case 'automation':
        return (
          <div className="flex items-center justify-center h-full space-x-2 p-4 w-full">
            <div className="demo-element node-1 w-12 h-12 rounded-full bg-zoru-ink flex items-center justify-center text-xs font-bold opacity-0 scale-50 z-10">Trigger</div>
            <div className="demo-element line-1 w-8 h-1 bg-zoru-ink opacity-0 origin-left -ml-3 -mr-3"></div>
            <div className="demo-element node-2 w-12 h-12 rounded bg-zoru-ink flex items-center justify-center text-xs font-bold opacity-0 scale-50 z-10">Action</div>
            <div className="demo-element line-2 w-8 h-1 bg-zoru-ink opacity-0 origin-left -ml-3 -mr-3"></div>
            <div className="demo-element node-3 w-12 h-12 rounded-full bg-zoru-ink flex items-center justify-center text-xs font-bold opacity-0 scale-50 z-10">End</div>
          </div>
        );
      case 'crm':
        return (
          <div className="flex flex-col p-4 h-full justify-center space-y-4 w-full max-w-sm mx-auto">
            <div className="demo-element crm-header flex items-center space-x-3 opacity-0 -translate-x-5">
               <div className="w-12 h-12 rounded-full bg-zoru-ink border-2 border-white flex items-center justify-center font-bold text-lg">JD</div>
               <div>
                 <div className="text-sm font-bold text-white mb-1">Jane Doe</div>
                 <div className="text-xs text-zoru-ink-muted">jane@example.com</div>
               </div>
            </div>
            <div className="space-y-3 bg-zoru-ink p-3 rounded border border-zoru-line">
              <div className="demo-element crm-field flex justify-between opacity-0">
                 <span className="text-xs text-zoru-ink-muted">Lifecycle</span>
                 <span className="text-xs text-zoru-ink-muted font-bold bg-zoru-ink px-2 py-0.5 rounded">Lead</span>
              </div>
              <div className="demo-element crm-field flex justify-between opacity-0">
                 <span className="text-xs text-zoru-ink-muted">Tags</span>
                 <span className="text-xs text-zoru-ink-muted bg-zoru-ink px-2 py-0.5 rounded">Enterprise</span>
              </div>
            </div>
          </div>
        );
      case 'campaigns':
        return (
          <div className="flex flex-col p-4 h-full justify-center space-y-4 w-full max-w-sm mx-auto">
            <div className="demo-element camp-card bg-zoru-ink p-4 rounded border border-zoru-line opacity-0 scale-95">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold">Black Friday Promo</span>
                  <span className="text-xs bg-zoru-ink px-2 py-1 rounded">Sending</span>
                </div>
                <div className="flex justify-between text-xs text-zoru-ink-muted mb-2">
                  <span>12,450 / 15,000 sent</span>
                  <span>83%</span>
                </div>
                <div className="w-full h-2 bg-zoru-ink rounded-full overflow-hidden">
                  <div className="demo-element camp-bar h-full bg-zoru-ink w-0"></div>
                </div>
            </div>
          </div>
        );
      case 'commerce':
        return (
          <div className="flex flex-col p-4 h-full justify-center space-y-2 w-full max-w-sm mx-auto">
            <div className="bg-white text-black p-4 rounded font-sans relative overflow-hidden">
                <div className="text-center font-bold mb-4 border-b pb-2">RECEIPT</div>
                <div className="demo-element cart-item flex justify-between text-sm opacity-0 translate-y-2 mb-2">
                  <span>SAB-PRO (x1)</span><span>$99.00</span>
                </div>
                <div className="demo-element cart-item flex justify-between text-sm opacity-0 translate-y-2 mb-2">
                  <span>API-Overage</span><span>$10.00</span>
                </div>
                <div className="demo-element cart-total flex justify-between text-sm font-bold opacity-0 pt-2 border-t mt-2">
                  <span>TOTAL PAID</span><span>$109.00</span>
                </div>
                <div className="demo-element cart-stamp absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 text-zoru-ink font-black text-2xl tracking-widest border-4 border-zoru-line py-1 px-3 rotate-[-15deg] pointer-events-none bg-white/80">
                  PAID
                </div>
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="flex flex-col items-center justify-end p-4 h-full w-full max-w-sm mx-auto">
             <div className="flex items-end justify-between w-full h-32 border-b-2 border-l-2 border-zoru-line p-2 space-x-2">
                <div className="demo-element chart-bar w-full bg-zoru-ink opacity-0 h-0" data-h="40%"></div>
                <div className="demo-element chart-bar w-full bg-zoru-ink opacity-0 h-0" data-h="75%"></div>
                <div className="demo-element chart-bar w-full bg-zoru-ink opacity-0 h-0" data-h="55%"></div>
                <div className="demo-element chart-bar w-full bg-zoru-ink opacity-0 h-0" data-h="90%"></div>
                <div className="demo-element chart-bar w-full bg-zoru-ink opacity-0 h-0" data-h="65%"></div>
             </div>
          </div>
        );
      default:
        return (
           <div className="text-zoru-ink">Interactive demo not available.</div>
        );
    }
  };

  return (
    <div ref={containerRef} className="mt-8 border-2 border-black p-1 bg-black text-white rounded-none relative overflow-hidden group h-64 flex flex-col">
      <div className="flex items-center justify-between border-b border-white pb-2 mb-2 px-2 pt-2 z-20">
        <div className="flex space-x-2">
           <div className="w-3 h-3 bg-white rounded-full"></div>
           <div className="w-3 h-3 bg-white rounded-full"></div>
           <div className="w-3 h-3 bg-white rounded-full"></div>
        </div>
        <div className="text-xs font-bold tracking-widest uppercase">Interactive Demo</div>
      </div>
      
      <div className="flex-1 relative font-mono text-sm overflow-hidden flex items-center justify-center">
        
        {renderVisual()}

        {/* Play button overlay */}
        {!isPlaying && (
          <button 
            onClick={playDemo}
            className="absolute inset-0 m-auto w-16 h-16 bg-white text-black flex items-center justify-center hover:scale-110 transition-transform cursor-pointer border-2 border-black z-20"
            aria-label="Play Demo"
          >
            <Play className="w-8 h-8 ml-1" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function ProductsClient() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
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

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-81px)]" ref={containerRef}>
      {/* Navigation Sidebar */}
      <aside className="w-full lg:w-64 border-r border-black p-6 bg-white flex-shrink-0 lg:sticky top-[81px] lg:h-[calc(100vh-81px)] overflow-y-auto">
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase mb-4 tracking-widest border-b border-black pb-2 flex items-center">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </h2>
          
          <input 
            type="text" 
            placeholder="Search products..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border-2 border-black p-2 mb-6 text-sm font-bold outline-none focus:bg-black focus:text-white transition-colors"
          />

          <h3 className="text-xs font-bold uppercase mb-3 text-zoru-ink tracking-widest">Categories</h3>
          <div className="space-y-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`w-full text-left px-3 py-2 text-sm font-bold border-2 transition-colors uppercase tracking-wide ${activeCategory === category ? 'bg-black text-white border-black' : 'bg-white text-black border-transparent hover:border-black'}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <h2 className="text-sm font-bold uppercase mb-4 tracking-widest border-b border-black pb-2">Endpoints</h2>
        <nav className="space-y-1">
          {filteredProducts.map((p) => (
            <a key={p.id} href={`#${p.id}`} className="flex items-center justify-between text-sm hover:bg-black hover:text-white px-2 py-2 transition-colors border border-transparent hover:border-black group">
              <span className="font-bold">{p.name}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100" />
            </a>
          ))}
          {filteredProducts.length === 0 && (
            <div className="text-sm text-zoru-ink py-2">No endpoints found.</div>
          )}
        </nav>
      </aside>

      {/* Content Area */}
      <div className="flex-1 bg-white">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center h-full min-h-[500px]">
             <Box className="w-16 h-16 mb-4 opacity-20" />
             <h2 className="text-2xl font-bold uppercase tracking-widest">No Products Found</h2>
             <p className="mt-2 text-zoru-ink">Try adjusting your filters or search query.</p>
             <button 
               onClick={() => { setActiveCategory('All'); setSearchQuery(''); }}
               className="mt-6 border-2 border-black px-6 py-2 font-bold uppercase hover:bg-black hover:text-white transition-colors"
             >
               Clear Filters
             </button>
          </div>
        ) : (
          filteredProducts.map((product, idx) => (
            <div key={product.id} id={product.id} className={`product-card grid grid-cols-1 xl:grid-cols-2 ${idx !== 0 ? 'border-t border-black' : ''}`}>
              
              {/* Documentation Column (Left) */}
              <div className="p-8 xl:p-12 xl:border-r border-black bg-white flex flex-col justify-center">
                <div className="mb-6 flex items-center space-x-4">
                  <div className="p-3 border-2 border-black bg-white">
                    <product.icon className="w-6 h-6 text-black" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight uppercase">{product.name}</h2>
                </div>
                
                <div className="mb-4 inline-block bg-zoru-surface-2 px-3 py-1 text-xs font-bold uppercase tracking-widest border border-black self-start">
                  Category: {product.category}
                </div>

                <p className="text-black mb-10 text-lg leading-relaxed border-l-4 border-black pl-4">
                  {product.description}
                </p>

                <div className="mt-auto">
                  <h3 className="text-xs font-bold uppercase tracking-widest border-b border-black pb-2 mb-4">HTTP Request</h3>
                  <div className="flex items-center text-sm border-2 border-black">
                    <div className="bg-black text-white px-4 py-3 font-bold border-r-2 border-black uppercase w-24 text-center shrink-0">
                      {product.method}
                    </div>
                    <div className="px-4 py-3 text-black font-bold break-all w-full bg-white">
                      https://api.sabnode.com{product.endpoint}
                    </div>
                  </div>
                </div>

                {/* Interactive Demo */}
                <ProductDemo product={product} />

              </div>

              {/* Code Snippet Column (Right) */}
              <div className="p-8 xl:p-12 bg-black text-white flex flex-col justify-center">
                <h3 className="text-xs font-bold uppercase tracking-widest border-b border-white pb-2 mb-4 text-white">Example Response</h3>
                <div className="bg-black border-2 border-white p-6 overflow-x-auto relative group">
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-xs font-bold border border-white px-3 py-1 uppercase hover:bg-white hover:text-black transition-colors focus:outline-none">COPY</button>
                  </div>
                  <pre className="text-sm font-mono text-white whitespace-pre">
                    <code>{product.response}</code>
                  </pre>
                </div>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
}
