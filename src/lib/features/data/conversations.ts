import type { Feature } from '../types';

export const conversationsFeatures: Feature[] = [
  {
    slug: 'shared-inbox',
    name: 'Shared Inbox',
    brand: 'Wachat',
    category: 'conversations',
    tagline: 'Every channel in one queue. Assign, route, resolve — together.',
    iconKey: 'inbox',
    color: '#4F46E5',
    tint: '#EEF2FF',

    seoTitle: 'Shared Inbox for WhatsApp, IG, Email & Web | SabNode',
    seoDescription:
      'Unify WhatsApp, Instagram DM, email and web chat into one shared inbox. Assign, route, tag, snooze, set SLAs and resolve faster as a team together.',
    keywords: [
      'shared inbox for whatsapp business',
      'unified customer support inbox',
      'multi channel helpdesk for ecommerce',
      'whatsapp instagram email inbox',
      'team inbox with sla and assignments',
      'collaborative customer messaging tool',
      'omnichannel chat inbox india',
      'shared inbox alternative to zendesk',
      'wachat shared inbox sabnode',
      'whatsapp business api inbox for teams',
    ],

    hero: {
      eyebrow: 'Wachat · Shared Inbox',
      headline: 'One queue for every customer conversation',
      subhead:
        'Stop juggling eight browser tabs. Wachat pulls WhatsApp Cloud API, Instagram DMs, Gmail/Outlook threads and your web widget into a single inbox with assignments, SLAs, internal notes and audit history. Twelve agents can work the same queue without stepping on each other.',
      bullets: [
        'Round-robin and skill-based assignment',
        'SLA timers per channel and label',
        'Private @mentions and internal notes',
        'Full thread history across all channels',
      ],
    },

    problem: {
      title: 'Support is bleeding through the cracks',
      body:
        'Most growing teams run customer conversations across at least four tools — the WhatsApp Business app on a shared phone, a personal Instagram handle, a Gmail label called "support@", and a Tawk.to widget nobody checks after 6pm. Replies get duplicated, urgent messages sit unread for hours, and the founder still gets pulled in to "just look at this one DM". When a customer complains, nobody can produce the full thread because half of it lived on a phone that an ex-employee took home.\n\nThe knock-on cost is real. First-response time creeps from minutes to hours, NPS softens, refund requests escalate to Instagram comments, and acquisition spend gets wasted on customers you already had. Worse, the team has no visibility — managers cannot tell who answered what, which campaign is generating the most tickets, or whether the new agent is actually picking up shifts.\n\nA shared inbox is not a luxury once you cross roughly 200 conversations a week. It is the operational backbone that lets a five-person team behave like a fifty-person one, with audit trails, ownership and measurable SLAs.',
    },

    overview: [
      'Wachat\'s shared inbox is built on the official WhatsApp Business Cloud API and Meta\'s Messenger/Instagram Graph APIs, with native connectors for Gmail and Microsoft 365 over OAuth. Every inbound message — a WhatsApp interactive button reply, an Instagram story mention, a Gmail thread, a web widget chat — lands in the same queue with the contact already deduped against your CRM. Agents see the customer\'s last order, last campaign, lifetime value and previous tickets in a right-hand context panel, so they never have to ask "what\'s your email again?"',
      'Routing is rule-driven and channel-aware. You can pin all Hindi-language WhatsApp conversations to your Delhi team between 10:00 and 19:00 IST, route Instagram DMs containing the word "refund" straight to a senior agent, and let the web widget auto-assign by URL path — pricing-page visitors go to sales, docs-page visitors go to support. The same engine handles re-assignment when an agent goes offline, when a ticket breaches its 30-minute SLA, or when a customer replies after a snooze.',
      'Collaboration happens inside the conversation, not in a separate Slack thread. Agents can leave private notes, @mention a teammate, attach a 50 MB voice memo or PDF, and tag the thread with one or many labels. Every action — assignment change, status flip, label edit, note added — is timestamped in an immutable audit log that admins can export to CSV for compliance reviews. Supervisors get a live "floor view" of who is typing, who is idle, and which conversations are at risk of SLA breach.',
      'Because the inbox shares the same contact graph as Wachat\'s CRM, Broadcasts and Flow Builder modules, a single reply can trigger a tag update, a deal stage move, or a follow-up sequence. A customer who replies "STOP" to a marketing template is automatically opted out of all future broadcasts; one who replies "RESCHEDULE" can be handed to a booking flow without an agent ever touching it. The inbox is the surface, but the entire SabNode stack is doing the work underneath.',
    ],

    capabilities: [
      {
        title: 'Unified channel queue',
        body:
          'WhatsApp Cloud API, Instagram DM and comments, Facebook Messenger, Gmail, Outlook, IMAP and the SabNode web widget converge into one list with channel icons and unread counts. Filter by channel, status, assignee, label or SLA risk in two clicks.',
      },
      {
        title: 'Smart assignment rules',
        body:
          'Round-robin with load balancing, skill-based routing (language, product line, tier), or sticky assignment so a returning customer always reaches the same agent. Fallback chains handle holidays, breaks and overflow without losing a single message.',
      },
      {
        title: 'SLA timers and breach alerts',
        body:
          'Define first-response and full-resolution SLAs per channel, label or VIP segment — for example 60 seconds on the web widget, 15 minutes on WhatsApp during business hours. Breach warnings ping the assignee at 70% elapsed and the supervisor at 100%.',
      },
      {
        title: 'Internal notes and @mentions',
        body:
          'Drop a private note that only teammates see, @mention a colleague to pull them in, or paste a screenshot. Notes live in the same timeline as customer messages, so context is never lost when a ticket gets handed off mid-shift.',
      },
      {
        title: 'Customer 360 side panel',
        body:
          'Every conversation shows the contact\'s phone, email, last 5 orders, current cart value, NPS score, opt-in status and active flow runs — pulled live from SabNode CRM, Shopify and Razorpay. Edit attributes inline and they sync everywhere.',
      },
      {
        title: 'Snooze, schedule and follow-ups',
        body:
          'Snooze a thread until tomorrow 09:00, schedule an outbound message for 14:30 IST, or set a "remind me if no reply in 48 hours" trigger. The inbox re-surfaces the conversation at exactly the right moment with the original context intact.',
      },
      {
        title: 'Audit log and compliance export',
        body:
          'Every assignment, edit, label change, note and message is recorded with agent ID, timestamp and IP. Admins can export a per-conversation PDF for DPDP/GDPR data subject requests or a date-range CSV for internal audits and dispute resolution.',
      },
    ],

    useCases: [
      {
        title: 'D2C brand handling order queries',
        industry: 'E-commerce',
        body:
          'A Shopify-powered skincare brand routes "where is my order" WhatsApp messages through an auto-reply that fetches the Shiprocket tracking link, then escalates to a human only when the customer asks a follow-up. The inbox shows the order number, courier and SLA breach risk at a glance, cutting average handle time from 7 minutes to 90 seconds.',
      },
      {
        title: 'B2B SaaS dunning and onboarding',
        industry: 'SaaS',
        body:
          'A vertical SaaS company watches its web widget for trial users on the pricing page and auto-assigns them to an account executive. Failed Stripe charges trigger a WhatsApp template; replies land in the same shared inbox where finance and CS collaborate on payment links and grace periods without a single forwarded email.',
      },
      {
        title: 'Clinic appointment management',
        industry: 'Healthcare',
        body:
          'A multi-location dental chain accepts bookings via WhatsApp, web chat and Instagram. Receptionists at each clinic see only their location\'s queue, while a central supervisor monitors all five. Patient records, last visit and outstanding balance show up in the side panel, fully compliant with the clinic\'s data retention policy.',
      },
      {
        title: 'Edtech admissions counselling',
        industry: 'Education',
        body:
          'An online MBA institute routes Hindi enquiries to the Delhi team, Tamil to Chennai, and English to a 24x7 offshore pod. Lead score, source campaign and last webinar attended are visible on the conversation, helping counsellors prioritise the 12 hottest leads out of 400 daily inbounds.',
      },
      {
        title: 'Logistics dispute resolution',
        industry: 'Logistics',
        body:
          'A last-mile delivery startup auto-tags conversations containing "damaged" or "missing" and pushes them to a senior queue with a 30-minute SLA. The shared inbox links every complaint to the AWB, delivery photo and driver, so disputes get resolved in one thread instead of three emails and a phone call.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Connect your channels',
        body:
          'Plug in WhatsApp Cloud API via Meta Embedded Signup (about 8 minutes), authorise Gmail/Outlook over OAuth, link your Instagram Business account, and paste the web widget snippet into your site.',
      },
      {
        step: '02',
        title: 'Invite agents and set roles',
        body:
          'Add teammates by email, assign them roles — agent, senior agent, supervisor, admin — and group them into teams like "Sales", "Tier 1 Support" or "Hindi Pod" for routing rules.',
      },
      {
        step: '03',
        title: 'Configure routing and SLAs',
        body:
          'Build assignment rules with a visual editor: channel + keyword + customer segment to team. Set first-response SLAs per team and channel; configure escalation chains for breaches.',
      },
      {
        step: '04',
        title: 'Train the AI layer',
        body:
          'Upload your help centre, product catalogue and past tickets. The AI suggests replies, summarises long threads, and auto-tags incoming messages — agents click to accept or edit before sending.',
      },
      {
        step: '05',
        title: 'Go live and tune',
        body:
          'Watch the live floor view, the SLA breach report and the per-agent CSAT dashboard. Iterate routing weekly: most teams see first-response time drop 50%+ within the first month.',
      },
    ],

    integrations: [
      'WhatsApp Business Cloud API (Meta)',
      'Instagram Graph API',
      'Gmail (Google Workspace OAuth)',
      'Microsoft 365 / Outlook',
      'Shopify',
      'Razorpay',
      'Slack',
      'HubSpot CRM',
    ],

    metrics: [
      { value: '<60s', label: 'Median first-response time on the web widget after launch' },
      { value: '3.2×', label: 'Increase in conversations handled per agent per shift' },
      { value: '42%', label: 'Reduction in duplicate replies across team members' },
      { value: '99.95%', label: 'Inbox availability backed by Wachat\'s multi-region infra' },
    ],

    faqs: [
      {
        q: 'How is this different from WhatsApp Web with multiple devices?',
        a: 'WhatsApp Web supports up to four linked devices but offers no assignment, no SLA, no internal notes, no CRM context and no audit log — and you cannot run templated broadcasts. Wachat uses the official Cloud API, which is built for businesses: unlimited agents on one number, full conversation history in the cloud, templates, opt-ins, and webhooks for every event.',
      },
      {
        q: 'Can two agents reply to the same WhatsApp customer without conflict?',
        a: 'Yes. The inbox enforces single-assignee ownership: only the assigned agent can send a customer-facing reply, but anyone on the team can leave internal notes or @mention them. Typing indicators show in real time, and a soft-lock prevents two people from sending at once. Re-assignment is logged with one click.',
      },
      {
        q: 'Does it support the WhatsApp 24-hour service window?',
        a: 'The inbox tracks the 24-hour window per contact and displays a countdown. Inside the window, agents can send any free-form message or media. Outside the window, the composer prompts the agent to select a Meta-approved message template (HSM) instead, with merge fields auto-populated from the contact record.',
      },
      {
        q: 'What happens to old conversations when an agent leaves?',
        a: 'Removing an agent moves their open conversations to a configurable fallback — a teammate, a team queue or a supervisor. Closed conversations stay attached to the contact, so the next agent sees full history. The departed agent\'s actions remain in the audit log with their archived user ID, which is required for compliance.',
      },
      {
        q: 'Can I support customers in Hindi, Tamil or Bengali?',
        a: 'Yes. Wachat is fully UTF-8, supports Indic input methods, and canned replies/templates can be authored in any language. You can route by detected language using the AI layer — for example, all messages detected as Tamil are pushed to the Chennai team queue between 09:00 and 21:00 IST, with English fallback overnight.',
      },
      {
        q: 'How are pricing and seat limits calculated?',
        a: 'Wachat charges per seat per month plus pass-through Meta conversation fees for WhatsApp (Meta\'s rate card, no markup). Web chat, Instagram DM and email volume are unmetered. There is a free tier for two agents and a 14-day full-feature trial — no card needed to start.',
      },
      {
        q: 'Is data stored in India?',
        a: 'Yes. SabNode operates a Mumbai (ap-south-1) primary region with hot-standby in Singapore for disaster recovery only. Conversation bodies, attachments and audit logs reside in India, encrypted at rest with AES-256 and in transit with TLS 1.3. We are aligned with DPDP Act 2023 and offer signed DPAs for enterprise plans.',
      },
    ],

    related: ['whatsapp-business-api', 'instagram-dm', 'email-inbox', 'canned-replies'],
  },

  {
    slug: 'whatsapp-business-api',
    name: 'WhatsApp Business API',
    brand: 'Wachat',
    category: 'conversations',
    tagline: 'Official Cloud API access with templates, rich media and list/button messages.',
    iconKey: 'whatsapp',
    color: '#25D366',
    tint: '#DCFCE7',

    seoTitle: 'WhatsApp Business API for Teams & Brands | SabNode',
    seoDescription:
      'Official WhatsApp Cloud API: templates, list & button messages, media, opt-in flows and multi-agent inbox. Onboard in under 10 minutes with Wachat.',
    keywords: [
      'whatsapp business api provider india',
      'whatsapp cloud api onboarding',
      'meta approved whatsapp templates',
      'whatsapp interactive list button messages',
      'whatsapp hsm template messaging',
      'whatsapp business api for ecommerce',
      'official whatsapp api for shopify',
      'whatsapp 24 hour service window',
      'wachat whatsapp api sabnode',
      'bulk whatsapp messaging legal',
    ],

    hero: {
      eyebrow: 'Wachat · WhatsApp Business API',
      headline: 'Production-grade WhatsApp messaging in 8 minutes',
      subhead:
        'Wachat is a Meta-vetted BSP. Onboard your number through Embedded Signup, ship Meta-approved templates the same day, and start using interactive lists, buttons, CTAs and media without writing a single integration. Webhooks, retries and quality monitoring are handled for you.',
      bullets: [
        'Embedded Signup — no IT ticket required',
        'Template manager with category guidance',
        'List, button and CTA interactive messages',
        'Per-number quality score and tier alerts',
      ],
    },

    problem: {
      title: 'Most WhatsApp setups break by month two',
      body:
        'Teams sign up for the WhatsApp Business API expecting "WhatsApp, but for business". What they get is a Meta Business Manager interface that assumes you already know what an HSM is, a Cloud API that returns cryptic error codes, and a 24-hour service window rule that gets you blocked the first time you try to message a customer who hasn\'t replied in two days. Templates get rejected for vague reasons. Quality scores drop without explanation. A junior marketer accidentally messages 5,000 non-opted-in contacts and the number gets restricted.\n\nMeanwhile, the developers are stuck building retry queues, webhook validators, media uploaders and template variable mappers — work that has nothing to do with the actual product. Six weeks in, the messaging stack is a brittle Node.js script on someone\'s laptop, and the only person who understands it has just resigned.\n\nWachat is the layer that absorbs all of this. We are a Meta Business Solution Provider, so the API quotas, template review queue, embedded signup and quality monitoring sit inside our infrastructure. You get a clean API and a UI that maps every WhatsApp concept — service window, HSM categories, opt-in, button vs list, media MIME types — to a workflow your team can actually run.',
    },

    overview: [
      'Wachat provides direct access to the WhatsApp Business Cloud API hosted by Meta, with zero proprietary middleware in the message path. That means every feature Meta ships — interactive flows, payments, secure messaging, message reactions, view-once media — reaches your account on the day it goes GA, not six months later. We are a vetted BSP, so onboarding uses Meta\'s Embedded Signup: the user clicks a button, completes Meta\'s consent flow, and a phone number is provisioned and verified in 5–10 minutes without any back-and-forth with Meta support.',
      'Template management is the single biggest pain point in WhatsApp messaging, and we have spent two years instrumenting it. The template builder shows you the three categories (Utility, Marketing, Authentication), the pricing implication of each, character limits per component (1024 for body, 60 for headers), and a real-time linter that flags the language patterns most likely to get rejected. Approved templates appear in the inbox composer, in Flow Builder send nodes, and in the Broadcasts module without any extra publishing step.',
      'Interactive messages — reply buttons, list pickers, CTA URL buttons, location requests, product catalogues — are first-class citizens. You can build them visually in the inbox, fire them from a flow, or send them via API with a 12-line JSON payload. Wachat handles the response routing automatically: a button click becomes a new conversation event with the button_id available to your rules engine, so a "Track Order" tap goes to the order-status flow without an agent in the loop.',
      'Reliability is where most providers quietly fail. Wachat\'s send pipeline runs on a Kafka-backed queue with idempotent writes, exponential backoff on Meta\'s 429s, and per-number rate limiting that adapts to your tier (1K, 10K, 100K, unlimited). Inbound webhooks from Meta are deduped, persisted and replayed if your endpoint is down. Quality score, template rejection rate, opt-out rate and undelivered ratio are all surfaced in a dashboard with alert thresholds you set.',
    ],

    capabilities: [
      {
        title: 'Embedded Signup onboarding',
        body:
          'Customers click "Connect WhatsApp", complete Meta\'s native consent flow in a popup, and a verified number is live in 5–10 minutes. No PIN sharing, no Business Manager access requests, no waiting for a CSM to provision an account.',
      },
      {
        title: 'Template manager with linter',
        body:
          'Author Utility, Marketing and Authentication templates with live validation. The linter flags promotional language in Utility templates, missing opt-out in Marketing, and incorrect placeholders. Submitted templates show Meta review status with reason codes.',
      },
      {
        title: 'Interactive message builder',
        body:
          'Drag-and-drop builder for reply buttons (up to 3), list messages (up to 10 sections), CTA URL buttons, location requests and product list messages from your Meta catalogue. Preview renders exactly like the WhatsApp client on iOS and Android.',
      },
      {
        title: '24-hour window and opt-in tracking',
        body:
          'Every contact has a live service-window countdown and an opt-in record (source, timestamp, channel). Sending outside the window forces a template selector; sending without opt-in is blocked at the API level with a 422 response.',
      },
      {
        title: 'Rich media uploads',
        body:
          'Upload images (JPG, PNG up to 5 MB), video (MP4, 3GP up to 16 MB), documents (PDF, DOC, XLS up to 100 MB), audio (AAC, MP4, MPEG up to 16 MB) and stickers (WebP). Wachat handles MIME validation, Meta resumable upload and CDN caching.',
      },
      {
        title: 'Quality score monitoring',
        body:
          'Per-number quality score (green/yellow/red), messaging tier (1K to unlimited), and template rejection rate stream into a dashboard. Alerts fire when quality drops to medium or when daily opt-outs exceed your threshold, with playbook links to remediate.',
      },
      {
        title: 'Webhook delivery and replay',
        body:
          'Wachat fans out Meta webhooks to your endpoints with retry-with-backoff for 5xx responses, signed HMAC headers, and a 7-day replay log. You can fork a single Meta event to your CRM, your data warehouse and a Slack channel from one config.',
      },
    ],

    useCases: [
      {
        title: 'Cart abandonment recovery',
        industry: 'E-commerce',
        body:
          'A fashion D2C brand sends a Marketing template with the cart image, a "Resume Checkout" CTA URL button and a 10% off code 30 minutes after abandonment. Conversions recovered: 18% on first send, another 6% on a follow-up at hour 24 — all running inside the WhatsApp 24-hour window opened by the initial reply.',
      },
      {
        title: 'OTP and login notifications',
        industry: 'Financial Services',
        body:
          'A neobank moves SMS OTPs to WhatsApp Authentication templates: 60% cheaper per message, 4× higher open rate, and a one-tap copy button. The template is rate-limited per user, fingerprinted to the device, and falls back to SMS only if WhatsApp is undelivered after 15 seconds.',
      },
      {
        title: 'Appointment reminders',
        industry: 'Healthcare',
        body:
          'A diagnostics chain sends a Utility template 24 hours before each appointment with reply buttons "Confirm", "Reschedule" and "Cancel". Button taps route into the booking flow without an agent; no-show rate drops from 22% to 9%, freeing 14 hours of phone-confirmation labour weekly per branch.',
      },
      {
        title: 'Course drip and assignment alerts',
        industry: 'Education',
        body:
          'An online coding bootcamp uses list messages to let students pick which cohort track to enrol in, then sends Utility templates for assignment deadlines and grading feedback. Completion rate on the second cohort jumped 31% versus the email-only cohort, with cost-per-completion down 24%.',
      },
      {
        title: 'Shipment status updates',
        industry: 'Logistics',
        body:
          'A 3PL provider triggers Utility templates at every status change — picked, in-transit, out-for-delivery, delivered — with a CTA URL button to the live tracking page. WISMO ("where is my order") inbound tickets fell 64%, and proof-of-delivery photos are returned via WhatsApp media in the same thread.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Embedded Signup',
        body:
          'Click "Connect WhatsApp" in Wachat. Meta\'s popup walks the business owner through verifying the Meta Business, selecting a number and accepting terms. Provisioning finishes in 5–10 minutes.',
      },
      {
        step: '02',
        title: 'Submit your first templates',
        body:
          'Use the template builder to draft 3–5 starter templates: a welcome Utility, a Marketing offer, an Authentication OTP. Meta reviews them in 1–24 hours; the linter pre-catches most rejection reasons.',
      },
      {
        step: '03',
        title: 'Wire opt-in capture',
        body:
          'Add a WhatsApp opt-in checkbox to your checkout, signup form or web widget. Wachat records source, timestamp and IP, and exposes a single API to verify opt-in before any outbound send.',
      },
      {
        step: '04',
        title: 'Send and observe',
        body:
          'Send your first templates from the inbox, a flow or the Broadcasts module. Watch the delivery dashboard for sent, delivered, read, replied and failed. Address any quality dips before scaling volume.',
      },
      {
        step: '05',
        title: 'Scale to tier 4',
        body:
          'Meta auto-graduates well-behaved numbers from 1K to 10K to 100K to unlimited daily unique recipients. Wachat surfaces tier-up triggers and the metrics you need to maintain a green quality score.',
      },
    ],

    integrations: [
      'Meta WhatsApp Cloud API',
      'Meta Business Manager',
      'Meta Commerce Catalogue',
      'Shopify',
      'WooCommerce',
      'Razorpay',
      'Stripe',
      'Zapier',
    ],

    metrics: [
      { value: '8 min', label: 'Median onboarding time from sign-up to first sent message' },
      { value: '98.7%', label: 'Median delivery rate across Wachat customer numbers' },
      { value: '4×', label: 'Higher open rate vs SMS for OTP and transactional notifications' },
      { value: '0', label: 'Numbers blocked due to Wachat-side policy violations in 2025' },
    ],

    faqs: [
      {
        q: 'Do I need to apply with Meta directly or is Wachat a BSP?',
        a: 'Wachat is a vetted Meta Business Solution Provider. You do not need a separate application with Meta. Embedded Signup runs through our app, your number is provisioned on our shared Meta cluster, and you get the same Cloud API as if you were a direct Meta customer — just with the BSP layer handling provisioning, billing aggregation and support.',
      },
      {
        q: 'What is the difference between Utility, Marketing and Authentication templates?',
        a: 'Utility templates are post-purchase or account notifications (order updates, appointment reminders) — cheapest per conversation. Marketing templates are promotional (offers, launches) — priced higher and must include an opt-out. Authentication templates are OTPs and login codes — fixed format, rate-limited and the cheapest in markets where authentication pricing is enabled. Wachat\'s linter recommends the right category at draft time.',
      },
      {
        q: 'How does the 24-hour service window work?',
        a: 'When a customer messages you, a 24-hour window opens during which you can reply with any free-form text or media at no incremental conversation cost. Outside the window, you must use an approved template to re-initiate. Wachat tracks the window per contact, shows a live countdown in the inbox, and blocks free-form sends when the window is closed.',
      },
      {
        q: 'Can I send bulk marketing messages?',
        a: 'Yes, via Meta-approved Marketing templates to opted-in contacts. Wachat\'s Broadcasts module handles audience filtering, scheduling, rate-limiting against your messaging tier and per-recipient personalisation. Sending unsolicited messages or to non-opted-in contacts violates Meta policy and will trigger Wachat\'s pre-send guardrails — the broadcast simply will not start.',
      },
      {
        q: 'What happens if my quality score drops?',
        a: 'Meta lowers your messaging tier when quality drops below medium for a sustained period, capping daily unique recipients. Wachat alerts you the moment quality moves from high to medium, surfaces the templates and time windows correlated with the drop, and provides a remediation playbook — pause specific templates, tighten audience, improve opt-in flow.',
      },
      {
        q: 'Which media types and sizes are supported?',
        a: 'Images up to 5 MB (JPG, PNG), video up to 16 MB (MP4, 3GP), documents up to 100 MB (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT), audio up to 16 MB (AAC, MP4, MPEG, AMR, OGG), and WebP stickers up to 100 KB animated / 500 KB static. Wachat validates MIME types client-side before upload and handles Meta\'s resumable upload protocol transparently.',
      },
      {
        q: 'How is conversation-based pricing calculated?',
        a: 'Meta charges per 24-hour conversation in four categories (Utility, Marketing, Authentication, Service), with rates that vary by country. Wachat passes through Meta\'s rate card with no markup and bills monthly in INR or USD. You see the per-conversation cost in the broadcast preview before you send, plus running spend in the billing dashboard.',
      },
    ],

    related: ['shared-inbox', 'broadcasts', 'flow-builder', 'instagram-dm'],
  },

  {
    slug: 'instagram-dm',
    name: 'Instagram DM Inbox',
    brand: 'Wachat',
    category: 'conversations',
    tagline: 'Reply to DMs, story mentions and comments in the same shared inbox.',
    iconKey: 'instagram',
    color: '#E4405F',
    tint: '#FCE7F3',

    seoTitle: 'Instagram DM Inbox for Business Support Teams | SabNode',
    seoDescription:
      'Manage Instagram DMs, story mentions and post comments in one inbox. Auto-reply, route to agents, tag and resolve — backed by the official Graph API.',
    keywords: [
      'instagram dm management tool',
      'instagram business inbox for teams',
      'reply to story mentions automatically',
      'instagram comment moderation tool',
      'instagram graph api integration',
      'unified instagram and whatsapp inbox',
      'instagram dm crm for ecommerce',
      'auto reply instagram dms',
      'wachat instagram inbox sabnode',
      'manage instagram dms multi user',
    ],

    hero: {
      eyebrow: 'Wachat · Instagram DM',
      headline: 'Stop losing leads in the IG primary tab',
      subhead:
        'Wachat connects your Instagram Business account via the official Graph API and pulls every DM, story mention, story reply and post comment into the same shared inbox your team already lives in. No more "did anyone reply to that DM about pricing?" at 11pm.',
      bullets: [
        'DMs, story mentions and comments in one queue',
        'Auto-reply to common DMs in 5 seconds',
        'Hide or report spam comments inline',
        'Convert DM threads into CRM contacts',
      ],
    },

    problem: {
      title: 'Instagram is your sales floor, not just social',
      body:
        'For most consumer brands in India, Instagram is the highest-intent inbound channel — higher than the website contact form, higher than email. A new follower asks "is this in stock in size M?" and you have maybe 4 hours before she goes to a competitor. The official Instagram app has no assignment, no SLAs, no notes, and the primary/general/requests split means hot leads sit in "Requests" for days. If two team members are replying from the same handle, they routinely send duplicate messages — or worse, contradict each other on price.\n\nStory mentions are even more thinly handled. A micro-influencer with 8,000 followers tags your brand in a story and you have a 24-hour window to react before the story disappears. Most teams find out on Monday morning that they missed three story mentions over the weekend, including one from a verified account.\n\nComment moderation has its own failure mode. Negative comments under boosted ads tank the ROAS because new viewers see the complaint before they see the product. Hiding or replying to comments requires opening the post in the app one by one — there is no bulk workflow, no keyword auto-hide, no tag-and-route. By the time a community manager catches up, the damage is done.',
    },

    overview: [
      'Wachat\'s Instagram inbox uses the official Instagram Graph API via Meta Login for Business, which means everything you can do in the native app — and several things you cannot — is available with full audit and multi-user support. Direct messages, story replies, story mentions, post comments, ad comments and Reels comments all flow into the same queue as your WhatsApp and email, with the contact deduplicated by Instagram username and any matched phone or email.',
      'Auto-replies and rules run server-side. You can configure a rule like "if a DM contains the word \'price\' AND the sender does not follow us yet, send a list message with our top three SKUs and a discount code". For story mentions, an auto-reply can thank the user, request UGC permission and tag them as a potential ambassador in the CRM — all within seconds of the mention, well inside the 24-hour message window Meta allows for ice-breaker replies.',
      'Comment management is built for teams. Comments stream into a dedicated section of the inbox with the parent post visible. Agents can reply, like, hide or report a comment without leaving the page. Keyword rules auto-hide profanity, competitor mentions or spam DMs containing links, and the audit log shows which agent took which action — critical when a customer complains that their comment was hidden.',
      'Because Instagram DMs share the same shared-inbox machinery as the rest of Wachat, every routing rule, SLA timer, canned reply and AI suggestion you have configured applies here too. A returning customer who DMs about a refund gets routed to the same senior agent who handled their last WhatsApp ticket. A new follower asking about sizing gets a flow-generated reply with the size chart PDF and a "Talk to a stylist" button.',
    ],

    capabilities: [
      {
        title: 'Unified IG event stream',
        body:
          'Direct messages, story replies, story mentions, story shares, post comments, ad comments, Reels comments and Live comments all land in the same queue with type icons and parent-content previews. Filter to any subset with one click.',
      },
      {
        title: 'Story mention auto-reply',
        body:
          'When a user tags you in their story, Wachat can auto-thank them, request UGC permission with a button, and tag them in the CRM as a potential ambassador — all within the 24-hour reply window Meta allows for story mention events.',
      },
      {
        title: 'Comment moderation rules',
        body:
          'Keyword and regex rules auto-hide profanity, competitor names or link spam on any post or ad. Allow-lists protect known customers and verified accounts. Every hide/report action is logged with agent ID for community manager accountability.',
      },
      {
        title: 'Ice-breakers and persistent menu',
        body:
          'Configure Instagram\'s ice-breaker questions and persistent menu directly from Wachat — no need to dig through Meta Business Suite. Updates push live to your account in under 60 seconds, with version history and rollback.',
      },
      {
        title: 'Quick replies and saved replies sync',
        body:
          'Native Instagram quick replies and Wachat\'s richer canned replies live side by side. Agents can use either, and the AI layer suggests the best match based on the DM content and customer history.',
      },
      {
        title: 'DM to deal conversion',
        body:
          'One click turns an Instagram DM thread into a CRM contact and a deal in the sales pipeline, with the Instagram handle, follower count, location and profile bio captured as attributes. The DM history stays linked for context.',
      },
      {
        title: 'Multi-handle support',
        body:
          'Connect multiple Instagram Business accounts — main brand, sub-brand, regional handles — and assign each to a different team or routing rule. Agents see all queues they have access to, and admins can scope visibility per handle.',
      },
    ],

    useCases: [
      {
        title: 'Beauty brand handling sizing DMs',
        industry: 'E-commerce',
        body:
          'A cosmetics D2C brand auto-detects DMs asking about shade or skin type and replies with a list message linking to the shade-finder quiz. Conversion from quiz to purchase is 28%, and agents only handle DMs that fall outside the rule set — roughly 35% of inbound, down from 100%.',
      },
      {
        title: 'Restaurant table reservations',
        industry: 'Hospitality',
        body:
          'A multi-outlet restaurant routes DMs asking for reservations to a flow that captures date, party size and outlet. Bookings flow into the CRM and into the POS, and the customer receives a WhatsApp confirmation. Manager DMs from Instagram-driven reservations have grown 4× in six months.',
      },
      {
        title: 'Real estate enquiry capture',
        industry: 'Real Estate',
        body:
          'A property developer turns every IG ad comment that mentions "price" or "site visit" into a CRM lead, with the comment text, ad ID and creative version recorded. Sales call-back happens within 12 minutes during business hours, and the close rate from IG ads has doubled.',
      },
      {
        title: 'Edtech course enquiries',
        industry: 'Education',
        body:
          'A test-prep institute auto-replies to Reels comments asking about course start dates with a DM containing a list message: select the exam (CAT, GMAT, GRE, IELTS). The selection routes to the relevant counsellor queue with the Reel ID as context, lifting enrolled leads from Reels by 51%.',
      },
      {
        title: 'Travel agency itinerary requests',
        industry: 'Travel & Hospitality',
        body:
          'A boutique travel agency converts story-mention DMs into trip enquiries: a flow asks destination, dates, group size and budget. The completed enquiry creates a deal in the CRM with an assigned trip designer; response time has dropped from 9 hours to under 12 minutes during business hours.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Convert to a Business account',
        body:
          'Your Instagram handle must be a Business or Creator account linked to a Facebook Page. Wachat walks the admin through the conversion in 2 minutes if not already done.',
      },
      {
        step: '02',
        title: 'Connect via Meta Login',
        body:
          'Click "Connect Instagram", complete Meta\'s OAuth flow granting Wachat the messaging, content_publish and manage_comments permissions. Connection takes about 60 seconds.',
      },
      {
        step: '03',
        title: 'Set up auto-replies and rules',
        body:
          'Build keyword rules for common DMs (price, size, shipping), a story-mention thank-you flow, and comment moderation rules for the handles you connected. Test in sandbox before going live.',
      },
      {
        step: '04',
        title: 'Route to teams',
        body:
          'Assign DM routing — for example, all DMs from accounts with >10K followers go to a senior agent. Tie SLAs to the IG channel: 30 minutes during business hours, auto-template after-hours.',
      },
      {
        step: '05',
        title: 'Monitor and iterate',
        body:
          'Watch the dashboard: DMs received, response time, story mentions handled, comments hidden, deals created from IG. Tune rules weekly based on the top inbound keywords and ad performance.',
      },
    ],

    integrations: [
      'Instagram Graph API',
      'Meta Login for Business',
      'Meta Commerce Catalogue',
      'Shopify',
      'HubSpot CRM',
      'Salesforce',
      'Google Sheets',
      'Slack',
    ],

    metrics: [
      { value: '90s', label: 'Median response time on Instagram DMs after Wachat goes live' },
      { value: '5×', label: 'More story mentions captured and converted into CRM contacts' },
      { value: '73%', label: 'Reduction in moderator time spent hiding spam comments' },
      { value: '28%', label: 'Lift in DM-to-purchase conversion via automated quizzes' },
    ],

    faqs: [
      {
        q: 'Does this work with personal Instagram accounts?',
        a: 'No. The Instagram Graph API only supports Business and Creator accounts that are linked to a Facebook Page. The conversion is free and reversible, takes under 2 minutes in the Instagram app, and does not change the username, followers or content. Wachat detects account type at connection time and guides you through conversion if needed.',
      },
      {
        q: 'How many DMs per second can be sent?',
        a: 'Instagram\'s API enforces per-user and per-app rate limits — roughly 100 messages per second per page-scoped account, with bursts capped to protect deliverability. Wachat handles rate limiting transparently with a token-bucket queue, exponential backoff on 429s, and per-handle visibility so you can plan campaigns without hitting Meta\'s ceilings.',
      },
      {
        q: 'Can I reply to story mentions and how long do I have?',
        a: 'Yes. Meta opens a 24-hour message window when a user mentions you in their story, replies to your story, or sends you a DM. Inside that window you can send any message type — text, media, list, button. After 24 hours, you can no longer message that user until they message you again. Wachat tracks the window per contact with a live countdown.',
      },
      {
        q: 'Will hiding comments hurt my reach?',
        a: 'No. Hiding comments removes them from public view but does not affect the post\'s reach or engagement signals to the algorithm. The original commenter still sees their comment when logged in, which avoids the "why was I muted" backlash. Wachat\'s audit log records every hide action with agent and timestamp for transparency.',
      },
      {
        q: 'Can I run promotions or contests over DMs?',
        a: 'Yes, with care. Meta\'s policy allows promotional DMs only inside the 24-hour message window opened by an inbound message or mention. Wachat\'s flow builder makes it easy to run a "comment-to-DM" contest: a user comments a keyword on your post, gets an auto-DM with the entry form, and the conversation continues inside the allowed window.',
      },
      {
        q: 'How do I manage multiple brand handles?',
        a: 'Connect each Instagram Business account separately under the same Wachat workspace. Each handle becomes its own queue with its own routing rules, SLAs and team scopes. Agents only see handles they have permission to access. Cross-handle reports show aggregate response time, DM volume and conversion across the portfolio.',
      },
      {
        q: 'Does it support Reels and Live comments too?',
        a: 'Yes. Reels comments, Reels DMs, Live comments and Live DMs all stream into the same inbox in real time via Meta\'s webhook events. Live comments are especially useful — community managers can hide spam during a live broadcast, pin a CTA reply, and convert engaged viewers into CRM contacts the moment the Live ends.',
      },
    ],

    related: ['shared-inbox', 'whatsapp-business-api', 'web-chat-widget', 'chat-labels'],
  },

  {
    slug: 'email-inbox',
    name: 'Email Inbox',
    brand: 'Wachat',
    category: 'conversations',
    tagline: 'Threaded email with Gmail/Outlook connectors and per-team signatures.',
    iconKey: 'email',
    color: '#8B5CF6',
    tint: '#F3E8FF',

    seoTitle: 'Team Email Inbox with Gmail & Outlook Sync | SabNode',
    seoDescription:
      'Turn support@ into a real team inbox. Threaded conversations, assignments, SLAs, signatures and CRM context — synced with Gmail and Microsoft 365.',
    keywords: [
      'shared email inbox for teams',
      'support email management software',
      'gmail shared inbox for business',
      'outlook team inbox alternative',
      'help desk email ticketing',
      'collaborative inbox for support@',
      'email inbox with crm integration',
      'email inbox with sla tracking',
      'wachat email inbox sabnode',
      'gmail outlook helpdesk india',
    ],

    hero: {
      eyebrow: 'Wachat · Email Inbox',
      headline: 'Turn support@ into an operating system',
      subhead:
        'Connect Gmail or Microsoft 365 over OAuth and Wachat threads every inbound email into the shared inbox alongside WhatsApp, IG and web chat. Assignments, SLAs, per-team signatures and CRM context arrive instantly. Existing labels and rules are preserved.',
      bullets: [
        'Native Gmail and Microsoft 365 sync',
        'Threaded conversations with full headers',
        'Per-team signatures and reply-to addresses',
        'Bidirectional with Gmail labels and folders',
      ],
    },

    problem: {
      title: 'Email is the channel everyone underestimates',
      body:
        'Most modern support tools treat email like a fading channel — but for B2B SaaS, banking, healthcare and any business with invoices, email is still where 40-70% of post-purchase conversations live. The problem is that "support@" or "billing@" are usually shared Gmail or Outlook accounts where five people log in simultaneously, accidentally archive each other\'s threads, send replies from the wrong signature, and miss SLAs because nobody knows whose turn it is. The CC and BCC spaghetti gets worse the moment a customer loops in their finance team or their legal counsel.\n\nClassic helpdesks like Zendesk and Freshdesk solve this, but at the cost of fragmenting your conversation graph. The same customer who emails support@ also DMs you on Instagram and chats on the website — and in a Zendesk world, those are three separate tickets with three separate IDs, none of which know about each other.\n\nWachat\'s email inbox is built so that an email from raj@example.com lands next to his WhatsApp thread, his Instagram DMs and his web chats. One contact, one history, one assignee. The email itself keeps every header, attachment, threading ID and inline image — Gmail or Outlook continues to work as the underlying transport, but your team works inside the Wachat shared inbox.',
    },

    overview: [
      'Wachat connects to Gmail via Google Workspace OAuth and to Microsoft 365 via Microsoft Graph OAuth, both with the minimum permissions required to read inbox, send mail, and apply labels. Connection takes under 90 seconds and supports both individual addresses (raj@yourdomain.com) and group addresses (support@yourdomain.com). The original mailbox remains the source of truth — every email you send through Wachat lands in the Gmail/Outlook Sent folder with the right headers, so it shows up correctly even when the customer replies from their phone\'s native mail client.',
      'Threading is built on RFC 2822 Message-ID and In-Reply-To headers rather than subject-line matching, which means conversations stay correctly grouped even when a customer changes the subject or starts a new email referencing the old one. Attachments up to 25 MB (Gmail) or 35 MB (Microsoft) are streamed inline; larger files are auto-uploaded to SabNode\'s storage with a signed download link. HTML formatting, inline images and forwarded attachments are preserved exactly as the customer sent them.',
      'Per-team and per-address signatures handle the operational reality: your sales team signs "Priya, Inside Sales" with calendar booking link, while your support team signs "Wachat Support" with help-centre link. Reply-to addresses route correctly — a customer who emails support@ gets a reply from support@, even if the actual agent is replying from her personal account. Out-of-office, vacation responders and per-domain auto-archivers are configurable inside Wachat without touching Gmail or Outlook settings.',
      'Bidirectional sync means Gmail labels and Outlook folders are mirrored as Wachat labels, and label changes flow both ways. Mark a thread "Resolved" in Wachat and it gets the matching Gmail label; archive it in Gmail and it disappears from the Wachat queue. Existing Gmail filters keep working, so the routing rules your team has built up over years are not thrown away.',
    ],

    capabilities: [
      {
        title: 'OAuth Gmail and Outlook',
        body:
          'Connect Google Workspace mailboxes via OAuth 2.0 with offline scope, or Microsoft 365 via Microsoft Graph. No IMAP credentials, no app passwords. Re-auth happens silently on token refresh; admins see a connection-health indicator per address.',
      },
      {
        title: 'RFC-grade threading',
        body:
          'Threading uses Message-ID and In-Reply-To headers, not subject matching. Forwarded emails, replies from mobile mail clients and subject-line changes all collapse correctly into one conversation, preserving the full audit trail.',
      },
      {
        title: 'Per-team signatures',
        body:
          'Configure signatures per team, per address or per agent with rich HTML — logo, calendar link, help-centre URL, legal disclaimer. Wachat picks the right one automatically based on the team handling the conversation and the reply-to address.',
      },
      {
        title: 'Attachment handling up to 35 MB',
        body:
          'Inline attachments up to 25 MB (Gmail) or 35 MB (Microsoft) ride the native mail transport. Larger files are uploaded to SabFiles, replaced with a signed download link that expires after 30 days, and tracked for who opened the file.',
      },
      {
        title: 'Bidirectional label sync',
        body:
          'Gmail labels and Outlook folders mirror as Wachat labels. Apply, remove or rename in either system and changes propagate within 60 seconds. Existing Gmail filter rules keep firing — Wachat does not break what you have already built.',
      },
      {
        title: 'CC, BCC and forward handling',
        body:
          'CC and BCC are visible in the inbox composer with autocomplete from the CRM. Forwarded threads preserve the full quoted history but render only the new content above the fold, so agents see what matters first.',
      },
      {
        title: 'SPF, DKIM and DMARC validation',
        body:
          'Outbound mail uses your domain via DKIM signing, so deliverability matches your existing setup. Inbound mail is parsed for SPF/DKIM/DMARC results and flagged when failures suggest phishing — useful for finance and HR inboxes.',
      },
    ],

    useCases: [
      {
        title: 'B2B SaaS billing queries',
        industry: 'SaaS',
        body:
          'A vertical SaaS routes billing@ emails to a finance team queue with a 4-hour SLA. CC\'d AEs see the thread in their inbox but cannot reply. Invoice attachments are auto-attached to the customer\'s CRM record, and refund requests trigger a Razorpay refund flow with one click — no swivel-chair to Stripe.',
      },
      {
        title: 'Healthcare report delivery',
        industry: 'Healthcare',
        body:
          'A diagnostics lab sends test reports as encrypted PDF attachments from reports@. Wachat threads the patient\'s "where is my report" follow-up email into the same conversation as the original booking on WhatsApp, so the same agent sees full context — no medical history shared across threads.',
      },
      {
        title: 'Recruitment candidate pipeline',
        industry: 'Staffing',
        body:
          'An IT staffing firm uses careers@ as a real inbox. Resumes attached to inbound emails are auto-uploaded to SabFiles, parsed for skills, and a candidate record is created in the CRM. Recruiters reply from a per-role signature ("Sneha, Senior Recruiter, Java Practice") with a Calendly link.',
      },
      {
        title: 'E-commerce post-purchase support',
        industry: 'E-commerce',
        body:
          'A premium furniture retailer threads inbound emails with the order ID into the WhatsApp conversation that originally placed the order. The agent sees the email, the chat, the order line items and the courier ETA in one view, cutting handle time on delivery escalations from 11 minutes to 3.',
      },
      {
        title: 'Finance KYC document collection',
        industry: 'Financial Services',
        body:
          'A lending startup uses kyc@ to collect PAN, Aadhaar and bank statements. Wachat auto-detects MIME types, redacts attachments for non-KYC team members, and flags anything that fails OCR validation. The KYC officer signs off inside the email thread, and the CRM status flips automatically.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Authorise mailbox',
        body:
          'Click "Connect Gmail" or "Connect Outlook", complete the OAuth consent screen, and the mailbox starts syncing within 30 seconds. Historical sync (last 90 days by default) runs in the background.',
      },
      {
        step: '02',
        title: 'Configure signatures',
        body:
          'Set per-team or per-address signatures using the rich-HTML editor. Drop in your logo, calendar link, support URL and legal disclaimer. Preview against light and dark themes before saving.',
      },
      {
        step: '03',
        title: 'Map labels and routing',
        body:
          'Mirror Gmail labels or Outlook folders as Wachat labels. Build routing rules — for example, emails to billing@ with the word "refund" go to a finance senior with a 2-hour SLA.',
      },
      {
        step: '04',
        title: 'Set SLAs and auto-responders',
        body:
          'Define first-response SLAs per address and per label. Configure out-of-office, vacation responders and weekend auto-replies. Wachat respects business hours and holiday calendars per team.',
      },
      {
        step: '05',
        title: 'Train the AI replies',
        body:
          'Feed Wachat\'s AI layer your last 5,000 resolved threads. It learns your tone, common answers and escalation patterns, then suggests replies inline for the agent to accept, edit or discard.',
      },
    ],

    integrations: [
      'Gmail (Google Workspace)',
      'Microsoft 365 / Outlook',
      'HubSpot CRM',
      'Salesforce',
      'Razorpay',
      'Stripe',
      'Calendly',
      'Slack',
    ],

    metrics: [
      { value: '4 min', label: 'Median first-response time on team email inboxes' },
      { value: '60%', label: 'Reduction in email-to-WhatsApp context switching for agents' },
      { value: '0', label: 'IMAP credentials stored — fully OAuth, no shared passwords' },
      { value: '25 MB', label: 'Inline attachment ceiling matching Gmail native limits' },
    ],

    faqs: [
      {
        q: 'Will my existing Gmail filters keep working?',
        a: 'Yes. Wachat does not replace Gmail\'s server-side rules — it sits alongside them. Your existing filters continue to apply labels, archive automatically and forward as configured. Wachat picks up emails as they land in the relevant labels, and any label change Wachat makes is mirrored back to Gmail in under 60 seconds.',
      },
      {
        q: 'Can I keep using Gmail or Outlook directly for some emails?',
        a: 'Absolutely. Wachat is additive. Agents who prefer the native client can still respond from Gmail or Outlook — Wachat sees the sent reply via the Sent folder and updates the conversation. Many teams use the native client for personal email and Wachat for shared inboxes like support@ or sales@.',
      },
      {
        q: 'What happens if the OAuth token expires?',
        a: 'Wachat refreshes tokens silently using the offline scope granted at connection time. If the user revokes access or changes their password, Wachat shows a clear "reconnect" prompt in the inbox with the affected mailbox highlighted, and queues outbound emails for up to 24 hours so nothing is lost during the brief interruption.',
      },
      {
        q: 'Does this support custom domains and aliases?',
        a: 'Yes. Wachat supports any domain configured in Google Workspace or Microsoft 365 — including aliases like sales@, billing@ and brand-specific addresses (support@brandA.com, support@brandB.com). Each alias can route to a different team, carry a different signature, and inherit a different SLA.',
      },
      {
        q: 'How do attachments larger than 25 MB get handled?',
        a: 'Wachat detects attachments exceeding the native mail transport limit, uploads them to SabFiles, replaces the attachment with a signed download link valid for 30 days, and notes in the email body that the original file is hosted securely. The recipient clicks the link to download — no quota issues, no bounced emails for being too large.',
      },
      {
        q: 'Is the historical sync configurable?',
        a: 'Yes. By default Wachat syncs the last 90 days of email on first connect, which covers most active conversations. Admins can extend to 180 days, 365 days or full history, with the trade-off that initial sync takes longer for very large mailboxes (a 100K-thread mailbox takes about 4 hours to backfill). New mail syncs in near real time via Gmail Push and Microsoft Graph subscriptions.',
      },
      {
        q: 'Can I migrate from Zendesk, Freshdesk or Help Scout?',
        a: 'Yes. Wachat provides a one-time importer that ingests CSV exports from Zendesk, Freshdesk and Help Scout, mapping tickets to conversations, agents to users and tags to labels. The migration runs in a sandbox first so you can validate mapping before cutover. Most teams complete a full migration in a weekend with no downtime on the live inbox.',
      },
    ],

    related: ['shared-inbox', 'whatsapp-business-api', 'canned-replies', 'chat-labels'],
  },

  {
    slug: 'web-chat-widget',
    name: 'Web Chat Widget',
    brand: 'Wachat',
    category: 'conversations',
    tagline: 'Embed a chat bubble on your site — inherits the AI layer automatically.',
    iconKey: 'webchat',
    color: '#06B6D4',
    tint: '#CFFAFE',

    seoTitle: 'Embeddable Web Chat Widget with AI Replies | SabNode',
    seoDescription:
      'A 4 KB chat bubble for your site. Routes to humans in-hours, AI otherwise. Page-context aware, fully themed, and unified with WhatsApp & email.',
    keywords: [
      'live chat widget for website',
      'embeddable chat bubble for shopify',
      'ai chat widget for saas pricing pages',
      'chat widget with whatsapp handoff',
      'lightweight chat widget under 10kb',
      'website chat with team routing',
      'web chat with knowledge base ai',
      'replace intercom drift tidio',
      'wachat web widget sabnode',
      'embed chat sdk for nextjs',
    ],

    hero: {
      eyebrow: 'Wachat · Web Chat Widget',
      headline: 'A 4 KB bubble that actually closes deals',
      subhead:
        'Drop one script tag and your site has a chat widget that pulls in your AI knowledge layer, routes to humans during business hours and falls back to bot otherwise. It knows the page the visitor is on, their UTM source, their cart contents and their previous conversations across every channel.',
      bullets: [
        '4 KB gzipped — does not slow your LCP',
        'Page-aware routing (pricing vs docs)',
        'Hand off to WhatsApp with one tap',
        'Fully themeable: colour, position, copy',
      ],
    },

    problem: {
      title: 'Most chat widgets are LCP killers and lead leaks',
      body:
        'Walk through the average B2B SaaS pricing page on a 3G connection and you will find a chat widget that adds 280 KB of JavaScript, blocks the main thread for 600 ms, and shows a "we typically reply in a few hours" message that has not been true since 2019. The visitor scrolls past, the page fails its Largest Contentful Paint budget, and Core Web Vitals tank the SEO score for the entire site. Worse, the lead does not get captured in the CRM because the widget vendor lives in its own silo — a different login, different identity model, different tagging convention.\n\nE-commerce widgets have their own problems. They prompt aggressively, harvest emails to grow a marketing list that gets reported as spam, and have no idea that the visitor just abandoned a cart with three items. When the visitor does chat, the conversation lives in the widget vendor\'s app, separate from the brand\'s WhatsApp Business inbox where the same person was talking to support yesterday.\n\nA modern web widget needs to be small enough to never affect performance, smart enough to know the page context, and connected enough to share state with WhatsApp, Instagram and email. It also has to gracefully hand off — a visitor who starts on web chat at 9pm should be able to continue on WhatsApp the next morning without retyping their problem.',
    },

    overview: [
      'Wachat\'s web widget is a 4 KB gzipped JavaScript shim that lazy-loads the full experience only when the bubble is clicked or after 8 seconds of idle time, whichever comes first. The initial paint adds zero blocking JavaScript and uses passive event listeners, so Core Web Vitals are unaffected. The full chat UI is React-based, loaded on demand, and supports streaming AI responses, file upload, voice messages, emoji and rich cards.',
      'The widget knows what the visitor knows. It captures page URL, page title, scroll depth, time on page, UTM parameters, referrer and screen size on every message. Pricing-page visitors get auto-routed to a sales queue with a "Talk to sales" pre-fill; docs-page visitors get routed to support with a "Ask about the docs" pre-fill; checkout-page visitors who paused get a proactive nudge after 30 seconds of inactivity, offering help with the cart contents that Wachat already knows about via the Shopify or Razorpay integration.',
      'Hand-off to WhatsApp is one tap. A visitor who has typed their question on web chat sees a "Continue on WhatsApp" button that captures their number, sends them an opt-in confirmation template, and continues the same conversation thread in the same shared inbox. Agents do not see a new ticket — they see the same one, now on a different channel, with full history intact. This is the single biggest lift for businesses with mobile-heavy traffic, because customers prefer mobile chat but bounce from desktop widgets.',
      'Theming is comprehensive: bubble colour, position (bottom-right, bottom-left, mid-right), border radius, font family, dark mode, welcome message, idle nudge, attention-grabber animations, and CSS variables for every surface. The widget supports five languages out of the box (English, Hindi, Tamil, Bengali, Spanish) with full UTF-8 input and right-to-left support for future markets. Custom CSS is sandboxed inside a Shadow DOM, so your site\'s styles never bleed into the widget and vice versa.',
    ],

    capabilities: [
      {
        title: '4 KB lazy-load shim',
        body:
          'Initial script is 4 KB gzipped with zero blocking dependencies. Full chat UI lazy-loads on bubble click or after 8s idle. Lighthouse scores are unaffected — measured on a sample of 200 production sites.',
      },
      {
        title: 'Page-aware routing',
        body:
          'The widget knows the page URL, UTM source, referrer and time-on-page. Build rules: pricing-page chats go to sales, docs-page chats to support, blog visitors to a growth bot. Pre-fills the composer with the most likely first message.',
      },
      {
        title: 'WhatsApp hand-off',
        body:
          'One-tap continuation on WhatsApp: the widget captures the phone number, sends the Meta-approved opt-in template, and continues the same thread in the shared inbox. No "ticket #1234" friction, no retyping.',
      },
      {
        title: 'Proactive nudges',
        body:
          'Trigger messages based on time on page, scroll depth, exit intent, returning visitor or specific URL patterns. The cart-page nudge can reference the actual items in the cart, pulled live from Shopify or Razorpay context.',
      },
      {
        title: 'AI fallback after hours',
        body:
          'In business hours, visitors reach a human in under 60 seconds. Out of hours, the AI layer answers from your help centre, product catalogue and past resolved tickets — and queues a human follow-up at the start of the next business window.',
      },
      {
        title: 'Theming and i18n',
        body:
          'Customise colour, position, font, dark mode and copy via the admin UI or JS config. Ships with five languages (English, Hindi, Tamil, Bengali, Spanish) and accepts custom locales. Shadow DOM isolation prevents CSS conflicts.',
      },
      {
        title: 'Identity and CRM sync',
        body:
          'Pass the logged-in user\'s ID, email and JWT-signed attributes to identify visitors deterministically. The widget reconciles to the existing CRM contact, so a returning user sees their full conversation history across web, WhatsApp and email.',
      },
    ],

    useCases: [
      {
        title: 'SaaS pricing page conversion',
        industry: 'SaaS',
        body:
          'A B2B SaaS routes pricing-page chats to AEs with a proactive nudge at 45 seconds: "Want a quote with your team size pre-filled?" The widget reads the segment selector on the page, pre-fills team size in the message, and routes the chat to the AE owning that segment. Demo bookings from pricing page are up 34%.',
      },
      {
        title: 'Shopify cart recovery',
        industry: 'E-commerce',
        body:
          'A D2C apparel brand triggers a widget nudge when a visitor sits on the checkout page for 60 seconds without progressing. The nudge references the cart contents and offers a 5% off code in exchange for chatting. Recovered carts are tagged in the CRM and credited to the widget channel in analytics.',
      },
      {
        title: 'Docs-page support deflection',
        industry: 'SaaS',
        body:
          'A developer-tooling startup uses the widget on its docs site with AI-first answers from the documentation corpus. 78% of chats are resolved without a human, freeing engineers to handle the 22% that involve real bugs or feature requests routed to the appropriate sub-team.',
      },
      {
        title: 'University admissions enquiry',
        industry: 'Education',
        body:
          'A private university widget routes chats from the programme-detail page to the relevant admissions counsellor (MBA, BTech, MSc). Chats outside the 09:00-21:00 window get AI replies and a callback request that creates a CRM lead with the page context attached.',
      },
      {
        title: 'Healthcare appointment booking',
        industry: 'Healthcare',
        body:
          'A specialist clinic widget pulls the doctor\'s next 5 available slots from the practice-management system and offers them inline as buttons. The visitor picks one, confirms via WhatsApp template, and the appointment is created in the EHR — no phone call, no email back-and-forth.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Paste the snippet',
        body:
          'Copy a 3-line script tag from the Wachat admin and paste it into your site head (or a Google Tag Manager tag). The bubble appears immediately with your default theme and welcome message.',
      },
      {
        step: '02',
        title: 'Style and theme',
        body:
          'Use the admin UI to pick brand colour, position, font, dark mode and welcome message. Preview against your live site in the embedded iframe before publishing changes.',
      },
      {
        step: '03',
        title: 'Wire CRM identity',
        body:
          'For logged-in users, call window.wachat.identify({ id, email, name, signature }) with a server-signed JWT so visitors are deterministically matched to existing CRM contacts.',
      },
      {
        step: '04',
        title: 'Build page rules',
        body:
          'Map URL patterns to teams, AI bots and proactive nudges. For example: pricing.* → sales team, /docs/* → AI bot with docs corpus, /checkout → cart-recovery flow.',
      },
      {
        step: '05',
        title: 'Monitor and tune',
        body:
          'Watch the widget dashboard: visitors who saw the bubble, who clicked, who chatted, who converted to a CRM contact, and who handed off to WhatsApp. Iterate nudges weekly based on the conversion funnel.',
      },
    ],

    integrations: [
      'Shopify',
      'WooCommerce',
      'Stripe',
      'Razorpay',
      'Google Tag Manager',
      'Segment',
      'HubSpot CRM',
      'Salesforce',
    ],

    metrics: [
      { value: '4 KB', label: 'Initial gzipped JavaScript footprint before lazy load' },
      { value: '<60s', label: 'Median time to first human response in business hours' },
      { value: '34%', label: 'Lift in demo bookings from pricing-page proactive nudges' },
      { value: '78%', label: 'Docs-site chats resolved by AI without a human handoff' },
    ],

    faqs: [
      {
        q: 'Will the widget hurt my Core Web Vitals?',
        a: 'No. The initial script is 4 KB gzipped and uses defer + idle scheduling, so it adds zero blocking time to LCP. We benchmark on a rolling sample of 200 customer sites and the median Lighthouse Performance score moves less than 0.5 points when the widget is added. The full chat UI loads only on user interaction or 8-second idle.',
      },
      {
        q: 'Can I install it via Google Tag Manager?',
        a: 'Yes. Wachat ships a one-tag GTM template that handles initialisation, identity passing and consent gating. The tag respects Consent Mode v2 — if the user has not accepted analytics cookies, the widget loads in anonymous mode with no identity association. Once consent is granted, identity backfills automatically.',
      },
      {
        q: 'Does it work on single-page apps and Next.js?',
        a: 'Yes. The widget detects route changes via the History API and the Next.js router, so page-context rules fire on client-side navigation. There is a React SDK (npm install @wachat/widget-react) with a hook for identity and a typed event API. For App Router, the script tag goes in the root layout with the next/script strategy="afterInteractive".',
      },
      {
        q: 'How does it handle GDPR and DPDP consent?',
        a: 'The widget integrates with cookie consent platforms (OneTrust, Cookiebot, custom) via a published JS API. Until consent is granted, no cookies are written and identity is treated as anonymous. The widget can be configured to not appear at all until consent is granted, or to appear in a no-personalisation mode that still allows chatting.',
      },
      {
        q: 'Can I customise the welcome message per page?',
        a: 'Yes. Use the admin UI to set per-URL-pattern welcome messages, idle nudges and pre-fill text. For more control, call window.wachat.setContext({ welcome, prefill, nudge }) from your page JavaScript — useful for e-commerce sites that want to reference the specific product the visitor is looking at.',
      },
      {
        q: 'What happens if my visitor closes the tab mid-chat?',
        a: 'The conversation persists on the server, keyed by a long-lived widget ID stored in localStorage. When the visitor returns — same browser or a different page on the same domain — they see the full history. If they identified themselves with an email or phone, they can pick up the conversation from any device after sign-in.',
      },
      {
        q: 'Can the widget hand off to a sales rep with calendar booking?',
        a: 'Yes. The widget supports inline cards including Calendly, HubSpot Meetings and Google Calendar appointment slots. A flow can detect intent like "book a demo", check the AE\'s availability, and offer three time slots as buttons. Selecting one creates the meeting, sends a confirmation email and posts a WhatsApp reminder 24 hours before the call.',
      },
    ],

    related: ['shared-inbox', 'whatsapp-business-api', 'ai-studio', 'business-hours'],
  },

  {
    slug: 'business-hours',
    name: 'Business Hours Routing',
    brand: 'Wachat',
    category: 'conversations',
    tagline: 'Route to humans in-hours, auto-reply otherwise — per team or channel.',
    iconKey: 'clock',
    color: '#F59E0B',
    tint: '#FEF3C7',

    seoTitle: 'Business Hours Routing for Support & Sales Teams | SabNode',
    seoDescription:
      'Per-team and per-channel business hours with holiday calendars, after-hours auto-replies and timezone-aware SLAs across WhatsApp, IG, email and web.',
    keywords: [
      'business hours routing for whatsapp',
      'after hours auto reply for support team',
      'timezone aware support inbox',
      'holiday calendar customer support',
      'per channel business hours routing',
      'sla timer business hours only',
      'office hours auto responder',
      'multi region support team scheduling',
      'wachat business hours sabnode',
      'whatsapp business off hours response',
    ],

    hero: {
      eyebrow: 'Wachat · Business Hours',
      headline: 'Send replies when humans are awake',
      subhead:
        'Configure business hours per team, per channel and per region with a holiday calendar that respects Diwali, Eid, Christmas and your bank-holiday list. SLAs pause overnight, after-hours auto-replies set expectations, and WhatsApp-window-aware bots keep conversations alive until morning.',
      bullets: [
        'Per-team and per-channel hours',
        'Holiday calendar with regional presets',
        'SLA timers that pause off-hours',
        'After-hours WhatsApp template auto-reply',
      ],
    },

    problem: {
      title: 'After-hours messages are quietly killing CSAT',
      body:
        'A customer sends a WhatsApp message at 11:42 pm on a Sunday asking about an order. Nobody is online. By the time your team reaches the queue at 9 am Monday — assuming Monday is not Eid — the customer has already DMed you on Instagram, tweeted at you, and opened a chargeback dispute. The original WhatsApp service window is hours from expiring, so even when an agent eventually replies, they may be forced into an awkward template re-engagement. The team did nothing wrong; the system simply had no way to acknowledge the message and set expectations.\n\nThe inverse failure is just as bad. A US-based founder pings your sales chat at 2pm Pacific — which is 2:30 am IST — and gets an instant reply from a junior agent who is technically logged in but should be asleep. The reply is rushed, the lead is mis-qualified, and the founder thinks the company is either an offshore sweatshop or unprofessional.\n\nBusiness hours routing is the small, boring feature that fixes both of these. Configured properly, it tells the customer when to expect a reply, hands the conversation to a bot or AI that can actually help in the meantime, and resumes the SLA clock only when humans are around to honour it. It also lets you run a follow-the-sun model with a Delhi day team and a Lisbon evening team without anyone burning out.',
    },

    overview: [
      'Wachat lets you define business hours at three levels: workspace (the company default), team (Sales, Support, Tier 2), and channel (WhatsApp Sales, Web Chat Docs, Email Billing). Hours are timezone-aware and can be different for each weekday — for example, Sales might run 09:00-19:00 IST Monday to Friday and 10:00-15:00 IST on Saturdays. Holiday calendars apply automatically: pick from regional presets (India national + state-level for Maharashtra, Tamil Nadu, West Bengal, Karnataka etc., plus US, UK, EU defaults) or upload a CSV of custom dates with full or half-day designations.',
      'When a message arrives outside business hours, Wachat fires the after-hours rule for the targeted team or channel. The rule can send a free-form text (for web chat and Instagram inside their respective message windows), trigger a flow (collect priority, route to on-call), or send a Meta-approved Utility template for WhatsApp (since free-form sends are only valid inside the 24-hour service window, but inbound messages auto-open that window). The auto-reply can include the expected response time computed from the next business hours block — "We\'ll be back at 09:00 IST tomorrow, about 11 hours from now" — instead of a generic "we are away".',
      'SLA timers respect business hours. A "first response within 30 minutes" SLA on the Sales team only counts minutes that fall inside Sales\' business hours. If a message arrives at 22:00, the timer does not start until 09:00 the next morning, so agents are not penalised for breaches caused by company policy. Supervisors see the projected SLA deadline ("by 09:30 tomorrow") in the queue, not a misleading "30 minutes" countdown.',
      'For multi-region teams, Wachat supports follow-the-sun routing. Configure a Delhi team running 09:00-19:00 IST, a Lisbon team running 09:00-19:00 WET, and an Austin team running 09:00-19:00 CT, and Wachat hands conversations across regions automatically as each team starts and ends their day. The handover note ("escalating to Lisbon — last message was a refund request, customer is verified") generates with an AI summary so the receiving region picks up cold cases warm.',
    ],

    capabilities: [
      {
        title: 'Three-level hour scopes',
        body:
          'Define business hours at workspace, team and channel level. Specific scopes override broader ones. Per-weekday and per-half-day granularity supports the messy reality of Indian operations — Saturday half-days, Sunday Sales-only, etc.',
      },
      {
        title: 'Regional holiday presets',
        body:
          'One-click presets for India national holidays plus state-level lists (Maharashtra, Tamil Nadu, West Bengal, Karnataka, Delhi, Gujarat). Also US, UK, EU and Singapore defaults. CSV upload for custom internal holidays like "founders\' day".',
      },
      {
        title: 'Channel-aware after-hours replies',
        body:
          'WhatsApp gets a Meta-approved Utility template auto-reply; web chat gets a free-form message with the next-open ETA; email gets a polite auto-responder with the expected SLA. Each is configured separately and tested in the admin UI.',
      },
      {
        title: 'Business-hours SLAs',
        body:
          'SLA timers pause off-hours and resume at the next business window. The queue shows projected breach time in the local timezone of the assigned team, not a misleading raw countdown.',
      },
      {
        title: 'Follow-the-sun routing',
        body:
          'Hand conversations across regional teams automatically as time zones rotate. The leaving team\'s AI-generated handover note ("customer wants refund, order #3421, opened 2h ago") attaches to the conversation for the receiving team.',
      },
      {
        title: 'On-call escalation override',
        body:
          'Mark conversations as VIP, P0 or escalated and they bypass off-hours rules — paging the on-call agent via Slack, SMS or push notification. Useful for enterprise contracts with 24x7 SLAs on a subset of customers.',
      },
      {
        title: 'Customer-facing hours widget',
        body:
          'Show your business hours on the web widget and in WhatsApp greetings via a merge field. The customer always knows when to expect a reply, which reduces "are you there?" follow-ups by roughly half in our customer cohort.',
      },
    ],

    useCases: [
      {
        title: 'Sole-founder consultancy',
        industry: 'Professional Services',
        body:
          'A solo consultant running a 60-customer book sets business hours 10:00-18:00 IST Monday to Thursday, and pure-AI Friday to Sunday. The AI handles 70% of weekend questions; the rest queue up as Monday 10:00 tasks with the conversation summary at the top, so Friday\'s pizza night stays uninterrupted.',
      },
      {
        title: 'D2C brand with night cart questions',
        industry: 'E-commerce',
        body:
          'A skincare D2C brand sees 40% of cart-question WhatsApps arrive between 22:00 and 02:00 IST. After-hours auto-reply sends a Utility template confirming receipt with an order-status link and a "we\'ll reply by 09:00" promise. Morning agents pick up an already-acknowledged queue, cutting abandoned carts by 14%.',
      },
      {
        title: 'B2B SaaS with enterprise contracts',
        industry: 'SaaS',
        body:
          'A vertical SaaS runs business hours for standard customers but enables 24x7 routing for enterprise VIPs tagged in the CRM. The on-call rotation in PagerDuty is wired in — a P0 ticket from a VIP pages the on-call engineer in 90 seconds, even at 3 am, while standard customers see the polite "back at 09:00" template.',
      },
      {
        title: 'Edtech with international students',
        industry: 'Education',
        body:
          'A test-prep platform serves students in India, the Gulf and Southeast Asia. Three regional teams run 09:00-21:00 in their own zones, with handovers and AI summaries. A student in Dubai who messages at 22:00 GST hits the India late shift, not a closed inbox.',
      },
      {
        title: 'Multi-clinic healthcare chain',
        industry: 'Healthcare',
        body:
          'A 14-clinic dental chain has different hours per branch. Wachat routes WhatsApp messages to the nearest clinic\'s local team during their hours, and to a central night team for genuine emergencies — with the patient\'s last visit and treatment plan attached, regardless of which clinic they normally attend.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Define workspace defaults',
        body:
          'Set your workspace timezone, default business hours (e.g. 10:00-18:00 IST Mon-Sat), and pick a holiday-calendar preset for your region. This becomes the fallback for everything.',
      },
      {
        step: '02',
        title: 'Override per team',
        body:
          'Sales might run earlier and later; Tier 1 Support might cover full weekdays; Tier 2 Engineering might be weekday-only with on-call rotation. Configure each team\'s hours and exceptions.',
      },
      {
        step: '03',
        title: 'Channel-specific rules',
        body:
          'Set WhatsApp Sales to 09:00-21:00, Web Chat Docs to 10:00-19:00, Email Billing to 10:00-18:00. Each gets its own after-hours auto-reply tuned to the channel and audience.',
      },
      {
        step: '04',
        title: 'Wire SLAs',
        body:
          'Define first-response and resolution SLAs per team and channel, with the option to apply them business-hours-only or 24x7. Configure breach alerts (email, Slack, push) for assignees and supervisors.',
      },
      {
        step: '05',
        title: 'Test and monitor',
        body:
          'Use the simulator to send a test message at any chosen time and see which rule fires. Monitor the after-hours dashboard: messages received off-hours, auto-replies sent, AI conversations resolved, and follow-up rate when the team logs back in.',
      },
    ],

    integrations: [
      'WhatsApp Cloud API',
      'Instagram Graph API',
      'Gmail / Microsoft 365',
      'Slack',
      'PagerDuty',
      'Google Calendar',
      'Microsoft Calendar',
      'Zapier',
    ],

    metrics: [
      { value: '11h', label: 'Average after-hours window covered by AI auto-replies' },
      { value: '14%', label: 'Reduction in abandoned carts via after-hours acknowledgement' },
      { value: '92%', label: 'Customer satisfaction on after-hours WhatsApp template replies' },
      { value: '0', label: 'SLA breaches counted during configured non-working hours' },
    ],

    faqs: [
      {
        q: 'Can I run different hours for different brands in the same workspace?',
        a: 'Yes. Wachat supports multiple brands within a single workspace, each with its own set of channels, teams and business hours. A premium beauty brand can run 24x7 sales support while its sister value brand runs 10:00-18:00 — both billed on the same plan, with completely independent routing rules.',
      },
      {
        q: 'How are holidays detected — do I need to update them every year?',
        a: 'Wachat\'s regional presets auto-renew each calendar year with verified holiday data including state-level Indian holidays. You can override individual dates (e.g. your company observes Republic Day but not Independence Day) and add custom dates like founder\'s day or all-hands. The admin UI shows the next 90 days of upcoming holidays for any selected calendar.',
      },
      {
        q: 'What about WhatsApp\'s 24-hour service window after-hours?',
        a: 'Wachat is fully aware of the 24-hour window per contact. When a customer messages you at midnight, the window opens — but you can still send a Meta-approved Utility template as the auto-reply, which counts against template messaging not the free-form quota. The template sets expectation and stays inside Meta policy. Free-form replies pause until morning.',
      },
      {
        q: 'Can SLAs be business-hours-only for some teams and 24x7 for others?',
        a: 'Yes, per team and per label. Standard Tier 1 SLAs typically run business-hours-only. Enterprise VIPs flagged in the CRM get 24x7 SLAs with on-call escalation. P0 incident tickets escalate immediately regardless of time. The mix is configurable without writing code — every routing rule has a toggle for hours-respecting vs always-on.',
      },
      {
        q: 'Does the AI bot keep the conversation going overnight?',
        a: 'Yes. The same AI Studio assistant your team uses inside business hours runs autonomously overnight. It can answer from the help centre, lookup orders, trigger refunds within policy thresholds, and book calendar slots. Anything it cannot handle queues up with a tag like "AI-needs-human" so morning agents see a clean priority list, not a wall of unread messages.',
      },
      {
        q: 'Can I get a Slack alert for messages that arrive off-hours?',
        a: 'Yes, with filters. Configure the off-hours Slack alert to fire only for VIP tags, P0 priorities or specific keywords like "outage" or "refund". This prevents alert fatigue — the team is not pinged for routine after-hours questions that the AI bot is already handling, but a flagged escalation still wakes the on-call.',
      },
      {
        q: 'How do I handle half-day Saturdays?',
        a: 'Per-weekday hours support half-days natively. Set Saturday to 10:00-14:00 with the rest of the day treated as after-hours, complete with its own auto-reply ("We\'re open mornings only on Saturdays — back at 10:00 Monday"). The SLA timer respects the configured half-day, and Sunday inherits the after-hours treatment automatically.',
      },
    ],

    related: ['shared-inbox', 'whatsapp-business-api', 'chatbot-rules', 'canned-replies'],
  },

  {
    slug: 'canned-replies',
    name: 'Canned Replies',
    brand: 'Wachat',
    category: 'conversations',
    tagline: 'Shared library of reply snippets with merge fields and keyboard shortcuts.',
    iconKey: 'reply',
    color: '#EC4899',
    tint: '#FCE7F3',

    seoTitle: 'Canned Replies & Snippets for Support Teams | SabNode',
    seoDescription:
      'Shared library of reply snippets with merge fields, attachments, keyboard shortcuts and team-specific permissions across WhatsApp, IG and email.',
    keywords: [
      'canned replies for whatsapp business',
      'reply snippets with merge fields',
      'shared reply library for support team',
      'keyboard shortcuts customer support',
      'saved replies with attachments',
      'standard responses customer service',
      'reply templates multi language',
      'macro library helpdesk',
      'wachat canned replies sabnode',
      'shortcut text expander support',
    ],

    hero: {
      eyebrow: 'Wachat · Canned Replies',
      headline: 'A team library that types itself',
      subhead:
        'Build a shared library of reply snippets with merge fields, attachments and keyboard shortcuts. Agents trigger them with a slash command, and the AI layer suggests the right snippet based on the incoming message. New hires sound like five-year veterans on day one.',
      bullets: [
        'Slash commands like /refund or /shipping',
        'Merge fields pull from CRM live',
        'Attach PDFs, images and SabFiles',
        'Per-team scopes and translation packs',
      ],
    },

    problem: {
      title: 'Every team rewrites the same reply 400 times',
      body:
        'Pull up any support inbox and you will find the same five answers retyped in slightly different ways: "Yes, we ship to PIN code XYZ, here is the shipping policy link"; "Your order is on the way, here is the tracking link"; "Please share your order ID and registered phone number"; "I have processed the refund, you should see it in 5-7 working days." Every agent has their own slightly off version with a typo, a different tone, or a missing crucial detail. Customers get inconsistent answers, brand voice drifts, and seasoned agents end up coaching juniors by Slack DM on what to copy-paste — which itself becomes a tribal knowledge bottleneck.\n\nThe old solution was a Notion doc with reply templates, which works for the first two weeks and then rots. Nobody updates it, nobody can find the right answer fast enough in the heat of a queue, and the merge fields are still manual — agents copy "[ORDER_ID]" and forget to swap in the real value.\n\nA proper canned-reply system is a small piece of software that disproportionately affects quality. Done right, an agent types "/refund" and the right snippet appears with the order ID, customer name and refund amount already merged, the policy PDF attached, and the tone matching the brand. New hires hit production-grade replies on day one, supervisors update the canon centrally, and the team\'s collective experience stops walking out the door when someone leaves.',
    },

    overview: [
      'Wachat\'s canned replies live in a shared library scoped per workspace, with folders for teams (Sales, Support, Billing), languages (English, Hindi, Tamil, Bengali) and channels (WhatsApp can use interactive button templates that web chat cannot). Each snippet has a title, a shortcut (e.g. /shipping, /refund-7days), a body with Liquid-style merge fields like {{contact.first_name}} or {{order.tracking_url}}, optional attachments, and tone/voice tags so the AI layer knows when to suggest it.',
      'The composer integrates the library at three levels of agent effort. The lazy path is "/" which opens a fuzzy-search picker over the entire library scoped to the agent\'s team. The medium path is typing the shortcut directly — /refund7d expands to the full snippet inline, like a text expander. The zero-effort path is AI suggestion: as the customer message arrives, Wachat\'s AI suggests the top-3 most likely snippets ranked by past usage and message similarity, and the agent presses Tab to accept.',
      'Merge fields pull live from the contact, the conversation, the linked order, the active flow run, the assigned agent and a few well-known constants. They support filters and defaults — {{order.total | currency: "INR" }} or {{contact.first_name | default: "there"}} — so a missing field never produces an awkward "Hi ," reply. The preview pane in the snippet editor renders against a sample contact so authors can validate output before publishing.',
      'Attachments are first-class. Pin a tracking-policy PDF to the /shipping snippet, a refund-process diagram to /refund, a Calendly link card to /book-call, and they travel with the snippet on every channel that supports them. On WhatsApp, the attachment uses Meta\'s media upload pipeline transparently; on email, it goes as an attachment; on web chat, it goes as a downloadable file card. SabFiles links handle anything too large for native channel limits.',
    ],

    capabilities: [
      {
        title: 'Slash command picker',
        body:
          'Type "/" in the composer to open a fuzzy search across the entire library scoped to the agent\'s team. Hit enter to insert; the merge fields populate from the current contact and conversation in under 50 ms.',
      },
      {
        title: 'Merge fields with filters',
        body:
          'Liquid-style variables pull from contact, conversation, order, flow run and workspace. Filters handle currency, date, name capitalisation and defaults so a missing field never renders blank or breaks the sentence.',
      },
      {
        title: 'Attachments and rich cards',
        body:
          'Pin PDFs, images, SabFiles links, Calendly cards or product catalogue items to a snippet. They travel correctly to WhatsApp, Instagram, email and web chat using each channel\'s native media handling.',
      },
      {
        title: 'AI-suggested snippets',
        body:
          'As a customer message arrives, Wachat\'s AI ranks the top-3 most relevant snippets by past usage, message similarity and customer segment. The agent accepts with Tab, edits with Enter, or ignores — and the model learns from the choice.',
      },
      {
        title: 'Team scopes and permissions',
        body:
          'Scope snippets to teams (Support only, Sales only) or roles (senior agents only for the /escalate-vip snippet). Public snippets are visible to everyone; private snippets are personal drafts that do not pollute the team list.',
      },
      {
        title: 'Multilingual variants',
        body:
          'One logical snippet can have variants per language: /shipping has English, Hindi, Tamil and Bengali versions. Wachat picks the right variant based on the contact\'s detected language or explicit preference, falling back to English.',
      },
      {
        title: 'Usage analytics',
        body:
          'Per-snippet metrics: how many times used, by which agents, in what channels, with what CSAT outcome. Identify the snippets that drive high CSAT to promote, and the snippets that correlate with bad outcomes to retire or rewrite.',
      },
    ],

    useCases: [
      {
        title: 'E-commerce returns desk',
        industry: 'E-commerce',
        body:
          'A footwear brand has 22 canned replies covering size exchange, return pickup, refund timeline, replacement issue, damaged item and quality dispute. /size-exchange auto-populates the order ID, current size and recommended size from the order; the agent reviews and sends in 4 seconds instead of 90.',
      },
      {
        title: 'SaaS onboarding pod',
        industry: 'SaaS',
        body:
          'A vertical SaaS uses canned replies for the first 14 days of every trial: /welcome-day1, /day3-checkin, /demo-booking, /admin-setup, /api-keys. Snippets include personalised Loom links generated by a flow, with the AE\'s name and Calendly URL merged in. Trial-to-paid conversion is up 18%.',
      },
      {
        title: 'Banking KYC desk',
        industry: 'Financial Services',
        body:
          'A neobank maintains 35 canned replies for KYC and account-opening scenarios. Each has the regulatory copy reviewed by compliance, with merge fields for PAN, Aadhaar masking, and required document list. New hires can handle Tier 1 KYC queries from week two with zero compliance escapes.',
      },
      {
        title: 'Travel agency itinerary share',
        industry: 'Travel & Hospitality',
        body:
          'A boutique travel agency uses /itinerary to send a PDF day-wise plan, /visa-checklist for the destination-specific visa docs, and /booking-confirm for the deposit invoice. Snippets are versioned per season and per destination, so monsoon-Goa and winter-Goa get different recommendations.',
      },
      {
        title: 'Edtech course support',
        industry: 'Education',
        body:
          'A coding bootcamp uses canned replies for course access (/reset-password, /lms-access, /class-schedule), submission help (/upload-issue, /grading-timeline) and refund policy (/refund-pre-week2). Hindi and English variants share one shortcut; the contact\'s preferred language picks the right one automatically.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Seed from past conversations',
        body:
          'Wachat scans your last 90 days of resolved conversations, clusters frequent replies, and suggests 20-40 starter canned replies with shortcuts. Review, edit and approve in bulk — most teams ship the initial library in under an hour.',
      },
      {
        step: '02',
        title: 'Add merge fields',
        body:
          'Open each snippet and replace hard-coded names, order IDs and amounts with merge fields. Preview against a sample contact in the right pane. Save and publish; the snippet is immediately available in every agent\'s composer.',
      },
      {
        step: '03',
        title: 'Attach files and cards',
        body:
          'Pin PDFs, images, Calendly bookings, product cards or SabFiles links. Verify each channel renders the attachment correctly (WhatsApp media, email attachment, web-chat card) using the preview tool.',
      },
      {
        step: '04',
        title: 'Train the AI suggester',
        body:
          'Enable AI-suggested snippets. The model learns from the team\'s acceptance and edit patterns over the first 1-2 weeks. Suggested snippet accuracy typically reaches 70%+ after 500 conversations.',
      },
      {
        step: '05',
        title: 'Review usage weekly',
        body:
          'Open the analytics view. Promote the high-CSAT snippets, rewrite the low-CSAT ones, and retire any that have not been used in 30 days. Treat the library like a product backlog, not a static doc.',
      },
    ],

    integrations: [
      'WhatsApp Cloud API',
      'Instagram Graph API',
      'Gmail / Microsoft 365',
      'Shopify',
      'Razorpay',
      'Calendly',
      'SabFiles',
      'HubSpot CRM',
    ],

    metrics: [
      { value: '85%', label: 'Of agent replies on busy teams come from canned snippets' },
      { value: '4s', label: 'Median time from message arrival to canned reply sent' },
      { value: '70%+', label: 'AI-suggested snippet acceptance rate after 2 weeks of training' },
      { value: '3.2×', label: 'Faster ramp time for new agent hires to reach productivity' },
    ],

    faqs: [
      {
        q: 'Can canned replies be different per channel?',
        a: 'Yes. A snippet can target WhatsApp, Instagram, email, web chat or all. WhatsApp variants can include interactive buttons and lists; email variants can include rich HTML and inline images; web chat variants can include cards and quick reply buttons. Wachat picks the right variant automatically based on the current channel, with a fallback to plain text if needed.',
      },
      {
        q: 'What merge fields are available?',
        a: 'Contact fields (name, phone, email, all custom attributes), conversation fields (channel, assignee, labels, language), order fields (when linked to a Shopify or WooCommerce order — total, status, tracking, items), flow fields (any variable set during the flow run), agent fields (name, signature, calendar link), and workspace constants (support URL, business hours, returns policy URL).',
      },
      {
        q: 'How do I prevent agents from sending the wrong snippet?',
        a: 'Three layers of protection. First, scope snippets to teams and roles so juniors cannot send /refund-vip. Second, require approval on high-risk snippets (refunds, escalations) — the senior agent gets a 30-second approval prompt before the message goes out. Third, the audit log records every snippet send for post-hoc review and coaching.',
      },
      {
        q: 'Can I bulk-edit snippets when a policy changes?',
        a: 'Yes. The library supports tagging snippets with keywords (e.g. "refund-policy", "shipping-policy") and bulk editing all snippets tagged with one. Useful when the refund window changes from 7 to 10 days — find all snippets that reference the old window, edit them in batch, and republish in one save.',
      },
      {
        q: 'Does the AI learn which snippet I prefer?',
        a: 'Yes. The AI suggester runs a per-agent personalisation layer on top of the team-wide ranking. If you consistently choose the more formal variant of /refund over the casual one, your suggestions tilt formal. Team-wide patterns still influence base ranking, but individual style preferences are respected.',
      },
      {
        q: 'Can I export the library and version-control it?',
        a: 'Yes. The entire library exports to YAML or JSON, complete with merge fields, attachments (as SabFiles URLs) and team scopes. You can keep it in git, review changes via pull requests, and import back. This is especially useful for regulated industries where every customer-facing message must be reviewed by compliance.',
      },
      {
        q: 'What happens if a merge field has no value?',
        a: 'Wachat uses the |default: filter to fall back gracefully. For example, {{contact.first_name | default: "there"}} renders "Hi there" if the first name is blank, instead of "Hi ,". The snippet editor flags any merge field without a default during validation, so unsafe snippets cannot be published.',
      },
    ],

    related: ['shared-inbox', 'ai-studio', 'whatsapp-business-api', 'chat-labels'],
  },

  {
    slug: 'chat-labels',
    name: 'Chat Labels',
    brand: 'Wachat',
    category: 'conversations',
    tagline: 'Color-coded labels, auto-tagging rules and per-label SLA timers.',
    iconKey: 'tag',
    color: '#10B981',
    tint: '#D1FAE5',

    seoTitle: 'Chat Labels with Auto-Tagging & Per-Label SLAs | SabNode',
    seoDescription:
      'Color-coded labels with regex-based auto-tagging, per-label SLA timers and bulk filters across WhatsApp, Instagram, email and web chat conversations.',
    keywords: [
      'chat labels auto tagging support',
      'conversation tagging for whatsapp business',
      'per label sla timer support',
      'regex auto tag customer conversations',
      'color coded labels inbox',
      'bulk filter conversations by tag',
      'whatsapp conversation tags analytics',
      'inbox label rules engine',
      'wachat chat labels sabnode',
      'customer support label taxonomy',
    ],

    hero: {
      eyebrow: 'Wachat · Chat Labels',
      headline: 'Labels that actually drive the queue',
      subhead:
        'Color-coded labels with regex and AI-powered auto-tagging, per-label SLAs, routing rules and bulk filters. Stop asking agents to remember to tag — let the rules engine do it the moment the message lands, then report on every label as a first-class metric.',
      bullets: [
        'Regex + AI auto-tagging on inbound',
        'Per-label SLAs and escalation rules',
        'Bulk re-label and snooze by filter',
        'Label-level dashboards and exports',
      ],
    },

    problem: {
      title: 'Tags rot when humans have to remember them',
      body:
        'Most teams set up labels in their first week of using a support tool — Refund, Bug, Feature Request, VIP, Billing, Sales — and within a month nobody is applying them consistently. The senior agent tags everything; the juniors forget; the analytics dashboard becomes useless because half the conversations are untagged or wrongly tagged. By month three, leadership is asking "how many refund requests did we get last month?" and the honest answer is "we don\'t really know — maybe 200, maybe 600".\n\nThe second failure mode is labels with no consequence. A conversation gets tagged "VIP" but nothing changes — same queue, same SLA, same agent. Labels become a write-only descriptor instead of a control mechanism. Operators eventually stop trusting the system and rebuild routing logic in their head, defeating the entire point of having tags.\n\nWachat\'s chat labels are designed so that tagging happens automatically and labels actively drive behaviour. A label is a first-class object with a colour, an icon, optional SLA overrides, optional routing rules, optional auto-replies, and analytics. The label "Refund" might have a 30-minute SLA, route to the finance team, trigger an internal note to the assignee, and roll up into a weekly executive report — all without an agent ever clicking "Add label".',
    },

    overview: [
      'Wachat labels are workspace-scoped objects with a name, colour (12-step palette), icon, description and parent (for hierarchical labels like "Refund > Damaged" and "Refund > Wrong size"). Any conversation can have any number of labels, applied manually by an agent, automatically by a rule, or by the AI tagger. The label panel in the inbox shows active labels as removable chips with their colours; the queue filter supports any combination of include/exclude labels for precision triage.',
      'Auto-tagging runs on every inbound message. Rules can use exact keyword match, regex (full PCRE), customer attribute conditions (e.g. ltv > 50000), order conditions (e.g. order total > 10k), channel filters, or AI-based intent classification. A typical setup might be: regex /refund|return|money back/i tags "Refund"; regex /not working|broken|error/i tags "Bug Report"; AI intent "complaint" tags "Escalation"; CRM lookup "ltv > 50000" tags "VIP". Multiple rules can apply to one message; the conversation accumulates the union of all matched labels.',
      'Each label can carry its own behaviour. A "VIP" label can override the default SLA from 30 minutes to 10 minutes, force assignment to a senior agent pool, post a Slack alert and pin the conversation to the top of every queue. A "Refund" label can route to the finance team, attach the company\'s refund policy as an internal note, and require a senior agent\'s approval before resolution. The behaviour is configured per label in the admin UI — no flow needed for most cases.',
      'Analytics treat every label as a measurable dimension. The labels dashboard shows volume, average response time, average resolution time, CSAT and revenue impact per label per week. Export by label to CSV for board reports, slice by label inside the analytics module, or use labels as audience criteria in Broadcasts ("send to all contacts with the Bug-Report label closed in the last 30 days"). Labels become the spine of the company\'s operational view of its customer conversations.',
    ],

    capabilities: [
      {
        title: 'Color-coded label library',
        body:
          'Create unlimited labels with name, colour, icon, parent and description. The 12-step palette is colourblind-safe, and labels render as chips in the queue, the conversation header and inside reports for instant visual scan.',
      },
      {
        title: 'Regex auto-tagging',
        body:
          'PCRE-flavoured regex rules run on inbound message text. Case-insensitive, multi-line and lookahead supported. Test rules against historical conversations in the rule editor before publishing — see how many would have matched in the last 30 days.',
      },
      {
        title: 'AI intent classification',
        body:
          'A trained classifier maps inbound messages to intents (complaint, refund, sales-enquiry, technical-issue, praise, spam) with confidence scores. High-confidence matches tag automatically; low-confidence ones queue for human review with the suggested label.',
      },
      {
        title: 'Per-label SLAs',
        body:
          'Override the team or channel SLA when a label is applied. VIP gets 10 minutes; Refund gets 30 minutes; Bug Report gets 4 hours. The most aggressive applicable SLA wins, so a VIP refund still triggers the 10-minute clock.',
      },
      {
        title: 'Label-driven routing',
        body:
          'When a label is applied, optionally re-assign the conversation to a specific team or agent. A "Refund" label routes to finance; "Billing" routes to accounting; "Bug Report" routes to the on-call engineer. Routing fires once per label application to avoid loops.',
      },
      {
        title: 'Bulk operations',
        body:
          'Filter the queue by any label combination and apply bulk actions: re-assign, re-label, snooze, send a broadcast template to all linked contacts, or export. Useful for backlog cleanup and for running a campaign targeted at a specific customer state.',
      },
      {
        title: 'Label analytics',
        body:
          'Per-label dashboards: volume, response time, resolution time, CSAT, revenue and refund amount linked. Compare labels week over week, segment by channel, or drill into individual conversations from any cell of the dashboard.',
      },
    ],

    useCases: [
      {
        title: 'D2C refund taxonomy',
        industry: 'E-commerce',
        body:
          'A skincare brand has parent label "Refund" with children "Damaged", "Wrong Size", "Allergic Reaction", "Changed Mind", "Late Delivery". Auto-tagging routes "Allergic Reaction" to a senior agent with a 15-minute SLA and a templated apology. Monthly board report shows refund volume by reason without anyone manually classifying anything.',
      },
      {
        title: 'SaaS bug triage',
        industry: 'SaaS',
        body:
          'A B2B SaaS auto-tags "Bug Report" on messages matching error code regex like /\\bE\\d{4}\\b/, then routes to the engineering on-call channel in Slack with the customer\'s plan tier and account ID. Bugs from enterprise accounts get a "P0" sub-label that triggers PagerDuty; everyone else gets a 24-hour SLA.',
      },
      {
        title: 'Healthcare emergency flagging',
        industry: 'Healthcare',
        body:
          'A telemedicine platform auto-tags "Emergency" when messages match keywords like "chest pain", "bleeding", "unconscious" with high AI-classifier confidence. The label triggers an immediate call to the on-call doctor and a templated message to the patient with the nearest hospital from their location.',
      },
      {
        title: 'Financial services KYC',
        industry: 'Financial Services',
        body:
          'A lending app auto-tags messages with attached documents as "KYC-Submitted" and routes to the KYC team. AI classifies whether the document is PAN, Aadhaar or bank statement, then sub-labels accordingly. The dashboard tracks KYC turnaround time and rejection reasons per document type.',
      },
      {
        title: 'Edtech VIP cohort',
        industry: 'Education',
        body:
          'An online MBA programme tags students from corporate-sponsored cohorts as "VIP-Corporate" via CRM attribute lookup on inbound. These get a 10-minute SLA, priority assignment to the senior counsellor, and quarterly satisfaction surveys auto-triggered by the label state.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Design your taxonomy',
        body:
          'Plan 10-20 starter labels organised hierarchically. Wachat\'s setup wizard suggests common patterns by industry (e-commerce, SaaS, healthcare) which most teams adopt with minor tweaks.',
      },
      {
        step: '02',
        title: 'Build auto-tagging rules',
        body:
          'Open the rules editor. Write keyword, regex, AI-intent or attribute conditions. Test each rule against the last 30 days of conversations — Wachat shows how many would have matched and which.',
      },
      {
        step: '03',
        title: 'Wire label behaviours',
        body:
          'Per label, configure overrides: SLA, routing, internal notes, Slack alerts, auto-replies. A label without a behaviour is just a descriptor; a label with behaviours is a control surface.',
      },
      {
        step: '04',
        title: 'Backfill historical data',
        body:
          'Run auto-tagging rules across the entire conversation history (or last 90 days) in a background job. This produces meaningful analytics from day one instead of waiting weeks for forward-looking data.',
      },
      {
        step: '05',
        title: 'Iterate weekly',
        body:
          'Review the label analytics dashboard. Add new labels for emerging patterns, retire labels with under 10 hits per month, and tune rules with low precision. Treat the taxonomy as a living artefact.',
      },
    ],

    integrations: [
      'WhatsApp Cloud API',
      'Instagram Graph API',
      'Gmail / Microsoft 365',
      'Slack',
      'PagerDuty',
      'Google Sheets',
      'HubSpot CRM',
      'Zapier',
    ],

    metrics: [
      { value: '94%', label: 'Of conversations auto-tagged within 2 seconds of arrival' },
      { value: '12', label: 'Average number of active labels per mid-sized customer team' },
      { value: '0.2%', label: 'Mis-tag rate after AI classifier reaches steady-state training' },
      { value: '6×', label: 'Faster monthly board reporting using label-driven exports' },
    ],

    faqs: [
      {
        q: 'How many labels should a team have?',
        a: 'Most healthy taxonomies sit between 15 and 40 active labels. Below 10 and you lose granularity; above 60 and the queue becomes visually overwhelming and analytics get noisy. Use hierarchical parent/child labels to expand without bloating — "Refund" with five children gives you both summary and detail views without cluttering the chip space in the conversation header.',
      },
      {
        q: 'Can a conversation have multiple labels?',
        a: 'Yes. A conversation can carry any number of labels simultaneously — for example, "VIP", "Refund", "Damaged" and "Hindi" all on the same thread. Each label\'s behaviour (SLA, routing) applies, with the most aggressive SLA winning if there is a conflict. The queue filter supports any boolean combination of include/exclude labels.',
      },
      {
        q: 'Do regex rules support Unicode and Indic scripts?',
        a: 'Yes. The regex engine is full UTF-8 and PCRE-compatible, so you can match Hindi, Tamil, Bengali and other Indic scripts directly. The rule tester previews matches in-script. Most teams build both English and regional-language rules for the same intent — for example, two rules tagging "Refund" matching English and Hindi keywords respectively.',
      },
      {
        q: 'How accurate is the AI intent classifier?',
        a: 'After 500-1000 labelled conversations in training, the classifier typically reaches 88-94% precision for common intents like refund, complaint, sales-enquiry. Lower-volume intents need more training data. The classifier outputs a confidence score, so you can set a high threshold (e.g. 0.85) for auto-apply and queue lower-confidence matches for human review with the suggestion attached.',
      },
      {
        q: 'Can I use labels in Broadcasts and Flow Builder?',
        a: 'Yes. Labels are first-class audience criteria in Broadcasts ("send to all contacts with an open Bug-Report label") and first-class triggers in Flow Builder ("when label \'VIP\' is added, run the VIP onboarding sequence"). This makes labels the glue that connects inbox state to outbound communication and automation.',
      },
      {
        q: 'What happens when a label is deleted?',
        a: 'Wachat soft-deletes labels by default: the label disappears from the picker but stays attached to historical conversations and visible in analytics. You can hard-delete after a 30-day cooling period if needed. This prevents accidental destruction of historical reporting data when someone mistakenly deletes a long-used label.',
      },
      {
        q: 'Can I export label analytics for board reports?',
        a: 'Yes. Every label-level metric — volume, response time, resolution time, CSAT, linked revenue — exports to CSV, Google Sheets or directly to the SabNode Analytics module for dashboarding. Most teams set up a scheduled monthly export to a Google Sheet that the COO reviews in the first week of every month.',
      },
    ],

    related: ['shared-inbox', 'canned-replies', 'segments', 'business-hours'],
  },
];
