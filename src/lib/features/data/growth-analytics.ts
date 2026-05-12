import type { Feature } from '../types';

export const growthAnalyticsFeatures: Feature[] = [
  {
    slug: 'broadcasts',
    name: 'Broadcasts',
    brand: 'Campaigns',
    category: 'growth',
    tagline: 'Ship Meta-approved templates to 100k+ contacts. Live delivery reporting.',
    iconKey: 'send',
    color: '#06B6D4',
    tint: '#CFFAFE',

    seoTitle: 'WhatsApp Broadcasts at 100k+ Scale Live Reports | SabNode',
    seoDescription:
      'Send Meta-approved WhatsApp template broadcasts to 100k+ contacts. Live delivery, read and reply reporting with segment pacing and retries in one console.',
    keywords: [
      'whatsapp broadcast software',
      'bulk whatsapp template sender',
      'meta approved template broadcast',
      'whatsapp marketing campaign tool',
      'whatsapp business api broadcast',
      'segmented whatsapp broadcast',
      'whatsapp delivery report dashboard',
      'whatsapp opt-in compliant broadcast',
      'high throughput whatsapp sender',
      'whatsapp campaign analytics',
    ],

    hero: {
      eyebrow: 'Campaigns · Broadcasts',
      headline: 'Send broadcasts at scale without praying',
      subhead:
        'Most teams launch a WhatsApp blast, refresh a dashboard and hope the numbers move. SabNode broadcasts give you live delivery, read and reply telemetry as messages leave the queue, with throttling, retries and per-segment pacing wired into one console. Pick a template, attach an audience, hit send.',
      bullets: [
        'Live sent, delivered, read, failed counters',
        'Per-second throttling tuned to your WABA tier',
        'Segment, suppress and pace by timezone',
        'Auto-retry transient failures with backoff',
      ],
    },

    problem: {
      title: 'Broadcasts are too important to fly blind',
      body:
        'Most WhatsApp marketing teams still operate the same way they did three years ago: export a CSV, paste it into a vendor portal, choose a template, click send, then watch a spinner. By the time the queue clears, a few thousand sends have already failed for opt-out, invalid numbers or template policy mismatches — and no one knows which segment was hit hardest until a CSV is exported the next morning.\n\nMeanwhile the platform itself keeps moving. Meta changed marketing template pricing to per-conversation, introduced new categories (Marketing, Utility, Authentication), tightened policy on promotional content inside Utility templates, and started gating high-volume senders behind quality ratings. A broadcast that worked last month can throttle silently this month if a template is paused or your WABA quality drops to medium.\n\nThe cost of running blind compounds. A 5 percent silent failure rate on a 200,000-contact campaign is 10,000 customers who never heard from you, plus a slow degradation of your phone number quality that nobody traced back. Operators need broadcasts that report in real time, respect segmentation rules, and surface platform-level signals before they become incidents.',
    },

    overview: [
      'SabNode broadcasts are built around the assumption that you will send to large, segmented audiences and need to see what is happening while it happens. When you launch a broadcast we open a live socket back to the console: each message moves through queued, sent, delivered, read, replied and failed states, and the counters update message-by-message. If your WABA tier supports 80 messages per second, the dispatcher fills that pipe; if Meta starts throttling, we back off automatically and tell you why.',
      'Audiences come from Contacts, Segments or uploaded CSV. Every recipient is checked against opt-in status, suppression lists and 24-hour service window rules before we attempt delivery, so you do not burn template credits on contacts who already opted out. Variables are validated against the template body and header before send — a missing `{{1}}` value blocks the broadcast rather than failing per-message at Meta, which would damage your quality rating.',
      'After dispatch, every event flows into the reporting layer. You can pivot delivery, read-rate and reply-rate by segment, language, template version and even the hour-of-day a message was sent, which makes timezone pacing decisions defensible to growth leadership. Failed messages are bucketed by Meta error code so your operations team can act on the actionable failures (re-opt-in, fix variable, switch number) without drowning in noise.',
      'Broadcasts are not islands. Every send becomes a campaign touch in attribution, every reply lands in the shared inbox with the original broadcast attached, and every conversion can be tied back to the template and audience that drove it. This is the difference between sending messages and running a measurable channel.',
    ],

    capabilities: [
      {
        title: 'High-throughput dispatcher',
        body: 'Tuned to your WABA tier, the dispatcher fills your messages-per-second pipe and backs off the instant Meta returns 429 or quality signals. A 200k broadcast typically clears in under 25 minutes on a Tier 3 number.',
      },
      {
        title: 'Live state telemetry',
        body: 'Every message moves through queued → sent → delivered → read → replied → failed, with counters updating in real time over a websocket. You see the dip the moment it happens, not in tomorrow\'s export.',
      },
      {
        title: 'Audience guardrails',
        body: 'Opt-in, suppression and 24-hour window checks run before we hit Meta. Contacts flagged as opted-out, undeliverable or recently messaged are excluded automatically and surfaced as a suppression report.',
      },
      {
        title: 'Variable validation',
        body: 'Templates are parsed and variables checked against your contact fields before the broadcast launches. Missing or empty variables block the send so you never waste credits on per-message rejections.',
      },
      {
        title: 'Timezone pacing',
        body: 'Pace by recipient timezone or fixed window — for example, deliver to Mumbai contacts 10am–8pm IST and Dubai contacts 9am–9pm GST. The dispatcher schedules per recipient, not per batch.',
      },
      {
        title: 'Retry and failure routing',
        body: 'Transient errors retry with exponential backoff. Permanent failures (invalid number, opted out, template paused) are bucketed by Meta error code and pushed to a failure inbox for ops review.',
      },
      {
        title: 'Reply routing to inbox',
        body: 'Every reply is stitched back to the broadcast that triggered it and lands in the shared inbox with full context. Agents see the template, variables and segment without leaving the conversation.',
      },
    ],

    useCases: [
      {
        title: 'Sale launch to 250k subscribers',
        industry: 'E-commerce',
        body: 'A D2C apparel brand fires a marketing template the morning of a flash sale, segmented by past purchase category and city. Pacing keeps the surge under WhatsApp\'s quality threshold, replies route to inbox, and revenue is attributed back inside two hours.',
      },
      {
        title: 'Payment reminder utility blast',
        industry: 'Financial Services',
        body: 'An NBFC sends a Utility template for upcoming EMI due dates to 80,000 borrowers daily. Conversation-based pricing keeps cost predictable, DLT-compliant headers are pre-attached, and failed sends route to SMS fallback via Twilio.',
      },
      {
        title: 'Course launch with regional language variants',
        industry: 'EdTech',
        body: 'An edtech platform broadcasts a course-drop announcement in English, Hindi, Tamil and Telugu. SabNode resolves the right template version per contact based on language preference, with a single campaign view across all four.',
      },
      {
        title: 'Appointment confirmation at scale',
        industry: 'Healthcare',
        body: 'A diagnostics chain sends 40,000 appointment-confirmation utility templates the night before. CSAT auto-triggers post-visit, no-shows fall by double-digit percent because patients can reply directly to confirm or reschedule.',
      },
      {
        title: 'Driver shift reminders',
        industry: 'Logistics',
        body: 'A last-mile logistics operator runs a daily Authentication-style broadcast at 5am to confirm shift availability. Replies populate a roster in real time and missing drivers escalate to ops chat in Slack within minutes.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Pick a template',
        body: 'Choose from approved Marketing, Utility or Authentication templates in the library. Preview header, body, footer and buttons with sample variables before you commit.',
      },
      {
        step: '02',
        title: 'Attach an audience',
        body: 'Select a saved segment, contact list or upload a CSV. Opt-in, suppression and 24-hour window filtering happens automatically with a transparent count.',
      },
      {
        step: '03',
        title: 'Map variables and pacing',
        body: 'Bind template variables to contact fields, then set throughput, timezone pacing and a holdout percentage if you want a clean control group for attribution.',
      },
      {
        step: '04',
        title: 'Launch and watch live',
        body: 'Send now or schedule. The console shows queued, sent, delivered, read and failed counters tick up in real time with per-segment breakdowns.',
      },
      {
        step: '05',
        title: 'Triage and attribute',
        body: 'After dispatch, review failure buckets, replies in the shared inbox and revenue attribution. Export the campaign report to your warehouse with one click.',
      },
    ],

    integrations: ['Meta', 'Shopify', 'HubSpot', 'Razorpay', 'Twilio', 'Google Sheets', 'Slack', 'BigQuery'],

    metrics: [
      { value: '80/sec', label: 'Throughput on Tier 3 WhatsApp Business numbers' },
      { value: '<25 min', label: 'Time to clear a 200,000 contact broadcast' },
      { value: '99.4%', label: 'Median delivery rate across customer broadcasts' },
      { value: '42%', label: 'Average read rate on Marketing templates' },
    ],

    faqs: [
      {
        q: 'Do I need to apply for templates separately, or does SabNode handle that?',
        a: 'You author the template directly inside SabNode and submit for Meta approval from the same screen. We track approval status, surface rejection reasons in plain language and version every change so you can roll back if a newer variant performs worse. Approved templates are immediately available to broadcasts and flows.',
      },
      {
        q: 'How does pricing work for marketing broadcasts?',
        a: 'WhatsApp uses conversation-based pricing, so a marketing template opens a 24-hour marketing conversation. SabNode does not mark up Meta\'s charges — you see the per-conversation cost by country in the broadcast preview before launch, plus a forecast of total spend based on your audience size and prior delivery rate.',
      },
      {
        q: 'What happens if my WABA quality rating drops mid-broadcast?',
        a: 'The dispatcher monitors quality signals and Meta throttle responses. If your number drops to medium quality, we automatically slow throughput to a safer rate; if it drops to low, we pause the broadcast and alert you so you can investigate (usually a high opt-out or block rate from a specific segment) before resuming.',
      },
      {
        q: 'Can I run a holdout group for attribution?',
        a: 'Yes. Set a holdout percentage on the broadcast and SabNode will randomly suppress that fraction of the audience while still treating them as exposed for attribution purposes. After dispatch you compare conversion lift between treated and held-out cohorts in the campaign report.',
      },
      {
        q: 'How do replies to a broadcast get handled?',
        a: 'Every reply lands in the shared inbox attached to a conversation that references the broadcast, template and variable values that were sent. Agents see the original outbound at the top, which removes the "what message are they replying to?" guesswork and keeps response times down even on six-figure sends.',
      },
      {
        q: 'Is this DLT-compliant for Indian senders?',
        a: 'SabNode supports DLT header IDs and content templates for SMS fallback through Twilio and Indian aggregators. WhatsApp itself is exempt from DLT, but if you use SMS fallback for failed WhatsApp sends, the registered DLT template auto-attaches and the broadcast log shows the channel used per contact.',
      },
      {
        q: 'Can I segment by language and send the right template variant?',
        a: 'Yes. Templates support multiple language variants under one parent. SabNode resolves the right variant per contact based on the language field on the contact record, so a single campaign covers English, Hindi, Spanish or any other approved language without parallel workflows.',
      },
    ],

    related: ['templates', 'campaigns', 'segments', 'dashboards'],
  },

  {
    slug: 'templates',
    name: 'Template Library',
    brand: 'Campaigns',
    category: 'growth',
    tagline: 'In-app approval flow, variable preview and version history.',
    iconKey: 'fileText',
    color: '#4F46E5',
    tint: '#EEF2FF',

    seoTitle: 'WhatsApp Template Library, Versions & Approvals | SabNode',
    seoDescription:
      'Author, submit and version WhatsApp message templates inside SabNode. Variable preview, category guidance and one-click submission to Meta with status tracking.',
    keywords: [
      'whatsapp template approval tool',
      'meta template library manager',
      'hsm template management',
      'whatsapp marketing template builder',
      'utility template approval flow',
      'authentication template whatsapp',
      'template version history',
      'whatsapp template variable preview',
      'multi language whatsapp templates',
      'template rejection reason tracker',
    ],

    hero: {
      eyebrow: 'Campaigns · Templates',
      headline: 'Stop guessing why Meta rejected your template',
      subhead:
        'WhatsApp templates are the difference between a channel that scales and a channel that throttles. SabNode gives you a structured authoring environment with category guidance, variable preview, rejection-reason translation and full version history — so the next submission gets approved on the first try.',
      bullets: [
        'Author Marketing, Utility and Authentication templates',
        'Preview variables, header media and buttons',
        'One-click submit to Meta, track status live',
        'Version history with rollback and diff',
      ],
    },

    problem: {
      title: 'Template approvals are a black box',
      body:
        'Every WhatsApp operator has lost a launch to a template rejection. Sometimes the reason is obvious — a promotional clause in a Utility template — but more often it is a single phrase, a generic CTA button, or an opaque "policy violation" with no further detail. The team rewrites, resubmits, waits 24 hours, gets rejected again, and the campaign slips a week.\n\nIt gets worse at scale. A growth team running 30 active templates across four languages quickly loses track of which version is live, which variant performed best in the last A/B test, and what changed between submission v3 and v4. People paste templates into Notion docs, label them "FINAL_v2_use-this", and the truth drifts. When Meta deprecates a template category or quietly changes a policy, nobody notices until traffic falls off a cliff.\n\nMeanwhile templates are now the single most regulated surface in your stack. Categories carry different pricing, different policy bars, and different rejection patterns. You cannot run a serious WhatsApp practice on screenshots and shared docs. You need a library that treats templates as first-class versioned objects, with a feedback loop that explains rejections in plain English and surfaces the patterns that pass.',
    },

    overview: [
      'The SabNode template library is the source of truth for every WhatsApp message that leaves your account. Every template is a versioned object with a category (Marketing, Utility, Authentication), language variants, header (text, image, video or document), body with typed variables, optional footer and buttons (quick reply, URL, phone). When you edit a template, we create a new draft version — the live version keeps serving broadcasts and flows until the new draft is approved.',
      'Authoring includes a real-time preview that renders exactly how the message will look on iOS and Android, with sample values plugged into every variable. Buttons render with character counts, URLs are validated, and media headers are previewed at the right aspect ratio. Before you submit, we lint the template against common rejection patterns — promotional language inside Utility, missing opt-in references, broken variable indices — and explain each warning in plain English so you can fix issues pre-submission.',
      'Submission is one click. The library tracks status (pending, approved, rejected, paused, disabled) and surfaces rejection reasons translated from Meta\'s policy codes into actionable language: not just "policy violation" but "Utility templates cannot contain promotional offers — line 3 mentions a discount." You can resubmit a fix without losing history; every version, every rejection, every approver is logged.',
      'Templates are not just for broadcasts. The flow builder, AI Studio responses, scheduled campaigns and chatbot rules all pull from the same library. Pause a template here and it stops sending everywhere. Roll back a variant here and every downstream surface updates. This is the contract that keeps a large WhatsApp practice from drifting out of compliance one rogue copy edit at a time.',
    ],

    capabilities: [
      {
        title: 'Category-aware authoring',
        body: 'Each template category (Marketing, Utility, Authentication) has different policy bars and pricing implications. The editor adapts — Utility templates warn on promotional language, Authentication enforces OTP patterns, Marketing surfaces conversation pricing.',
      },
      {
        title: 'Live device preview',
        body: 'See your template render exactly as it will on a recipient\'s phone, with sample variables, button styling, media headers at the correct ratio and footer disclaimers. Catch layout issues before submission, not after rejection.',
      },
      {
        title: 'Pre-submission lint',
        body: 'Common rejection patterns are flagged in real time: promotional copy in Utility, missing variable indices, button label length, unverified URL domains. Each warning explains the policy and suggests a fix.',
      },
      {
        title: 'Version history and rollback',
        body: 'Every save creates a new draft version. The live version keeps serving until the new version is approved. Roll back to a previous variant in one click; every change is attributed to a user with a timestamp.',
      },
      {
        title: 'Multi-language variants',
        body: 'Group English, Hindi, Tamil, Telugu, Spanish or any approved language under one parent template. Broadcasts and flows resolve the right variant per contact based on the language field on the contact record.',
      },
      {
        title: 'Rejection reason translation',
        body: 'Meta\'s policy codes are translated into specific, actionable language. Instead of "policy violation 6.1" you see "header image must be at least 800px wide" or "promotional content not allowed in Utility category".',
      },
      {
        title: 'Usage and performance attached',
        body: 'Each template shows which broadcasts, flows and campaigns reference it, last send date, current delivery rate and read rate. Decisions to pause, archive or A/B test are grounded in real usage data.',
      },
    ],

    useCases: [
      {
        title: 'Onboarding template suite',
        industry: 'SaaS',
        body: 'A B2B SaaS sets up six Utility templates covering signup confirmation, trial start, trial expiry, payment success, invoice and renewal. Versioned in the library, they fire from the flow builder and stay in sync as the product copy evolves.',
      },
      {
        title: 'Order lifecycle templates',
        industry: 'E-commerce',
        body: 'An e-commerce brand maintains 12 Utility templates for order placed, shipped, out for delivery, delivered, return initiated and refund processed. Each has English, Hindi and Tamil variants resolved per customer language preference.',
      },
      {
        title: 'OTP and login codes',
        industry: 'Financial Services',
        body: 'A neobank runs Authentication templates for login OTP, transaction OTP and password reset. The library enforces the OTP pattern, ensures one-time-password copy is auto-detectable on iOS, and tracks delivery latency per template.',
      },
      {
        title: 'Marketing variants for A/B testing',
        industry: 'D2C',
        body: 'A D2C beauty brand maintains three Marketing variants for every sale campaign — short, long and emoji-led. A/B testing in campaigns picks the winner; the library shows lifetime read rate and click rate per variant.',
      },
      {
        title: 'Appointment reminders',
        industry: 'Healthcare',
        body: 'A clinic chain runs Utility templates for appointment booked, reminder 24h before, reminder 2h before and post-visit feedback. Versioned per location and language, with rollback when a new copy variant underperforms.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Draft a template',
        body: 'Pick a category, language and template structure. Add header, body, footer and buttons. Define typed variables and a sample value for preview.',
      },
      {
        step: '02',
        title: 'Lint and preview',
        body: 'The editor flags policy risks in real time and renders a live device preview. Fix warnings before submission to maximise first-try approval.',
      },
      {
        step: '03',
        title: 'Submit to Meta',
        body: 'One click submits the template to your WABA. Status is tracked from pending through approved, with rejection reasons translated and resubmission supported in place.',
      },
      {
        step: '04',
        title: 'Wire into surfaces',
        body: 'Approved templates are immediately available to broadcasts, flows, AI Studio responses and scheduled campaigns. Each usage site is shown in the template detail view.',
      },
      {
        step: '05',
        title: 'Monitor and iterate',
        body: 'Track delivery, read and reply rates per template version. Roll back, branch or archive variants. Pause a template here to stop it everywhere instantly.',
      },
    ],

    integrations: ['Meta', 'Google Sheets', 'HubSpot', 'Salesforce', 'Slack', 'Shopify', 'Zapier', 'Notion'],

    metrics: [
      { value: '93%', label: 'First-try approval rate with pre-submission lint' },
      { value: '<6 hrs', label: 'Median Meta approval time on Utility templates' },
      { value: '4×', label: 'Faster iteration vs WhatsApp Manager direct workflow' },
      { value: '100%', label: 'Versioned history of every template change' },
    ],

    faqs: [
      {
        q: 'Can I submit templates without leaving SabNode?',
        a: 'Yes. The library submits directly to your linked WhatsApp Business Account via the official API. You never need to log into Meta Business Manager for template work — authoring, submission, status tracking and rejection handling all happen in one place, with full audit history of who submitted what.',
      },
      {
        q: 'What happens if Meta deprecates a template I am using?',
        a: 'When Meta pauses or disables a template, SabNode marks it disabled in the library immediately and lists every downstream surface (broadcasts, flows, AI Studio) that references it. You see exactly where the breakage will land and can swap to a sibling variant in one click without redeploying flows.',
      },
      {
        q: 'How do variables work and can I use rich data?',
        a: 'Variables are typed and bound to contact fields, conversation context or campaign payload at send time. The editor validates that every {{1}}, {{2}} etc. has a sample value and a runtime binding. Headers support image, video and document media, plus location. Buttons support quick reply, URL with dynamic suffix and phone call.',
      },
      {
        q: 'Can I A/B test template copy?',
        a: 'Yes. Maintain multiple language-equivalent variants and use the multi-step campaigns module to run A/B arms. The library shows lifetime read rate, reply rate and click rate per variant so you can promote the winner and archive losers without losing the underperforming versions from history.',
      },
      {
        q: 'How do I handle templates across multiple WABAs?',
        a: 'Each WABA has its own template namespace inside SabNode. You can clone a template from one WABA to another in one click — the library re-submits it under the new account and tracks separate approval status. Useful for multi-brand or multi-region setups where each market has its own number.',
      },
      {
        q: 'What about category change events?',
        a: 'Meta occasionally reclassifies templates (e.g. moving a borderline Utility into Marketing). SabNode listens for category-change webhooks and updates pricing forecasts on every downstream broadcast and campaign so you never get a surprise invoice. The change is logged in the template history.',
      },
      {
        q: 'Can I restrict who can submit templates?',
        a: 'Yes. Template permissions are RBAC-controlled: typically marketing can draft, a designated reviewer can submit to Meta and admins can roll back or archive. Every action is logged. For regulated industries we support a two-person sign-off where draft and submit must be done by different users.',
      },
    ],

    related: ['broadcasts', 'campaigns', 'ab-testing', 'flow-builder'],
  },

  {
    slug: 'campaigns',
    name: 'Multi-step Campaigns',
    brand: 'Campaigns',
    category: 'growth',
    tagline: 'A/B arms, holdouts and attribution baked in.',
    iconKey: 'trendingUp',
    color: '#EC4899',
    tint: '#FCE7F3',

    seoTitle: 'Multi-step WhatsApp Campaigns with A/B Holdouts | SabNode',
    seoDescription:
      'Orchestrate multi-step WhatsApp and cross-channel campaigns with A/B arms, holdout groups, journey logic and end-to-end attribution. Build, launch, measure.',
    keywords: [
      'multi step whatsapp campaign',
      'whatsapp drip campaign tool',
      'cross channel campaign orchestrator',
      'whatsapp ab testing platform',
      'campaign holdout group software',
      'multi touch attribution whatsapp',
      'lifecycle marketing whatsapp',
      'whatsapp journey builder',
      'whatsapp campaign automation',
      'whatsapp conversion campaign',
    ],

    hero: {
      eyebrow: 'Campaigns · Orchestration',
      headline: 'Campaigns that span days, channels and decisions',
      subhead:
        'A single broadcast is rarely the campaign. Real growth runs in steps — touch, wait, branch, fallback, convert — with A/B arms and a clean holdout so you can prove lift. SabNode multi-step campaigns let you orchestrate this without code, then attribute the outcome back to the specific step that moved the needle.',
      bullets: [
        'Sequence templates over days with wait nodes',
        'A/B arms with traffic splits and significance',
        'Holdout groups for clean lift measurement',
        'Cross-channel fallback to email and SMS',
      ],
    },

    problem: {
      title: 'One-shot broadcasts leave money on the table',
      body:
        'A single WhatsApp blast captures the intent of the audience that was ready to convert in that moment. Everyone else — the 80 percent who saw it, did not click and moved on — is gone unless you have a follow-up plan. The teams that win on WhatsApp do not send one message; they orchestrate a sequence: a hook, a 36-hour wait, a reminder for non-clickers, a different angle for non-openers, a cross-channel fallback to email or SMS for the unreachable.\n\nBuilding this in most tools is painful. You end up scheduling individual broadcasts, manually deduplicating audiences, writing fragile spreadsheets to track which contact got which step. A/B testing degenerates into manually splitting a CSV and comparing in Looker a week later. Attribution is a fiction — you guess which message drove the conversion and write a slide.\n\nMulti-step campaigns make the sequence a first-class object. You design it once as a journey, the platform handles audience deduplication, message timing, A/B arm assignment and holdout suppression, and at the end you get a campaign report that shows lift by arm, by step and by segment. The result is fewer slides, more decisions you can defend.',
    },

    overview: [
      'A SabNode campaign is a journey with multiple steps that share an audience, a goal and a measurement frame. Each step can be a WhatsApp template broadcast, an email send, an SMS fallback, a wait, a branch on contact behaviour or a synchronisation point with the flow builder. You design the journey on a canvas, the platform handles per-contact state, and contacts move through the steps at their own pace — not in lockstep batches.',
      'A/B testing is structural. You can split traffic at any step into two or more arms, each running a different template variant, audience filter or wait length. The platform handles random assignment, tracks per-arm conversion against the goal you defined, and surfaces a significance signal once you have enough volume. This is the difference between "we tried the new copy and it felt better" and "the new copy lifted reply rate by 7.2 percent at 95 percent confidence on 18,000 exposures".',
      'Holdouts are equally structural. Set a holdout percentage at campaign launch and the platform randomly suppresses that fraction of the audience from receiving any campaign message, while still tracking their conversion behaviour. After the campaign concludes, the report shows treated-versus-holdout lift on the campaign goal — the cleanest version of attribution you can run on a channel that does not give you click IDs by default.',
      'Cross-channel fallback is built in. If a WhatsApp send fails (opted out, undeliverable, outside the 24-hour service window), the contact can route to an email or SMS step automatically. The campaign report stitches these touches together, so the conversion is attributed to the campaign even if the conversion-driving message was email rather than WhatsApp. Real lifecycle marketing, not channel-locked broadcasts.',
    ],

    capabilities: [
      {
        title: 'Visual journey canvas',
        body: 'Drag and drop steps, waits, branches and fallback nodes onto a canvas. The journey runs as a single object with per-contact state, so a contact who pauses at step 2 picks up correctly even after you edit step 4.',
      },
      {
        title: 'A/B arms with significance',
        body: 'Split traffic at any step into 2–4 arms. The platform handles random assignment, tracks per-arm conversion against the campaign goal and surfaces a statistical significance signal once enough volume has flowed through.',
      },
      {
        title: 'Holdout groups',
        body: 'Define a holdout percentage at launch. Held-out contacts receive no campaign message but their conversion behaviour is still tracked, giving you a clean lift estimate without infrastructure work.',
      },
      {
        title: 'Cross-channel fallback',
        body: 'When WhatsApp delivery fails (opted out, 24-hour window expired, undeliverable), contacts can route automatically to an email send or SMS aggregator step so you do not lose the touch.',
      },
      {
        title: 'Branch on behaviour',
        body: 'Branch downstream steps on whether a contact opened, clicked, replied or hit a conversion event. Non-openers can receive a different angle; clickers can skip to a checkout-recovery step.',
      },
      {
        title: 'Goal-based reporting',
        body: 'Define a campaign goal — a conversion event, a revenue target, a reply rate. The campaign report surfaces lift against goal by arm, by step and by segment, with raw event-level data exportable for warehouse analysis.',
      },
      {
        title: 'Audience dedup and pacing',
        body: 'A contact in two overlapping campaigns is automatically deduplicated based on rules you set (one promotional message per 48 hours, for example). Pacing prevents bombarding any single contact across active campaigns.',
      },
    ],

    useCases: [
      {
        title: 'Welcome series for new signups',
        industry: 'SaaS',
        body: 'A SaaS runs a 5-step onboarding campaign over 14 days: welcome, product tour reminder, integration setup, billing prompt, upgrade offer. Two A/B arms test reminder timing (24h vs 72h) and reveal a meaningful retention lift on the shorter cadence.',
      },
      {
        title: 'Cart recovery with cross-channel fallback',
        industry: 'E-commerce',
        body: 'An e-commerce brand runs a 3-step abandoned-cart sequence: WhatsApp reminder at 1h, WhatsApp discount at 24h, email fallback at 48h for non-WhatsApp-reachable contacts. Holdout group proves a 12 percent lift in recovered revenue.',
      },
      {
        title: 'Lead nurture for high-ticket products',
        industry: 'Real Estate',
        body: 'A real-estate developer runs a 7-step lead nurture over three weeks: brochure, site visit invitation, video walkthrough, financing options, agent call CTA, urgency message, final close. Branching on video views routes hot leads to agents.',
      },
      {
        title: 'Course re-engagement',
        industry: 'EdTech',
        body: 'An edtech platform re-engages inactive learners with a 4-step sequence over 10 days. A/B arms test motivational vs progress-led messaging and the platform attributes course resumption rate to the winning arm at 95 percent confidence.',
      },
      {
        title: 'Loan application follow-up',
        industry: 'Financial Services',
        body: 'An NBFC follows up on incomplete loan applications with a 5-step sequence — document reminder, OTP resend, pre-approved amount nudge, agent-call CTA, expiry warning. Conversation-based pricing keeps spend predictable across 60k applicants.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Define the goal',
        body: 'Pick the conversion event the campaign optimises for — a purchase, a reply, a signup, a custom event. Goals come from triggers, payments, contacts or external webhooks.',
      },
      {
        step: '02',
        title: 'Design the journey',
        body: 'On the canvas, sequence template sends, waits, branches and fallbacks. Add A/B splits and a holdout percentage. Every node has a live preview.',
      },
      {
        step: '03',
        title: 'Attach an audience',
        body: 'Select a saved segment or list. Pacing rules apply — contacts already in another active campaign are excluded according to your global dedup policy.',
      },
      {
        step: '04',
        title: 'Launch and run',
        body: 'Campaigns run as a single object. Contacts move through at their own pace, and the platform handles state, retries and fallbacks per contact.',
      },
      {
        step: '05',
        title: 'Read the report',
        body: 'The campaign report shows per-arm, per-step conversion, treated-vs-holdout lift, revenue attributed and significance. Export raw event data to your warehouse.',
      },
    ],

    integrations: ['Meta', 'Shopify', 'HubSpot', 'Salesforce', 'Razorpay', 'Stripe', 'Gmail', 'Mixpanel'],

    metrics: [
      { value: '3.2×', label: 'Conversion lift on multi-step vs one-shot broadcasts' },
      { value: '12%', label: 'Median revenue lift on holdout-tested cart recovery' },
      { value: '95%', label: 'Confidence threshold on A/B arm winner detection' },
      { value: '<2 hrs', label: 'Setup time for a 5-step lifecycle campaign' },
    ],

    faqs: [
      {
        q: 'How is a multi-step campaign different from a flow?',
        a: 'Flows are reactive, triggered by an event and run per contact. Campaigns are proactive — you start with an audience and orchestrate timed touches against a goal. They share the same template library and reporting, and you can call a flow from a campaign step if you need branching logic that exceeds what the campaign canvas supports natively.',
      },
      {
        q: 'Can a contact be in two campaigns at once?',
        a: 'Yes, but you control the policy. The default is one promotional campaign at a time per contact, with utility and transactional sends unrestricted. You can override this per campaign — for example, a retention campaign can be allowed to run alongside a cart-recovery campaign because they target different intents.',
      },
      {
        q: 'How do A/B arms actually split traffic?',
        a: 'Random assignment happens at the moment a contact enters the split node. Each contact is hashed against the campaign ID and the split node ID, so a contact who re-enters the campaign lands in the same arm. The split is sticky across the entire campaign, which is important for clean per-arm conversion measurement.',
      },
      {
        q: 'What conversion events can I attribute to?',
        a: 'Anything that lands as an event in SabNode — purchases via Shopify, payments via Razorpay or Stripe, custom webhooks from your backend, replies from contacts, label changes in the inbox, or CRM stage advances. The campaign report attributes every event in the window to the relevant campaign and arm.',
      },
      {
        q: 'How does holdout measurement work in detail?',
        a: 'At campaign launch, a hash of the contact ID against the campaign seed assigns each contact to treated or holdout. Held-out contacts receive zero campaign messages but their conversion events in the campaign window are tracked. The report shows treated conversion rate minus holdout conversion rate as lift, with a confidence interval based on sample size.',
      },
      {
        q: 'Can I edit a running campaign?',
        a: 'Yes, with guardrails. You can edit downstream steps a contact has not yet reached, pause individual steps, adjust pacing and extend the audience. You cannot retroactively change A/B arm assignment or holdout fraction once contacts have entered, because that would invalidate the measurement.',
      },
      {
        q: 'How does revenue attribution handle the holdout?',
        a: 'Revenue from held-out contacts is counted as baseline, and treated-group revenue minus baseline (scaled to the same audience size) is reported as incremental revenue driven by the campaign. This is the closest you can get to a randomised controlled trial without losing operational simplicity.',
      },
    ],

    related: ['broadcasts', 'ab-testing', 'attribution', 'flow-builder'],
  },

  {
    slug: 'landing-pages',
    name: 'Landing Pages',
    brand: 'Campaigns',
    category: 'growth',
    tagline: 'Capture opt-ins on hosted pages that sync straight to Contacts.',
    iconKey: 'globe',
    color: '#8B5CF6',
    tint: '#F3E8FF',

    seoTitle: 'Hosted WhatsApp Opt-in Landing Pages, Sub-1s | SabNode',
    seoDescription:
      'Launch hosted landing pages that capture WhatsApp opt-ins, sync to Contacts and trigger flows. No code, fast load, full UTM and event tracking.',
    keywords: [
      'whatsapp opt-in landing page',
      'lead capture landing page builder',
      'hosted whatsapp subscription form',
      'whatsapp consent landing page',
      'no-code campaign landing page',
      'utm tracking landing page',
      'whatsapp click to chat page',
      'mobile first landing page tool',
      'whatsapp newsletter signup page',
      'landing page whatsapp api integration',
    ],

    hero: {
      eyebrow: 'Campaigns · Landing Pages',
      headline: 'Hosted pages that turn ads into opt-ins',
      subhead:
        'Click-to-chat is one path. Sometimes you need a real page — a form, a privacy line, a UTM-tracked CTA — that captures explicit consent and routes the contact straight into a flow. SabNode landing pages give you exactly that: fast, hosted, mobile-first and wired to Contacts, broadcasts and analytics without exporting CSVs.',
      bullets: [
        'Hosted pages on your subdomain or custom domain',
        'Mobile-first templates load under 1 second',
        'UTM, click-ID and meta-pixel capture built in',
        'Auto-create Contact and trigger a flow on submit',
      ],
    },

    problem: {
      title: 'Landing pages are still glued together with tape',
      body:
        'Most teams running WhatsApp campaigns build landing pages in one tool, host them in another, store form submissions in a third, then have someone every morning export a CSV from the form tool and re-upload it to the messaging tool as a new audience. Half the time the field names do not match, opt-in consent is captured but not propagated, and UTM parameters get dropped between the click and the conversion.\n\nThe consequences are real. Without explicit consent stored against the contact, you can be running broadcasts to people who never opted in — a violation risk that becomes a quality-rating problem fast on WhatsApp. Without UTM propagation, attribution is impossible: ads land on a page, conversions are recorded somewhere else, and the marketing team is left squinting at percentages they cannot defend.\n\nThe other failure mode is performance. Marketers fall in love with page builders that load 4 MB of JavaScript and break on a slow Indian 4G connection. The drop-off between ad click and form submit is enormous, and nobody measures it because the analytics is in yet another tool. A landing page that loads in 800 ms on a Realme phone is a marketing asset; one that loads in five seconds is a leak.',
    },

    overview: [
      'SabNode landing pages are first-class hosted assets that exist for one purpose: capture an opt-in, attribute the source and route the contact into the rest of the platform. Each page is built from a small set of mobile-first templates that prioritise speed — under 1 second to first contentful paint on a 4G connection, server-rendered HTML with progressive enhancement, no shipped framework bloat. You can host on a SabNode subdomain instantly or attach a custom domain with automatic SSL.',
      'Forms are typed. Define the fields you want (phone, name, email, custom fields), set validation rules, mark consent checkboxes as legally required where needed, and the page renders accordingly. On submit, the platform creates or updates the contact in Contacts, attaches the consent record (timestamp, page URL, UTM, IP), and fires a trigger that can launch a flow, send a welcome template, add to a segment or push to your CRM.',
      'Attribution is built in. UTM parameters, click IDs (Meta, Google), referrer, device class and IP-derived geo are captured against every submission. The campaign report attributes downstream conversions back to the specific landing page and ad source. If you split-test page variants, the test runs through the same campaigns engine and reports significance the same way as any A/B arm.',
      'Performance is monitored. Every page tracks page-load time, time-to-form-interactive, scroll depth, field-level drop-off and final submission rate. If the page slows down (a media asset bloated, a third-party script added), you see it in the page health view before it eats your conversion rate. This is hosting as a marketing primitive, not as an afterthought.',
    ],

    capabilities: [
      {
        title: 'Mobile-first templates',
        body: 'A small curated set of templates optimised for sub-1-second load on 4G. Server-rendered HTML with progressive enhancement, no bloated framework, no shipped megabytes of JS. Looks great on a Redmi as much as on a Pixel.',
      },
      {
        title: 'Typed form fields',
        body: 'Define phone, name, email, custom contact fields, consent checkboxes and free-text inputs. Validation rules (regex, country code, length) run client and server side. Field-level drop-off is tracked automatically.',
      },
      {
        title: 'Consent capture',
        body: 'Mark consent checkboxes as legally required. Every submission stores consent text, timestamp, page URL, UTM and IP against the contact — auditable proof of opt-in for WhatsApp marketing or any other channel.',
      },
      {
        title: 'UTM and click-ID propagation',
        body: 'UTM source, medium, campaign, content, term, plus Meta and Google click IDs are captured and stored against the contact and the conversion event. Attribution flows downstream without manual stitching.',
      },
      {
        title: 'Custom domain and SSL',
        body: 'Host on a SabNode subdomain or attach your own (lp.yourbrand.com). SSL is automatic. Domains can be moved between pages without changing the URL, so paid traffic is never broken by an internal rename.',
      },
      {
        title: 'Submit triggers a flow',
        body: 'On submit, fire a trigger that runs a flow, sends a welcome template, adds the contact to a segment, pushes to HubSpot or Salesforce, or starts a multi-step campaign. Multiple actions can run in parallel.',
      },
      {
        title: 'A/B variants and health',
        body: 'Split traffic between page variants and read significance in the same reporting layer as campaigns. Health view tracks load time, time-to-interactive, scroll depth and submit rate so regressions surface fast.',
      },
    ],

    useCases: [
      {
        title: 'Newsletter opt-in for a brand',
        industry: 'D2C',
        body: 'A D2C brand runs Meta ads to a SabNode landing page offering a discount in exchange for WhatsApp opt-in. The page captures phone, consent and source, fires a flow that sends the discount template, and adds the contact to a "newsletter subscribers" segment.',
      },
      {
        title: 'Lead capture for a webinar',
        industry: 'SaaS',
        body: 'A B2B SaaS hosts a webinar registration landing page. Submissions create contacts, attach a webinar segment, fire a Utility template with the calendar invite, and a reminder flow sends a nudge 1 hour before the start.',
      },
      {
        title: 'Loan application kickoff',
        industry: 'Financial Services',
        body: 'An NBFC runs a landing page from a Google ad asking for phone, name, loan amount and pin code. Submission creates a lead in the CRM, fires a flow that requests documents over WhatsApp, and routes the contact to a relationship manager queue.',
      },
      {
        title: 'Property enquiry page',
        industry: 'Real Estate',
        body: 'A developer runs a landing page per project. Enquiries land as contacts tagged with the project, fire a brochure send via WhatsApp, and start a 7-step nurture campaign for high-intent leads. Site-visit bookings sync to the calendar.',
      },
      {
        title: 'Course application',
        industry: 'EdTech',
        body: 'An edtech platform runs a "talk to a counsellor" landing page per course. Submission auto-creates a contact, books a counsellor call slot, fires a WhatsApp confirmation, and adds the lead to the relevant program segment for follow-up.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Pick a template',
        body: 'Start from a curated mobile-first template, edit copy, add fields and consent text. Preview on a phone-sized canvas with live form validation.',
      },
      {
        step: '02',
        title: 'Wire up the submit',
        body: 'Choose what happens on submit: create or update contact, send a template, add to a segment, fire a flow, push to CRM. Multiple actions can chain.',
      },
      {
        step: '03',
        title: 'Publish to a domain',
        body: 'Publish to a SabNode subdomain instantly or attach a custom domain with automatic SSL. The URL stays stable even if you rename the page internally.',
      },
      {
        step: '04',
        title: 'Drive traffic',
        body: 'Send Meta ads, Google ads, organic links or QR posters at the page. UTM parameters and click IDs are captured automatically against every submission.',
      },
      {
        step: '05',
        title: 'Measure and iterate',
        body: 'Watch load time, drop-off, submit rate and downstream conversion in the page health view. Run A/B variants when you want to test copy or layout.',
      },
    ],

    integrations: ['Meta', 'Google Sheets', 'HubSpot', 'Salesforce', 'Razorpay', 'Stripe', 'Zapier', 'Mixpanel'],

    metrics: [
      { value: '<1 sec', label: 'Median time to first contentful paint on 4G' },
      { value: '34%', label: 'Average submit rate on opt-in landing templates' },
      { value: '0', label: 'CSV exports needed between page and contacts' },
      { value: '5 min', label: 'Time to publish a working opt-in page from scratch' },
    ],

    faqs: [
      {
        q: 'Do I need a developer to launch a landing page?',
        a: 'No. The templates are configured through a visual editor — pick fields, edit copy, set the submit action, publish. A developer is only needed if you want to embed the form on a page you already host elsewhere, in which case we provide a one-line embed snippet that posts to the same backend.',
      },
      {
        q: 'How is consent stored and is it audit-grade?',
        a: 'Every submission stores the consent checkbox text, the timestamp, the full page URL, the UTM parameters, the IP address and a hash of the user agent. This is sufficient for WhatsApp opt-in audit, DPDP compliance in India and GDPR-style records of consent in the EU. Records are immutable and exportable per contact.',
      },
      {
        q: 'Can I host the page on my own domain?',
        a: 'Yes. Attach lp.yourbrand.com (or any subdomain) to a SabNode page, point a CNAME at our edge and we handle SSL automatically. The page renders from your domain so paid traffic does not bounce against an unfamiliar URL. You can move the domain to a different page without losing the URL.',
      },
      {
        q: 'How fast are the pages, really?',
        a: 'Templates target a sub-1-second first contentful paint on a 4G connection without aggressive caching. We achieve this by server-rendering HTML, deferring all non-essential JS, inlining critical CSS and avoiding third-party scripts unless explicitly added. Page health view shows the actual numbers for your traffic, not a synthetic benchmark.',
      },
      {
        q: 'Can I A/B test landing page variants?',
        a: 'Yes. Define two or more variants of the same page; traffic is split deterministically based on visitor cookie. Conversion (form submit) and downstream events (purchase, reply) are tracked per variant. The campaigns reporting layer surfaces significance once enough volume has flowed.',
      },
      {
        q: 'Where does submission data end up?',
        a: 'In Contacts as a new or updated contact record, with a consent record attached. From there it flows wherever you have wired it — segments, flows, CRM (HubSpot, Salesforce, Pipedrive), spreadsheets (Google Sheets), webhooks to your backend, or analytics tools (Mixpanel, Amplitude). One submission, many destinations, no CSVs.',
      },
      {
        q: 'Can I prefill fields from a URL parameter?',
        a: 'Yes. Any URL parameter (e.g. ?phone=9876543210&source=newsletter) can prefill matching form fields. This is useful for re-engagement campaigns where the contact already exists and you only want to confirm consent on a new channel. The platform recognises the contact and updates rather than creating a duplicate.',
      },
    ],

    related: ['contacts', 'broadcasts', 'flow-builder', 'attribution'],
  },

  {
    slug: 'catalog-sync',
    name: 'Catalog Sync',
    brand: 'Commerce',
    category: 'growth',
    tagline: 'Keep WhatsApp Business catalog in sync with Shopify, Stripe and Sheets.',
    iconKey: 'image',
    color: '#10B981',
    tint: '#D1FAE5',

    seoTitle: 'WhatsApp Catalog Sync with Shopify & Stripe | SabNode',
    seoDescription:
      'Auto-sync your WhatsApp Business catalog with Shopify, Stripe, WooCommerce or Google Sheets. Real-time inventory, pricing and image updates with rollback.',
    keywords: [
      'whatsapp catalog sync',
      'shopify whatsapp catalog integration',
      'whatsapp business catalog automation',
      'stripe product whatsapp catalog',
      'woocommerce whatsapp catalog',
      'whatsapp commerce catalog tool',
      'real time inventory whatsapp',
      'product catalog whatsapp api',
      'google sheets whatsapp catalog',
      'click to chat shopping catalog',
    ],

    hero: {
      eyebrow: 'Commerce · Catalog',
      headline: 'A catalog that matches your store, always',
      subhead:
        'WhatsApp commerce only works when the catalog is current. SabNode Catalog Sync mirrors your Shopify, WooCommerce, Stripe or Google Sheets product feed into the WhatsApp Business catalog — with inventory, pricing, images and variants updating in near real time, plus a rollback log when something breaks.',
      bullets: [
        'Two-way sync with Shopify, WooCommerce, Stripe',
        'Updates push within 60 seconds of a store change',
        'Inventory, price, variants and images covered',
        'Rollback any sync run from the history log',
      ],
    },

    problem: {
      title: 'A stale catalog burns brand trust',
      body:
        'WhatsApp commerce promises a frictionless path from chat to checkout, but only if the catalog is right. The moment a customer taps a product in chat, sees a price that has changed, an image that no longer matches, or a "buy" button that leads to an out-of-stock item, your conversion rate collapses and your support load doubles. Every operator who has tried to maintain a WhatsApp catalog manually knows the pain: edit a product in Shopify, remember to update WhatsApp Manager, forget half the time, get yelled at by a customer the next day.\n\nIt gets worse with variants and bulk SKUs. A fashion brand with 600 SKUs across colours and sizes cannot manually sync. A grocery operator with daily price changes cannot manually sync. Stripe-only sellers using Payment Links have no native WhatsApp catalog at all, despite running their entire checkout through it. The result is that WhatsApp commerce becomes a "we will reply with options" workflow — slow, agent-heavy and no better than email.\n\nA working catalog sync is operational glue, not a feature. It needs to push inventory changes within seconds, handle variants and image URLs properly, validate Meta\'s catalog rules before submission, and provide a rollback when a bad sync run nukes your live catalog at 3pm on a Saturday. Anything less is a liability disguised as automation.',
    },

    overview: [
      'SabNode Catalog Sync is a two-way bridge between your source of truth (Shopify, WooCommerce, Stripe, Google Sheets) and the WhatsApp Business catalog attached to your WABA. When a product changes in the source — a price, an image, an inventory count, a variant added — we detect the change via webhook or scheduled poll, transform it into Meta\'s catalog schema, validate it against Meta\'s rules and push the update. Typical end-to-end latency is under 60 seconds for webhook-supported sources.',
      'Variants are handled properly. A Shopify product with three sizes and four colours becomes 12 catalog items in WhatsApp with the right naming, SKU mapping and pricing. Inventory is respected — items going out of stock are flagged unavailable so they stop appearing in catalog messages and product flows. Images are mirrored to a CDN-backed origin to keep load fast inside the WhatsApp client.',
      'Sync runs are auditable. Every run logs which products changed, what fields, what Meta returned and how long it took. If a run pushes a bad update (a wrong price, a broken image URL), one click rolls back to the previous catalog state. For high-stakes catalogs we support a review mode where changes queue for human approval before they hit WhatsApp.',
      'The catalog is not a dead asset. Once synced, products are available to the Flow Builder, AI Studio, broadcasts and the orders module. A customer can ask "do you have this in red?" in chat, an AI agent can pull the variant from the catalog and send the product card with a Buy Now button. Sales close in chat, payments go through Razorpay or Stripe, and the order syncs back to Shopify automatically.',
    ],

    capabilities: [
      {
        title: 'Webhook-based real-time sync',
        body: 'When Shopify, WooCommerce or Stripe pushes a product or inventory webhook, SabNode picks it up and updates WhatsApp within seconds. No polling lag, no nightly batch — what changes in the store changes in chat almost immediately.',
      },
      {
        title: 'Variants and SKU mapping',
        body: 'Shopify variants, WooCommerce attributes and Stripe SKUs are normalised into Meta\'s catalog schema. Each variant becomes its own catalog item with proper naming, inventory and pricing, so customers can pick the right size or colour in chat.',
      },
      {
        title: 'Inventory awareness',
        body: 'Out-of-stock items are flagged unavailable so they do not appear in catalog messages or product flows. Restocks flip the item back to available automatically. Saves agents from manually checking inventory before sending a product card.',
      },
      {
        title: 'Image and media CDN',
        body: 'Product images are mirrored through a CDN-backed origin so they load fast inside the WhatsApp client, especially on low-bandwidth Indian or African networks. Broken image URLs in source data are surfaced as validation errors before push.',
      },
      {
        title: 'Meta rule validation',
        body: 'Before push, every product is validated against Meta\'s catalog rules — title length, description length, price format, image aspect ratio, prohibited categories. Failures are surfaced with the specific rule that broke, not a generic error.',
      },
      {
        title: 'Rollback and history',
        body: 'Every sync run is logged with a diff of what changed. If a run pushes a bad update, one click rolls the catalog back to the previous state. For high-stakes catalogs, review mode queues changes for human approval before they hit WhatsApp.',
      },
      {
        title: 'Google Sheets fallback',
        body: 'For sellers without an e-commerce platform, the catalog can be defined in a Google Sheet with a structured schema. Edits to the sheet sync to WhatsApp on a schedule or on demand. Great for grocery, services or low-SKU operators.',
      },
    ],

    useCases: [
      {
        title: '600-SKU fashion catalog',
        industry: 'D2C',
        body: 'A D2C fashion brand syncs 600 SKUs from Shopify, including size and colour variants. New arrivals appear on WhatsApp within a minute, sold-out items vanish from the catalog, and agents send product cards in chat that reflect real inventory without manual checks.',
      },
      {
        title: 'Daily-price grocery catalog',
        industry: 'E-commerce',
        body: 'A grocery operator syncs 1200 SKUs with daily price changes from a Google Sheet. The catalog updates each morning, customers see today\'s mango price, and the cart-recovery flow reflects current pricing rather than yesterday\'s figure.',
      },
      {
        title: 'Stripe payment links as a catalog',
        industry: 'SaaS',
        body: 'A B2B SaaS sells add-on services via Stripe Payment Links. SabNode maps each link to a WhatsApp catalog item with pricing and description, so the sales team can send a product card in chat that opens directly to the Stripe checkout.',
      },
      {
        title: 'Pharmacy chain inventory',
        industry: 'Healthcare',
        body: 'A pharmacy chain syncs over-the-counter medicine inventory per outlet. WhatsApp catalog reflects branch-level stock so chat orders only show items actually available at the customer\'s nearest store, reducing returns and refunds.',
      },
      {
        title: 'Course catalog for an edtech',
        industry: 'EdTech',
        body: 'An edtech platform syncs its course catalog (with cohort start dates and seats remaining) from a Google Sheet. AI agents recommend the right course in chat based on the learner\'s interest and route them to a Razorpay payment link.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Connect a source',
        body: 'Authenticate Shopify, WooCommerce, Stripe or paste a Google Sheet URL. The platform fetches your product schema and previews how it will map to Meta\'s catalog format.',
      },
      {
        step: '02',
        title: 'Map fields',
        body: 'Visually map source fields (title, price, image, SKU, inventory) to WhatsApp catalog fields. Set rules for variants, currency formatting and image fallback.',
      },
      {
        step: '03',
        title: 'Run a dry run',
        body: 'Trigger a dry run to validate every product against Meta\'s rules. Errors are listed per product with the specific rule that failed and a suggested fix.',
      },
      {
        step: '04',
        title: 'Push to WhatsApp',
        body: 'Push the validated catalog to your WABA. Subsequent webhook events from the source update the catalog in near real time without further setup.',
      },
      {
        step: '05',
        title: 'Monitor and rollback',
        body: 'Watch the sync log for runs, diffs and Meta responses. If a run pushes bad data, rollback to the previous state in one click. Set up alerts on validation failures.',
      },
    ],

    integrations: ['Shopify', 'WooCommerce', 'Stripe', 'Razorpay', 'Google Sheets', 'Meta', 'BigCommerce', 'Zapier'],

    metrics: [
      { value: '<60s', label: 'End-to-end latency from store change to WhatsApp' },
      { value: '99.7%', label: 'Sync success rate after Meta rule validation' },
      { value: '1-click', label: 'Rollback to a previous catalog snapshot' },
      { value: '0', label: 'Manual edits in WhatsApp Manager after setup' },
    ],

    faqs: [
      {
        q: 'How does inventory sync work for variants?',
        a: 'Each variant (size, colour, flavour) becomes its own item in the WhatsApp catalog with an explicit inventory count or availability flag. When Shopify reports a variant going out of stock, we flip availability on that specific catalog item within seconds, so product cards in chat reflect what customers can actually buy right now.',
      },
      {
        q: 'What if Meta rejects a product?',
        a: 'Pre-push validation catches most rejections (title length, image format, prohibited categories) before they reach Meta. If Meta still rejects on the API side, the rejection reason is surfaced in the sync log with the specific Meta rule that failed and a one-click action to either edit the source product or skip that item from sync.',
      },
      {
        q: 'Can I keep some products out of WhatsApp?',
        a: 'Yes. Filter rules let you sync only certain product types, collections, vendor tags or active products. You can also flag individual products as excluded directly in SabNode without touching the source. Useful when WhatsApp catalog is for B2C SKUs while your Shopify also contains B2B-only items.',
      },
      {
        q: 'Does this support Stripe-only sellers who do not have a real catalog?',
        a: 'Yes. We treat Stripe Products and Payment Links as catalog items. Each Stripe product becomes a WhatsApp catalog entry with its price and image, and the catalog item links to the Stripe checkout URL. Sellers running purely on Stripe get a WhatsApp catalog for free.',
      },
      {
        q: 'How do you handle multi-currency stores?',
        a: 'Shopify and WooCommerce multi-currency setups are mapped to a primary catalog currency per WABA. If a customer is in a different country, the AI agent or flow can quote the price in their local currency, but the catalog itself is single-currency per WhatsApp Business account, which is a Meta constraint, not ours.',
      },
      {
        q: 'How fast is "real time" actually?',
        a: 'Webhook-based sources (Shopify, WooCommerce, Stripe) typically push to WhatsApp in 5–30 seconds end to end, including Meta\'s ingestion time. Google Sheets uses a 60-second poll for changes. If you need sub-second updates for things like flash-sale price changes, get in touch — we have a custom push channel for high-velocity catalogs.',
      },
      {
        q: 'What does rollback restore?',
        a: 'Rollback restores the catalog to the state captured before a specific sync run. That means products, prices, images, availability and variants. It does not roll back orders or downstream events — those are immutable. We recommend dry-running large changes and using review mode for catalogs where a bad sync would be expensive.',
      },
    ],

    related: ['catalog', 'orders', 'payments', 'cart-recovery'],
  },

  {
    slug: 'dashboards',
    name: 'Dashboards',
    brand: 'Analytics',
    category: 'analytics',
    tagline: 'Sent, delivered, read, failed — split by channel, campaign and team.',
    iconKey: 'lineChart',
    color: '#F59E0B',
    tint: '#FEF3C7',

    seoTitle: 'WhatsApp & Omnichannel Operator Dashboards | SabNode',
    seoDescription:
      'Operator dashboards for sent, delivered, read and failed across WhatsApp, Instagram, email and web chat. Slice by campaign, agent, team and segment.',
    keywords: [
      'whatsapp messaging dashboard',
      'omnichannel analytics dashboard',
      'customer messaging metrics',
      'whatsapp delivery analytics',
      'agent performance dashboard',
      'broadcast analytics tool',
      'team messaging analytics',
      'real time chat dashboard',
      'whatsapp open rate dashboard',
      'cross channel reporting',
    ],

    hero: {
      eyebrow: 'Analytics · Dashboards',
      headline: 'One dashboard for every message that left the building',
      subhead:
        'Operator-grade dashboards for the metrics that decide how the next quarter goes — sent, delivered, read, replied, failed — across WhatsApp, Instagram, email and web chat. Slice by campaign, agent, team, segment and language without rebuilding the report in three different BI tools.',
      bullets: [
        'Sent, delivered, read, failed in real time',
        'Pivot by channel, campaign, team, segment',
        'Drill from a number into the underlying messages',
        'Share live dashboard links with leadership',
      ],
    },

    problem: {
      title: 'Operator metrics live in three different tools',
      body:
        'Most growth and CX teams operate without a single, current picture of how their messaging actually performed. WhatsApp delivery comes from one vendor dashboard, email opens come from another, Instagram metrics live inside Meta Business Suite, agent productivity is in a separate helpdesk panel, and the warehouse copy is two days behind real time. Leadership asks "how did the Diwali campaign do?" and the answer involves three spreadsheets and a manual stitch.\n\nWorse, the numbers do not agree. WhatsApp\'s read rate as reported by your vendor differs from what shows up in Looker because the warehouse missed a webhook for two hours last Tuesday. Agent CSAT is computed differently in your helpdesk than in your weekly review deck. Channel attribution is a fiction because there is no shared event spine. People stop trusting the dashboards and start asking for raw CSVs, which is the moment you have lost analytics as a discipline.\n\nReal dashboards have to be operator-first, not BI-first. They have to show today\'s number, broken down the way an operator thinks about it (this campaign, that team, that segment), drill into the underlying messages on demand, and stay live without a refresh dance. The same data feeds the warehouse for executive reporting — but the operator does not have to wait for it.',
    },

    overview: [
      'SabNode dashboards are operator dashboards. They show the metrics that matter when you are running a channel today — total sent in the last hour, delivery rate by template, read rate by segment, reply rate by agent, failure breakdown by Meta error code — with the latency of a live feed, not a nightly batch. Every dashboard is composed of cards (counters, charts, breakdown tables) that you can rearrange, filter and share.',
      'Pivots are first-class. Any metric can be split by channel (WhatsApp, Instagram, email, web chat), by campaign, by template, by agent, by team, by segment, by language and by time-of-day. You can stack pivots — read rate by template within campaign within segment — without writing SQL. When a number looks off, click it to drill down to the underlying messages: who they were sent to, when, by what flow, and what each individual outcome was.',
      'Real-time is the default. Counters update every few seconds as events flow in from Meta, Instagram, your email gateway and the web widget. The "today" view never lags more than a minute or so, so operators can react to a broadcast in progress, not after the fact. Historical views run against the same event store with longer aggregation windows and remain fast through pre-computed rollups.',
      'Dashboards are not isolated. Every metric has a "view raw events" path that exports to CSV or pushes into BigQuery, Snowflake or Postgres for warehouse work. Share a dashboard link with leadership and the link stays live without exposing the underlying tooling. The result is one source of truth for operations and analytics, instead of two competing ones.',
    ],

    capabilities: [
      {
        title: 'Real-time counters',
        body: 'Sent, delivered, read, replied and failed counters update every few seconds. During a live broadcast you watch the dispatcher tick through the audience in real time, with delivery health visible at a glance.',
      },
      {
        title: 'Stackable pivots',
        body: 'Pivot any metric by channel, campaign, template, agent, team, segment, language or time-of-day. Stack two or three pivots simultaneously to find where a problem lives without leaving the dashboard.',
      },
      {
        title: 'Drill-to-message',
        body: 'Click any number to drill into the underlying messages — who, when, what template, what outcome, what error. The drill view links to the conversation in the shared inbox for one-click follow-up.',
      },
      {
        title: 'Agent and team views',
        body: 'Dedicated views for agent productivity (first response time, resolution time, messages handled, CSAT, ratings) and team health (queue depth, SLA compliance, workload distribution). Operator-grade, not vanity metrics.',
      },
      {
        title: 'Failure analysis',
        body: 'Failed messages are bucketed by Meta error code, with translated explanations and recommended actions. Spot a spike in invalid-number errors immediately rather than three days later in a CSV.',
      },
      {
        title: 'Shareable live links',
        body: 'Share a dashboard via a tokenised link that stays live without exposing the underlying tooling. Leadership sees today\'s number, not yesterday\'s. Tokens can be revoked instantly when access changes.',
      },
      {
        title: 'Scheduled snapshots',
        body: 'Schedule a dashboard to email or Slack as a PNG or PDF at 9am every morning. Useful for daily standups, weekly business reviews and board reporting without manually screenshotting anything.',
      },
    ],

    useCases: [
      {
        title: 'Daily growth standup',
        industry: 'D2C',
        body: 'The growth team starts every day with a shared dashboard: yesterday\'s broadcasts by template, top failure codes, revenue attributed to WhatsApp, agent SLA on the inbox queue. The link is pinned in Slack and stays live so anyone can see the latest numbers.',
      },
      {
        title: 'Support team SLA monitoring',
        industry: 'SaaS',
        body: 'A SaaS support lead watches an SLA dashboard live: queue depth, first-response time per agent, breaches in the last hour. When a number spikes, they drill straight to the underlying conversations and reassign workload from the same screen.',
      },
      {
        title: 'Campaign performance war room',
        industry: 'EdTech',
        body: 'During a course-launch campaign, the marketing team projects a war-room dashboard on a wall TV. Sent, delivered, read, replied and revenue update in real time across four language variants, and decisions on pacing are made within minutes of seeing them.',
      },
      {
        title: 'Daily payment reminder ops',
        industry: 'Financial Services',
        body: 'An NBFC tracks a daily Utility broadcast for EMI reminders. Dashboard shows delivery, read and payment-completed rates by region; spikes in failure codes route to the ops queue, and the team intervenes the same day rather than at month-end.',
      },
      {
        title: 'Multi-brand executive view',
        industry: 'E-commerce',
        body: 'A retail group operating three brands shares a consolidated dashboard with the CEO: messaging volume, revenue attributed and customer satisfaction by brand, by channel and by month. One link, three columns, live numbers — no monthly slide deck needed.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Pick a dashboard',
        body: 'Start from a curated template (Broadcasts, Inbox, Campaigns, Agent, Executive) or build your own from cards. Templates work out of the box.',
      },
      {
        step: '02',
        title: 'Add filters',
        body: 'Apply global filters — date range, channel, campaign, team, segment. Filters persist with the dashboard and are reflected in every card.',
      },
      {
        step: '03',
        title: 'Stack pivots',
        body: 'On any card, add one or two pivot dimensions. The card re-renders as a stacked bar, line chart or breakdown table according to the data shape.',
      },
      {
        step: '04',
        title: 'Drill into events',
        body: 'Click any number to view the underlying messages or events. From there, jump to a conversation, a contact, a campaign or a template.',
      },
      {
        step: '05',
        title: 'Share or schedule',
        body: 'Share the dashboard as a live link or schedule a daily PNG/PDF to Slack or email. Tokens are revocable and shares are audited.',
      },
    ],

    integrations: ['Slack', 'Gmail', 'Outlook', 'BigQuery', 'Snowflake', 'Looker', 'Mixpanel', 'Amplitude'],

    metrics: [
      { value: '<5s', label: 'Latency from message event to dashboard counter' },
      { value: '0', label: 'BI tools required for day-to-day operator decisions' },
      { value: '15+', label: 'Curated dashboard templates ready out of the box' },
      { value: '100%', label: 'Drill-to-message coverage on every aggregated metric' },
    ],

    faqs: [
      {
        q: 'How do dashboards differ from exports to BigQuery or Snowflake?',
        a: 'Dashboards are for operating today. Warehouse exports are for modelling, retention analysis and executive reporting. SabNode supplies both: dashboards give operators a real-time view with drill-to-message; warehouse exports give analysts the raw event spine to model anything from cohort retention to LTV. Same source data, two different latencies.',
      },
      {
        q: 'Can I build my own dashboards or only use templates?',
        a: 'You can build your own from a card library — counters, line charts, stacked bars, breakdown tables, heatmaps, funnels. Templates are starting points. Custom dashboards are saved per workspace and can be shared with role-based access (view-only vs edit) and audited.',
      },
      {
        q: 'How real-time is real-time?',
        a: 'Counters update typically within 3–8 seconds of an event arriving — meaning a WhatsApp message delivered now will show on the delivery counter within that window. During very high-throughput broadcasts (multiple thousand events per second), aggregations can lag up to 30 seconds before catching up, but no data is lost.',
      },
      {
        q: 'Are dashboards safe to share with external stakeholders?',
        a: 'Yes. Shared links are tokenised, scoped to specific dashboards (not the workspace), and can be revoked at any time. You can enable password protection, set expiry dates and audit every view. External users see the dashboard at their permission scope without needing a SabNode account.',
      },
      {
        q: 'How do dashboards handle multi-WABA or multi-brand setups?',
        a: 'Each workspace can connect multiple WABAs and channel accounts. Dashboards can filter to a single brand or aggregate across brands. For multi-tenant operators (agencies running several customer accounts), per-tenant dashboards are isolated by workspace and a master agency view rolls up across them.',
      },
      {
        q: 'What about agent-level performance — is there a way to compare?',
        a: 'Yes. Agent dashboards rank agents by first-response time, resolution time, messages handled, CSAT and ratings. Comparison views show a single agent against the team median. Used carefully (avoid pure stack-ranking, prefer trends and outliers) these are powerful for coaching and capacity planning.',
      },
      {
        q: 'Can I see dashboards on mobile?',
        a: 'Yes. Every dashboard is responsive and works on a phone. We also offer a "today" mobile view with the top three metrics for each role (growth, support, ops) for leadership who check on the move. Real-time updates work over a long-poll connection that handles patchy mobile networks.',
      },
    ],

    related: ['flow-analytics', 'csat', 'attribution', 'exports'],
  },

  {
    slug: 'flow-analytics',
    name: 'Flow Analytics',
    brand: 'Analytics',
    category: 'analytics',
    tagline: 'Per-node success, drop-off, revenue and SLA metrics.',
    iconKey: 'activity',
    color: '#4F46E5',
    tint: '#EEF2FF',

    seoTitle: 'Flow Builder Analytics, Drop-off & Revenue | SabNode',
    seoDescription:
      'See per-node success rate, drop-off, revenue and SLA breaches across every WhatsApp flow. Spot the bottleneck and fix it without leaving the canvas.',
    keywords: [
      'whatsapp flow analytics',
      'chatbot flow drop-off analysis',
      'node level conversion analytics',
      'whatsapp automation reporting',
      'flow builder analytics dashboard',
      'chatbot funnel analysis',
      'flow conversion rate tracking',
      'message automation metrics',
      'flow sla monitoring',
      'whatsapp drip flow analytics',
    ],

    hero: {
      eyebrow: 'Analytics · Flows',
      headline: 'See exactly where your flow leaks contacts',
      subhead:
        'Flows fail silently. A node times out, a branch is mis-wired, an AI prompt returns garbage — and 30 percent of your funnel walks away without anyone noticing. Flow Analytics overlays per-node success, drop-off, revenue and SLA right on the canvas you built, so the bottleneck is visible the moment you open the flow.',
      bullets: [
        'Per-node success, drop-off and elapsed time',
        'Revenue attributed to specific flow paths',
        'SLA breach heatmap on long-running flows',
        'Compare flow versions side by side',
      ],
    },

    problem: {
      title: 'Flows fail silently and steal conversions',
      body:
        'A WhatsApp flow looks fine until it does not. Contacts enter at the top, conversions trickle out the bottom, and somewhere in the middle 35 percent of the audience vanishes — into a branch that fires the wrong template, a wait node that holds them too long, an AI step that returns an empty answer, or a webhook that 500s and never retries. The funnel metric tells you the conversion rate is 12 percent. It does not tell you that node 7 is responsible for half the loss.\n\nThe traditional debugging path is brutal. You re-read the canvas, manually trace a few contacts through it, scroll through logs, build a one-off query against the event store, and three hours later you have a hunch about where the leak is. By the time you fix it, you have run a campaign at 35 percent below its real potential, and the next flow will leak somewhere else.\n\nThe fix is to make the flow itself a measurement surface. Every node should publish how many contacts entered, how many succeeded, how many dropped, how long they spent inside, what revenue they touched and which SLA they breached. Then the canvas is a heatmap as well as an editor. You open the flow, see where the red is and act on it — without leaving the page.',
    },

    overview: [
      'Flow Analytics turns every node in the Flow Builder into a live measurement point. As contacts flow through, each node publishes counters for entered, succeeded, dropped, timed-out, errored and elapsed time. The canvas overlays these counters directly on the node tile, with a heatmap of drop-off so the leakiest step is visible at first glance. There is no separate analytics view to build — the editor and the analytics are the same surface.',
      'Drop-off is computed properly. If a contact enters node 5 and never reaches node 6 within the flow\'s timeout, they are counted as dropped at node 5 with a reason: timeout, branch mismatch, errored webhook, agent intervention, opt-out. This decomposition is the difference between "5 percent of contacts dropped at the AI step" and "the AI step times out 5 percent of the time on Hindi prompts longer than 200 characters" — actionable, specific, fixable.',
      'Revenue overlay shows which paths through the flow generate revenue and which do not. A two-branch flow where branch A leads to a Razorpay payment and branch B leads to an agent handoff can be compared on revenue per entrant, with the dollar number rendered on each path. Decisions to promote a branch, prune a step or rewrite a template become grounded in money rather than hand-wave conversion rates.',
      'Flow versions are first-class. When you publish a new version of a flow, Flow Analytics keeps the previous version visible so you can compare entrants, success rate and revenue side by side over time. This is how you prove a flow change worked, instead of guessing. Combined with A/B traffic splits at any node, it gives you a clean iteration loop on automation — not just on campaigns.',
    ],

    capabilities: [
      {
        title: 'On-canvas overlay',
        body: 'Every node shows entered, succeeded, dropped, errored and elapsed time inline on the canvas. A heatmap colour-codes drop-off so the leakiest step is visible without opening any side panel.',
      },
      {
        title: 'Drop-off decomposition',
        body: 'Drops are categorised by reason — timeout, branch mismatch, errored integration, agent takeover, contact opted out. Each reason is actionable and links to the underlying conversations for investigation.',
      },
      {
        title: 'Revenue per path',
        body: 'Attach a revenue event to a flow (a Razorpay payment, a Shopify order, a custom webhook). The canvas overlays revenue per entrant on each path, so dollar-weighted decisions replace conversion-rate guesses.',
      },
      {
        title: 'SLA monitoring',
        body: 'Define an SLA on a flow (must complete within 2 hours) and the analytics surface breach rate per node. SLA-breaching flows can trigger an alert, route to a manager queue or fail safely with a fallback.',
      },
      {
        title: 'Version comparison',
        body: 'Compare flow versions side by side on entrants, success rate, drop-off and revenue. Make a change, publish v2, and watch real numbers tell you whether the change worked rather than reading agent anecdotes.',
      },
      {
        title: 'AI step diagnostics',
        body: 'AI nodes publish prompt-level metrics — average token count, response time, success rate, refusal rate, fallback rate. Spot a degraded model or a bad prompt template before customers complain.',
      },
      {
        title: 'Per-segment breakdown',
        body: 'Compare flow behaviour across segments — paid vs free, new vs returning, India vs UAE. A flow that converts at 18 percent overall might be 28 percent for paid and 6 percent for free, which changes the fix.',
      },
    ],

    useCases: [
      {
        title: 'Onboarding flow drop-off',
        industry: 'SaaS',
        body: 'A B2B SaaS sees its trial-to-paid conversion plateau. Flow Analytics shows the integration-setup step times out for 22 percent of contacts. A 60-second wait extension and a retry branch lift conversion by 8 percent the following week.',
      },
      {
        title: 'Cart-recovery branch optimisation',
        industry: 'E-commerce',
        body: 'An e-commerce brand runs a 4-step cart-recovery flow. Revenue overlay reveals branch A (discount) generates twice the per-entrant revenue of branch B (free shipping) for first-time buyers. They reroute the segment and watch revenue lift in real time.',
      },
      {
        title: 'Loan-application flow SLA',
        industry: 'Financial Services',
        body: 'An NBFC requires loan applications to complete within 24 hours. Flow Analytics surfaces a 14 percent SLA breach at the document-upload step. They add an SMS fallback after 4 hours and breach rate falls to 3 percent.',
      },
      {
        title: 'AI agent prompt diagnostics',
        industry: 'EdTech',
        body: 'An edtech runs an AI agent flow for course recommendation. Flow Analytics shows the AI step has a 9 percent refusal rate on Hindi prompts. They retune the system prompt for multilingual handling and refusal rate drops below 1 percent.',
      },
      {
        title: 'Appointment-booking funnel',
        industry: 'Healthcare',
        body: 'A clinic chain runs an appointment-booking flow. Drop-off is concentrated at the time-slot selection step on mobile. They redesign the list response to use a button-based picker and bookings rise 23 percent across the chain.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Run the flow',
        body: 'Flow Analytics begins collecting data the moment a flow goes live. No instrumentation needed — every node automatically publishes counters and timing.',
      },
      {
        step: '02',
        title: 'Open the canvas',
        body: 'Open the flow in the editor. Counters and a heatmap render on each node by default. Switch to revenue or SLA overlay for different lenses.',
      },
      {
        step: '03',
        title: 'Drill into a node',
        body: 'Click any node to see drop-off breakdown, errored events, elapsed-time distribution and the conversations of contacts who passed through.',
      },
      {
        step: '04',
        title: 'Compare versions',
        body: 'Open the version compare view to see the metrics of the previous flow version alongside the current one over the same date range.',
      },
      {
        step: '05',
        title: 'Iterate and republish',
        body: 'Make a targeted fix to the leakiest node, publish a new version and watch real numbers update. Roll back from history if the new version underperforms.',
      },
    ],

    integrations: ['Razorpay', 'Stripe', 'Shopify', 'Meta', 'Mixpanel', 'Amplitude', 'BigQuery', 'Slack'],

    metrics: [
      { value: '100%', label: 'Per-node visibility across every published flow' },
      { value: '8–18%', label: 'Typical conversion uplift after one drop-off fix' },
      { value: '<10s', label: 'Latency from flow event to analytics overlay' },
      { value: '0', label: 'Custom instrumentation required by the flow author' },
    ],

    faqs: [
      {
        q: 'Do I need to instrument my flow for analytics to work?',
        a: 'No. Every node in the Flow Builder publishes counters and timing automatically. The only optional setup is attaching a revenue event (a Razorpay or Shopify webhook) to a flow so the revenue overlay has data to render. Everything else, including drop-off decomposition, works out of the box from the moment a flow goes live.',
      },
      {
        q: 'How is "dropped" defined?',
        a: 'A contact is counted as dropped at a node if they enter the node and do not progress to a downstream node within the flow\'s timeout window. We further categorise the drop by reason — timeout, branch mismatch, errored integration, agent takeover, opt-out — so the number tells you not just where to look but what to fix.',
      },
      {
        q: 'Can I see analytics for a specific cohort?',
        a: 'Yes. The per-segment breakdown lets you compare a flow\'s behaviour across any contact segment — paid vs free, new vs returning, by country, by source, by language. A flow that converts at 18 percent overall might be 28 percent for paid and 6 percent for free, which usually changes the fix you would make.',
      },
      {
        q: 'How does revenue attribution work for flows?',
        a: 'Attach a revenue event to the flow — typically a Razorpay payment, a Stripe charge, a Shopify order or a custom webhook from your backend. The platform attributes revenue to the path the contact took through the flow within an attribution window you set (default 7 days). Per-path revenue per entrant appears on the canvas.',
      },
      {
        q: 'Can I A/B test a flow node?',
        a: 'Yes. Any node can be replaced by an A/B split node that routes contacts randomly between two or more downstream paths. Flow Analytics shows per-arm metrics with a significance signal, exactly like multi-step campaigns. The winner can be promoted by editing the split to 100 percent on the winning arm.',
      },
      {
        q: 'How do I monitor SLA breaches in real time?',
        a: 'Set an SLA on the flow (must complete within X minutes or hours). Flow Analytics tracks the percentage of contacts breaching the SLA per node and surfaces it on the canvas. You can also route breaches to an alert channel (Slack, email) or trigger a fallback flow that recovers the conversation automatically.',
      },
      {
        q: 'Does this cover AI Studio steps?',
        a: 'Yes. AI nodes publish additional diagnostics — average token count, response time, success rate, refusal rate, fallback rate to a human. You can see whether a recent model swap or prompt change degraded performance, and you can compare AI step behaviour across languages or segments to catch issues that hide in averages.',
      },
    ],

    related: ['flow-builder', 'ai-studio', 'ab-testing', 'dashboards'],
  },

  {
    slug: 'csat',
    name: 'CSAT & Ratings',
    brand: 'Analytics',
    category: 'analytics',
    tagline: 'Auto-trigger CSAT on resolved chats. Segment by agent, channel, label.',
    iconKey: 'star',
    color: '#EC4899',
    tint: '#FCE7F3',

    seoTitle: 'In-channel CSAT & Customer Ratings Engine | SabNode',
    seoDescription:
      'Auto-trigger CSAT surveys on resolved WhatsApp, Instagram and email chats. Segment by agent, channel, label and language with real-time scoring.',
    keywords: [
      'whatsapp csat survey',
      'customer satisfaction rating tool',
      'agent csat tracking',
      'whatsapp customer feedback',
      'omnichannel csat dashboard',
      'auto trigger csat survey',
      'csat by agent channel',
      'whatsapp post chat survey',
      'nps and csat tool',
      'customer support rating software',
    ],

    hero: {
      eyebrow: 'Analytics · CSAT',
      headline: 'Know what customers think the moment a chat ends',
      subhead:
        'Resolutions without feedback are guesses. SabNode CSAT auto-fires a survey the moment a chat is marked resolved — on the channel the conversation happened on — and pipes the score straight into agent, team, channel and label dashboards. No third-party survey tool, no broken links, no day-old aggregates.',
      bullets: [
        'Auto-trigger on resolve, opt-out aware',
        'Native WhatsApp, Instagram, email and widget',
        'Score by agent, team, channel, label, language',
        'Verbatim feedback surfaced to agents and ops',
      ],
    },

    problem: {
      title: 'Support quality is measured by vibes',
      body:
        'Most support teams claim to care about CSAT and then run it like an afterthought. A weekly survey goes out from a generic email address, response rates sit in the single digits, the dashboard is a static PDF emailed every Monday, and nobody believes the number. Worse, the survey lives in a separate tool that does not know which agent handled the chat, which channel it happened on, what label was applied or what the customer\'s opening question was — so even when the score comes in, it is contextless.\n\nThe operational consequences are real. Agents are coached on hunches because the number cannot be tied back to specific conversations. Channel investments are justified by opinion because there is no per-channel CSAT. Bad chats slip out into the world because nobody sees the 2-star until a week later. The customer who took the time to give honest feedback never gets a follow-up because the system is not wired to surface them quickly.\n\nThe right way is to fire CSAT in the channel the conversation happened on, the moment the chat resolves, with the agent and conversation context attached. The response should land in the same system that runs the inbox, so a 1-star automatically routes to a senior agent for a make-good and the score appears on the agent and team dashboard within seconds. This is operational CSAT, not survey theatre.',
    },

    overview: [
      'SabNode CSAT runs as an integrated part of the inbox, not a separate survey tool. When a chat is marked resolved, the platform fires a CSAT prompt in the same channel the conversation happened on — a WhatsApp interactive message with star buttons, an Instagram DM with quick replies, an email with a one-click rating, or a widget banner inside the web chat. Response rates are dramatically higher than email-only surveys because the customer is already in the channel.',
      'The CSAT prompt is contextual. It knows which agent handled the chat, what the opening question was, which labels were applied and what segment the customer belongs to, so every response is automatically attributed without manual tagging. Verbatim feedback (an optional follow-up text response) is captured and made searchable. Low ratings (1 or 2 star) can trigger automatic workflows — assign to a senior agent for a make-good, alert the team lead in Slack, open a ticket in your CRM.',
      'Reporting is operator-grade. CSAT can be sliced by agent, team, channel, label, segment, language, time-of-day and conversation length. Trend lines, distributions and outlier alerts run on the same dashboard layer as the rest of the platform. A team lead can see which agents are trending down, which labels correlate with low CSAT and which channels have the highest variance — and drill into the specific conversations behind any number.',
      'Compliance is built in. The survey is opt-out aware (suppressed if the contact has opted out of marketing or post-chat messaging), respects WhatsApp\'s 24-hour service window (uses a Utility template if the window has closed), and stores the consent record for the response. Verbatim feedback is encrypted at rest, and access can be restricted by RBAC so frontline agents see only their own ratings while leads see the team.',
    ],

    capabilities: [
      {
        title: 'Native channel CSAT',
        body: 'CSAT fires in the channel the chat happened on — WhatsApp interactive buttons, Instagram quick replies, email one-click rating, web widget banner. No external survey tool, no broken links, response rates 3–5× higher than email-only surveys.',
      },
      {
        title: 'Auto-trigger on resolve',
        body: 'When an agent marks a chat resolved, the CSAT prompt fires within seconds. Configurable rules suppress for opt-outs, transactional flows, very short interactions and repeat customers who rated recently.',
      },
      {
        title: 'Full context attribution',
        body: 'Every response is automatically attributed to the handling agent, conversation, label, segment, channel and opening question. No manual tagging, no spreadsheet reconciliation, no "I think this was a billing chat" guesswork.',
      },
      {
        title: 'Verbatim capture',
        body: 'Optional follow-up text response captures verbatim feedback. Searchable, sentiment-scored and routable to a leadership channel or a CRM ticket. The customers who took the time to explain a 2-star never get lost.',
      },
      {
        title: 'Low-rating workflows',
        body: 'Any rating below a threshold can trigger automatic action — assign to a senior agent, alert in Slack, open a ticket in HubSpot or Salesforce, fire a make-good flow that offers a discount or a callback within 4 hours.',
      },
      {
        title: 'Stackable analytics',
        body: 'CSAT splits by agent, team, channel, label, segment, language and time. Trend lines, distributions and outlier alerts run on the same dashboard layer. Drill into the specific conversations behind any number with one click.',
      },
      {
        title: 'NPS and custom survey support',
        body: 'Beyond CSAT, the same engine runs NPS, CES (effort), thumbs-up/down and custom multi-question surveys. Use the right instrument for the moment — short post-chat CSAT, longer monthly NPS, product-specific CES on flows.',
      },
    ],

    useCases: [
      {
        title: 'Support team coaching',
        industry: 'SaaS',
        body: 'A B2B SaaS support lead runs weekly 1:1s using CSAT trends per agent, verbatim feedback on outliers, and channel-level breakdowns. Coaching is grounded in specific conversations rather than gut feel, and agent CSAT moves measurably quarter-over-quarter.',
      },
      {
        title: 'D2C brand make-goods',
        industry: 'D2C',
        body: 'A D2C beauty brand auto-routes 1-star CSAT to a senior agent who reaches out within 4 hours with a make-good offer. Recovered customers re-rate at an average 4.6/5 and a quarter of recoveries lead to a follow-on purchase within 14 days.',
      },
      {
        title: 'Clinic chain NPS by location',
        industry: 'Healthcare',
        body: 'A diagnostics chain runs CSAT after every chat and NPS after every visit, segmented by location. Locations underperforming on either metric get targeted operational interventions, with the trend visible on a CEO-level dashboard updated in real time.',
      },
      {
        title: 'Channel comparison for marketing',
        industry: 'E-commerce',
        body: 'An e-commerce growth team compares post-purchase CSAT across WhatsApp, Instagram DM and email. WhatsApp consistently rates highest; the team uses the data to justify expanding the WhatsApp budget at the next quarterly planning round.',
      },
      {
        title: 'Bank branch customer feedback',
        industry: 'Financial Services',
        body: 'A bank runs CSAT after every chat with a relationship manager, segmented by branch, product type and language. Branch managers see live CSAT for their team and intervene on outliers within the same day rather than reading a monthly summary.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Pick a survey type',
        body: 'CSAT (star or thumb), NPS, CES or custom multi-question. Each is configured once per use case — typically a short CSAT post-chat and a longer NPS quarterly.',
      },
      {
        step: '02',
        title: 'Set trigger rules',
        body: 'Fire on resolve, on a specific label, on a particular flow path or on a manual button. Suppress on opt-out, transactional conversations or recent rate.',
      },
      {
        step: '03',
        title: 'Render in the channel',
        body: 'The survey renders natively — WhatsApp interactive buttons, Instagram quick replies, email one-click rating, web widget banner. No external survey tool.',
      },
      {
        step: '04',
        title: 'Route the response',
        body: 'Responses land in the analytics layer instantly. Low ratings trigger configured workflows — agent assignment, Slack alert, CRM ticket, make-good flow.',
      },
      {
        step: '05',
        title: 'Coach and improve',
        body: 'Slice CSAT by agent, team, channel, label and language. Use verbatim feedback for coaching, leadership reviews and operational interventions.',
      },
    ],

    integrations: ['Slack', 'HubSpot', 'Salesforce', 'Zapier', 'Gmail', 'Outlook', 'Mixpanel', 'BigQuery'],

    metrics: [
      { value: '38–55%', label: 'Typical response rate on native channel CSAT' },
      { value: '<5s', label: 'Time from chat resolve to CSAT prompt sent' },
      { value: '4 hr', label: 'Standard make-good SLA for low-rating recovery' },
      { value: '+18%', label: 'Repeat-purchase rate on recovered low-rating customers' },
    ],

    faqs: [
      {
        q: 'Why is response rate so much higher on channel-native CSAT?',
        a: 'Because the customer is still in the channel and still has context. A WhatsApp interactive message with three star buttons gets tapped immediately by most customers; an email sent two hours later asking the same question rarely does. Response rates of 38–55 percent are normal for in-channel CSAT versus 4–8 percent for email surveys.',
      },
      {
        q: 'How does CSAT respect WhatsApp\'s 24-hour service window?',
        a: 'If the chat resolves inside the 24-hour service window, CSAT fires as a free-form interactive message. If the window has closed (e.g. resolution happened many hours after the last customer message), the survey uses a pre-approved Utility template tagged for post-chat feedback, which preserves deliverability and policy compliance.',
      },
      {
        q: 'Can I suppress CSAT for certain conversations?',
        a: 'Yes. Suppression rules can fire on label (no CSAT on "spam" or "test"), on conversation length (skip if shorter than 2 messages), on contact recency (do not survey a customer who rated within the last 7 days), on opt-out status and on specific flows. The goal is to never survey-fatigue good customers.',
      },
      {
        q: 'How do low ratings get handled?',
        a: 'Configurable. A 1- or 2-star can auto-assign to a senior agent for a make-good, post an alert to Slack, open a HubSpot or Salesforce ticket, or fire a make-good flow that offers a discount or callback. The SLA on these recoveries is typically 4 hours — fast enough that the customer feels heard before they move on.',
      },
      {
        q: 'Can I run NPS and CSAT side by side?',
        a: 'Yes. CSAT is short and fires post-chat. NPS is the right instrument for product or relationship sentiment and typically fires monthly or after a milestone (purchase, onboarding complete). Both run on the same engine, share the same analytics layer and can be cross-referenced — for example, customers with low CSAT who later give a high NPS are a powerful coaching signal.',
      },
      {
        q: 'Who can see what?',
        a: 'RBAC controls everything. Frontline agents see their own ratings and verbatim feedback by default. Team leads see their team. Workspace admins see everything. Verbatim feedback is encrypted at rest and access is audited. You can grant temporary access for specific reviews (e.g. a coaching session) without permanent permission changes.',
      },
      {
        q: 'Can I send CSAT through email or web chat as well as WhatsApp?',
        a: 'Yes. The same survey runs across all channels in the way that fits — WhatsApp interactive buttons, Instagram quick replies, email with one-click links, web widget banner. Responses land in a unified analytics layer, so a single CSAT score per agent can be computed across every channel they handle.',
      },
    ],

    related: ['shared-inbox', 'chat-labels', 'dashboards', 'attribution'],
  },

  {
    slug: 'exports',
    name: 'Exports & Warehouse',
    brand: 'Analytics',
    category: 'analytics',
    tagline: 'Download raw events, CSV exports or sync to BigQuery, Snowflake, Postgres.',
    iconKey: 'download',
    color: '#8B5CF6',
    tint: '#F3E8FF',

    seoTitle: 'Data Exports & BigQuery, Snowflake, Postgres Sync | SabNode',
    seoDescription:
      'Export every message event, conversation and contact to CSV, or stream to BigQuery, Snowflake or Postgres for analysis. Hourly or real-time pipelines.',
    keywords: [
      'whatsapp data export tool',
      'messaging events bigquery sync',
      'snowflake whatsapp data warehouse',
      'postgres customer messaging export',
      'csv message export tool',
      'whatsapp event stream',
      'data warehouse messaging sync',
      'whatsapp analytics export',
      'raw event export tool',
      'whatsapp data pipeline',
    ],

    hero: {
      eyebrow: 'Analytics · Warehouse',
      headline: 'Your raw event stream, your warehouse, your rules',
      subhead:
        'Operator dashboards answer "what happened today". Warehouse pipelines answer everything else. SabNode streams every message, conversation, flow and contact event into BigQuery, Snowflake or Postgres, with CSV exports for one-off questions. Your data, modelled by your analysts, with no vendor lock on the spine.',
      bullets: [
        'Stream events to BigQuery, Snowflake, Postgres',
        'Hourly or near real-time pipelines',
        'CSV exports for any view or report',
        'Documented event schema with version history',
      ],
    },

    problem: {
      title: 'Analytics tools live and die by the warehouse',
      body:
        'Every serious analytics practice eventually hits the same wall: the vendor dashboards are fine for ops, but the moment leadership wants real cohort retention, LTV by channel, or a year-over-year revenue waterfall, you need the raw events in a warehouse where your analysts can model them. Most vendors make this difficult — opaque APIs, partial event coverage, schemas that change without warning, or premium pricing for the privilege of getting your own data out.\n\nThe failure modes compound. A growth analyst spends two weeks reverse-engineering a vendor\'s data export only to discover that delivery webhooks are missing entirely. A finance team builds a revenue report off CSV exports that silently drop the last 200 rows because the export ran during a deploy. A data engineer is asked to model attribution but the event timestamps are in three different timezones because nobody documented the schema. Six months later, the dashboards in the warehouse disagree with the dashboards in the vendor tool, and nobody trusts either.\n\nThe fix is to treat the warehouse export as a first-class product, not an afterthought. Document the event schema with version history. Stream events in near real time. Cover every event the platform emits — messages, conversations, flow steps, payments, opt-ins, CSAT — with consistent IDs across all of them. Then your analysts model once and the answers stay defensible quarter after quarter.',
    },

    overview: [
      'SabNode Exports & Warehouse is a first-class data product. Every event the platform emits — message sent, delivered, read, replied, failed; conversation opened, assigned, resolved; flow node entered, succeeded, dropped; contact created, updated, opted-in, opted-out; payment created, succeeded, refunded — is captured in a documented event schema with stable IDs that join across event types. The same contact ID appears in messages, flows, payments and CSAT, so cohort modelling works without manual joins.',
      'Pipelines write to BigQuery, Snowflake or Postgres on a configurable cadence — hourly batch for most teams, near real time (1–5 minute latency) for high-velocity operations. Each warehouse target gets its own ingestion service that handles schema migration, late-arriving events and de-duplication idempotently. If your warehouse goes down for a few hours, no data is lost; the pipeline backfills automatically when connectivity returns.',
      'CSV exports cover the rest. Any dashboard view, any list of conversations, any segment, any campaign report can be exported as a CSV with one click. Large exports (hundreds of thousands of rows) run as a background job and email a download link when ready. Exports are signed and short-lived to prevent accidental sharing of customer data, and every export is logged in the audit trail for compliance.',
      'Schema is documented and versioned. The event schema is published as a versioned reference doc — every column, type, nullability and meaning, with example values and changelog entries when a field is added or deprecated. Breaking changes ship behind a major version bump with a migration window, so your warehouse models never break overnight. This is the difference between a data integration and a moving target.',
    ],

    capabilities: [
      {
        title: 'BigQuery pipeline',
        body: 'Native streaming sink to a BigQuery dataset of your choice. Handles schema migrations, late-arriving events and idempotent de-duplication automatically. Backfills if the warehouse goes down, no data lost.',
      },
      {
        title: 'Snowflake pipeline',
        body: 'Snowflake pipe via Snowpipe or scheduled COPY commands. Lands events in a versioned schema with predictable column names and stable IDs that join across messages, conversations, flows and payments.',
      },
      {
        title: 'Postgres pipeline',
        body: 'Postgres ingestion for teams running their warehouse on Postgres or self-hosted RDS. Supports change-data-capture style updates with deterministic upsert semantics, plus standard append-only event streams.',
      },
      {
        title: 'Hourly to real-time cadence',
        body: 'Choose the cadence per pipeline — hourly batch for cost-efficient bulk modelling, near real-time (1–5 min) for operational dashboards that drive same-day decisions, or both running in parallel against different schemas.',
      },
      {
        title: 'CSV export with backgrounding',
        body: 'Any view, list or campaign report exports to CSV. Small exports download immediately; large exports (>50k rows) run as a background job and email a signed, short-lived download link when ready.',
      },
      {
        title: 'Documented event schema',
        body: 'Every event, column, type and meaning is documented with example values, nullability rules and a changelog. Schema versions are stable; breaking changes ship behind a major version with a migration window.',
      },
      {
        title: 'Audit and compliance',
        body: 'Every export and every pipeline run is logged with user, timestamp, row count and purpose. Useful for DPDP, GDPR or SOC 2 audits where data movement must be traceable. Pipelines support data-residency rules per region.',
      },
    ],

    useCases: [
      {
        title: 'LTV modelling',
        industry: 'D2C',
        body: 'A D2C analyst joins WhatsApp engagement events with Shopify order events in BigQuery to model lifetime value by acquisition channel. The shared contact ID makes the join trivial and the LTV-by-channel chart drives a 30 percent rebalance of marketing spend.',
      },
      {
        title: 'Cohort retention',
        industry: 'SaaS',
        body: 'A B2B SaaS analyst models trial-to-paid cohort retention by onboarding-flow version. Snowflake export lets them slice retention by every flow variant they shipped that quarter and prove which onboarding flows actually retain users.',
      },
      {
        title: 'Daily revenue waterfall',
        industry: 'EdTech',
        body: 'An edtech finance team builds a daily revenue waterfall in their warehouse — sign-ups, conversions, refunds, MRR change — joined with WhatsApp campaign exposure. The single source of truth ends a long-running dispute between marketing and finance.',
      },
      {
        title: 'Regulator export',
        industry: 'Financial Services',
        body: 'An NBFC exports every customer message and opt-in record for a regulator audit. The platform produces a signed, scoped CSV bundle within minutes, with audit log entries that the regulator can verify independently.',
      },
      {
        title: 'Operations forecasting',
        industry: 'Logistics',
        body: 'A logistics operator streams driver-shift WhatsApp acknowledgements into Postgres alongside operational data. The combined dataset feeds a forecasting model that predicts roster gaps a week out, reducing missed deliveries.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Pick a destination',
        body: 'Choose BigQuery, Snowflake, Postgres or CSV. Authenticate via OAuth or a service account scoped to the target dataset.',
      },
      {
        step: '02',
        title: 'Select event types',
        body: 'Pick which event categories to stream — messages, conversations, flows, payments, contacts, CSAT. Each becomes its own table in the destination.',
      },
      {
        step: '03',
        title: 'Set cadence',
        body: 'Choose hourly batch or near real-time streaming. Real-time uses change-data-capture; batch uses scheduled bulk inserts. Both are idempotent.',
      },
      {
        step: '04',
        title: 'Validate the schema',
        body: 'Run a dry export. Validate that the schema matches your warehouse expectations and that example rows look right. Documented schema reference is shared.',
      },
      {
        step: '05',
        title: 'Go live and monitor',
        body: 'Enable the pipeline. Monitor row counts, lag and errors in the pipeline health view. Backfills run automatically if the warehouse is unavailable.',
      },
    ],

    integrations: ['BigQuery', 'Snowflake', 'Postgres', 'Looker', 'Mixpanel', 'Amplitude', 'Google Sheets', 'Zapier'],

    metrics: [
      { value: '<5 min', label: 'Lag on near real-time warehouse pipelines' },
      { value: '100%', label: 'Event coverage across messages, flows, payments, CSAT' },
      { value: '0', label: 'Data loss after warehouse outage thanks to backfill' },
      { value: 'Versioned', label: 'Schema with changelog and migration windows' },
    ],

    faqs: [
      {
        q: 'How is this different from a Zapier export?',
        a: 'Zapier exports are great for single-event automations ("when a contact is created, add to a Google Sheet") but break down at warehouse scale — they do not handle late-arriving events, schema migrations, backfill after an outage, or idempotent ingestion. SabNode pipelines are built for warehouse loads of millions of events per day with predictable schemas and audit trails.',
      },
      {
        q: 'What is the latency on real-time streaming?',
        a: 'Typically 1–5 minutes end-to-end from event occurrence to row landing in the warehouse. We do not promise sub-second because warehouses themselves do not ingest at sub-second cleanly, and the cost premium is rarely justified. If you need true streaming, our webhooks API delivers individual events in under 2 seconds for downstream stream-processing systems.',
      },
      {
        q: 'How do schema changes get handled?',
        a: 'Additive changes (a new optional column) ship continuously and are documented in the changelog. Breaking changes (renaming, type change, removal) are batched into a major schema version with a 60-day migration window. During the window both versions run in parallel so your warehouse models can be updated without downtime. We never silently break a schema.',
      },
      {
        q: 'Can I export CSV from any view?',
        a: 'Yes. Any dashboard view, conversation list, campaign report, segment or contact list can be exported to CSV. Small exports (under 50,000 rows) download immediately. Larger exports run as a background job and email a signed, short-lived download link. Exports are logged in the audit trail.',
      },
      {
        q: 'Does this respect data residency requirements?',
        a: 'Yes. Pipelines can be configured per region — Indian customer data can be exported to a BigQuery dataset in asia-south1, EU customer data to europe-west, US customer data to us-central. The platform enforces residency at ingestion time and the documentation specifies which regions are available for each destination.',
      },
      {
        q: 'What happens if my warehouse is down for several hours?',
        a: 'The pipeline detects the outage, queues events in our buffer, and resumes ingestion when the warehouse recovers. Events are de-duplicated using stable IDs so backfill is idempotent — running the same event twice produces the same result. Most outages of up to 24 hours backfill transparently with no manual intervention.',
      },
      {
        q: 'Can I get historical data when I first set up the pipeline?',
        a: 'Yes. On first pipeline setup, we offer an initial backfill of up to 18 months of historical events at no charge. Longer backfills are available on request. The backfill loads in batches that do not exceed your warehouse\'s ingestion quota, so it does not interfere with regular streaming for current data.',
      },
    ],

    related: ['dashboards', 'attribution', 'webhooks', 'rest-api'],
  },

  {
    slug: 'attribution',
    name: 'Attribution',
    brand: 'Analytics',
    category: 'analytics',
    tagline: 'See which flow, campaign or channel actually drove the outcome.',
    iconKey: 'target',
    color: '#7C3AED',
    tint: '#EDE9FE',

    seoTitle: 'Multi-touch Attribution for WhatsApp, IG & Email | SabNode',
    seoDescription:
      'Multi-touch and last-touch attribution across WhatsApp, Instagram and email. See which campaign, flow or channel really drove the conversion.',
    keywords: [
      'whatsapp attribution model',
      'multi touch attribution messaging',
      'last touch attribution whatsapp',
      'campaign attribution dashboard',
      'flow attribution tracking',
      'whatsapp revenue attribution',
      'omnichannel attribution tool',
      'first touch attribution whatsapp',
      'incremental lift measurement',
      'whatsapp conversion attribution',
    ],

    hero: {
      eyebrow: 'Analytics · Attribution',
      headline: 'Stop guessing which message drove the sale',
      subhead:
        'Attribution on WhatsApp is usually fiction — a last-touch number on a marketing slide nobody believes. SabNode runs multi-touch, last-touch and incremental-lift attribution against the same event spine that powers operations, so the number on the slide matches the number in the warehouse, and both are defensible.',
      bullets: [
        'Multi-touch, last-touch and lift models',
        'Attribution at campaign, flow and channel level',
        'Configurable lookback windows and decay',
        'Holdout-based incrementality on supported campaigns',
      ],
    },

    problem: {
      title: 'Attribution on WhatsApp is mostly storytelling',
      body:
        'WhatsApp does not give you click IDs. There is no equivalent of gclid or fbclid baked into the message envelope. So when a customer receives a marketing template, taps a button, lands on a checkout, and converts, the link between message and conversion has to be reconstructed from your own data — and most operators reconstruct it badly. They pick a 24-hour last-touch window, attribute everything in it to whatever the most recent send was, and call it done. The marketing slide says WhatsApp drove 47 percent of revenue. Finance does not believe it. Nobody re-runs the analysis with a different model because nobody knows how.\n\nThe failure modes are predictable. A customer receives a Marketing template, ignores it, gets an email two days later, clicks through and buys — but the WhatsApp template gets the credit because attribution windows overlap. Or a flow runs every day for a week and conversion is attributed only to the last touch even though the first message was the one that built the intent. Or a holdout campaign proves a 12 percent lift but the slide quotes 38 percent because last-touch is over-counting.\n\nReal attribution acknowledges the messiness. It supports multiple models — last-touch for ops dashboards, multi-touch for marketing planning, holdout-based incrementality for budget decisions — and lets you run them against the same events so the differences are visible and explainable. Then nobody is lying; everyone is just looking at the right model for the right question.',
    },

    overview: [
      'SabNode Attribution runs against the same event spine that powers operations and warehouse exports. Every message touch, every flow entry, every campaign exposure and every conversion event lives in one canonical store keyed by the contact, so attribution joins are trivial and consistent. You do not need to stitch identities across systems — the same contact ID flows through marketing, inbox, flows, payments and CSAT.',
      'Multiple models run side by side. Last-touch attributes the conversion to the most recent qualifying touch within the lookback window. First-touch credits the earliest. Linear distributes credit evenly across all touches. Time-decay weights more recent touches higher. Position-based gives 40 percent each to first and last touches and distributes 20 percent across middle touches. Each model is configurable for lookback window and touch eligibility (which channels, which campaign types qualify).',
      'Incremental lift is the gold standard, available where you ran a holdout. Multi-step campaigns and flows that include a holdout group produce a clean lift estimate — treated conversion rate minus held-out conversion rate, with confidence intervals. The lift number is the closest you can get to "this is what the campaign actually caused" rather than "this is what correlated with the campaign". Where holdouts are not available, multi-touch is the next-best honest model.',
      'Reporting is operator-friendly. The attribution dashboard surfaces revenue and conversions by campaign, flow, channel and segment under each model side by side, so the gap between last-touch and incremental lift is visible. Drill into a campaign to see the underlying touches, the contacts attributed and the conversion paths. Export the model output to BigQuery or Snowflake for your finance team to reconcile against ledger truth.',
    ],

    capabilities: [
      {
        title: 'Last-touch attribution',
        body: 'Attribute each conversion to the most recent qualifying touch within a configurable lookback window (default 7 days for marketing, 1 day for transactional). Operator-friendly default for daily dashboards and same-day decisions.',
      },
      {
        title: 'Multi-touch models',
        body: 'First-touch, linear, time-decay and position-based models run against the same event spine. Configure lookback per model and compare side by side to understand where each model over- or under-credits.',
      },
      {
        title: 'Incremental lift',
        body: 'For campaigns and flows with holdouts, compute true incremental lift — treated minus holdout conversion rate with confidence intervals. The honest model that survives scrutiny in finance and board reviews.',
      },
      {
        title: 'Campaign and flow attribution',
        body: 'Attribute conversions to the specific campaign or flow that drove them, not just the channel. A customer touched by three flows in a week gets credit distributed by the model you select, not assigned arbitrarily to the loudest one.',
      },
      {
        title: 'Channel attribution',
        body: 'Cross-channel attribution joins WhatsApp, Instagram, email and web chat touches under the same contact ID. See whether your WhatsApp ROI is real or whether email is doing the heavy lifting hidden behind a last-touch WhatsApp tap.',
      },
      {
        title: 'Lookback and decay control',
        body: 'Configure lookback windows by channel and by event type. Authentication touches usually do not deserve marketing credit; Marketing touches in the last 24 hours probably do. The platform makes the rules explicit.',
      },
      {
        title: 'Warehouse-grade exports',
        body: 'Attribution model outputs export to BigQuery, Snowflake or Postgres alongside raw events. Your analysts can rebuild the model in dbt if they want to, but the canonical results stay defensible and consistent across teams.',
      },
    ],

    useCases: [
      {
        title: 'Quarterly budget reallocation',
        industry: 'D2C',
        body: 'A D2C growth team runs holdout-tested attribution across WhatsApp, Instagram DM and email. The honest lift number reallocates a six-figure quarterly budget toward WhatsApp Marketing templates after proving a 14 percent incremental lift versus last-touch\'s 38 percent.',
      },
      {
        title: 'Flow performance review',
        industry: 'SaaS',
        body: 'A B2B SaaS reviews flow performance with multi-touch attribution rather than last-touch. The onboarding flow gets first-touch credit it deserves on conversions weeks later, justifying continued investment in onboarding copy and flow design.',
      },
      {
        title: 'Channel ROI for the CFO',
        industry: 'EdTech',
        body: 'An edtech CFO asks for channel ROI. The attribution dashboard shows last-touch, multi-touch and incremental lift side by side, with the gaps explained. The CFO signs off on the WhatsApp budget once the lift number is reconciled against the ledger.',
      },
      {
        title: 'Campaign A/B winner promotion',
        industry: 'E-commerce',
        body: 'An e-commerce brand runs a campaign with an A/B split and a holdout. Attribution shows arm A drove a 7 percent incremental lift versus arm B\'s 2 percent. Arm A is promoted to 100 percent for the next campaign without internal debate.',
      },
      {
        title: 'Real-estate broker performance',
        industry: 'Real Estate',
        body: 'A developer attributes site visits and bookings to the specific outbound message and broker that touched the lead. Multi-touch model credits both the initial brochure send and the broker\'s follow-up, ending arguments about which message moved the lead.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Define a conversion event',
        body: 'Pick the conversion — a purchase, a payment, a signup, a reply, a custom webhook. Events can be defined per business and per campaign goal.',
      },
      {
        step: '02',
        title: 'Pick attribution models',
        body: 'Enable last-touch, multi-touch (first, linear, time-decay, position) and incremental lift where holdouts exist. Each runs in parallel against the same data.',
      },
      {
        step: '03',
        title: 'Set lookback and rules',
        body: 'Configure lookback windows per channel and event eligibility (which touches qualify). Authentication usually does not qualify for marketing credit.',
      },
      {
        step: '04',
        title: 'View attribution dashboard',
        body: 'See revenue and conversions by campaign, flow, channel and segment under each model. Drill into a campaign to see the underlying touches and paths.',
      },
      {
        step: '05',
        title: 'Reconcile and decide',
        body: 'Export model outputs to your warehouse for finance reconciliation. Use incremental lift for budget reallocation and last-touch for daily operations.',
      },
    ],

    integrations: ['Shopify', 'Stripe', 'Razorpay', 'HubSpot', 'Salesforce', 'BigQuery', 'Snowflake', 'Mixpanel'],

    metrics: [
      { value: '5', label: 'Attribution models running side by side on the same data' },
      { value: '12–18%', label: 'Typical incremental lift on WhatsApp Marketing broadcasts' },
      { value: '<24 hr', label: 'Lag from conversion event to attributed credit' },
      { value: '95%', label: 'Confidence threshold on incremental lift detection' },
    ],

    faqs: [
      {
        q: 'Why does my last-touch attribution number differ so much from incremental lift?',
        a: 'Last-touch credits every conversion in the lookback window to the most recent touch, which over-counts touches that happened near the conversion but did not cause it. Incremental lift compares treated and held-out audiences, which isolates true causation. The gap is real — a 38 percent last-touch share might be a 14 percent incremental lift, and the gap is mostly customers who would have converted anyway.',
      },
      {
        q: 'Which model should I use for budget decisions?',
        a: 'Incremental lift where you have a holdout. Multi-touch (time-decay or position-based) where you do not. Last-touch is fine for daily ops dashboards where the question is "who did we touch today" rather than "what did the touch cause". The dashboard surfaces all three side by side so you can pick the right one for the question.',
      },
      {
        q: 'How are touches across channels reconciled?',
        a: 'Through the shared contact ID. Every WhatsApp send, Instagram DM, email open and web chat session is keyed by the same canonical contact, so a customer touched by three channels in a week has all three touches available to whichever attribution model you run. Identity resolution is at the contact level, not at the channel level.',
      },
      {
        q: 'What counts as a qualifying touch?',
        a: 'Configurable per channel. By default, Marketing template sends qualify for marketing attribution; Authentication and most Utility sends do not. Email opens, link clicks and replies all qualify. You can override these defaults per campaign — for example, a transactional Utility template that included a soft-cross-sell might be promoted to qualify for attribution credit.',
      },
      {
        q: 'How is the holdout for incremental lift different from a campaign A/B?',
        a: 'A campaign A/B compares two treatment arms (e.g., copy A vs copy B). A holdout compares the treated audience against an audience that received zero campaign messages. Both are valuable but they answer different questions: A/B says "which variant is better"; holdout says "did the campaign cause anything at all". Together they tell you which arm is best and how much it moved the needle absolutely.',
      },
      {
        q: 'How fast does attribution show up on the dashboard?',
        a: 'New conversions are attributed within minutes. Models that depend on a full lookback window (e.g., 7-day multi-touch) stabilise as the window completes — a conversion attributed on day 1 might have its model output adjusted as later touches fall outside the window. The dashboard shows both the immediate and the stabilised number with a small icon explaining the difference.',
      },
      {
        q: 'Can I rebuild attribution in dbt against the raw events?',
        a: 'Yes. The warehouse export includes every event the attribution engine sees, with documented schema and stable IDs. Analysts who want to rebuild the model in dbt or run custom analyses (e.g., Shapley value attribution, Markov chain models) can do so against the same canonical data. The platform-computed result is the reference; analysts replicate or extend.',
      },
    ],

    related: ['campaigns', 'dashboards', 'exports', 'ab-testing'],
  },

  {
    slug: 'heatmaps',
    name: 'Activity Heatmaps',
    brand: 'Analytics',
    category: 'analytics',
    tagline: 'Visualise activity over time-of-day and day-of-week by channel.',
    iconKey: 'eye',
    color: '#06B6D4',
    tint: '#CFFAFE',

    seoTitle: 'Activity Heatmaps for WhatsApp, IG & Chat Volume | SabNode',
    seoDescription:
      'See where your traffic actually lives — by hour, day, channel and segment. Plan staffing, broadcast pacing and SLA windows on real activity data.',
    keywords: [
      'whatsapp activity heatmap',
      'chat traffic heatmap',
      'agent staffing heatmap',
      'time of day messaging analytics',
      'day of week chat volume',
      'broadcast pacing heatmap',
      'support sla planning tool',
      'whatsapp peak hour analysis',
      'omnichannel volume heatmap',
      'inbound message heatmap',
    ],

    hero: {
      eyebrow: 'Analytics · Heatmaps',
      headline: 'See exactly when your customers actually talk to you',
      subhead:
        'Staffing, broadcast pacing and SLA windows all hinge on knowing when traffic happens — by hour, by day, by channel, by segment. SabNode Activity Heatmaps render the answer in a single glance. Decide your shift roster, your broadcast launch time and your SLA thresholds on real data instead of folk wisdom.',
      bullets: [
        'Hour × day grid for every channel and segment',
        'Inbound volume, response time and resolution',
        'Compare current week to a baseline',
        'Drive staffing, SLA and pacing decisions',
      ],
    },

    problem: {
      title: 'Operational decisions made on folk wisdom',
      body:
        'Every support and growth team has a "we think Tuesday afternoons are busy" theory. Most of the time it is wrong, or right only in aggregate, or right last year but wrong now because customer behaviour shifted after the festive season. The result is a roster that has too many agents at 11am and too few at 8pm, a broadcast launched at 10am because that is when the marketing lead arrives at the office, and an SLA of "respond within 4 hours" set without checking when customers are actually waiting.\n\nThe data is there — every inbound message, every reply, every resolution is timestamped — but it is locked inside a spreadsheet nobody runs. When the question comes up ("should we add a night-shift agent?", "when should we send the festival broadcast?"), the analysis takes a week and the decision is made before the spreadsheet is finished. The team falls back to gut feel, the gut feel turns out to be wrong in a way that costs money, and nobody learns anything because there is no closed loop.\n\nA heatmap closes the loop. One glance shows traffic by hour and day, by channel, by segment. The decision — when to staff, when to broadcast, what SLA to set — gets made on Monday morning in two minutes instead of a week. The next week, the heatmap reflects the impact of the decision, so you can tell whether moving the broadcast from 10am to 8pm actually changed read rate. This is operations grounded in evidence, at the cadence operations actually moves.',
    },

    overview: [
      'SabNode Activity Heatmaps render every operational signal as an hour × day grid. The default view is inbound message volume by hour-of-day and day-of-week, across all channels, for the last 30 days. From there you slice — by channel (WhatsApp, Instagram, email, web chat), by segment (paid vs free, new vs returning, by country), by team or agent, by label, by language — and the grid updates in milliseconds. Every cell is interactive: click to see the underlying conversations, hover for the exact volume, right-click to drill into the same hour on the previous month for comparison.',
      'Beyond inbound volume, the same heatmap surface answers the operational questions that volume alone cannot. Response time heatmaps show when your agents are slowest, by hour and day, so the SLA conversation is grounded in real numbers. Resolution-time heatmaps show when chats take the longest to close — usually correlated with shift handovers and weekend coverage. Broadcast-window heatmaps show when read rates peak by segment, so the launch time conversation is settled in seconds.',
      'Comparison is built in. Every heatmap can be overlaid with a baseline period — last week vs the week before, this month vs the same month last year, festive period vs non-festive — and the delta is rendered as a divergent colour scale. A spike in inbound on Thursday evenings that did not exist last quarter is visible immediately, and the drill-down shows you which segment caused it. Operations becomes a closed loop: notice the shift, intervene, see the impact on the next heatmap update.',
      'Heatmaps drive other systems. The broadcast scheduler can suggest a launch window based on the read-rate heatmap for the target segment. The shared inbox can recommend a staffing pattern based on the volume heatmap for each team. The SLA configuration UI can surface "your current SLA of 4 hours is breached 22 percent of the time at 8pm on weekdays" — turning a static target into a living number. The heatmap is not a chart; it is operational intelligence.',
    ],

    capabilities: [
      {
        title: 'Hour × day grid',
        body: 'The canonical view — 24 hours by 7 days, coloured by volume or any metric you choose. Every cell is interactive: hover for exact values, click to see underlying conversations, right-click to compare with a baseline period.',
      },
      {
        title: 'Channel and segment slicing',
        body: 'Slice the heatmap by channel (WhatsApp, Instagram, email, web chat), segment (paid vs free, by country, by language), team, agent, label or campaign. Every dimension updates in milliseconds without page reloads.',
      },
      {
        title: 'Response and resolution heatmaps',
        body: 'Beyond inbound volume, render response time and resolution time as heatmaps. Surface when agents are slowest by hour and day, which usually correlates with handovers and weekend coverage gaps.',
      },
      {
        title: 'Broadcast pacing recommendations',
        body: 'Read-rate heatmaps power broadcast-window suggestions. When you launch a marketing template to a segment, the scheduler suggests a window based on when that segment historically reads messages within the first hour.',
      },
      {
        title: 'Baseline comparison',
        body: 'Overlay any heatmap with a baseline — last week, last month, same period last year. Divergent colour scale renders the delta directly so spikes and dips are visible without doing the maths in your head.',
      },
      {
        title: 'SLA planning surface',
        body: 'Heatmaps feed the SLA configuration UI. Setting a 4-hour SLA shows you which hour-day cells would breach historically, so the SLA conversation is grounded in real coverage rather than aspiration.',
      },
      {
        title: 'Timezone correctness',
        body: 'Heatmaps respect the recipient\'s timezone when relevant (read-rate heatmaps) and the operator\'s timezone otherwise (agent staffing heatmaps). No more debates about whether 8pm IST equals 2:30pm UTC; the platform does it correctly.',
      },
    ],

    useCases: [
      {
        title: 'Support shift planning',
        industry: 'E-commerce',
        body: 'An e-commerce support lead reads the volume heatmap and discovers a sustained spike at 9–11pm IST that was not on the roster. They add an evening-shift agent the next week and the queue-wait heatmap for that window drops from 12 minutes median to under 3.',
      },
      {
        title: 'Broadcast launch window',
        industry: 'D2C',
        body: 'A D2C beauty brand launches Marketing templates based on read-rate heatmaps per segment — 7pm IST for "metro women 25–34", 8am IST for "tier-2 men 35–45". Average read rate within the first hour improves 18 percent versus a one-size launch time.',
      },
      {
        title: 'SLA reset for support team',
        industry: 'SaaS',
        body: 'A B2B SaaS resets its support SLA after the heatmap shows 4-hour breaches concentrated at 7am UTC. They split the SLA — 1 hour during business hours, 8 hours overnight — and breach rate falls below 3 percent across the week.',
      },
      {
        title: 'Festive season prep',
        industry: 'Retail',
        body: 'A retail chain compares Diwali week volume heatmap to the same week the previous year. The 200 percent surge informs how many seasonal agents to onboard, when to onboard them and when to ramp down. The post-Diwali debrief uses the same heatmap to evaluate.',
      },
      {
        title: 'Multi-region operations',
        industry: 'Logistics',
        body: 'A logistics operator running in India, UAE and Singapore reads heatmaps in each region\'s timezone. Staffing patterns and broadcast schedules differ per region but each is grounded in the same heatmap discipline, surfaced in a single workspace.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Open the heatmap',
        body: 'Pick a metric — inbound volume, response time, resolution time, read rate. The default 30-day hour-by-day grid renders immediately.',
      },
      {
        step: '02',
        title: 'Slice it',
        body: 'Filter by channel, segment, team, agent, label, campaign or language. Every dimension updates in milliseconds without page reloads.',
      },
      {
        step: '03',
        title: 'Compare with a baseline',
        body: 'Overlay last week, last month or same period last year. Divergent colour scale renders the delta so spikes and dips are visible at a glance.',
      },
      {
        step: '04',
        title: 'Drill into a cell',
        body: 'Click a cell to see the underlying conversations, messages and contacts. Jump straight to the inbox or contact view for action.',
      },
      {
        step: '05',
        title: 'Drive a decision',
        body: 'Use the heatmap to set a roster, pick a broadcast launch window, define an SLA or schedule a campaign. The next heatmap update closes the loop.',
      },
    ],

    integrations: ['Slack', 'Google Sheets', 'BigQuery', 'Snowflake', 'Mixpanel', 'Amplitude', 'Looker', 'HubSpot'],

    metrics: [
      { value: '<100ms', label: 'Heatmap render time on standard 30-day grid' },
      { value: '0', label: 'BI tools needed to plan staffing or pacing' },
      { value: '18%', label: 'Average lift on broadcast read rate after window tuning' },
      { value: '2 min', label: 'Time to make a roster decision that used to take a week' },
    ],

    faqs: [
      {
        q: 'How is this different from a regular bar chart of volume by hour?',
        a: 'A bar chart by hour averages across days, hiding the day-of-week pattern. A bar chart by day averages across hours, hiding the time-of-day pattern. A heatmap renders both dimensions simultaneously, which is essential because most operational decisions (staffing, broadcast timing) hinge on the interaction — Thursday at 9pm is not Friday at 9pm and not Thursday at 10am.',
      },
      {
        q: 'What timezone is used?',
        a: 'Depends on the metric. Read-rate heatmaps use the recipient\'s timezone so "best send window for Bengaluru contacts" reflects when they read messages in IST. Staffing heatmaps use the operator\'s timezone so the roster you build matches your shift planning. The platform handles the conversion correctly and the UI shows which timezone is in use.',
      },
      {
        q: 'Can I see heatmaps per agent?',
        a: 'Yes. Agent heatmaps show response time, resolution time and message volume handled by hour and day for each agent. Useful for coaching ("you slow down at 4pm — let us look at why") and capacity planning ("we need a second agent during 7–9pm"). RBAC controls who can see which agents.',
      },
      {
        q: 'How far back can I look?',
        a: 'Default heatmaps cover the last 30 days. You can extend the range to 90 days, 6 months or 1 year. Going further than 1 year is supported via warehouse export — analysts can render multi-year heatmaps in Looker or Tableau against the canonical event store, which contains your full history.',
      },
      {
        q: 'Does this work for very small message volumes?',
        a: 'Yes, with a caveat. Heatmaps at low volume (a few hundred events over 30 days) show noise more than signal — a single hour with two conversations is not a pattern. The platform surfaces a confidence indicator when the cell volume is below a threshold and recommends extending the time range so the pattern stabilises before you make a decision.',
      },
      {
        q: 'Can I export the heatmap?',
        a: 'Yes. Export as PNG for slide decks, CSV for finance review, or raw event export for warehouse modelling. Heatmaps are also embeddable as live links into Confluence, Notion or any dashboard tool that accepts iframes. Tokens for live links are revocable and audited.',
      },
      {
        q: 'How do heatmaps drive the broadcast scheduler?',
        a: 'When you launch a broadcast and pick an audience, the scheduler reads the audience\'s historical read-rate heatmap and suggests a launch window — for example, "send Friday 7pm IST, read rate within 1 hour averages 47 percent for this segment versus 23 percent at 10am". You can accept the suggestion or override it. Either way, the decision is grounded.',
      },
    ],

    related: ['dashboards', 'broadcasts', 'flow-analytics', 'business-hours'],
  },
];
