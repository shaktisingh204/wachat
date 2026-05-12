import type { Feature } from '../types';

export const commerceDeveloperFeatures: Feature[] = [
  /* ───────────────────────── COMMERCE ───────────────────────── */
  {
    slug: 'payments',
    name: 'In-chat Payments',
    brand: 'Commerce',
    category: 'commerce',
    tagline: 'Collect payments inside the chat via Stripe, Razorpay and UPI.',
    iconKey: 'dollar',
    color: '#10B981',
    tint: '#D1FAE5',

    seoTitle: 'In-chat Payments via Stripe, Razorpay & UPI | SabNode',
    seoDescription:
      'Collect payments inside WhatsApp, Instagram and web chat with Stripe, Razorpay Magic Checkout and UPI. PCI-safe links, reconciled to every order.',
    keywords: [
      'in-chat payments whatsapp',
      'razorpay magic checkout integration',
      'stripe payment links api',
      'upi payment collection whatsapp',
      'whatsapp commerce payment',
      'phonepe gpay paytm checkout',
      'pci dss compliant chat payment',
      'cod to prepaid conversion',
      'shopify whatsapp checkout',
      'payment reconciliation crm',
    ],

    hero: {
      eyebrow: 'Commerce · In-chat Payments',
      headline: 'Close the sale where the conversation happens.',
      subhead:
        'SabNode turns any chat into a checkout. Drop a Stripe, Razorpay or UPI link straight inside WhatsApp, Instagram DM or your web widget, and watch payments settle without redirecting customers to a fragile shopping cart. Every successful charge writes back to the contact, the order and the agent who closed it.',
      bullets: [
        'Stripe, Razorpay and UPI in one flow',
        'Pre-filled amount, GST and order ID',
        'Auto-reconciles to contact and order',
        'PCI-DSS scope stays with the gateway',
      ],
    },

    problem: {
      title: 'Carts die between chat and checkout',
      body:
        'A customer asks one last question on WhatsApp, an agent answers, then says "please open our website to pay". That hand-off is where most D2C revenue leaks. The customer switches apps, the session cookie is gone, the coupon does not auto-apply, and the average mobile checkout has six form fields before the OTP screen. Cart abandonment in India hovers near 70%, and COD orders that do convert come with 25-30% RTO loss.\n\nThe second problem is reconciliation. Even if the customer pays, the gateway dashboard, the Shopify order, the support ticket and the CRM contact live in four different tools. Finance reconciles by exporting CSVs every Monday. Marketing cannot attribute revenue to the campaign that actually drove it. Support cannot see if the refund went through without logging into Razorpay.\n\nIn-chat payments close both gaps. The link is generated against the exact conversation, the amount is locked, the gateway settles to your bank, and SabNode writes the transaction back to the order, the contact and the attribution table — in the same tick.',
    },

    overview: [
      'SabNode In-chat Payments is a gateway-agnostic layer that lets your agents and flows request money inside any conversation. When the flow builder hits a "Collect Payment" node, SabNode mints a short-lived link against your connected Stripe, Razorpay or UPI VPA, pre-fills amount, currency, order reference and GST line items, and pushes it into the thread as a tappable button. The customer pays in the gateway-hosted page — never in our app — so your PCI-DSS scope stays exactly where it was.',
      'For Indian merchants, UPI is a first-class citizen. We support intent links that deep-link straight into PhonePe, Google Pay, Paytm or any UPI app, plus QR fallback for desktop web chats. Razorpay Magic Checkout one-click flows are supported for repeat buyers, which alone lifts mobile conversion 30-40% on D2C catalogs. International stores get Stripe Payment Links with Apple Pay, Google Pay and saved cards through Stripe Link.',
      'Every event from the gateway — payment.captured, payment.failed, refund.processed — is normalised into the SabNode webhook bus. Your order timeline, your dashboards and your attribution model all update without you writing a single line of reconciliation code. Agents see a green "Paid ₹2,499 via UPI · 11:42 IST" badge inside the same chat where they nudged the customer 90 seconds earlier.',
      'The flow builder treats payment outcome as a first-class branch. Paid customers get the post-purchase confirmation flow, failed payments get a retry with a different method 15 minutes later, and dropped links get an abandonment nudge at the 20-minute mark. No webhook plumbing, no Zap, no CSV — just a node.',
    ],

    capabilities: [
      {
        title: 'Multi-gateway routing',
        body:
          'Connect Stripe, Razorpay, Cashfree and a UPI VPA at the workspace level, then route by country, currency or cart value. Indian rupee orders go through Razorpay with UPI intent, USD orders go through Stripe with Apple Pay enabled.',
      },
      {
        title: 'UPI intent + QR',
        body:
          'Generate UPI deep links that open PhonePe, GPay or Paytm with amount and reference pre-locked. Desktop web chats get a scannable QR with the same payload. Verification happens via Razorpay webhook within seconds.',
      },
      {
        title: 'Magic Checkout',
        body:
          'Razorpay Magic Checkout one-tap is wired in for repeat buyers. SabNode passes saved address, GSTIN and cart context, so the customer confirms with a single OTP and the order writes back to Shopify or WooCommerce immediately.',
      },
      {
        title: 'GST-ready invoices',
        body:
          'Every collection captures HSN code, GSTIN and place-of-supply against the line items. Invoices are auto-numbered per workspace, stored in SabFiles and attached to the order timeline for filing and Tally export.',
      },
      {
        title: 'COD to prepaid nudges',
        body:
          'Detect cash-on-delivery orders from Shopify and trigger a chat with a discounted prepaid link. Merchants regularly convert 18-25% of COD intents to prepaid, slashing RTO and freezing-up working capital.',
      },
      {
        title: 'Refunds inside chat',
        body:
          'Agents with refund permission can issue partial or full refunds without leaving the inbox. Refund status streams back from the gateway and posts as a system event on the contact and the order.',
      },
      {
        title: 'Reconciled to the rupee',
        body:
          'A nightly job matches gateway settlements against orders and writes a single ledger view. Finance exports one CSV per period that already ties payouts, fees and refunds to the order ID.',
      },
    ],

    useCases: [
      {
        title: 'D2C reorder over WhatsApp',
        industry: 'D2C',
        body:
          'A skincare brand fires a 30-day reorder reminder on WhatsApp with a one-tap UPI link for the customer\'s last cart. Around 22% pay inside the thread without ever opening the website, lifting LTV without burning ad spend.',
      },
      {
        title: 'High-ticket consult booking',
        industry: 'Healthcare',
        body:
          'An online clinic uses in-chat payments to lock the consultation slot. The flow collects ₹999 via Razorpay before assigning a doctor, eliminating no-shows and freeing the front desk from chasing payment confirmations.',
      },
      {
        title: 'Cross-border SaaS upgrade',
        industry: 'SaaS',
        body:
          'A B2B SaaS routes USD upgrades through Stripe and INR upgrades through Razorpay automatically. The same support chat that surfaced the upgrade collects payment, then triggers the seat-provisioning workflow.',
      },
      {
        title: 'Cart-to-COD-to-prepaid',
        industry: 'E-commerce',
        body:
          'Shopify pushes new COD orders to SabNode. A bot opens chat, offers a 5% discount for switching to UPI and drops a pre-filled link. The Shopify order is flipped to prepaid in real time and shipped a day faster.',
      },
      {
        title: 'Education course enrolment',
        industry: 'EdTech',
        body:
          'An ed-tech assigns a counsellor on WhatsApp who walks the parent through the course and collects the first installment via UPI. Subsequent EMIs auto-charge on a Razorpay token saved at first payment.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Connect gateways',
        body:
          'OAuth into Stripe and Razorpay, paste your UPI VPA, and select a default per currency. Test mode is isolated end-to-end.',
      },
      {
        step: '02',
        title: 'Drop a payment node',
        body:
          'Inside any flow, add the Collect Payment node. Bind amount, currency, order ID, GSTIN and success/failure branches.',
      },
      {
        step: '03',
        title: 'Send the link',
        body:
          'The customer receives a button inside WhatsApp, Instagram or web chat. Tapping it opens the hosted gateway page.',
      },
      {
        step: '04',
        title: 'Capture the webhook',
        body:
          'Gateway fires payment.captured. SabNode verifies HMAC, normalises the event and writes it to the order timeline.',
      },
      {
        step: '05',
        title: 'Branch the flow',
        body:
          'Paid users enter the post-purchase journey. Failed payments retry, dropped links get a 20-minute abandonment nudge.',
      },
    ],

    integrations: [
      'Stripe',
      'Razorpay',
      'UPI (PhonePe / GPay / Paytm)',
      'Shopify',
      'WooCommerce',
      'Magento',
      'Cashfree',
      'Tally',
    ],

    metrics: [
      { value: '42%', label: 'Lift in checkout conversion on in-chat links' },
      { value: '22%', label: 'COD orders converted to prepaid UPI' },
      { value: '<60s', label: 'Median time from link sent to payment captured' },
      { value: '3.1×', label: 'Reorder rate vs email-only campaigns' },
    ],

    faqs: [
      {
        q: 'Do you store card or UPI credentials?',
        a: 'No. SabNode never touches the PAN, CVV or UPI PIN. The payment page is hosted by Stripe or Razorpay, so your PCI-DSS scope stays exactly where it already is. We only store tokenised references (gateway transaction ID, last 4, network) needed for reconciliation and refunds.',
      },
      {
        q: 'Can I send the same link via WhatsApp and Instagram DM?',
        a: 'Yes. The link is channel-agnostic. We render it as a tappable button inside WhatsApp interactive messages, an Instagram DM CTA, or a web chat card. The success webhook is identical and writes to the same contact regardless of where the customer paid.',
      },
      {
        q: 'How do refunds work end-to-end?',
        a: 'Agents with the refund:write scope can issue full or partial refunds from the order timeline. SabNode calls the gateway API, polls until the refund status is processed, then posts a system event on the contact, the order and Shopify (if connected). Finance sees the refund in the nightly reconciliation report.',
      },
      {
        q: 'Do you support UPI AutoPay for subscriptions?',
        a: 'Yes, through Razorpay tokens. The first payment captures a token under your sub-merchant ID, and subsequent debits run on the agreed schedule. SabNode flows can react to mandate.authenticated, subscription.charged and subscription.halted events to upsell or recover.',
      },
      {
        q: 'How is GST handled?',
        a: 'Every collection accepts HSN, place-of-supply and buyer GSTIN. SabNode generates a serially numbered invoice, stores the PDF in SabFiles and attaches it to the order. The data is also exposed via the REST API, so most merchants pipe it directly into Tally or Zoho Books.',
      },
      {
        q: 'What happens if the customer pays twice?',
        a: 'The order ID acts as an idempotency key on the gateway side. A second tap on the same link returns the original capture. If a customer somehow pays through two different links, SabNode flags it on the order timeline and offers a one-click refund of the duplicate.',
      },
      {
        q: 'Can the same flow charge USD and INR customers differently?',
        a: 'Yes. Routing rules look at the contact\'s country, the cart currency and the gateway you configured. USD goes through Stripe with Apple Pay and Link enabled, INR routes to Razorpay with UPI intent first. The flow author writes one node, not two.',
      },
    ],

    related: ['catalog', 'orders', 'cart-recovery', 'post-purchase'],
  },

  {
    slug: 'catalog',
    name: 'Product Catalog',
    brand: 'Commerce',
    category: 'commerce',
    tagline: 'WhatsApp Business catalog manager with live stock and price sync.',
    iconKey: 'image',
    color: '#EC4899',
    tint: '#FCE7F3',

    seoTitle: 'WhatsApp Product Catalog with Live Stock Sync | SabNode',
    seoDescription:
      'Manage your WhatsApp Business catalog from one place. Sync stock and price from Shopify, WooCommerce or a CSV. Send cart messages inside chat.',
    keywords: [
      'whatsapp business catalog manager',
      'meta commerce manager sync',
      'whatsapp catalog shopify integration',
      'product feed woocommerce whatsapp',
      'cart messages whatsapp api',
      'multi product message template',
      'catalog stock price sync',
      'whatsapp commerce catalog api',
      'whatsapp shop catalog upload',
      'inventory sync whatsapp business',
    ],

    hero: {
      eyebrow: 'Commerce · Product Catalog',
      headline: 'Your storefront, ready for cart messages.',
      subhead:
        'SabNode mirrors your Shopify, WooCommerce or Magento catalog into Meta Commerce Manager, keeps stock and price live, and exposes the SKU graph to the flow builder so any bot can recommend, add to cart and check out — without ever leaving WhatsApp.',
      bullets: [
        'Mirror Shopify / Woo / Magento to Meta',
        'Live stock and price every 15 minutes',
        'Cart and multi-product messages',
        'Variant-aware: size, colour, bundle',
      ],
    },

    problem: {
      title: 'WhatsApp catalogs go stale fast',
      body:
        'Meta Commerce Manager is a competent product, but it was not built for a merchant who edits prices three times a day and runs flash sales every weekend. The default workflow is upload a CSV, wait for review, fix rejections, then realise half the SKUs are out of stock on the website but still showing in WhatsApp. Customers tap, add to cart, then bounce when the agent says "actually, that variant is sold out".\n\nThe second pain is variants and bundles. Meta\'s catalog data model is flat — one row per SKU. Real D2C catalogs have parents and children: a t-shirt with five sizes and three colours is fifteen rows in Meta, but it is one product in Shopify. Keeping those rows in lockstep manually is a part-time job.\n\nThe third pain is that the catalog is invisible to your bot. Even if the storefront is perfect, the chatbot cannot say "show me the in-stock blue medium" without a separate query layer. SabNode treats the catalog as a typed graph that flows, agents and AI Studio can all reach into.',
    },

    overview: [
      'SabNode connects to your source of truth — Shopify, WooCommerce, Magento, BigCommerce or a flat CSV in SabFiles — and continuously projects it into Meta Commerce Manager via the official Catalog API. Every 15 minutes we diff the source against Meta and push only the deltas: stock changes, price drops, new SKUs, deletions. Variant expansion is handled for you; one parent product in Shopify becomes the right set of Meta SKUs with the correct group_id and variant attributes.',
      'Inside SabNode, your catalog is a queryable resource. The flow builder ships a "Product Search" node that takes natural language ("show me waterproof backpacks under 3000") or structured filters (collection, tag, price range, in-stock) and returns a typed list. The bot can render those as a WhatsApp interactive multi-product message, or hand them to AI Studio for an LLM-grounded recommendation.',
      'Cart messages are first-class. When a customer taps "Add to cart" on a multi-product message, WhatsApp sends a structured cart payload that SabNode normalises into an Order draft. Your flow can quote shipping, apply a coupon, collect the address and then drop a payment link — all without redirecting to the website. The same cart payload writes to Shopify as a draft order so your operations team sees one source of truth.',
      'For merchants in India, we handle the GSTIN, HSN and place-of-supply fields, and we surface DLT-template-safe product names for utility broadcasts. Catalog quality issues (rejected images, missing brand, blocked words) surface in the SabNode dashboard with a one-click fix, not buried four screens deep in Meta.',
    ],

    capabilities: [
      {
        title: 'Source-of-truth sync',
        body:
          'Connect Shopify, WooCommerce, Magento or BigCommerce by OAuth. SabNode polls or listens to webhooks, diffs against Meta and pushes only deltas. Manual CSV upload works too for legacy stores.',
      },
      {
        title: 'Variant expansion',
        body:
          'A single Shopify variant tree (size × colour × material) is auto-expanded to the right set of Meta SKUs with group_id, color, size, pattern and gender attributes filled in. Bundles and configurable products are preserved.',
      },
      {
        title: 'Live stock & price',
        body:
          'Inventory and price update within 15 minutes of the source change. Out-of-stock SKUs are hidden from interactive multi-product messages so customers never see a "sold out" surprise in chat.',
      },
      {
        title: 'Multi-product messages',
        body:
          'Render up to 30 SKUs in a single interactive WhatsApp message. Sections, headers and call-to-action buttons are configurable. The flow builder treats the response as a typed Cart object.',
      },
      {
        title: 'Cart message handling',
        body:
          'When the customer taps Add to Cart, SabNode receives the cart payload, validates stock, applies coupons, and exposes a Cart variable to the flow. Quote shipping, collect address, fire a payment link without context switching.',
      },
      {
        title: 'Quality watchdog',
        body:
          'A daily check flags Meta-rejected items, low-quality images, missing brand or banned keywords, and surfaces fixes. Merchants resolve catalog rejections in minutes instead of discovering them at scale.',
      },
      {
        title: 'AI Studio grounding',
        body:
          'AI Studio can ground LLM answers on the live catalog. Ask "recommend a gift under 2000 for a 30-year-old" and the bot replies with three in-stock SKUs, each backed by a real product URL and price.',
      },
    ],

    useCases: [
      {
        title: 'WhatsApp-only flash sale',
        industry: 'D2C',
        body:
          'A fashion brand publishes a private flash collection only in WhatsApp. The catalog is filtered by tag "vip-drop" and rendered as a multi-product message to a 40k segment. Stock drains in real time, sold-out variants disappear automatically.',
      },
      {
        title: 'Conversational gifting',
        industry: 'E-commerce',
        body:
          'A gifting site uses AI Studio plus the catalog to take "recommend a 1500 rupee gift for a colleague who loves coffee" and reply with three SKUs as a multi-product message. The agent can edit the suggestion before sending.',
      },
      {
        title: 'B2B price-list quoting',
        industry: 'B2B',
        body:
          'A wholesaler exposes a price-list catalog gated by contact tag. Tier-2 buyers see one set of prices, tier-1 buyers see another. The agent quotes via cart message, draft order writes back to Magento.',
      },
      {
        title: 'Bookings as catalog',
        industry: 'Healthcare',
        body:
          'A diagnostics chain models each test as a SKU with HSN code and place-of-supply. Patients pick tests via multi-product message, the cart converts to a booking with home-sample-collection date and a Razorpay payment.',
      },
      {
        title: 'Restaurant ordering',
        industry: 'F&B',
        body:
          'A cloud kitchen syncs its POS menu nightly. Diners chat, browse a multi-product menu, drop items into a cart and pay via UPI. The cart hits the POS as a paid order and the kitchen ticket prints automatically.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Connect source',
        body:
          'OAuth into Shopify, Woo or Magento. Pick the collections and tags to mirror. SabNode reads the variant tree and counts SKUs.',
      },
      {
        step: '02',
        title: 'Link Meta Commerce',
        body:
          'Authorize the WhatsApp Business catalog. SabNode creates or selects the target catalog and validates required fields.',
      },
      {
        step: '03',
        title: 'Initial seed',
        body:
          'First-time push uploads the catalog with variant expansion. Image and field validation runs before submitting to Meta.',
      },
      {
        step: '04',
        title: 'Continuous sync',
        body:
          'Webhooks and a 15-minute fallback poll keep stock, price and metadata fresh. Diffs only — no full re-uploads.',
      },
      {
        step: '05',
        title: 'Use in flows',
        body:
          'Drop Product Search and Cart Message nodes anywhere. Bots and AI Studio query the catalog as a typed resource.',
      },
    ],

    integrations: [
      'Shopify',
      'WooCommerce',
      'Magento',
      'BigCommerce',
      'Meta Commerce Manager',
      'Google Sheets',
      'AI Studio',
      'SabFiles',
    ],

    metrics: [
      { value: '15min', label: 'Maximum stock and price drift from source' },
      { value: '30', label: 'SKUs per WhatsApp multi-product message' },
      { value: '94%', label: 'Catalog approval rate on first submission' },
      { value: '3.4×', label: 'Add-to-cart rate vs link-only campaigns' },
    ],

    faqs: [
      {
        q: 'Can you sync from a Google Sheet instead of Shopify?',
        a: 'Yes. SabNode supports a Google Sheet, an Airtable view or a CSV in SabFiles as a source of truth. We watch the sheet for changes via webhook (Sheets) or daily poll (CSV) and project the result into Meta. This is the typical path for catalogs of services, bookings or B2B price-lists.',
      },
      {
        q: 'How are variants handled in WhatsApp?',
        a: 'WhatsApp\'s catalog model is flat. SabNode expands one Shopify variant tree into the correct set of Meta SKUs and links them via group_id, color, size, pattern and gender. Customers see one parent in the catalog browser and pick variants like they would on the storefront.',
      },
      {
        q: 'What happens when stock drops to zero mid-conversation?',
        a: 'The Cart Message node revalidates stock at quote time. If a SKU went out of stock between message send and customer tap, the bot offers the next closest variant or asks the agent to step in. Out-of-stock SKUs are also automatically suppressed from new multi-product messages within 15 minutes.',
      },
      {
        q: 'Do you support coupons and conditional pricing?',
        a: 'Yes. SabNode applies workspace-level coupons (BOGO, percentage, fixed) at quote time, plus contact-tag gated pricing for B2B tiers and VIP cohorts. The discount is reflected in both the WhatsApp cart message and the resulting Shopify or WooCommerce draft order.',
      },
      {
        q: 'Will catalog rejections block my campaigns?',
        a: 'No. The quality watchdog tells you the day before a campaign that "12 SKUs are unfit for ads — missing brand, low-res image". You fix them in one click, SabNode re-submits to Meta, and the campaign goes out on time. Rejection batches that used to take days now resolve in minutes.',
      },
      {
        q: 'Can the LLM in AI Studio search the catalog?',
        a: 'Yes. Catalog is exposed as a typed resource to AI Studio. The model receives a structured tool: search(query, filters) → SKU[]. It cannot hallucinate SKUs that do not exist, and every suggestion in the reply carries the real product URL, price and stock from the source.',
      },
      {
        q: 'Is the WhatsApp catalog separate from my Instagram shop?',
        a: 'They share Meta\'s underlying catalog object, so syncing through SabNode populates both the WhatsApp catalog and the Instagram shop tab. You can choose to expose different collections to each surface using SabNode\'s channel-aware visibility tags.',
      },
    ],

    related: ['payments', 'orders', 'cart-recovery', 'catalog-sync'],
  },

  {
    slug: 'orders',
    name: 'Orders Timeline',
    brand: 'Commerce',
    category: 'commerce',
    tagline: 'Every order becomes a timeline event on the contact record.',
    iconKey: 'fileText',
    color: '#4F46E5',
    tint: '#EEF2FF',

    seoTitle: 'Orders Timeline & Unified Customer 360 View | SabNode',
    seoDescription:
      'See every Shopify, WooCommerce and in-chat order on the contact timeline. Lifetime value, RTO history, last item bought — one screen, no CSVs.',
    keywords: [
      'unified customer order timeline',
      'shopify orders in crm',
      'whatsapp order tracking',
      'customer lifetime value crm',
      'rto risk score d2c',
      'order events webhook normalisation',
      'cod order management',
      'commerce crm 360 view',
      'order status whatsapp template',
      'returns and refunds timeline',
    ],

    hero: {
      eyebrow: 'Commerce · Orders Timeline',
      headline: 'Every order, one customer record, zero CSV gymnastics.',
      subhead:
        'SabNode pulls orders from Shopify, WooCommerce, Magento and in-chat checkout into a single timeline on the contact. Agents see lifetime value, last item bought, shipment status and RTO history before they hit reply — no tab switching, no stale data.',
      bullets: [
        'Shopify, Woo, Magento and chat orders',
        'Lifetime value and order count live',
        'RTO risk score and COD history',
        'Shipping status from Shiprocket / Delhivery',
      ],
    },

    problem: {
      title: 'Your agents are flying blind',
      body:
        'When a customer messages "where is my order?", the agent typically opens four tabs: Shopify admin to find the order, Shiprocket to check the AWB, the gateway dashboard to verify payment, and a Google Sheet to remember if this person was a problem returner. By the time the agent has the answer, the customer has bounced or escalated. Multiply that by 3,000 tickets a month and you have a serious support cost.\n\nThe second issue is segmentation. Marketing wants to broadcast a "frequent buyer" coupon to anyone with three orders in 90 days. To do that today, ops exports CSVs from Shopify, joins them in Sheets, dedupes by phone, then uploads to the broadcast tool. By the time the campaign runs, the data is two days stale and half the contacts have churned.\n\nThe third is RTO. India\'s D2C economy bleeds working capital on cash-on-delivery returns. Knowing that a phone number has three RTOs in the last six months — at the point of the next chat — saves real money. Orders Timeline puts that signal exactly where the agent or the bot is making a decision.',
    },

    overview: [
      'Orders Timeline turns SabNode into a commerce-aware CRM. Every order from your connected stores, plus every in-chat checkout, lands as a timeline event on the matching contact. The match is done by phone first, then email, then any custom field, so you do not lose orders to formatting differences. The timeline is sorted chronologically with payment, shipment, delivery, return and refund nested as sub-events under the parent order.',
      'On the contact panel, agents see live aggregates: total orders, lifetime value, average order value, last item bought, last shipped date, RTO count, refund count, and a computed RTO risk score from 0-100. Hover any number to drill into the underlying orders. The same fields are exposed to the flow builder, broadcasts and segments — so you can build a "VIP buyers in Bengaluru with no RTO" segment in seconds.',
      'Shipping is woven into the timeline natively. SabNode integrates with Shiprocket, Delhivery, Bluedart and ShipStation, ingests AWB and status updates, and surfaces "Out for delivery", "Delivered", "RTO initiated" as discrete events. Status-change webhooks can trigger flows: WhatsApp shipment notifications, "rate your delivery" CSAT, or auto-refund on confirmed RTO.',
      'Returns and refunds get the same treatment. A Shopify refund posts as a sub-event with reason, amount and gateway ID. The contact\'s LTV automatically nets out, so your "high-value customers" segment never includes someone who returned half of what they bought.',
    ],

    capabilities: [
      {
        title: 'Multi-store ingestion',
        body:
          'Connect Shopify, WooCommerce, Magento or BigCommerce by OAuth. SabNode reads existing orders via the bulk API on first connect, then keeps current state via webhooks plus a safety-net poll.',
      },
      {
        title: 'Smart contact matching',
        body:
          'Phone-first matching with E.164 normalisation, then email, then custom field. Conflicting matches are surfaced as a merge candidate in the contact merge queue rather than silently dropped.',
      },
      {
        title: 'Live LTV and AOV',
        body:
          'Lifetime value, order count, last order date and average order value are materialised columns on the contact, not computed on the fly. Segments filter by them in milliseconds even at 10M-contact scale.',
      },
      {
        title: 'RTO risk score',
        body:
          'A model trained on your store\'s RTO history scores each open COD order 0-100 at creation. Agents and bots can ask for prepaid conversion on high-risk orders before they ship.',
      },
      {
        title: 'Shipping events',
        body:
          'Shiprocket, Delhivery and Bluedart status updates land as discrete timeline events. Out-for-delivery, attempted, delivered, RTO and disposed each have their own webhook your flows can branch on.',
      },
      {
        title: 'Refunds and returns',
        body:
          'Shopify and Razorpay refund events post as sub-events. LTV nets out automatically, and "frequent returner" tags can be auto-applied to power do-not-broadcast lists.',
      },
      {
        title: 'Timeline filters',
        body:
          'Filter the timeline by event type, channel, store or date. Search "all RTO orders in last 30 days" or "orders with refund reason damaged" from one panel without writing SQL.',
      },
    ],

    useCases: [
      {
        title: 'WISMO support deflection',
        industry: 'E-commerce',
        body:
          '"Where is my order" tickets get auto-answered by a bot that reads the latest shipment event, replies with status and AWB, and only escalates if the shipment is delayed by more than 48 hours. Saves 30-40% of support volume.',
      },
      {
        title: 'COD risk gating',
        industry: 'D2C',
        body:
          'New COD orders with an RTO risk score above 70 trigger a WhatsApp flow that offers a 5% prepaid discount before the order is dispatched. Confirmed prepaid orders ship the same day, risky COD orders are held.',
      },
      {
        title: 'VIP cohort broadcast',
        industry: 'D2C',
        body:
          'Marketing builds a segment "LTV > 5000, no RTO in 6 months" and runs a private collection drop on WhatsApp. The segment is live, so a customer who returns later is dropped from the next send automatically.',
      },
      {
        title: 'Replenishment reminders',
        industry: 'D2C',
        body:
          'A nutrition brand watches "last consumable order date" and triggers a reorder flow 28 days after delivery. The flow knows the SKU, the size and the discount tier and pre-fills the cart for one-tap UPI checkout.',
      },
      {
        title: 'Subscription health',
        industry: 'SaaS',
        body:
          'A SaaS sees Stripe invoice failed events on the contact timeline and routes them to dunning. The CSM gets a card in their inbox with MRR, failure reason and retry schedule before they reach out.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Connect stores',
        body:
          'OAuth into Shopify, WooCommerce or Magento. Choose phone or email as the primary match key. Test in sandbox.',
      },
      {
        step: '02',
        title: 'Historical backfill',
        body:
          'SabNode pulls existing orders via the bulk API, matches them to contacts, and computes LTV and AOV in the background.',
      },
      {
        step: '03',
        title: 'Live event stream',
        body:
          'Webhooks for created, paid, fulfilled, shipped, delivered, refunded land as timeline events with full payload.',
      },
      {
        step: '04',
        title: 'Shipping enrichment',
        body:
          'Carrier webhooks add discrete shipping events. The bot can answer WISMO without an agent ever opening Shiprocket.',
      },
      {
        step: '05',
        title: 'Drive flows',
        body:
          'Use timeline events as triggers. Replenishment, RTO risk, refund recovery — all built in the flow builder.',
      },
    ],

    integrations: [
      'Shopify',
      'WooCommerce',
      'Magento',
      'Shiprocket',
      'Delhivery',
      'Bluedart',
      'Razorpay',
      'Stripe',
    ],

    metrics: [
      { value: '38%', label: 'WISMO tickets deflected by timeline-aware bot' },
      { value: '<5s', label: 'Sync latency from store webhook to timeline' },
      { value: '6×', label: 'Faster segment builds vs CSV-export workflow' },
      { value: '24%', label: 'RTO reduction with risk-score COD gating' },
    ],

    faqs: [
      {
        q: 'How are duplicate contacts handled?',
        a: 'SabNode normalises phone numbers to E.164 before matching, so the same Indian customer with +91, 91 or 0-prefix is one record. When ingestion finds a conflicting match (same email, different phone), the case is added to a merge queue with side-by-side context for an admin to resolve.',
      },
      {
        q: 'Will the timeline slow down for large stores?',
        a: 'No. Orders are stored on a partitioned event log and the contact panel pulls only the most recent 100 events by default. Aggregates like LTV and AOV are materialised columns, so loading a contact with 1,000 orders is the same speed as loading one with 3.',
      },
      {
        q: 'Can I write back to Shopify from SabNode?',
        a: 'Yes. The flow builder ships nodes to update order metadata, add a tag, cancel an order or create a draft order. Common patterns include tagging risky COD orders with "verify-before-ship" and creating draft orders from in-chat cart payloads.',
      },
      {
        q: 'How is the RTO risk score computed?',
        a: 'Per-workspace gradient-boosted model trained on your store\'s last 12 months of COD orders. Features include pincode RTO rate, contact RTO history, order value, time of day, product category and channel. The score is recomputed at order creation and exposed as a contact field.',
      },
      {
        q: 'Do you support multi-currency stores?',
        a: 'Yes. Each order is stored in its presentment currency plus a normalised workspace currency at the exchange rate at order time. LTV, AOV and analytics dashboards default to the workspace currency, with per-store breakdowns available in reports.',
      },
      {
        q: 'Can returns trigger an automatic refund?',
        a: 'Yes. A flow can listen to the "return delivered to warehouse" event from Shiprocket and call the Razorpay or Stripe refund API. The refund posts back as a sub-event on the order with a closing message to the customer on WhatsApp.',
      },
      {
        q: 'How does this differ from a CDP?',
        a: 'A CDP describes who the customer is. Orders Timeline describes what they bought, paid, returned and received — and exposes those signals to the flow builder, broadcasts and segments inside the same product. There is no ETL hop, so the data is fresh and the operator is empowered.',
      },
    ],

    related: ['payments', 'catalog', 'cart-recovery', 'contacts'],
  },

  {
    slug: 'cart-recovery',
    name: 'Cart Recovery',
    brand: 'Commerce',
    category: 'commerce',
    tagline: 'Template flow that messages abandoners 20 minutes after drop-off.',
    iconKey: 'reply',
    color: '#F59E0B',
    tint: '#FEF3C7',

    seoTitle: 'WhatsApp Cart Abandonment Recovery Flow for D2C | SabNode',
    seoDescription:
      'Recover 12-18% of abandoned carts with a 3-step WhatsApp flow. 20-minute nudge, 24-hour discount, 72-hour last call — all template-compliant.',
    keywords: [
      'whatsapp abandoned cart recovery',
      'shopify cart recovery automation',
      'd2c cart abandonment flow',
      'utility template whatsapp marketing',
      'utility vs marketing template meta',
      'cart drop-off nudge sequence',
      'cart recovery roi d2c',
      'whatsapp marketing template flow',
      'discount nudge abandoned checkout',
      'razorpay cart abandonment',
    ],

    hero: {
      eyebrow: 'Commerce · Cart Recovery',
      headline: 'Win back the carts your storefront cannot.',
      subhead:
        'SabNode ships a battle-tested three-step WhatsApp flow — 20 minutes after drop-off, 24 hours later with a soft discount, 72 hours later with last-call urgency. Every step is Meta-template compliant, opt-in aware and tied to the live cart in Shopify, WooCommerce or Magento.',
      bullets: [
        '3-step nudge sequence, pre-built',
        '20 min, 24 hr, 72 hr cadence',
        'Utility-then-marketing template ladder',
        'In-chat payment closes the loop',
      ],
    },

    problem: {
      title: 'Email recovery is a rounding error',
      body:
        'The average D2C store recovers 2-4% of abandoned carts through email. Most of that recovery happens with the first email; the second and third are wallpaper. Customers do not check email on mobile the way they check WhatsApp, and the few who do, see your recovery email below an Amazon promo, a bank statement and three newsletters.\n\nWhatsApp is the inverse. The notification fires, the customer is one tap away from continuing their purchase, and the open rate is 90%+. The catch is that you cannot just blast marketing templates to abandoners — Meta separates utility from marketing strictly, and quality ratings drop fast if you push promotion under a utility category. Most teams give up here and end up either spamming or doing nothing.\n\nSabNode\'s Cart Recovery is a Meta-aware recipe: the first nudge is a utility "you left items in your cart" template (no discount, opt-in not required because it references a transaction the user initiated), the second is a marketing template with a soft discount, the third is a final reminder. The ladder is what keeps quality ratings green while pulling 12-18% of abandoners back.',
    },

    overview: [
      'Cart Recovery is delivered as a template flow you can install in one click. Out of the box it watches the Shopify, WooCommerce or Magento checkout-abandoned webhook, matches the cart to a contact, checks opt-in status, and schedules the first message exactly 20 minutes after drop-off. The 20-minute window is calibrated — sooner feels stalkery, later loses the warm intent.',
      'Step one is a utility template: "you left {item_count} items in your cart for ₹{cart_total}. Continue checkout?" with a deep link that re-hydrates the Shopify cart token. No discount, no marketing — this is a transactional reminder and Meta categorises it as such, so it can be sent without prior marketing opt-in and at any hour.',
      'Step two fires 24 hours later if the cart is still abandoned. This is a marketing template, sent only to contacts who have marketing opt-in (SabNode tracks opt-in status per channel automatically). The copy offers a 5-10% discount, dynamically generated as a single-use coupon, with a one-tap UPI or Stripe link directly inside the message — no website redirect.',
      'Step three at 72 hours is the last-call: limited-stock messaging, a slightly steeper coupon or free shipping, and a graceful exit if the customer still does not respond. The flow then sets a "cart-abandoned-3x" tag so the customer can be enrolled in a longer win-back cadence later. Every step writes a timeline event on the contact, so attribution rolls into the dashboards.',
    ],

    capabilities: [
      {
        title: 'Three-step ladder',
        body:
          '20-minute utility nudge, 24-hour marketing template with discount, 72-hour last-call. The cadence is editable per workspace, and the default is benchmarked against thousands of D2C stores.',
      },
      {
        title: 'Meta template smarts',
        body:
          'The flow automatically selects utility vs marketing categories based on copy and discount. Quality rating is monitored per template, and underperforming variants are paused before they damage your sending tier.',
      },
      {
        title: 'Cart re-hydration',
        body:
          'Deep links carry the Shopify cart token or the Woo session id so the customer lands on the exact cart they abandoned, not a fresh storefront. Discount codes auto-apply at landing.',
      },
      {
        title: 'In-chat checkout',
        body:
          'On step two and three, customers can pay inside WhatsApp via Razorpay or Stripe instead of returning to the website. Removes the second friction point that kills recovery for mobile-first shoppers.',
      },
      {
        title: 'Opt-in awareness',
        body:
          'Utility messages send to all abandoners. Marketing steps send only to contacts with marketing opt-in. The flow handles this automatically and never violates Meta policy.',
      },
      {
        title: 'Coupon hygiene',
        body:
          'Single-use, time-bound coupons are generated per message. If the customer recovers without the coupon, the code is revoked. No long-tail margin leak from leaked codes.',
      },
      {
        title: 'A/B subject and offer',
        body:
          'Run two copy variants or two discount tiers in parallel. Statistical significance is computed automatically and the winning variant is promoted to the default sequence.',
      },
    ],

    useCases: [
      {
        title: 'Shopify D2C apparel',
        industry: 'D2C',
        body:
          'A clothing brand sees 71% cart abandonment. The flow recovers 14% inside 72 hours. Step one alone (no discount) accounts for 60% of the recovered revenue — the rest comes from step two and three.',
      },
      {
        title: 'WooCommerce nutrition',
        industry: 'D2C',
        body:
          'A supplements store ties cart abandonment recovery to its replenishment flow. If a customer abandoned a refill cart, step one mentions their previous order: "your protein is running low — want us to ship the same as last time?".',
      },
      {
        title: 'High-AOV electronics',
        industry: 'E-commerce',
        body:
          'A consumer electronics retailer with ₹40k average cart routes high-value abandoners to a human agent at step two instead of a coupon. The agent answers product questions on WhatsApp and closes 22% of those carts.',
      },
      {
        title: 'Hyperlocal food',
        industry: 'F&B',
        body:
          'A cloud kitchen with same-day fulfilment compresses the ladder to 10 min / 1 hr / next-day. The 10-minute nudge alone recovers 30% of carts because hunger is the strongest motivator.',
      },
      {
        title: 'Online learning',
        industry: 'EdTech',
        body:
          'An ed-tech course store routes step two to a counsellor instead of a coupon. The counsellor handles objections live on WhatsApp and converts 28% of step-two contacts — far higher than any pure discount play.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Install template flow',
        body:
          'Pick Shopify, Woo or Magento as the source. SabNode subscribes to the checkout-abandoned webhook and registers the templates with Meta.',
      },
      {
        step: '02',
        title: 'Match the cart',
        body:
          'Cart is matched to a contact by phone or email. Opt-in status is read. Past order history and LTV are pulled to personalise copy.',
      },
      {
        step: '03',
        title: 'Send step one',
        body:
          'At T+20 min, a utility template fires with a cart deep-link. No discount, no opt-in needed. 60% of recoveries happen here.',
      },
      {
        step: '04',
        title: 'Send step two',
        body:
          'At T+24 hr, a marketing template fires with a single-use coupon and in-chat UPI link. Sends only to opted-in contacts.',
      },
      {
        step: '05',
        title: 'Send step three',
        body:
          'At T+72 hr, final urgency nudge. Cart is closed after this step and a cart-abandoned-3x tag is applied for later win-back.',
      },
    ],

    integrations: [
      'Shopify',
      'WooCommerce',
      'Magento',
      'Razorpay',
      'Stripe',
      'Meta WhatsApp Business API',
      'Google Sheets',
      'Klaviyo',
    ],

    metrics: [
      { value: '14%', label: 'Average cart recovery rate across SabNode merchants' },
      { value: '90%+', label: 'WhatsApp open rate vs 18% for email recovery' },
      { value: '20min', label: 'Optimal first-nudge delay tested across 3M carts' },
      { value: '4.2×', label: 'ROI vs email-only recovery on equivalent traffic' },
    ],

    faqs: [
      {
        q: 'Is the first nudge legal without marketing opt-in?',
        a: 'Yes. The 20-minute message is a utility template under Meta\'s categorisation — it references a transaction the customer initiated, contains no promotional content and is widely accepted. Marketing-opt-in is checked before step two and three, which carry promotional offers.',
      },
      {
        q: 'Will sending recovery messages damage my Meta quality rating?',
        a: 'Not if the ladder is followed. The utility template at step one has near-zero block rate because customers asked for the cart in the first place. SabNode monitors quality per template and pauses any variant that dips below "Medium" automatically.',
      },
      {
        q: 'Can I run a recovery flow without offering a discount?',
        a: 'Absolutely. Many brands use step two and three to route the conversation to a human or to highlight social proof and shipping speed instead of a coupon. Discounts are one tactic among many — the flow builder lets you swap any step\'s payload.',
      },
      {
        q: 'How does this interact with Klaviyo or my email flow?',
        a: 'SabNode ships a "skip email if WhatsApp recovered" signal you can post into Klaviyo. Customers who recover via WhatsApp are excluded from the email cadence, so the two channels never collide. The signal also rolls into attribution dashboards.',
      },
      {
        q: 'What happens if the customer ignores all three nudges?',
        a: 'A cart-abandoned-3x tag is applied. The contact stops receiving cart recovery messages for that cart but remains available for monthly win-back campaigns. Repeat abandoners with three or more cart-3x tags can be flagged as "browsers" and de-prioritised in ads.',
      },
      {
        q: 'Can I trigger different flows by cart value?',
        a: 'Yes. The flow forks at step zero: under ₹500 carts get an aggressive 10% coupon at step two, ₹500-5000 carts get a 5% coupon, and ₹5000+ carts route to a human agent. The branching is one node, not a separate flow.',
      },
      {
        q: 'How is recovery attributed to revenue?',
        a: 'Every recovery message carries a UTM and an internal SabNode link ID. When the order finally places, the source is stamped on the order timeline and rolls into the attribution dashboard. Revenue, AOV and recovery rate are visible per step and per variant.',
      },
    ],

    related: ['payments', 'orders', 'post-purchase', 'broadcasts'],
  },

  {
    slug: 'post-purchase',
    name: 'Post-purchase Flows',
    brand: 'Commerce',
    category: 'commerce',
    tagline: 'Confirmation, tracking, reorder and review prompts — out of the box.',
    iconKey: 'badge',
    color: '#8B5CF6',
    tint: '#F3E8FF',

    seoTitle: 'Post-purchase WhatsApp Flows for D2C Brands | SabNode',
    seoDescription:
      'Order confirmation, shipping updates, NPS, review collection and reorder reminders — all as installable WhatsApp flows wired to Shopify and Shiprocket.',
    keywords: [
      'whatsapp order confirmation template',
      'post purchase nps whatsapp',
      'shopify review collection flow',
      'reorder reminder automation',
      'shiprocket whatsapp tracking',
      'd2c post purchase journey',
      'whatsapp delivery notification template',
      'replenishment marketing automation',
      'csat survey whatsapp template',
      'returns flow d2c',
    ],

    hero: {
      eyebrow: 'Commerce · Post-purchase',
      headline: 'The seven moments after checkout, automated.',
      subhead:
        'SabNode ships a complete post-purchase suite — confirmation, payment receipt, shipping updates, delivery NPS, review prompt, replenishment nudge and reorder upsell. Each step is a real WhatsApp flow, not a templated email, and writes back to orders, contacts and your reviews tool.',
      bullets: [
        'Order, shipped, delivered, reviewed',
        'Replenishment timed to product life',
        'NPS and CSAT inside WhatsApp',
        'Loops back into reorder upsell',
      ],
    },

    problem: {
      title: 'Post-purchase is where loyalty is built or burnt',
      body:
        'Most stores treat post-purchase as a single confirmation email and call it a day. That is the cheapest mistake in D2C. The seven days after delivery are when the customer is most likely to leave a review, refer a friend or buy again — and the silence from the brand during that window is what kills 70% of the LTV that should otherwise compound.\n\nDoing post-purchase right with email alone is brutal: open rates fall below 18%, transactional emails get marked promotional, and review collection rates hover around 1-3%. WhatsApp inverts every one of those numbers, but only if the flow is structured correctly — order confirmation as a utility template, shipping updates as utility, review prompt as marketing with opt-in, and reorder upsell with the right delay tied to the actual product life.\n\nSabNode ships all seven moments pre-wired. You connect Shopify and Shiprocket, install the post-purchase pack, and within five minutes every order that lands triggers the same journey that the best D2C brands build over six months. Each step is editable, each is attributed, and each rolls back into your dashboards as a revenue source.',
    },

    overview: [
      'The Post-purchase pack is a set of seven installable flows that cover the entire journey from "order placed" to "customer reorders". Order confirmation fires within seconds of the Shopify order webhook, payment receipt fires when the gateway captures, shipped notification fires on Shiprocket\'s manifested event, and out-for-delivery and delivered events stream in from the carrier. Every message is Meta-template compliant, opt-in aware and personalised with order ID, AWB, ETA and product list.',
      'Two days after delivery, the NPS flow asks "how likely are you to recommend us on a scale of 0-10?". Detractors are routed to a human agent for save-the-customer outreach. Promoters get a review request three days later with a direct link to your Yotpo, Judge.me, Loox or Google Business profile. The review collection rate consistently beats email by 4-6×.',
      'Reorder is the loop. Each product can have a configured "reorder cycle" — 30 days for protein, 45 days for skincare, 90 days for cosmetics. At the right offset, the customer receives a personalised WhatsApp message: "your last cycle is wrapping up, want us to ship the same?" with a pre-filled cart and a one-tap UPI link. Replenishment alone routinely contributes 20-35% of total revenue for consumables brands.',
      'Every step writes a sub-event on the order timeline, every reply is a conversation an agent can pick up, and every conversion attributes back to the post-purchase flow in dashboards. The pack runs out of the box, but the flow builder lets you fork any step with your own logic.',
    ],

    capabilities: [
      {
        title: 'Order confirmation',
        body:
          'Fires within 5 seconds of the order webhook. Includes order ID, item list, total, payment method and an expected delivery range computed from your Shiprocket SLA history.',
      },
      {
        title: 'Live shipping updates',
        body:
          'Carrier events from Shiprocket, Delhivery, Bluedart and ShipStation flow into the timeline and trigger a WhatsApp utility template. Customers know exactly where their package is without opening a tracker page.',
      },
      {
        title: 'Delivery NPS',
        body:
          'Two days after delivery the customer is asked a 0-10 question. Detractors route to an agent, promoters route to review collection. The flow is a clean conditional branch in the flow builder.',
      },
      {
        title: 'Review collection',
        body:
          'Promoters get a Yotpo, Judge.me, Loox or Google review link three days post-delivery. Review collection rate runs 4-6× the email baseline, because the ask happens at peak emotional recall.',
      },
      {
        title: 'Replenishment timing',
        body:
          'Each SKU can have a configured reorder cycle in days. The flow fires at cycle-end with a pre-built cart, discount code (if any) and one-tap UPI payment — no website redirect.',
      },
      {
        title: 'Refund/return flow',
        body:
          'Customers can initiate a return inside WhatsApp. The flow collects reason, item, photo (via SabFiles), validates against return policy and creates the Shiprocket return label.',
      },
      {
        title: 'Loyalty signals',
        body:
          'Repeat buyers, frequent reviewers and high NPS scorers get tagged automatically. These tags feed VIP broadcasts, early-access drops and loyalty pricing tiers.',
      },
    ],

    useCases: [
      {
        title: 'Skincare replenishment',
        industry: 'D2C',
        body:
          'A skincare brand with 45-day cycle products sees 31% of customers reorder via the replenishment flow alone. The flow knows the last SKU, applies a loyalty discount and accepts UPI payment inline.',
      },
      {
        title: 'Apparel review engine',
        industry: 'D2C',
        body:
          'A fashion brand 12×\'s its review velocity by routing post-NPS promoters to a Judge.me link inside WhatsApp. The store\'s storefront review widgets fill out within a week, lifting product page conversion 8%.',
      },
      {
        title: 'Returns containment',
        industry: 'E-commerce',
        body:
          'An electronics store funnels return requests through a WhatsApp flow that captures reason and photo. 25% of returns are deflected when the agent offers a swap, a how-to video or a partial refund credit.',
      },
      {
        title: 'Healthcare follow-up',
        industry: 'Healthcare',
        body:
          'A diagnostics chain runs a post-test follow-up four days after the report is delivered. The flow asks if the patient consulted a doctor, offers a tele-consult slot via Razorpay, and improves consult attach 18%.',
      },
      {
        title: 'EdTech onboarding',
        industry: 'EdTech',
        body:
          'After course purchase, the post-purchase flow walks the learner through Day 1, Day 7 and Day 30 milestones. NPS at Day 30 feeds into the upsell flow that pitches the next course in the ladder.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Install the pack',
        body:
          'One click installs all seven flows. SabNode registers templates with Meta and subscribes to Shopify and carrier webhooks.',
      },
      {
        step: '02',
        title: 'Confirmation fires',
        body:
          'Order webhook triggers a utility template within seconds. Items, total, payment method and ETA are rendered into copy.',
      },
      {
        step: '03',
        title: 'Shipping updates',
        body:
          'Shipped, out-for-delivery and delivered events stream from the carrier into the timeline and the customer\'s chat.',
      },
      {
        step: '04',
        title: 'NPS & review',
        body:
          'Two days after delivery, NPS fires. Detractors route to an agent, promoters get a review prompt three days later.',
      },
      {
        step: '05',
        title: 'Reorder loop',
        body:
          'At the configured cycle, replenishment fires with a one-tap cart. Successful reorders re-enter the post-purchase journey.',
      },
    ],

    integrations: [
      'Shopify',
      'WooCommerce',
      'Shiprocket',
      'Delhivery',
      'Bluedart',
      'Yotpo',
      'Judge.me',
      'Loox',
    ],

    metrics: [
      { value: '4.6×', label: 'Review collection rate vs email baseline' },
      { value: '31%', label: 'Replenishment-driven repeat purchase on consumables' },
      { value: '18%', label: 'NPS lift after 60 days on the post-purchase pack' },
      { value: '<5s', label: 'Latency from order placed to confirmation sent' },
    ],

    faqs: [
      {
        q: 'Do I have to install all seven flows?',
        a: 'No. The pack is modular. Most merchants start with confirmation, shipping updates and review collection, then add NPS and replenishment when they are ready. Each flow has its own toggle and analytics view in the SabNode dashboard.',
      },
      {
        q: 'How do you set the reorder cycle per product?',
        a: 'You can set a default reorder cycle at the category level (skincare 45 days, supplements 30 days, cosmetics 90 days), then override per SKU. The cycle is editable in the catalog screen, and AI Studio can suggest a starting cycle based on your historical reorder gap data.',
      },
      {
        q: 'What if Meta classifies my review prompt as marketing?',
        a: 'It is marketing — and that is correct. SabNode only sends the review prompt to contacts who have a marketing opt-in. The NPS step doubles as the implicit opt-in checkpoint: customers who reply with a number have engaged with the brand post-purchase and can receive the next promotional ask.',
      },
      {
        q: 'Does the shipping update message double-send if I also use Shiprocket\'s own SMS?',
        a: 'Yes, that is on you to deduplicate. The common fix is to disable Shiprocket\'s SMS notifications for the channels SabNode is handling and let WhatsApp own the customer touchpoint. SabNode\'s flow has finer control over copy, timing and branding.',
      },
      {
        q: 'Can the NPS detractor branch route to a specific agent?',
        a: 'Yes. The flow builder lets you route detractors by team, by language, by AOV or by any contact field. A common setup is to route ₹5000+ AOV detractors to a senior CX agent and the rest to the regular queue.',
      },
      {
        q: 'How is review submission verified?',
        a: 'For Yotpo, Judge.me and Loox we listen for the review-submitted webhook and post a "thanks for reviewing — here is 10% off your next order" message. The reviewer is automatically tagged as a vocal-promoter and added to the early-access segment.',
      },
      {
        q: 'Will the replenishment flow stop if the customer reorders elsewhere?',
        a: 'Yes. If a new order comes in for the same SKU before the cycle fires, the existing replenishment job is cancelled and a new cycle is scheduled from the new order date. Customers never get a "time to reorder" message right after they already reordered.',
      },
    ],

    related: ['orders', 'cart-recovery', 'csat', 'broadcasts'],
  },

  /* ───────────────────────── DEVELOPER ───────────────────────── */
  {
    slug: 'rest-api',
    name: 'REST API',
    brand: 'Developer',
    category: 'developer',
    tagline: 'Typed REST + webhooks for every object. SDKs for JS, Python and Go.',
    iconKey: 'hash',
    color: '#4F46E5',
    tint: '#EEF2FF',

    seoTitle: 'SabNode REST API & SDKs for JS, Python, Go | SabNode',
    seoDescription:
      'Production-grade REST API with OpenAPI 3.1, idempotency keys, cursor pagination and typed SDKs for JavaScript, Python and Go. 99.95% uptime SLA.',
    keywords: [
      'whatsapp business api sdk',
      'crm rest api openapi 3.1',
      'idempotency key http api',
      'cursor pagination rest api',
      'rate limit exponential backoff',
      'javascript sdk whatsapp crm',
      'python sdk customer engagement',
      'go sdk crm integration',
      'http status code semantics api',
      'multi tenant saas api keys',
    ],

    hero: {
      eyebrow: 'Developer · REST API',
      headline: 'A REST API that does not lie about its semantics.',
      subhead:
        'Every SabNode object — contact, conversation, flow, broadcast, order, file — is reachable through a typed REST surface. OpenAPI 3.1, real HTTP status codes, idempotency keys on every POST, cursor pagination and zero-downtime versioning. SDKs for JavaScript, Python and Go are generated from the same spec.',
      bullets: [
        'OpenAPI 3.1 spec, always current',
        'Idempotency-Key header on every POST',
        'Cursor pagination, opaque tokens',
        'SDKs for JS, Python, Go',
      ],
    },

    problem: {
      title: 'Most CRM APIs are toys in production',
      body:
        'You have integrated five CRMs by now. One returned 200 for failed writes. Another paginated by integer offset and silently dropped rows when a contact was added mid-scan. A third had a "create or update" endpoint that swallowed validation errors. By the time you hit production scale, you have built a wrapper library, a retry queue and a deduplication layer just to make the official SDK usable.\n\nThe second pain is versioning. You shipped against v2, the vendor pushed v3 with a breaking change, and v2 is in a year-long sunset that nobody bothers to honor. Your integration breaks during a Black Friday window because someone at the vendor decided to "improve" the response shape.\n\nThe third pain is observability. You sent 12,000 webhook deliveries last night, the partner is complaining that "events are missing", and the vendor dashboard shows you nothing useful — no per-delivery status, no replay tool, no signing secret rotation. SabNode\'s REST API and webhook system were designed by engineers who lived inside those failure modes.',
    },

    overview: [
      'The SabNode REST API is documented by a single OpenAPI 3.1 spec that drives every SDK, the in-app reference and our internal validation. Every endpoint uses real HTTP semantics: 200 for success, 201 for created, 204 for empty success, 400 for input errors, 401 for missing auth, 403 for scope errors, 404 for not found, 409 for idempotency conflicts, 422 for business-rule failures and 429 for rate limiting. There are no 200-with-error-in-body responses anywhere in the surface.',
      'POST requests accept an Idempotency-Key header (UUID v4). A repeated call with the same key replays the original response — even hours later — so a retried network call from your worker never accidentally creates a second contact or a duplicate broadcast. List endpoints use opaque cursor pagination: the cursor encodes the sort key and the position, so adding or deleting rows mid-scan never drops or duplicates results.',
      'SDKs for JavaScript (TypeScript-first), Python (mypy-typed) and Go are generated from the same OpenAPI spec on every release. The generated clients ship retry logic with exponential backoff, jitter, and Retry-After honoring, plus a structured error type per status. You install the SDK with one command, paste your scoped token, and call typed methods with full IDE autocomplete.',
      'Versioning follows a date-header model: every request carries an Api-Version header. Adding fields is non-breaking, removing or renaming requires a new version that is supported for at least 24 months. Sunset announcements are written into the response headers so your dashboards can alert you long before the cutoff.',
    ],

    capabilities: [
      {
        title: 'OpenAPI 3.1 spec',
        body:
          'A machine-readable OpenAPI 3.1 spec drives the docs, the SDKs and our request validator. Import it into Postman or generate your own client if your stack is not in our official trio.',
      },
      {
        title: 'Idempotency keys',
        body:
          'Every POST accepts Idempotency-Key. A 24-hour cache replays the original response on retry. Conflicting payloads under the same key return 409 with a structured diff explaining what changed.',
      },
      {
        title: 'Cursor pagination',
        body:
          'List endpoints return an opaque next_cursor in the response and accept it as a query parameter. Cursors encode the sort key, the position and a tenant-id check, so they are stable under writes.',
      },
      {
        title: 'Predictable rate limits',
        body:
          'Limits are per-token and per-endpoint family. Every response includes X-RateLimit-Remaining and X-RateLimit-Reset. 429 responses include Retry-After in seconds, and the SDKs honor it automatically.',
      },
      {
        title: 'Typed SDKs',
        body:
          'JavaScript / TypeScript, Python and Go clients are generated from the spec. They expose typed methods, structured error classes per status, automatic retries and an SSE helper for streaming endpoints.',
      },
      {
        title: 'Versioning by header',
        body:
          'Api-Version header pins your integration to a release. Additive changes are silent, breaking changes ship a new version supported 24+ months. Sunset notices land in response headers months in advance.',
      },
      {
        title: 'Bulk endpoints',
        body:
          'Contacts, messages and tag operations have bulk variants accepting up to 1,000 items per call. Bulk endpoints return per-item status so partial failures are observable, not silent.',
      },
    ],

    useCases: [
      {
        title: 'Sync from data warehouse',
        industry: 'SaaS',
        body:
          'A B2B SaaS pushes daily contact updates from Snowflake into SabNode via the bulk upsert endpoint. Idempotency keys derived from a hash of (warehouse_row_id, day) make the job rerunnable without dedup logic.',
      },
      {
        title: 'Custom mobile app',
        industry: 'D2C',
        body:
          'A D2C brand\'s mobile app uses the REST API to fetch the user\'s order timeline, fire support tickets and trigger WhatsApp opt-in confirmations — without re-implementing any of the SabNode primitives.',
      },
      {
        title: 'Outbound enrichment',
        industry: 'Financial Services',
        body:
          'A fintech enriches new leads with PAN and address verification through their own internal API, then writes the verified fields back to the SabNode contact via PATCH. Webhook on update fires the next flow.',
      },
      {
        title: 'BI dashboard pipeline',
        industry: 'E-commerce',
        body:
          'A merchant pipes orders, messages and broadcast events from SabNode into BigQuery via a Cloud Run job that uses the cursor-paginated list endpoints. The job is rerunnable thanks to stable cursors.',
      },
      {
        title: 'Ops automation script',
        industry: 'Logistics',
        body:
          'A logistics team runs a nightly Python script that finds contacts with a stuck shipment and patches a tag for the broadcast team. The script uses the typed Python SDK and runs in under 30 seconds for 50k contacts.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Mint a token',
        body:
          'Create a scoped API key in Settings → Developer. Choose scopes (contacts:read, messages:write, etc) and an optional IP allowlist.',
      },
      {
        step: '02',
        title: 'Install the SDK',
        body:
          'npm i @sabnode/sdk, pip install sabnode, or go get github.com/sabnode/sabnode-go. All three are generated from the same spec.',
      },
      {
        step: '03',
        title: 'Make a typed call',
        body:
          'Instantiate the client with your token and Api-Version. Call sdk.contacts.create({ phone, name }) and get a typed Contact back.',
      },
      {
        step: '04',
        title: 'Handle errors',
        body:
          'Catch typed errors per status: ValidationError, RateLimitError, ConflictError. The SDK auto-retries on 429 and 5xx with backoff.',
      },
      {
        step: '05',
        title: 'Listen on webhooks',
        body:
          'Subscribe to events. Verify the HMAC signature, ack within 5 seconds, and the rest of your worker is yours to write.',
      },
    ],

    integrations: [
      'OpenAPI 3.1',
      'Postman',
      'Vercel',
      'AWS Lambda',
      'GitHub Actions',
      'Snowflake',
      'BigQuery',
      'Cloud Run',
    ],

    metrics: [
      { value: '99.95%', label: 'Monthly API uptime SLA on the public surface' },
      { value: '<120ms', label: 'p95 latency for read endpoints in primary region' },
      { value: '1000', label: 'Items per bulk POST with per-item result codes' },
      { value: '24mo', label: 'Minimum support window for each API version' },
    ],

    faqs: [
      {
        q: 'How do I retry safely without creating duplicates?',
        a: 'Send an Idempotency-Key header (UUID v4) on every POST. SabNode caches the original response for 24 hours and replays it on retry. If you send the same key with a different payload, the API returns 409 with a JSON diff so you can see exactly which field changed.',
      },
      {
        q: 'How are rate limits structured?',
        a: 'Limits are per-token and per-endpoint family — for example, messages:write has its own bucket from contacts:write. Every response carries X-RateLimit-Remaining and X-RateLimit-Reset, and a 429 includes Retry-After in seconds. The SDKs honour Retry-After automatically with jitter.',
      },
      {
        q: 'Will my integration break if you ship v3?',
        a: 'No, not unless you opt in. Your client pins to an Api-Version header. Additive changes flow silently into your pinned version, breaking changes require explicit version bump. Each version is supported for at least 24 months after release and sunset is announced through response headers months in advance.',
      },
      {
        q: 'Can I use the API from the browser?',
        a: 'Read-only public endpoints (status, configured templates) can be called with a publishable key from the browser. Write endpoints require a server-side scoped token and CORS is locked down accordingly. Most integrations live in a Vercel Edge Function, an AWS Lambda or a worker behind your own API.',
      },
      {
        q: 'How is pagination stable?',
        a: 'List endpoints return opaque cursors that encode sort key, position and a tenant-id check. Inserting or deleting a row in the middle of a scan does not duplicate or drop other rows. Sorts default to created_at desc, and you can request updated_at desc for incremental syncs.',
      },
      {
        q: 'What about webhooks vs polling?',
        a: 'Both are first-class. Webhooks deliver events in near-real-time with HMAC-SHA256 signing and a dead-letter queue. Polling endpoints (with cursor pagination and updated_since filters) are available for environments that cannot accept inbound traffic, like behind a corporate firewall.',
      },
      {
        q: 'Is the API GDPR and DPDP compliant?',
        a: 'Yes. Personal data fields are returned only when scopes allow, deletion requests are processed via a documented PII purge endpoint that propagates to backups within 90 days, and audit logs record every read of PII when audit logging is enabled. Regional data residency is available on enterprise plans.',
      },
    ],

    related: ['webhooks', 'oauth', 'environments', 'mcp-server'],
  },

  {
    slug: 'webhooks',
    name: 'Webhooks',
    brand: 'Developer',
    category: 'developer',
    tagline: 'Inbound and outbound, with retries, signing and dead-letter queue.',
    iconKey: 'zap',
    color: '#10B981',
    tint: '#D1FAE5',

    seoTitle: 'Signed Webhooks with Retries and Dead-letter Queue | SabNode',
    seoDescription:
      'Outbound webhooks with HMAC-SHA256 signing, exponential backoff retries, dead-letter queue and a replay tool. Inbound webhooks accept any provider.',
    keywords: [
      'hmac sha256 webhook signing',
      'webhook dead letter queue',
      'exponential backoff retry webhook',
      'webhook replay tool saas',
      'webhook signature verification',
      'inbound webhook receiver crm',
      'event driven architecture webhooks',
      'webhook delivery sla',
      'idempotent webhook handler',
      'shopify webhook receiver',
    ],

    hero: {
      eyebrow: 'Developer · Webhooks',
      headline: 'Events that survive your worst Monday.',
      subhead:
        'Every SabNode event — message received, order created, flow completed, payment captured — is delivered to your endpoint with HMAC-SHA256 signing, exponential backoff retries, replay-on-demand and a per-subscription dead-letter queue. Inbound webhooks accept Shopify, Razorpay, Meta and arbitrary provider payloads with first-class signature verification.',
      bullets: [
        'HMAC-SHA256 signing on every delivery',
        '24-hour exponential-backoff retry window',
        'DLQ with one-click replay',
        'Per-subscription secret rotation',
      ],
    },

    problem: {
      title: 'Webhooks are where reliability promises die',
      body:
        'You set up a webhook in five minutes and it works. Six months later your endpoint is 5xx-ing for thirty seconds during a deploy and the partner has lost 4,000 events. You email support, they tell you events are "best effort", and you spend a weekend stitching together a replay job from CSV exports of their internal logs.\n\nThe second pain is signing. The partner ships an HMAC secret. You write the verifier yourself. A week later someone discovers your verifier compares strings non-constant-time and your endpoint is vulnerable to timing attacks. Or you find out the partner does not sign the timestamp, so a captured request can be replayed forever. Each of these has happened on real production systems.\n\nThe third is observability. Inbound webhooks from Shopify, Razorpay, Meta and a dozen other providers land in your codebase. You have no per-provider dashboard, no replay button, no way to find "the 12 events that failed last Tuesday at 14:32". SabNode\'s webhook system was designed by an engineer who has been on the wrong end of every one of these.',
    },

    overview: [
      'Outbound webhooks subscribe to any SabNode event — message.created, conversation.assigned, contact.updated, order.shipped, payment.captured, flow.completed and dozens more. You choose the events, the endpoint URL and an optional set of filters (only events on contacts in segment X, only orders over ₹5,000). SabNode signs every request with HMAC-SHA256 over the body and timestamp, includes a sabnode-signature header and a sabnode-event-id, and expects a 2xx response within 5 seconds.',
      'Retries follow an exponential backoff curve: 30s, 2m, 10m, 30m, 1h, 4h, 12h, 24h, with full jitter. After the final retry, the event lands in the subscription\'s dead-letter queue. The DLQ in the SabNode dashboard shows the payload, the response your endpoint returned, the timestamps and a one-click replay button. You can also bulk-replay everything from a given hour, useful after a deploy outage.',
      'Inbound webhooks are a first-class object. You can mount an inbound URL per provider (Shopify, Razorpay, Meta, custom), paste the provider\'s signing secret, and SabNode handles signature verification and replay-protection before the payload hits any of your flows. Inbound payloads can trigger flows, write fields to contacts or call REST API mutations — without you running a single line of glue code.',
      'Secrets rotate cleanly. Each subscription has a primary and an optional next secret. During rotation, deliveries are signed with both; you cut over the verifier when ready and retire the old secret. No bang-and-pray secret swaps at 2 AM.',
    ],

    capabilities: [
      {
        title: 'HMAC-SHA256 signing',
        body:
          'Every outbound request includes a sabnode-signature header with HMAC-SHA256 over `${timestamp}.${body}`. The 5-minute timestamp tolerance defeats replays. Constant-time comparison is documented in every SDK.',
      },
      {
        title: 'Exponential backoff',
        body:
          'Retries follow 30s, 2m, 10m, 30m, 1h, 4h, 12h, 24h with full jitter. Total window is 24 hours. The schedule is documented and unchanged release-over-release so your runbooks are stable.',
      },
      {
        title: 'Dead-letter queue',
        body:
          'After final retry, events land in a per-subscription DLQ. The UI shows payload, your response, headers and timestamps. One-click replay or bulk-replay-by-hour pulls the events back through your endpoint.',
      },
      {
        title: 'Filtered subscriptions',
        body:
          'Subscribe to events with filters: only contacts in segment X, only orders over ₹5k, only conversations on the priority queue. Filters run in SabNode, so your endpoint only gets the events it cares about.',
      },
      {
        title: 'Inbound receivers',
        body:
          'Mount a SabNode-hosted URL per provider. We verify Shopify HMAC, Razorpay signature, Meta X-Hub-Signature and custom HMAC schemes before the event triggers a flow or writes a contact.',
      },
      {
        title: 'Secret rotation',
        body:
          'Each subscription holds a primary and a next secret. During rotation, outbound deliveries are signed with both so you can flip the verifier without downtime, then retire the old secret.',
      },
      {
        title: 'Delivery observability',
        body:
          'Per-subscription dashboards show throughput, success rate, p95 latency and failure breakdown. Alerts fire when failure rate breaches a threshold you set (default: 5% over 15 minutes).',
      },
    ],

    useCases: [
      {
        title: 'Real-time data warehouse',
        industry: 'SaaS',
        body:
          'A SaaS streams every conversation.assigned, message.created and flow.completed event into BigQuery via a Cloud Run receiver. The DLQ saved them during a 14-minute warehouse outage — 4,200 events replayed cleanly.',
      },
      {
        title: 'PagerDuty escalation',
        industry: 'E-commerce',
        body:
          'A merchant sets a filtered subscription on conversation.priority="urgent" → PagerDuty. The on-call engineer is paged inside 90 seconds of a high-value angry customer landing in the queue.',
      },
      {
        title: 'Shopify return webhook',
        industry: 'D2C',
        body:
          'A D2C brand mounts an inbound Shopify webhook for refunds.created. The flow triggered by that webhook posts a soft-recovery message to the customer and adds a frequent-returner tag for downstream filtering.',
      },
      {
        title: 'CRM bidirectional sync',
        industry: 'B2B',
        body:
          'A B2B team mirrors contacts both ways between Salesforce and SabNode using outbound contact.updated webhooks and a Salesforce Apex receiver. Idempotency keys derived from the event ID make double-fires safe.',
      },
      {
        title: 'Compliance ledger',
        industry: 'Financial Services',
        body:
          'A fintech subscribes to message.created and writes every send and receive to an append-only S3 bucket for regulatory archive. The webhook signature is preserved in the archive for non-repudiation.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Create a subscription',
        body:
          'Pick events, endpoint URL and optional filters. SabNode mints a signing secret and shows a curl sample for verification.',
      },
      {
        step: '02',
        title: 'Verify signatures',
        body:
          'Your endpoint reads sabnode-signature, computes HMAC-SHA256 over timestamp+body, compares constant-time and acks 200.',
      },
      {
        step: '03',
        title: 'Process idempotently',
        body:
          'sabnode-event-id is unique per logical event. Dedupe on it so a retry from our side is never a double-write on yours.',
      },
      {
        step: '04',
        title: 'Watch the dashboard',
        body:
          'Delivery rate, p95 latency and DLQ depth show in the subscription dashboard. Alerts fire on failure thresholds.',
      },
      {
        step: '05',
        title: 'Replay if needed',
        body:
          'After an outage, open the DLQ and click bulk-replay-by-hour. Events flow back through your endpoint in the original order.',
      },
    ],

    integrations: [
      'Shopify',
      'Razorpay',
      'Meta',
      'Stripe',
      'AWS Lambda',
      'Vercel',
      'Cloudflare Workers',
      'PagerDuty',
    ],

    metrics: [
      { value: '99.99%', label: 'Webhook delivery success after 24h retry window' },
      { value: '8', label: 'Retry attempts spread over 24 hours with full jitter' },
      { value: '<2s', label: 'Median time from event creation to first delivery' },
      { value: '<5min', label: 'Timestamp tolerance defeating replay attacks' },
    ],

    faqs: [
      {
        q: 'What happens if my endpoint is down for an hour?',
        a: 'SabNode retries with exponential backoff over 24 hours. Most outages of an hour or less are absorbed by retries with no manual action. Anything that fails all eight attempts lands in the dead-letter queue, where you can replay individual events or bulk-replay by hour once your endpoint is healthy.',
      },
      {
        q: 'How do I verify the signature in Node.js?',
        a: 'Read the sabnode-signature header (format: t=<timestamp>,v1=<hmac>). Compute HMAC-SHA256 over `${timestamp}.${rawBody}` with your secret, compare to v1 using crypto.timingSafeEqual. Reject if the timestamp is more than 5 minutes from now. Our JS SDK ships a verifyWebhook helper that does all of this.',
      },
      {
        q: 'Are deliveries ordered?',
        a: 'Within a single conversation, message events are delivered in order. Across conversations, events may interleave for throughput. If you need strict global ordering, sort by sabnode-event-id at the receiver — it is monotonic per workspace.',
      },
      {
        q: 'Can I subscribe to events for one workspace but not others?',
        a: 'Webhook subscriptions are scoped to a single workspace. If you run multiple workspaces (test, staging, prod), each one has its own subscriptions, secrets and DLQ. Cross-workspace event mirroring is available on enterprise plans through a dedicated event bus.',
      },
      {
        q: 'What payload format do you send?',
        a: 'JSON, UTF-8, content-type application/json. Every event carries id, type, created_at, workspace_id and data. The data shape is the same as the corresponding REST API resource, so a contact.updated webhook contains the full contact object exactly as GET /contacts/:id would return it.',
      },
      {
        q: 'How do I handle a renamed event type?',
        a: 'New event types ship as additive changes. Renames or removals are scheduled with at least 24 months of dual emission: both the old and the new event type fire, your verifier can listen to whichever it prefers, and we sunset the old type only after the API version that uses it is fully retired.',
      },
      {
        q: 'Can I get webhooks at the edge?',
        a: 'Yes. Cloudflare Workers, Vercel Edge Functions and AWS Lambda@Edge are all common receivers. SabNode\'s timestamps are UTC and signatures are pure HMAC-SHA256, so no V8-incompatible Node APIs are required for verification.',
      },
    ],

    related: ['rest-api', 'oauth', 'environments', 'triggers'],
  },

  {
    slug: 'meta-flow-editor',
    name: 'Meta Flow Editor',
    brand: 'Developer',
    category: 'developer',
    tagline: 'Design, publish and version Meta Flow screens from inside SabNode.',
    iconKey: 'fileText',
    color: '#EC4899',
    tint: '#FCE7F3',

    seoTitle: 'Meta Flow Editor for WhatsApp Business Flows | SabNode',
    seoDescription:
      'Build, version and publish Meta WhatsApp Flow screens visually. JSON schema validation, draft → review → published lifecycle and end-to-end testing.',
    keywords: [
      'meta whatsapp flow editor',
      'whatsapp flow json schema',
      'whatsapp flow builder visual',
      'meta flow screen design',
      'whatsapp flow lifecycle draft published',
      'meta flow validation tool',
      'whatsapp flow versioning',
      'flow data exchange endpoint',
      'whatsapp form ui builder',
      'meta flow testing sandbox',
    ],

    hero: {
      eyebrow: 'Developer · Meta Flow Editor',
      headline: 'Stop writing Meta Flow JSON by hand.',
      subhead:
        'SabNode\'s Meta Flow Editor is a visual designer for the JSON schemas that power WhatsApp Flows — multi-screen forms inside chat. Drag screens, bind components, validate against Meta\'s latest spec, and publish with versioning, rollback and a sandbox for end-to-end testing.',
      bullets: [
        'Visual builder for Meta Flow JSON',
        'Live schema validation per Meta spec',
        'Draft → review → published lifecycle',
        'Bind data exchange endpoints inline',
      ],
    },

    problem: {
      title: 'Authoring Meta Flow JSON is a tax on engineering',
      body:
        'WhatsApp Flows are the most powerful surface Meta has shipped for business messaging — multi-screen forms with TextInput, DatePicker, Dropdown, CheckboxGroup and dynamic data binding. They also require you to author a strict JSON schema, register it with Meta, validate against a versioned spec that changes every quarter, and wire it to a signed data exchange endpoint that follows a request/response handshake with public-key encryption.\n\nMost teams give up. They build the simpler interactive-message flow and miss out on the conversion lift of a real in-chat form. The teams that do not give up burn two engineer-weeks per Flow on JSON authoring, validation, signing, redeployment cycles and trial-and-error against the Meta sandbox. Every minor spec change breaks one of their screens and the entire pipeline has to run again.\n\nSabNode\'s Meta Flow Editor collapses that work into a visual canvas. You drag screens, bind inputs to flow variables, write data exchange handlers as small TypeScript snippets, validate against the current Meta spec live, and publish with one click. Versioning, rollback and sandbox testing are first-class. Engineering keeps building product; the marketing team ships Flows on their own.',
    },

    overview: [
      'The Meta Flow Editor is a canvas-style visual editor for the JSON that defines a WhatsApp Flow. Each screen is a rectangle on the canvas, with input components (TextInput, TextArea, RadioButtonsGroup, CheckboxGroup, Dropdown, DatePicker, Image), navigation buttons and conditional logic. As you edit, SabNode validates against Meta\'s latest published Flow schema and surfaces errors inline — wrong component for the action, missing required attribute, unsupported version — before you ever submit to Meta.',
      'Data exchange — Meta\'s server-side handshake that lets Flows fetch dynamic content (a list of available appointments, a price calculation, an OTP) — is wired in two clicks. The editor exposes a typed handler where you write a small TypeScript function that takes the screen state and returns the next payload. SabNode hosts the encrypted endpoint, manages the keypair rotation, and exposes the resulting log to the dashboard. You never touch RSA key generation or AES-GCM ciphertext framing.',
      'Lifecycle is enforced: Draft → Review → Published. A Draft is editable freely. A Review build is submitted to Meta\'s sandbox, where you can run the Flow end-to-end on a test number, watch every data exchange call and every state transition, and capture screenshots for QA sign-off. Publishing promotes the build to a versioned Published state on Meta; rolling back is a one-click revert to the previous Published version.',
      'For agencies and multi-brand merchants, Flow templates are first-class. Author a Lead Capture Flow once with variables for brand colour, logo, success message and CRM mapping, then clone it across 30 client workspaces with workspace-specific bindings. Updates to the template can be propagated as a Draft to all clones for review before publishing.',
    ],

    capabilities: [
      {
        title: 'Visual canvas',
        body:
          'Drag screens onto an infinite canvas. Each screen renders a live preview of the WhatsApp Flow shell. Components are reorderable, conditional logic is drawn as edges between screens, and the underlying JSON is generated automatically.',
      },
      {
        title: 'Live schema validation',
        body:
          'Every keystroke validates against Meta\'s current Flow JSON schema (v6.x and later). Errors are highlighted inline with the offending attribute, the expected type and a one-click "fix" for common mistakes like missing required keys.',
      },
      {
        title: 'Data exchange handlers',
        body:
          'Write a small TypeScript function for the data exchange screen. SabNode hosts an encrypted endpoint with Meta-compliant RSA/AES-GCM handshake, manages keypair rotation and surfaces request/response logs in the editor.',
      },
      {
        title: 'Draft / Review / Published',
        body:
          'Lifecycle stages enforce safe rollout. Drafts are editable, Review builds run on Meta\'s sandbox with a scannable QR for testing, Published versions are immutable until you cut the next version.',
      },
      {
        title: 'Versioning & rollback',
        body:
          'Every Publish creates a new version. The previous version stays available for instant rollback. You can compare versions side by side and see exactly which screens or fields changed.',
      },
      {
        title: 'End-to-end sandbox',
        body:
          'Test the Flow on a real WhatsApp test number with one tap. SabNode captures every screen transition, every data exchange call and the final completion payload, and shows them as a timeline in the editor.',
      },
      {
        title: 'Templates and cloning',
        body:
          'Save any Flow as a template with parameterised fields. Clone into other workspaces with workspace-specific bindings. Updates to the template can be staged as Drafts across all clones for orderly propagation.',
      },
    ],

    useCases: [
      {
        title: 'Lead capture for finance',
        industry: 'Financial Services',
        body:
          'A loan-origination team replaces a clunky landing page with a 4-screen Flow that captures name, PAN, income range and loan amount inside WhatsApp. Conversion rises 2.6× because customers never leave the chat.',
      },
      {
        title: 'Appointment booking',
        industry: 'Healthcare',
        body:
          'A diagnostics chain ships a Flow with a dynamic DatePicker that fetches available slots via data exchange. Slot inventory updates in real time, double-booking is impossible, and the booking completes inside WhatsApp.',
      },
      {
        title: 'Course enrolment',
        industry: 'EdTech',
        body:
          'An ed-tech runs a 5-screen Flow that scores the learner\'s level via a quick quiz, recommends a course, collects payment and provisions a learner account — all inside the Flow without redirecting to web.',
      },
      {
        title: 'Insurance KYC',
        industry: 'Financial Services',
        body:
          'An insurer collects KYC photos and Aadhaar number through a Flow with conditional screens that adapt to the policy type. Documents upload via SabFiles, the Flow completes with a policy quote shown on screen.',
      },
      {
        title: 'Restaurant reservation',
        industry: 'F&B',
        body:
          'A restaurant chain offers a Flow with venue selection, date, party size and seating preference. Data exchange pulls live availability from their booking system, and confirmation drops back into WhatsApp.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Pick a template',
        body:
          'Start from a blank canvas or a template (Lead Capture, KYC, Booking, Survey). Templates ship pre-validated against the current Meta spec.',
      },
      {
        step: '02',
        title: 'Drag screens',
        body:
          'Add screens, drop in components, draw conditional edges. The JSON updates live and validation runs on every change.',
      },
      {
        step: '03',
        title: 'Wire data exchange',
        body:
          'Write a TypeScript handler for any screen that needs dynamic data. SabNode hosts the encrypted endpoint and keypair.',
      },
      {
        step: '04',
        title: 'Test in sandbox',
        body:
          'Scan a QR with your phone, run the Flow on Meta\'s sandbox, watch every state transition in the editor timeline.',
      },
      {
        step: '05',
        title: 'Publish & roll out',
        body:
          'Publish to a versioned production state. Use it in any flow builder node. Roll back in one click if something breaks.',
      },
    ],

    integrations: [
      'Meta WhatsApp Business Platform',
      'AI Studio',
      'Razorpay',
      'Stripe',
      'Google Sheets',
      'Shopify',
      'Salesforce',
      'SabFiles',
    ],

    metrics: [
      { value: '2.6×', label: 'Lead capture conversion vs landing page baseline' },
      { value: '<3min', label: 'Median time from Draft to Sandbox test' },
      { value: '0', label: 'Lines of RSA / AES-GCM glue code you have to write' },
      { value: '100%', label: 'Schema validation coverage on every save' },
    ],

    faqs: [
      {
        q: 'Do I have to manage the data exchange keypair?',
        a: 'No. SabNode generates an RSA keypair per workspace, registers the public key with Meta and stores the private key in our managed KMS. Rotation is a one-click operation that publishes the new public key, dual-decrypts incoming exchanges during the cutover window and retires the old key safely.',
      },
      {
        q: 'Which Meta Flow JSON versions are supported?',
        a: 'All versions supported by Meta\'s public Flow Builder are supported here, with the current default being the latest stable. Drafts can target an older version explicitly if you need to keep parity with an existing Published Flow until your next planned release.',
      },
      {
        q: 'Can I write the JSON by hand if I prefer?',
        a: 'Yes. The editor has a JSON mode that shows the underlying Flow document with syntax highlighting and inline validation. You can paste JSON from another source, edit it directly, and switch back to the visual canvas — the two modes are always in sync.',
      },
      {
        q: 'How is Flow output passed to the rest of the system?',
        a: 'When a customer completes a Flow, the final response payload becomes a structured event on the SabNode conversation. Your flow builder can branch on the values, write them to the contact, drop them into a CRM, or fire downstream APIs — same as any other inbound event.',
      },
      {
        q: 'Can a non-engineer build Flows safely?',
        a: 'Yes, with guardrails. Workspace admins can lock the data exchange handler editor (which requires TypeScript) while leaving the visual canvas open for marketers. Publishes require a defined approver on enterprise plans, and lifecycle history is auditable per user.',
      },
      {
        q: 'What if Meta changes the schema?',
        a: 'SabNode tracks Meta\'s Flow schema releases, updates validation rules within 72 hours of publication, and surfaces a migration notice in any Draft that uses a deprecated attribute. Most schema changes are additive; the rare breaking change is handled by a one-click migration in the editor.',
      },
      {
        q: 'Is there a limit on screens or components per Flow?',
        a: 'Meta\'s current limit is 32 screens and a per-screen limit on components — SabNode enforces both at validation time. Most real-world Flows live well under those caps; if your Flow grows past them, the editor will suggest split points where you can branch into a second Flow.',
      },
    ],

    related: ['flow-builder', 'rest-api', 'webhooks', 'oauth'],
  },

  {
    slug: 'mcp-server',
    name: 'MCP Server',
    brand: 'Developer',
    category: 'developer',
    tagline: 'Plug any LLM into your SabNode workspace via Model Context Protocol.',
    iconKey: 'brain',
    color: '#7C3AED',
    tint: '#EDE9FE',

    seoTitle: 'SabNode MCP Server for Claude, GPT, Gemini | SabNode',
    seoDescription:
      'Expose SabNode as a Model Context Protocol server. Connect Anthropic Claude, OpenAI GPT and Google Gemini to your contacts, conversations and flows.',
    keywords: [
      'model context protocol server',
      'mcp server crm integration',
      'anthropic claude mcp tools',
      'openai gpt mcp connection',
      'gemini mcp data source',
      'json-rpc mcp specification',
      'llm tool calling crm',
      'mcp resource discovery',
      'ai assistant whatsapp crm',
      'agent native crm api',
    ],

    hero: {
      eyebrow: 'Developer · MCP Server',
      headline: 'Make your CRM the back end of any AI agent.',
      subhead:
        'SabNode exposes a Model Context Protocol server with typed tools, resources and prompts that any MCP-aware client — Anthropic Claude, OpenAI GPT, Google Gemini, custom agents — can reach. Search contacts, draft replies, run reports and trigger flows from the LLM directly, with scoped tokens and audit logging on every call.',
      bullets: [
        'Native MCP server over JSON-RPC',
        'Tools, resources and prompts exposed',
        'Works with Claude, GPT, Gemini, custom',
        'Scoped tokens with full audit trail',
      ],
    },

    problem: {
      title: 'LLMs are smart, but blind to your operational data',
      body:
        'You have an internal LLM assistant that can write emails and summarise meetings. It cannot answer "which contacts in Bengaluru replied to our flash-sale broadcast yesterday and have an LTV over ₹5,000?" because it has no idea your CRM exists. The fix is supposed to be tool calling — give the LLM a function, let it call. But every LLM client expects a different schema (OpenAI functions, Anthropic tools, Gemini function declarations), and you end up writing three adapters for the same operation.\n\nModel Context Protocol (MCP) is Anthropic\'s open standard that fixes this. Servers expose tools, resources and prompts over JSON-RPC; any MCP-aware client can discover and call them. Claude Desktop, the official OpenAI MCP client, Gemini\'s tool surface and a growing ecosystem of agent frameworks all speak it. Publish your CRM as an MCP server once, every agent can read it.\n\nSabNode ships a production MCP server out of the box. Every workspace gets a stable MCP endpoint; your LLM client authenticates with a scoped token; the server exposes ~40 tools (search_contacts, send_message, list_flows, run_report, create_broadcast and more), a curated set of resources (current dashboards, recent conversations, brand guidelines documents) and prompt templates (write_reply, summarise_conversation, build_segment). Every call is audit-logged with the originating LLM and user.',
    },

    overview: [
      'SabNode\'s MCP server speaks the latest Model Context Protocol specification over JSON-RPC. Clients establish a session, discover available tools and resources, and invoke them with typed parameters. Tools are categorised by scope: read-only tools require contacts:read or messages:read scopes on the token; write tools require explicit write scopes. The server enforces scopes on every call, returns structured errors when access is denied, and writes an audit log entry that records the LLM model, the workspace, the user who minted the token, the tool, the arguments and the result.',
      'The tool catalogue covers the entire CRM. Contact tools (search_contacts, get_contact, update_contact_fields, merge_contacts), conversation tools (list_conversations, get_messages, assign_conversation, send_message, generate_reply), flow tools (list_flows, trigger_flow, get_flow_run), broadcast tools (create_broadcast, list_broadcast_runs, get_broadcast_metrics) and analytics tools (run_report, query_dashboard, export_segment). Tools return JSON-RPC results with a documented schema that mirrors the REST API, so an agent that knows the REST surface can reach the MCP surface with zero relearning.',
      'Resources are read-only blobs of context: the current dashboard, the brand voice guidelines, the WhatsApp template library, the last 50 conversations on a queue. Clients can subscribe to a resource and get notified when it changes, so a chat with Claude that has the inbox resource attached automatically refreshes when new messages arrive. Prompts are reusable instruction templates that an end user can pick from a menu — "draft a reply in our brand voice", "build a segment that matches this description" — without writing the prompt themselves.',
      'For agents that need to act autonomously, the MCP server pairs with the rest of SabNode\'s primitives. An agent can search a segment, fire a broadcast, listen to webhooks for response events, and decide what to do next — all through MCP. Combined with AI Studio and Triggers, this is the closest thing on the market to a fully agentic CRM.',
    ],

    capabilities: [
      {
        title: 'JSON-RPC over MCP',
        body:
          'Standards-compliant MCP server over JSON-RPC. Compatible with Claude Desktop, Anthropic API\'s MCP support, OpenAI\'s MCP client, Google Gemini agents and the growing ecosystem of agent frameworks.',
      },
      {
        title: '40+ typed tools',
        body:
          'Tools for contacts, conversations, flows, broadcasts, analytics and files. Every tool has a typed parameter schema and a structured response schema documented in the MCP discovery handshake.',
      },
      {
        title: 'Curated resources',
        body:
          'Resources expose the current inbox, brand guidelines, template library, dashboard data and SabFiles documents. Subscriptions let the LLM see new state without manual re-fetches.',
      },
      {
        title: 'Reusable prompts',
        body:
          'Prompt templates — Draft a Reply, Summarise This Conversation, Build a Segment, Explain a Flow — let end users pick canned interactions without writing prompts themselves.',
      },
      {
        title: 'Scoped tokens',
        body:
          'MCP sessions authenticate with the same scoped API keys used by the REST API. Tools enforce scope at call time. A read-only token cannot send a broadcast, ever.',
      },
      {
        title: 'Full audit log',
        body:
          'Every tool call is logged with timestamp, LLM model, user, tool, parameters and result. Audit log is exportable to S3 and available through the REST API for compliance review.',
      },
      {
        title: 'Rate limit and quotas',
        body:
          'Per-workspace and per-token rate limits prevent runaway agents. Daily quotas on write tools (send_message, trigger_flow, create_broadcast) protect your sending reputation from a stuck loop.',
      },
    ],

    useCases: [
      {
        title: 'Claude as inbox assistant',
        industry: 'SaaS',
        body:
          'A support team connects Claude Desktop to their SabNode MCP endpoint. Agents ask Claude to draft replies using the brand voice resource, and Claude pulls the recent conversation history and customer record automatically through MCP tools.',
      },
      {
        title: 'GPT-powered segmentation',
        industry: 'D2C',
        body:
          'A growth manager asks GPT "build me a segment of high LTV repeat buyers in the south who have not bought in 60 days". GPT calls the search_contacts and build_segment MCP tools and returns a saved segment ready for broadcast.',
      },
      {
        title: 'Autonomous agent escalation',
        industry: 'E-commerce',
        body:
          'A custom LangGraph agent watches webhooks. When a high-AOV customer expresses frustration, the agent uses MCP tools to summarise the conversation, draft a 10% goodwill coupon and assign the conversation to a senior agent — without human intervention.',
      },
      {
        title: 'Gemini-powered reporting',
        industry: 'Logistics',
        body:
          'A logistics team chats with Gemini to ask "what is the average reply time on our top-5 priority lanes this week?". Gemini calls the run_report MCP tool, formats the result and offers to schedule the same query as a weekly Slack digest.',
      },
      {
        title: 'Compliance audit copilot',
        industry: 'Financial Services',
        body:
          'A compliance officer connects an internal LLM to MCP and asks for all messages containing personal financial data sent in the last 30 days. The LLM calls list_conversations and get_messages, summarises and flags anomalies for review.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Mint MCP token',
        body:
          'Generate a scoped MCP token in Settings → Developer → MCP. Pick scopes appropriate to the agent (read-only, draft-only, full-write).',
      },
      {
        step: '02',
        title: 'Configure the client',
        body:
          'Paste the SabNode MCP endpoint and token into your client (Claude Desktop, custom agent, OpenAI integration). Discovery runs automatically.',
      },
      {
        step: '03',
        title: 'Discover tools & resources',
        body:
          'The LLM lists available tools, resources and prompts. Tool schemas are typed; resources can be subscribed for live updates.',
      },
      {
        step: '04',
        title: 'Invoke from chat',
        body:
          'Ask the LLM a question that requires CRM data. It picks the right tool, calls it, and reasons over the result with the rest of your context.',
      },
      {
        step: '05',
        title: 'Audit and govern',
        body:
          'Review the audit log for every call. Tighten scopes, set quotas, rotate tokens when needed. Compliance team has a clean trail.',
      },
    ],

    integrations: [
      'Anthropic Claude',
      'OpenAI GPT',
      'Google Gemini',
      'Claude Desktop',
      'LangGraph',
      'LlamaIndex',
      'Vercel AI SDK',
      'Cursor',
    ],

    metrics: [
      { value: '40+', label: 'Tools exposed across the SabNode object graph' },
      { value: '<200ms', label: 'p95 latency on read tool calls in primary region' },
      { value: '100%', label: 'Tool calls written to the audit log with full args' },
      { value: '3', label: 'Major LLM vendors with first-party MCP support' },
    ],

    faqs: [
      {
        q: 'What is Model Context Protocol?',
        a: 'MCP is an open protocol introduced by Anthropic that standardises how LLMs talk to external systems. Servers expose tools, resources and prompts over JSON-RPC. Any MCP-aware client — Claude, OpenAI, Gemini, custom agent frameworks — can discover and use them without the integrator writing vendor-specific adapters.',
      },
      {
        q: 'Is the MCP server stable in production?',
        a: 'Yes. SabNode\'s MCP server is built on the same infrastructure as the REST API, with the same uptime SLA. Tools call into the same internal services that power the UI, so behaviour is consistent. We pin against the MCP specification version your client negotiates, so a spec update never breaks an existing agent without notice.',
      },
      {
        q: 'Can I expose only a subset of tools to a specific LLM?',
        a: 'Yes. Scopes on the MCP token define which tools are visible during discovery. A read-only token sees only read tools, and an even narrower custom scope can restrict the agent to, say, contacts-only access. Workspace admins can define reusable scope bundles and assign them per integration.',
      },
      {
        q: 'How does this differ from giving the LLM the REST API?',
        a: 'You could give an LLM the REST API via tool calling, but you would write the adapter per LLM (OpenAI functions, Anthropic tools, Gemini function declarations). MCP standardises the adapter. The same server works across every LLM client with no extra code, and resource subscriptions and prompts have no native equivalent in raw REST tool calling.',
      },
      {
        q: 'Does the LLM have access to other tenants?',
        a: 'No. Each MCP token is workspace-scoped. Tool calls hit the same multi-tenant guards as the REST API. A token minted in workspace A can never read or write to workspace B, and tenant isolation is enforced at the database query layer regardless of what the LLM tries to pass as an argument.',
      },
      {
        q: 'Can I run my own MCP server alongside SabNode\'s?',
        a: 'Yes. MCP is open; you can run additional servers for your own internal systems and let the LLM use both. A common pattern is SabNode (CRM) plus an internal Postgres MCP server plus an analytics MCP server, all visible to one agent.',
      },
      {
        q: 'Is the MCP server safe for autonomous agents?',
        a: 'It is safer than raw API access. Daily quotas on write tools prevent a stuck loop from blasting your customer base. The audit log captures every call. Scoped tokens let you start in read-only mode and gradually grant write scopes as you build confidence in the agent\'s behaviour. We still recommend a human review loop for any first-time production agent.',
      },
    ],

    related: ['ai-studio', 'rest-api', 'oauth', 'webhooks'],
  },

  {
    slug: 'oauth',
    name: 'OAuth 2 & API Keys',
    brand: 'Developer',
    category: 'developer',
    tagline: 'Scoped access tokens with audit log and granular permissions.',
    iconKey: 'shield',
    color: '#8B5CF6',
    tint: '#F3E8FF',

    seoTitle: 'OAuth 2.0 with PKCE & Scoped API Keys for SaaS | SabNode',
    seoDescription:
      'OAuth 2.0 with PKCE, scoped API keys, IP allowlists, refresh-token rotation, fine-grained permissions and a full audit log of every token-issued call.',
    keywords: [
      'oauth 2 pkce flow saas',
      'scoped api keys crm',
      'oauth client credentials grant',
      'api key audit log',
      'fine grained permissions rbac',
      'refresh token rotation oauth',
      'ip allowlist api key',
      'service account oauth 2',
      'mcp token oauth',
      'whatsapp api oauth scopes',
    ],

    hero: {
      eyebrow: 'Developer · OAuth 2 & API Keys',
      headline: 'Permissions you can defend in a security review.',
      subhead:
        'SabNode supports OAuth 2.0 with PKCE for third-party apps, scoped API keys for backend integrations and short-lived service tokens for ephemeral jobs. Every credential has fine-grained scopes, optional IP allowlists, configurable lifetime and a full audit log of every API and MCP call it makes.',
      bullets: [
        'OAuth 2.0 with PKCE for apps',
        'Scoped API keys for servers',
        'Refresh tokens with rotation',
        'IP allowlist + audit log per key',
      ],
    },

    problem: {
      title: 'A leaked admin token is a six-figure incident',
      body:
        'Most CRMs ship a single "API key" that grants full read-write across the entire workspace. The first developer who builds an integration drops it in their .env, the .env leaks to a public Git repo six months later, and now an attacker can export every contact, send broadcasts and delete data. Rotating that key breaks every integration at once because nothing was scoped.\n\nThe second pain is OAuth done poorly. Many SaaS products implement a half-OAuth flow without PKCE, without refresh-token rotation, without proper redirect URI validation. Audit teams flag it, customers refuse to install third-party apps, and your marketplace dies before it starts.\n\nThe third is auditability. When a regulator asks "who called the contacts export endpoint in February?", you should have a clean answer in 30 seconds. With most CRMs the answer is a Slack archaeology session and a confession that you cannot tell. SabNode treats credentials as a first-class security primitive.',
    },

    overview: [
      'SabNode supports three credential types. Scoped API keys are long-lived secrets minted in the dashboard for backend integrations — your nightly Snowflake sync, your internal admin script, your Vercel function. Each key has a list of scopes (contacts:read, messages:write, broadcasts:write and so on), an optional IP allowlist, an optional expiry date and a rate limit. Rotating a key issues a new secret while letting the old one keep working for a grace period of up to 30 days.',
      'OAuth 2.0 with PKCE is the path for third-party apps and marketplace integrations. The full authorization-code flow with PKCE is supported (S256 only), refresh tokens rotate on every use, and redirect URIs are validated with strict equality. The OAuth server exposes the standard discovery endpoints (/.well-known/oauth-authorization-server, /.well-known/openid-configuration where relevant) so MCP clients and SDKs that auto-discover endpoints work out of the box. Client-credentials grant is available for machine-to-machine integrations that do not need user context.',
      'Permissions are scoped, not roled. Instead of "admin" or "agent", credentials carry the precise scopes they need: contacts:read, contacts:write, contacts:delete, messages:read, messages:write, flows:execute, broadcasts:write, audit:read, and so on. Workspace admins can define reusable scope bundles ("Marketing Backend", "Support Read-only") that map to common integration shapes. Wildcard scopes are not exposed — every grant is explicit.',
      'Every API and MCP call is written to a tamper-evident audit log with the credential ID, the caller IP, the endpoint, the parameters (PII-redacted), the response code and the duration. The log is searchable in the dashboard for 90 days, exportable to S3 indefinitely, and accessible by the audit:read scope for your SIEM or compliance tooling.',
    ],

    capabilities: [
      {
        title: 'OAuth 2.0 + PKCE',
        body:
          'Standard authorization-code flow with PKCE S256, strict redirect URI matching and refresh-token rotation. Client-credentials and device-code grants are available for headless integrations and CLI tools.',
      },
      {
        title: 'Scoped API keys',
        body:
          'Long-lived backend keys with an explicit scope list. No "admin" wildcard. Optional IP allowlist, optional expiry, optional rate-limit override. Rotation grants a 30-day grace period for zero-downtime cutovers.',
      },
      {
        title: 'Fine-grained scopes',
        body:
          'About 30 scopes covering read, write and delete across every object type. Compose them into reusable bundles for common integration shapes. Wildcard grants are intentionally absent.',
      },
      {
        title: 'Refresh-token rotation',
        body:
          'Refresh tokens are single-use. On refresh, the old token is invalidated, and the new pair is issued. Token replay attacks against a stolen refresh token are detected and shut down the OAuth grant.',
      },
      {
        title: 'IP allowlists',
        body:
          'Restrict a credential to a CIDR list. Calls from outside the list return 401 with a structured error. Useful for locking integrations to your VPC NAT or your office static IP.',
      },
      {
        title: 'Audit log',
        body:
          'Every authenticated call writes an audit entry. Search by credential, IP, endpoint, status or PII access. Export to S3 or stream to your SIEM via webhook for long-term retention and analysis.',
      },
      {
        title: 'Service tokens',
        body:
          'Short-lived (5-60 minute) tokens minted on demand for ephemeral jobs. Useful for CI pipelines, Vercel Sandbox runs and one-off migrations. Expire automatically, leaving no long-tail attack surface.',
      },
    ],

    useCases: [
      {
        title: 'Marketplace app install',
        industry: 'SaaS',
        body:
          'A third-party analytics app uses OAuth 2.0 with PKCE to ask a SabNode user for read-only access to broadcasts and analytics. The user sees the precise scopes on the consent screen and approves; the app never sees the user\'s password.',
      },
      {
        title: 'Locked-down nightly sync',
        industry: 'Financial Services',
        body:
          'A fintech mints a contacts:read,messages:read API key with an IP allowlist on its NAT egress range and a daily expiry. The nightly job rotates the key automatically through their secrets manager.',
      },
      {
        title: 'Auditor read-only access',
        industry: 'Healthcare',
        body:
          'A healthcare compliance auditor is granted an audit:read,contacts:read token for 14 days. They can pull the audit log and verify access patterns without being able to write or delete anything in the workspace.',
      },
      {
        title: 'CI deployment token',
        industry: 'EdTech',
        body:
          'A GitHub Actions workflow mints a 15-minute service token at the start of a deploy, uses it to update flow definitions, and lets it expire. No long-lived credentials sit in CI environment variables.',
      },
      {
        title: 'Multi-tenant agency',
        industry: 'B2B',
        body:
          'An agency manages 40 client workspaces with OAuth. Each workspace consents independently. Revoking an agency app from one client does not affect the other 39, and the agency\'s dashboard shows scopes per workspace.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Choose credential type',
        body:
          'API key for backend integrations, OAuth app for third-party software, service token for ephemeral jobs. Mix and match per workspace.',
      },
      {
        step: '02',
        title: 'Pick scopes',
        body:
          'Select the precise scopes the credential needs. Use a saved scope bundle or compose from the catalogue. No wildcards.',
      },
      {
        step: '03',
        title: 'Configure guardrails',
        body:
          'IP allowlist, expiry date, rate-limit override, audit-level logging. Each guardrail is optional and editable post-creation.',
      },
      {
        step: '04',
        title: 'Distribute safely',
        body:
          'API keys are shown once and stored hashed at rest. OAuth secrets follow the standard discovery flow. Service tokens are minted on demand and never persisted.',
      },
      {
        step: '05',
        title: 'Monitor & rotate',
        body:
          'Audit log shows usage in real time. Rotate keys with a 30-day grace window. Revoke OAuth grants per workspace without affecting others.',
      },
    ],

    integrations: [
      'OAuth 2.0',
      'OIDC',
      'GitHub Actions',
      'AWS IAM',
      'Vault',
      'Doppler',
      'Vercel',
      'Okta',
    ],

    metrics: [
      { value: '~30', label: 'Distinct scopes covering read, write and delete' },
      { value: '90d', label: 'Audit log retention in dashboard, indefinite via S3' },
      { value: '30d', label: 'Rotation grace period for zero-downtime key cutover' },
      { value: '5min', label: 'Minimum lifetime for ephemeral service tokens' },
    ],

    faqs: [
      {
        q: 'Do you support OAuth 2.1?',
        a: 'Our OAuth implementation already follows the OAuth 2.1 best-current-practice profile: PKCE is mandatory for public clients, refresh tokens rotate on every use, the implicit and password grants are not exposed, and redirect URIs are validated by strict string equality with no wildcards. When the 2.1 spec is finalised, we will align to its final wire details without breaking existing apps.',
      },
      {
        q: 'How are API keys stored?',
        a: 'API keys are hashed with bcrypt at rest. The plaintext is shown to the user exactly once at creation and never again. The hash is what is checked on every request. A leaked database dump does not expose any valid API keys — even from a successful attacker on the row level.',
      },
      {
        q: 'Can I scope a key to a single contact segment?',
        a: 'Not yet. Scopes today are operation-level (contacts:read across the workspace). Row-level scoping by segment or tag is on the roadmap and is already available for read tools in MCP when paired with an upstream filter, but native row-level API key scoping ships later this year.',
      },
      {
        q: 'How does revocation propagate?',
        a: 'Revocation is immediate for API keys and OAuth refresh tokens — both go through a cache layer with a sub-second TTL, so the next request after revocation is rejected. Active OAuth access tokens live up to their TTL (default 60 minutes) before they must refresh, at which point the revoked refresh token blocks them.',
      },
      {
        q: 'Is multi-factor required for credential creation?',
        a: 'Yes for workspace admins on the Pro plan and above. MFA is enforced on the create-API-key, rotate-API-key and revoke-OAuth-app operations. Enterprise workspaces can require MFA on every sensitive admin action, with a configurable session-rebind window.',
      },
      {
        q: 'Can I use this for inbound webhooks too?',
        a: 'Inbound webhook receivers use HMAC signing per the Webhooks feature; OAuth is for outbound API and MCP traffic. The two systems share the same audit-log surface, so a security review can see all integration traffic — inbound and outbound — in one place.',
      },
      {
        q: 'How do I integrate with my secrets manager?',
        a: 'We have first-party guides for HashiCorp Vault, AWS Secrets Manager, Doppler and 1Password. The pattern is the same: a script mints the API key, writes it to your manager, and your application reads it at boot. Rotation is automated by a cron job that reads the current key, mints a new one, writes it, and lets the 30-day grace period absorb the cutover.',
      },
    ],

    related: ['rest-api', 'webhooks', 'mcp-server', 'environments'],
  },

  {
    slug: 'environments',
    name: 'Environments',
    brand: 'Developer',
    category: 'developer',
    tagline: 'Sandbox → staging → production with per-env credentials and domains.',
    iconKey: 'gitBranch',
    color: '#F59E0B',
    tint: '#FEF3C7',

    seoTitle: 'Sandbox, Staging and Production Environments | SabNode',
    seoDescription:
      'Test in a Meta-backed sandbox, validate in staging, ship to production. Per-environment credentials, domains, webhooks and a one-click promote flow.',
    keywords: [
      'whatsapp api sandbox environment',
      'staging production saas separation',
      'preview environment crm',
      'environment promotion ci cd',
      'sandbox meta whatsapp testing',
      'per environment api keys',
      'environment variables vercel',
      'safe testing whatsapp flows',
      'multi tenant environment isolation',
      'data residency per environment',
    ],

    hero: {
      eyebrow: 'Developer · Environments',
      headline: 'Ship to production without breaking customers.',
      subhead:
        'Every SabNode workspace ships with sandbox, staging and production environments. Each has its own Meta credentials, webhook URLs, API keys, custom domains and rate-limit budgets. Promote a flow, a template or a broadcast across environments with one click and full diff review.',
      bullets: [
        'Sandbox, staging, production by default',
        'Per-env credentials, webhooks and domains',
        'One-click promote with diff review',
        'Sandbox uses Meta\'s test number',
      ],
    },

    problem: {
      title: 'Testing in production is how broadcasts get blocked',
      body:
        'Most teams using a WhatsApp Business API tool have one environment: production. They build a new flow, send a "test broadcast" to a list of "test" phone numbers, accidentally include their entire VIP segment, and burn a year of brand goodwill in three minutes. Or they push a template change to Meta from production, get rejected, and now their main customer-comm template is stuck in pending for the next 48 hours.\n\nDevelopers feel this even harder. Without a real sandbox you cannot integration-test your code against the WhatsApp API — you mock it, hope the mocks match reality, and discover three months later that some edge case behaves differently in Meta\'s production graph. Webhook signatures, template validation states, message status callbacks — every one of these has subtle differences in test mode that you only learn by burning production.\n\nSabNode\'s environment model treats sandbox, staging and production as first-class peers from day one. Your CI can run end-to-end tests against sandbox. Your marketing team can preview a broadcast in staging. Your ops team can promote to production with a diff review. Nobody has to be a hero on a Friday night.',
    },

    overview: [
      'Every SabNode workspace boots with three environments: sandbox, staging and production. Sandbox is wired to Meta\'s WhatsApp test number with unlimited free messages to your own verified test phones. Staging connects to a separate WhatsApp Business Account (recommended) with a small budget for internal QA testing on real WABA infrastructure. Production is your customer-facing environment with the WABAs, templates and broadcast budgets you actually run on.',
      'Each environment has its own credentials — Meta tokens, webhook URLs, OAuth client IDs, API keys. The credentials are isolated at the database level: a sandbox API key cannot read production contacts, ever. The same applies to webhook subscriptions, custom domains, embedded widget origins and OAuth redirect URIs. There is no scenario where a sandbox misconfiguration leaks to production.',
      'Promotion is explicit. When a flow, template, broadcast definition or AI Studio assistant is ready, you click "Promote to staging" and SabNode generates a diff showing exactly what is being copied across (the flow nodes, the template body, the bindings) and what is being remapped (sandbox webhook URL → staging webhook URL). After a staging green light, "Promote to production" repeats the diff with production credentials. Promotion is recorded in the audit log with the user, the artifact and the timestamp.',
      'For agencies, white-label and multi-region deployments, environments compose with the workspace boundary: each workspace has its own sandbox/staging/prod set, so a 40-client agency runs 120 environments cleanly. Data residency settings on enterprise plans can be set per environment, so EU staging and prod can sit in EU regions while a global sandbox stays cheap and local.',
    ],

    capabilities: [
      {
        title: 'Three environments by default',
        body:
          'Sandbox, staging and production ship with every workspace. Additional environments (preview, demo, regional) are available on Pro and Enterprise plans for branch-deploy and multi-region scenarios.',
      },
      {
        title: 'Meta sandbox wired in',
        body:
          'Sandbox is connected to Meta\'s WhatsApp test number with up to 5 verified test phones. Send unlimited messages for development without burning template approvals or production rate-limit budget.',
      },
      {
        title: 'Isolated credentials',
        body:
          'Per-environment Meta tokens, API keys, OAuth client IDs and webhook signing secrets. Credentials cannot read across environments at the database query layer — isolation is enforced, not advisory.',
      },
      {
        title: 'Custom domains per env',
        body:
          'Mount a different domain per environment: chat.acme.com on production, chat-staging.acme.com on staging, chat-sandbox.acme.com on sandbox. Embedded widgets, OAuth redirects and SabFiles share links each respect the environment.',
      },
      {
        title: 'One-click promote',
        body:
          'Promote flows, templates, broadcasts, AI Studio assistants and segments across environments. Diff review shows added, changed and remapped fields before the promote runs.',
      },
      {
        title: 'Environment-scoped webhooks',
        body:
          'Each environment has its own webhook subscriptions and DLQ. Outbound URLs typically point at a different deployment of your code (sandbox endpoint, staging endpoint, prod endpoint) so the same code can be tested across environments.',
      },
      {
        title: 'CI-friendly tokens',
        body:
          'Short-lived service tokens scoped to sandbox are ideal for CI integration tests. Mint at the start of a job, run end-to-end tests through real Meta APIs, let the token expire. Tests run in 30-60 seconds.',
      },
    ],

    useCases: [
      {
        title: 'CI integration tests',
        industry: 'SaaS',
        body:
          'A SaaS engineering team runs full integration tests against SabNode\'s sandbox on every PR. Tests fire a real WhatsApp message to a verified test phone, verify the webhook fires, and inspect the conversation state. Production stays untouched.',
      },
      {
        title: 'Broadcast preview in staging',
        industry: 'D2C',
        body:
          'A D2C marketing team builds a 50k broadcast in staging, sends it to a 20-contact internal cohort, reviews open rate and copy quality, then promotes the broadcast definition to production for the real send.',
      },
      {
        title: 'Template approval workflow',
        industry: 'Financial Services',
        body:
          'A fintech submits templates to Meta from staging first. Approvals surface in staging within hours, the team verifies rendering, then promotes the template to production for actual customer sends. Rejection cycles never touch production.',
      },
      {
        title: 'Agency client onboarding',
        industry: 'B2B',
        body:
          'An agency builds a new client\'s flow in their own internal sandbox workspace, copies it to the client\'s staging environment for review, then promotes to the client\'s production once signed off. Three environments, two workspaces, one promote path.',
      },
      {
        title: 'EU data residency',
        industry: 'Healthcare',
        body:
          'A healthcare platform runs staging and production in the EU region with workspace-level data residency. Sandbox stays in the global region for faster iteration. Promotion across regions is rate-limited and audited.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Default trio',
        body:
          'Workspace ships with sandbox, staging and production. Each has unique credentials, webhook URLs and rate limits.',
      },
      {
        step: '02',
        title: 'Configure per env',
        body:
          'Set custom domain, WABA, API keys and webhook endpoints for each environment. Defaults work for dev; lock down prod.',
      },
      {
        step: '03',
        title: 'Build in sandbox',
        body:
          'Develop flows, templates and AI assistants in sandbox. Use Meta\'s test number to send real messages without cost.',
      },
      {
        step: '04',
        title: 'Promote with diff',
        body:
          'Click Promote, review the diff (added, changed, remapped). Promote to staging for QA, then to production for go-live.',
      },
      {
        step: '05',
        title: 'Roll back if needed',
        body:
          'Every promote creates a versioned snapshot in the target env. Roll back to a previous snapshot in one click if needed.',
      },
    ],

    integrations: [
      'Vercel',
      'GitHub Actions',
      'AWS',
      'Meta WhatsApp Business Platform',
      'Cloudflare',
      'Doppler',
      'Datadog',
      'Sentry',
    ],

    metrics: [
      { value: '3', label: 'Default environments per workspace at no extra cost' },
      { value: '<30s', label: 'Median time to promote a flow across environments' },
      { value: '0', label: 'Cross-environment credential leakage at DB query layer' },
      { value: '5', label: 'Verified test phones per sandbox for free messaging' },
    ],

    faqs: [
      {
        q: 'Do I need a separate WABA for staging?',
        a: 'Recommended, not required. Sandbox always uses Meta\'s test number. Staging can either share the production WABA (cheap, simple) or use a separate dedicated WABA (best practice for template approval and quality-rating isolation). Most growing teams move to a separate staging WABA once they cross 100k messages per month.',
      },
      {
        q: 'Does promote also copy contacts and messages?',
        a: 'No. Promote moves configuration (flows, templates, broadcast definitions, AI assistants, segments-as-definitions) — never customer data. Contacts and conversations stay in the environment where they were created. This keeps production data out of sandbox and staging, which simplifies privacy reviews and regulatory compliance.',
      },
      {
        q: 'Can I add more than three environments?',
        a: 'Yes. Pro plan adds preview environments (one per Git branch, integrated with Vercel and Netlify previews). Enterprise plans support arbitrary named environments — common patterns are demo, training, regional (eu-prod, in-prod, us-prod) and per-team sandboxes.',
      },
      {
        q: 'How do I run CI against sandbox?',
        a: 'Mint a short-lived service token scoped to sandbox at the start of your CI job. Use the SabNode SDK to drive end-to-end scenarios — send a message, wait for the webhook, assert state. The token expires at job end, so a compromised CI environment cannot exfiltrate long-lived secrets. See the SabNode GitHub Actions guide for a ready-to-copy workflow.',
      },
      {
        q: 'Are rate limits per environment?',
        a: 'Yes. Each environment has its own rate-limit bucket so a runaway test in sandbox cannot affect production throughput. Sandbox limits are lower (designed for development), staging mirrors production limits for realistic load tests, production uses your plan\'s full allocation.',
      },
      {
        q: 'How is data residency enforced per environment?',
        a: 'On enterprise plans you can pin each environment to a region (us, eu, in). Pinning means contacts, messages, files and audit logs are stored exclusively in that region\'s database and object storage. Cross-region promote of configuration is allowed; cross-region data movement is not. Each environment\'s residency is shown on the security dashboard.',
      },
      {
        q: 'Can I promote backwards (prod → staging)?',
        a: 'Yes, for configuration. If a hotfix is made directly in production (rare, but it happens), you can back-promote the config change to staging to keep environments in sync. The system warns you when prod and staging definitions diverge and offers a back-promote at any time.',
      },
    ],

    related: ['rest-api', 'oauth', 'webhooks', 'meta-flow-editor'],
  },
];
