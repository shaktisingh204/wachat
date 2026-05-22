import type { Metadata } from 'next';
import { Box, Activity, Users, Zap, ShoppingCart, BarChart, ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Products | SabNode',
  description: 'Explore the SabNode product suite for conversations, automation, CRM, campaigns, commerce, and analytics.',
};

const products = [
  {
    id: 'conversations',
    name: 'Conversations API',
    description: 'Unified messaging layer connecting multiple channels (SMS, WhatsApp, Email) into a single threaded interface.',
    method: 'GET',
    endpoint: '/v1/conversations',
    icon: Box,
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

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-white text-black font-mono selection:bg-black selection:text-white">
      {/* Header */}
      <header className="border-b border-black p-6 flex justify-between items-center bg-white sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-black flex items-center justify-center">
             <div className="w-4 h-4 bg-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase">SabNode Products</h1>
        </div>
        <div className="flex items-center space-x-4">
           <a href="/" className="text-sm font-bold uppercase hover:underline">Back to Home</a>
           <div className="text-sm border border-black px-3 py-1 bg-black text-white font-bold">
             v2.0.0
           </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-81px)]">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 border-r border-black p-6 bg-white hidden lg:block overflow-y-auto sticky top-[81px] h-[calc(100vh-81px)]">
          <h2 className="text-sm font-bold uppercase mb-4 tracking-widest border-b border-black pb-2">Endpoints</h2>
          <nav className="space-y-1">
            {products.map((p) => (
              <a key={p.id} href={`#${p.id}`} className="flex items-center justify-between text-sm hover:bg-black hover:text-white px-2 py-2 transition-colors border border-transparent hover:border-black group">
                <span className="font-bold">{p.name}</span>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100" />
              </a>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <div className="flex-1 bg-white">
          {products.map((product, idx) => (
            <div key={product.id} id={product.id} className={`grid grid-cols-1 xl:grid-cols-2 ${idx !== 0 ? 'border-t border-black' : ''}`}>
              
              {/* Documentation Column (Left) */}
              <div className="p-8 xl:p-12 xl:border-r border-black bg-white flex flex-col justify-center">
                <div className="mb-6 flex items-center space-x-4">
                  <div className="p-3 border-2 border-black bg-white">
                    <product.icon className="w-6 h-6 text-black" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight uppercase">{product.name}</h2>
                </div>
                
                <p className="text-black mb-10 text-lg leading-relaxed border-l-4 border-black pl-4">
                  {product.description}
                </p>

                <div className="mt-auto">
                  <h3 className="text-xs font-bold uppercase tracking-widest border-b border-black pb-2 mb-4">HTTP Request</h3>
                  <div className="flex items-center text-sm border-2 border-black">
                    <div className="bg-black text-white px-4 py-3 font-bold border-r-2 border-black uppercase w-24 text-center">
                      {product.method}
                    </div>
                    <div className="px-4 py-3 text-black font-bold break-all w-full bg-white">
                      https://api.sabnode.com{product.endpoint}
                    </div>
                  </div>
                </div>
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
          ))}
        </div>
      </div>
    </main>
  );
}
