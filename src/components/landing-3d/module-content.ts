/**
 * Per-module copy + mock preview data used by the 12 ModuleSections.
 * Keyed by the `id` of each entry in the MODULES array in Scene.tsx so the
 * grid, the constellation and the detail sections all stay in sync.
 */

export type ModuleContent = {
  tagline: string;
  description: string;
  bullets: string[];
  status: string;
  metric: { value: string; label: string };
  rows: { label: string; sub: string; right: string }[];
};

export const MODULE_CONTENT: Record<string, ModuleContent> = {
  inbox: {
    tagline: 'Every conversation, unified.',
    description:
      'WhatsApp, Instagram, Messenger and email — all in one living timeline, sorted by priority and routed to the right teammate automatically.',
    bullets: [
      'Single timeline across every channel',
      'Smart routing to the right team',
      'Canned replies and quick actions',
      'AI-suggested next responses',
    ],
    status: '12 channels live',
    metric: { value: '1.2k', label: 'threads' },
    rows: [
      { label: 'Priya Sharma',  sub: 'Can you confirm my order?',     right: '2m'  },
      { label: 'Rohan Kumar',   sub: 'Bulk quote request',            right: '8m'  },
      { label: 'Ananya Patel',  sub: 'Thanks for the quick reply!',   right: '15m' },
    ],
  },
  whatsapp: {
    tagline: 'WhatsApp at real scale.',
    description:
      'Broadcast to tens of thousands, auto-reply with AI, use rich templates with buttons — all through the native Business API with full delivery analytics.',
    bullets: [
      'Broadcast to 100k+ contacts',
      'AI-powered auto-replies',
      'Rich templates with buttons',
      'Real-time delivery analytics',
    ],
    status: 'API verified',
    metric: { value: '38%', label: 'reply rate' },
    rows: [
      { label: 'Black Friday blast', sub: '12.4k delivered · 99.2%', right: 'live' },
      { label: 'Welcome flow',       sub: '340 active subscribers',  right: 'on'   },
      { label: 'Support bot',        sub: 'Handling 62% of tickets', right: 'on'   },
    ],
  },
  chatbot: {
    tagline: 'AI that sounds human.',
    description:
      'Train a conversational AI on your docs, products and FAQs. It qualifies leads, answers questions and routes edge cases — 24/7, without sounding robotic.',
    bullets: [
      'Trains on your docs and FAQs',
      'Qualifies leads automatically',
      'Routes edge cases to humans',
      'Sounds conversational, not robotic',
    ],
    status: 'GPT-4 powered',
    metric: { value: '0.8s', label: 'avg reply' },
    rows: [
      { label: 'Product question', sub: 'Answered in 0.6s',     right: '✓' },
      { label: 'Pricing inquiry',  sub: 'Qualified → Sales',    right: '✓' },
      { label: 'Complex refund',   sub: 'Routed to human',      right: '→' },
    ],
  },
  flows: {
    tagline: 'Visual workflow builder.',
    description:
      'Drag-and-drop builder for multi-step automations. Branch on conditions, loop over lists, call APIs, send messages — all visually, no code.',
    bullets: [
      'Drag-and-drop visual canvas',
      'Conditional branching and loops',
      'HTTP calls and variables',
      'Live preview and testing',
    ],
    status: '24 flows active',
    metric: { value: '12k', label: 'runs / day' },
    rows: [
      { label: 'Order confirmation',  sub: '3 steps · Trigger: new order', right: 'live' },
      { label: 'Cart abandonment',    sub: '5 steps · Trigger: 1h idle',   right: 'live' },
      { label: 'Lead qualification',  sub: '7 steps · AI-powered',         right: 'live' },
    ],
  },
  crm: {
    tagline: 'Customers, deals, pipelines.',
    description:
      'A fully connected CRM where every contact, deal, task and conversation lives together. No more copy-pasting between tools.',
    bullets: [
      'Contacts, deals and pipelines',
      'Tasks and reminders',
      'Connected to every conversation',
      'Custom fields and segments',
    ],
    status: '4.2k contacts',
    metric: { value: '$48k', label: 'pipeline' },
    rows: [
      { label: 'Acme Corp',    sub: 'Proposal · $12,000',    right: 'hot'  },
      { label: 'Linear Labs',  sub: 'Discovery · $8,500',    right: 'warm' },
      { label: 'Nova Studios', sub: 'Negotiation · $18,000', right: 'hot'  },
    ],
  },
  broadcasts: {
    tagline: 'Reach thousands instantly.',
    description:
      'Send targeted broadcasts to segments with A/B testing, scheduled delivery and full analytics. Reach the right people at the right time.',
    bullets: [
      'Segment-targeted sends',
      'A/B testing built in',
      'Scheduled delivery',
      'Delivery and engagement analytics',
    ],
    status: '3 live campaigns',
    metric: { value: '48k', label: 'delivered' },
    rows: [
      { label: 'Summer Sale',      sub: '24.1k delivered', right: '98%' },
      { label: 'New product drop', sub: '12.8k delivered', right: '99%' },
      { label: 'Re-engagement',    sub: '11.1k delivered', right: '97%' },
    ],
  },
  catalog: {
    tagline: 'Sell inside the chat.',
    description:
      'Product catalogs that live inside WhatsApp. Customers browse, order and pay without leaving the conversation. Inventory syncs automatically.',
    bullets: [
      'WhatsApp-native product catalogs',
      'Inventory syncs automatically',
      'Order flow without leaving chat',
      'Payment links built in',
    ],
    status: '248 products',
    metric: { value: '$12k', label: 'today' },
    rows: [
      { label: 'Cotton T-shirt (M)', sub: 'Stock: 42', right: '$24' },
      { label: 'Running sneakers',   sub: 'Stock: 18', right: '$89' },
      { label: 'Leather wallet',     sub: 'Stock: 7',  right: '$42' },
    ],
  },
  email: {
    tagline: 'Campaigns that actually land.',
    description:
      'Design email campaigns, transactional emails and drip sequences from the same visual builder. Deliverability is optimized by default.',
    bullets: [
      'Visual email builder',
      'Transactional and marketing',
      'Drip sequences',
      'Deliverability tools built in',
    ],
    status: '5 sequences',
    metric: { value: '42%', label: 'open rate' },
    rows: [
      { label: 'Welcome series',  sub: 'Day 1 · Active', right: 'on'   },
      { label: 'Product launch',  sub: 'Sent to 14k',    right: 'done' },
      { label: 'Re-engagement',   sub: 'Paused',         right: '—'    },
    ],
  },
  sms: {
    tagline: 'Global SMS, zero setup.',
    description:
      'SMS blasts, OTPs and transactional messages worldwide. Smart fallback to WhatsApp when available. Real-time delivery reports.',
    bullets: [
      'Global SMS delivery',
      'OTP and transactional',
      'Smart WhatsApp fallback',
      'Real-time delivery reports',
    ],
    status: '140 countries',
    metric: { value: '2.1k', label: 'sent today' },
    rows: [
      { label: 'OTP for login',  sub: '+91 98xxx · Delivered', right: '1s' },
      { label: 'Order update',   sub: '+1 415xxx · Delivered', right: '2s' },
      { label: 'Flash sale',     sub: '824 recipients',        right: '✓'  },
    ],
  },
  seo: {
    tagline: 'Rank tracking that works.',
    description:
      'Track keyword rankings, audit technical SEO, score your content and monitor your brand — all from one dashboard.',
    bullets: [
      'Keyword rank tracking',
      'Technical SEO audits',
      'Content scoring',
      'Brand monitoring',
    ],
    status: '127 keywords',
    metric: { value: '#4', label: 'avg rank' },
    rows: [
      { label: '"ai automation"', sub: 'Position 3 · ↑2', right: '↑' },
      { label: '"whatsapp api"',  sub: 'Position 5 · ↑1', right: '↑' },
      { label: '"no-code crm"',   sub: 'Position 8 · ↓1', right: '↓' },
    ],
  },
  integrations: {
    tagline: '50+ tools, one connection.',
    description:
      'Connect Google Sheets, Razorpay, Stripe, Zapier, webhooks and 50+ services. Build custom integrations with our REST API.',
    bullets: [
      'Google Sheets, Razorpay, Stripe',
      'REST API and webhooks',
      'Zapier and Make support',
      'Custom OAuth integrations',
    ],
    status: '12 connected',
    metric: { value: '50+', label: 'services' },
    rows: [
      { label: 'Google Sheets', sub: 'Syncing 4 sheets',    right: 'on' },
      { label: 'Razorpay',      sub: 'Payments webhook',    right: 'on' },
      { label: 'Zapier',        sub: '8 active zaps',       right: 'on' },
    ],
  },
  workers: {
    tagline: 'Runs while you sleep.',
    description:
      'Background workers execute broadcasts, imports, audits and webhooks 24/7 — without you touching a thing. BullMQ + Redis under the hood.',
    bullets: [
      'Background job queue',
      '24/7 unattended execution',
      'Retries with exponential backoff',
      'Job monitoring and alerts',
    ],
    status: '8 workers live',
    metric: { value: '24/7', label: 'uptime' },
    rows: [
      { label: 'SEO audit queue',   sub: 'Processing 24 jobs',     right: '●' },
      { label: 'Email sender',      sub: '1,204 sent this hour',   right: '●' },
      { label: 'Webhook delivery',  sub: '98.6% success',          right: '●' },
    ],
  },
};
