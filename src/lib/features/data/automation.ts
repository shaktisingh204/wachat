import type { Feature } from '../types';

export const automationFeatures: Feature[] = [
  /* ------------------------------------------------------------------ */
  /* 1. FLOW BUILDER                                                    */
  /* ------------------------------------------------------------------ */
  {
    slug: 'flow-builder',
    name: 'Flow Builder',
    brand: 'SabFlow',
    category: 'automation',
    tagline: 'Drag-and-drop canvas with 42 node types. Triggers → conditions → actions, no code.',
    iconKey: 'workflow',
    color: '#4F46E5',
    tint: '#EEF2FF',

    seoTitle: 'Flow Builder — Visual Automation Canvas | SabNode',
    seoDescription:
      'Drag-and-drop WhatsApp, email and CRM automations. 42 node types, branching, retries, AI steps and live debugger. Ship without writing a line of code.',
    keywords: [
      'whatsapp flow builder',
      'no-code automation canvas',
      'visual workflow builder for crm',
      'drag and drop chatbot builder',
      'whatsapp business api automation',
      'multi-channel marketing automation',
      'conditional logic flow builder',
      'event-driven workflow tool',
      'sabflow automation',
      'whatsapp cloud api flow',
    ],

    hero: {
      eyebrow: 'SabFlow · Automation',
      headline: 'Design every customer journey on one canvas',
      subhead:
        'SabFlow gives your team a visual canvas where triggers, conditions, AI calls and channel actions snap together like Lego. Build a 12-step abandoned-cart recovery, a tax-season nudge, or a multilingual onboarding tree in an afternoon — and watch it run in production with live execution logs.',
      bullets: [
        '42 node types including AI and HTTP',
        'Versioning, rollback and audit trail',
        'Live debugger with step inspector',
        'Reusable sub-flows and templates',
      ],
    },

    problem: {
      title: 'Automation buried in spreadsheets and Zapier sprawl',
      body:
        'Most operators describe their automation stack the same way: a tab in Notion, a folder of Zaps no one owns, two HubSpot workflows that occasionally fire twice, and a WhatsApp bot the agency built last year. When the marketing manager wants to add a single branch — say, send a Hindi template to Tier-2 customers — they file a ticket and wait three weeks.\n\nMeanwhile, the actual logic of the business lives in heads, not systems. New hires re-discover that orders above ₹5,000 should skip the COD reminder. Refunds get a different SLA than complaints, but only the senior agent knows that. Every change risks breaking something silently, because nothing is observable end-to-end.\n\nFlow Builder collapses this. One canvas, one source of truth, one place where a non-developer can read a customer journey from trigger to outcome and confidently change a step without paging engineering.',
    },

    overview: [
      'SabFlow is a graph-based execution engine wrapped in a designer that feels closer to Figma than to Zapier. You start with a trigger — a WhatsApp message, a Shopify webhook, a CRM stage change, a cron — and drag nodes onto the canvas. Send Template, Wait, Branch, HTTP Request, AI Generate, Assign Agent, Update Field, Add Tag, Goto: each node has typed inputs, retry policy and timeout. The runtime serialises every execution to durable storage so a flow that started yesterday can resume after a deploy, a crash, or a 24-hour wait window.',
      'Branching is first-class. A Branch node evaluates JSONPath expressions against the flow context — `{{contact.tags}}`, `{{order.total}}`, `{{lastMessage.intent}}` — and routes execution down the matching path. You can split on geography, plan tier, language preference, last-seen timestamp, or any custom field. Branches nest, loops are explicit (with bounded iteration), and dead-letter paths catch anything unhandled.',
      'Because SabFlow runs inside SabNode, every node has zero-config access to the rest of the platform: send a WhatsApp template using your verified BSP, trigger an email through the same audience filter you built for broadcasts, drop a contact into a Kanban stage, or hand the conversation to a live agent with full context. There is no glue code, no auth juggling, no rate-limit accounting — it is one system speaking to itself.',
      'For technical teams there is an escape hatch on every node. HTTP Request talks to any REST endpoint with retries and exponential backoff. AI Generate calls your tenant-scoped model from AI Studio with tool-calling enabled. Script (sandboxed JavaScript) lets you transform payloads in-place. And the whole graph is exportable as JSON, version-controlled and diffable in pull requests if you want a GitOps workflow.',
    ],

    capabilities: [
      {
        title: '42 typed node types',
        body: 'Send Template, Send Free-form, Wait (relative or absolute), Branch, Switch, Loop, HTTP Request, AI Generate, Assign Agent, Update Contact, Add/Remove Tag, Move Stage, Webhook Out, Script, Subflow. Each has typed inputs, JSON schema validation and inline docs.',
      },
      {
        title: 'Live execution debugger',
        body: 'Replay any historical run step by step. See the exact context object at every node, every API response, every retry attempt and the final outcome. Filter executions by contact, trigger, status or duration to find the one customer who fell through.',
      },
      {
        title: 'Versioning and rollback',
        body: 'Every save creates a numbered version. Diff two versions side-by-side, promote a draft to live with one click, and roll back to any prior version if a deploy goes sideways. In-flight executions continue on the version they started on.',
      },
      {
        title: 'Reusable sub-flows',
        body: 'Extract any cluster of nodes into a Subflow with named inputs and outputs. Use the same KYC verification or refund-eligibility block across ten parent flows. Update the subflow once and every parent picks up the change instantly.',
      },
      {
        title: 'AI Generate node',
        body: 'Drop an AI step anywhere on the canvas. It calls your tenant-scoped LLM in AI Studio with retrieval, tools and guardrails configured per node. Use it to classify intent, summarise a thread, draft a reply or pick the next-best-action.',
      },
      {
        title: 'Retry, timeout and DLQ',
        body: 'Every external call (HTTP, BSP send, AI) has configurable retry windows with exponential backoff and a dead-letter queue. Failed runs surface in an alerts panel with the full stack so ops can replay after the upstream is healthy.',
      },
      {
        title: 'JSONPath context binding',
        body: 'Reference any variable in the flow context using `{{path.to.value}}` syntax. Pipe transforms (upper, lower, date:dd-MM-yyyy, currency:INR) format on the fly. No template engine to learn — it is the same syntax across nodes.',
      },
    ],

    useCases: [
      {
        title: 'Abandoned cart recovery with AI nudges',
        industry: 'E-commerce',
        body: 'Trigger on Shopify checkout.abandoned. Wait 30 minutes, send a WhatsApp template with the cart summary, then a Branch on reply. If the customer asks about size, route to AI Generate with the catalog as context. If silence at hour 4, send a 5% off coupon. Recover 18-22% of carts with three nodes and no agent time.',
      },
      {
        title: 'Multilingual onboarding for fintech',
        industry: 'Financial Services',
        body: 'New KYC submitted → Branch on contact.language. Hindi, Tamil, Telugu and English paths each send the verification template in the right script. Subflow handles document upload via interactive list message. Hand off to an agent only if the AI classifier flags risk. Cuts agent load by 60% in the first month.',
      },
      {
        title: 'Course drip with completion-based gating',
        industry: 'EdTech',
        body: 'Trigger on user.enrolled. Send module-1 link, wait 48 hours, HTTP Request to your LMS to check completion. If incomplete, send a nudge template; if complete, advance to module-2. Loops until course done or 30-day timeout. Replaces a manual cohort manager.',
      },
      {
        title: 'Appointment reminders with reschedule',
        industry: 'Healthcare',
        body: 'Cron trigger 24 hours before appointment pulls today\'s slots from Google Calendar. Sends a confirmation template with reply buttons (Confirm / Reschedule / Cancel). Reschedule branch calls AI Generate to suggest the next three open slots, books on confirmation. Cuts no-shows by a third.',
      },
      {
        title: 'Lead routing for B2B SaaS',
        industry: 'SaaS',
        body: 'Form submission → enrich via Clearbit HTTP node → Branch on company size and region. Enterprise leads get assigned to AE Slack channel with full payload; SMB leads enter a self-serve nurture flow with three templates over seven days. Marketing edits the branch thresholds without filing engineering tickets.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Pick a trigger',
        body: 'Choose from WhatsApp message, webhook, schedule, CRM event, form submit or manual fire. Each trigger exposes its own payload schema you can reference downstream.',
      },
      {
        step: '02',
        title: 'Drag nodes onto the canvas',
        body: 'Connect nodes with arrows. Configure each one with typed inputs. The validator catches missing fields, circular paths and unreachable nodes before you save.',
      },
      {
        step: '03',
        title: 'Test with a real contact',
        body: 'Hit Test, pick yourself or a sandbox contact, and step through the flow. The debugger shows every variable at every node and lets you skip waits in test mode.',
      },
      {
        step: '04',
        title: 'Publish a version',
        body: 'Promote the draft to live. New trigger fires use the latest version; in-flight runs finish on the version they started on. Roll back from history if anything goes wrong.',
      },
      {
        step: '05',
        title: 'Monitor and iterate',
        body: 'Watch the execution list, drop into any run that errored, fix the node, redeploy. Flow Analytics shows funnel drop-off so you know where to optimise next.',
      },
    ],

    integrations: ['Shopify', 'Stripe', 'Razorpay', 'HubSpot', 'Google Sheets', 'Slack', 'Meta WhatsApp Cloud API', 'Zapier'],

    metrics: [
      { value: '42', label: 'node types out of the box' },
      { value: '<300ms', label: 'median node execution latency' },
      { value: '99.95%', label: 'flow runtime availability SLO' },
      { value: '18×', label: 'faster than building flows in code' },
    ],

    faqs: [
      {
        q: 'Do I need a developer to build flows in SabFlow?',
        a: 'No. The canvas is designed for marketing and ops to operate independently. Every node has inline help, typed inputs and validation. For the 5% of cases that need custom logic — like a third-party API or a regex transform — the HTTP Request and Script nodes give technical users an escape hatch, but the other 95% of journeys are pure drag-and-drop.',
      },
      {
        q: 'What happens to a running flow if I edit it?',
        a: 'In-flight executions continue on the version they started on, so a customer halfway through a 48-hour wait will see the original messages. Only new trigger fires use the latest published version. This means you can deploy fixes without worrying about breaking customers who are already in the funnel.',
      },
      {
        q: 'Can flows wait for days or weeks?',
        a: 'Yes. The Wait node supports relative durations (5 minutes, 48 hours, 14 days) or absolute timestamps (next Tuesday at 10am in the contact\'s timezone). State is persisted in MongoDB so flows survive deploys, crashes and version upgrades. We have customers running flows with 90-day wait steps.',
      },
      {
        q: 'How do I debug a flow that misbehaved for one customer?',
        a: 'Open the Executions tab, filter by contact ID or phone number, and click into the run. You see every node that executed, the full context object before and after each step, every external API call with request/response bodies, and the final outcome. If the run errored, the offending node is highlighted with the exception payload.',
      },
      {
        q: 'Can I trigger flows from external systems?',
        a: 'Yes, three ways. (1) A signed webhook URL per flow that accepts any JSON payload. (2) Our REST API endpoint `POST /api/flows/{slug}/run` with bearer auth. (3) Native triggers from Shopify, Razorpay, Stripe, HubSpot and our other listed integrations. The MCP server also exposes flows as callable tools to AI agents.',
      },
      {
        q: 'Is there a limit on flow complexity?',
        a: 'A single flow can have up to 500 nodes and 50 levels of nesting, which is well beyond what any real journey needs. For complex orchestration we recommend breaking logic into Subflows — they keep the parent canvas readable and let multiple flows share the same building block. Loops are bounded to 1000 iterations by default; you can raise this per node.',
      },
      {
        q: 'How does Flow Builder handle WhatsApp template rejections?',
        a: 'Each Send Template node lets you specify a primary template plus up to two fallbacks. If Meta rejects the primary (because of category mismatch or HSM compliance), the node automatically retries with the next fallback. Failed sends land in the DLQ with the rejection reason from the Cloud API so you can fix the template and replay.',
      },
    ],

    related: ['triggers', 'ab-testing', 'ai-studio', 'flow-analytics'],
  },

  /* ------------------------------------------------------------------ */
  /* 2. CHATBOT RULES                                                   */
  /* ------------------------------------------------------------------ */
  {
    slug: 'chatbot-rules',
    name: 'Chatbot Rules',
    brand: 'Wachat',
    category: 'automation',
    tagline: 'Keyword-triggered replies with contains, exact and regex matching.',
    iconKey: 'bot',
    color: '#EC4899',
    tint: '#FCE7F3',

    seoTitle: 'Chatbot Rules — Keyword Auto-Replies | SabNode',
    seoDescription:
      'Pattern-matching auto-replies for WhatsApp, Instagram and web chat. Exact, contains, regex and priority routing. Deflect 40-60% of inbound without an LLM.',
    keywords: [
      'whatsapp keyword auto reply',
      'rule based chatbot builder',
      'regex chatbot whatsapp',
      'instagram dm auto responder',
      'no-code chatbot rules',
      'pattern matching chatbot',
      'wachat keyword bot',
      'business hours auto reply',
      'whatsapp menu bot',
      'auto-reply with buttons whatsapp',
    ],

    hero: {
      eyebrow: 'Wachat · Automation',
      headline: 'Catch the 50% of questions you already know',
      subhead:
        'Half the messages your team answers are the same five questions: pricing, hours, shipping, refund status, where is my order. Chatbot Rules turns those into instant, branded replies with buttons and lists — before a human ever sees the conversation. No model training, no hallucinations, no surprises.',
      bullets: [
        'Exact, contains and regex matching modes',
        'Priority ordering with first-match-wins',
        'Reply with template, button or list message',
        'Per-channel and per-time-window scoping',
      ],
    },

    problem: {
      title: 'AI is overkill for "what are your hours?"',
      body:
        'When teams adopt conversational AI, the instinct is to throw an LLM at every message. But the math rarely works for the long tail of trivial questions. A single GPT-4 call to answer "what time do you close" costs more than the entire ticket margin, takes 800ms, and occasionally hallucinates a closing time that was never in your knowledge base. The right answer here is a rule: if the message matches /hour|time|open|close|timing/i, reply with the canned hours block.\n\nThe second problem is observability. Rule-based bots from the 2010s lived in a black box — you had no idea which rules fired, which were dormant, or whether a typo in your regex was silently routing 8% of users into the wrong branch. Teams gave up on rules because they could not trust them.\n\nChatbot Rules in SabNode addresses both. Rules are fast (sub-50ms match), cheap (no model cost), and instrumented end-to-end. Every match is logged with the input, the rule, and the reply sent. You see exactly what is firing and tune accordingly.',
    },

    overview: [
      'Chatbot Rules is a deterministic pattern-matching layer that sits in front of every inbound message across WhatsApp, Instagram, Web Chat and Email. You define rules with three matching modes — Exact (case-insensitive equality), Contains (substring), and Regex (full PCRE) — and a reply action. When a message arrives, the engine evaluates rules in priority order and fires the first match. If nothing matches, the message falls through to your flow, your AI agent, or the shared inbox queue.',
      'Each rule is more than a keyword. It can be scoped by channel (only WhatsApp), by time window (only outside business hours), by language (only Hindi messages), or by contact segment (only new contacts in the last 7 days). This means a single rule library serves your entire surface area without leaking across contexts — your "pricing" rule for Indian visitors shows INR, your "pricing" rule for international shows USD.',
      'Replies are not limited to text. A rule can fire a WhatsApp template (with header media), an interactive button message (up to three quick replies), an interactive list message (up to ten options), or a free-form message inside the 24-hour service window. On Instagram, the same rule sends a DM with quick-reply buttons. On Web Chat, it renders rich cards. One rule definition, multi-channel output — that is the point.',
      'The whole layer is observable. Every rule has a hit counter, a 7-day trend, and a debug feed showing the last 20 messages it matched. Rules that never fire surface in a "stale" panel so you can clean up cruft. Conflicts (two rules with overlapping patterns) are flagged at save time. And every match emits an event you can wire into Flow Analytics to measure deflection by rule.',
    ],

    capabilities: [
      {
        title: 'Three matching modes',
        body: 'Exact for menu-style flows ("MENU", "STOP"). Contains for fuzzy intents ("how much" matches "how much does it cost"). Regex for power users — /\\b(refund|return)\\b/i with full PCRE support including named capture groups you can reference in the reply.',
      },
      {
        title: 'Priority and first-match-wins',
        body: 'Rules execute in numeric priority order. A rule at priority 10 always evaluates before priority 50. First match short-circuits the rest. This makes conflict resolution deterministic — no more "why did the wrong reply fire" debugging sessions.',
      },
      {
        title: 'Scoped rule libraries',
        body: 'Scope by channel, language, contact tag, business hours, or segment. A "shipping" rule can have one version for B2B contacts and another for D2C, with no overlap. Scope rules surface as filters in the rule list so navigation stays sane.',
      },
      {
        title: 'Interactive button replies',
        body: 'Reply with up to three quick-reply buttons or a list with ten options. Button clicks become structured events that trigger downstream flows. This is the cheapest way to build a guided menu without paying for an LLM at every step.',
      },
      {
        title: 'Variable interpolation',
        body: 'Reference contact attributes, regex capture groups, business hours and current time in the reply. `Hi {{contact.first_name}}, your order {{match.1}} ships tomorrow.` Variables fall back to safe defaults if missing — no broken templates on empty fields.',
      },
      {
        title: 'Hit analytics and stale detection',
        body: 'Every rule shows hit count, last-fired timestamp, and a 7-day sparkline. Rules with zero hits in 30 days are flagged. You can A/B test two replies for the same rule with a 50/50 split and pick the one that drives fewer follow-up messages.',
      },
      {
        title: 'Escalation handoff',
        body: 'Any rule can include an "escalate after N replies" condition. If the same contact triggers the same rule three times in five minutes, the bot stops, drops a note in the inbox, and assigns the conversation to a human agent. Saves customers from rule loops.',
      },
    ],

    useCases: [
      {
        title: 'Out-of-hours auto-reply with ETA',
        industry: 'E-commerce',
        body: 'Single rule scoped to outside business hours, contains mode on "*", priority 99 (fallback). Replies with a template containing the next-open-time variable and a button to leave a callback request. Captures intent overnight without making it feel automated.',
      },
      {
        title: 'Refund status quick-look',
        industry: 'D2C',
        body: 'Regex /refund.*\\b([A-Z]{2}\\d{6})\\b/i matches "refund for order IN123456". Captures the order ID, fires an HTTP request to the OMS, replies with the live status. Three-rule library handles 80% of inbound refund queries without an agent.',
      },
      {
        title: 'Course menu for institute',
        industry: 'EdTech',
        body: 'Exact match on "COURSES" fires an interactive list with six course categories. Each list option triggers a downstream rule that sends syllabus PDF and a fee structure. Replaces a five-page web form. Adoption jumps because students stay inside WhatsApp.',
      },
      {
        title: 'Branch locator for clinic chain',
        industry: 'Healthcare',
        body: 'Contains match on city names from a 240-entry list. Reply with branch address, hours, phone number and a Google Maps link. Adding a new branch is a single row in the rule list — no flow edit, no deploy.',
      },
      {
        title: 'Stop / unsubscribe compliance',
        industry: 'Financial Services',
        body: 'Highest priority rule (priority 1) matches /^(stop|unsubscribe|opt.?out)$/i in any case. Sets opt-in-status to false, sends a confirmation, and excludes the contact from future broadcasts. Audit-logged for DLT and consent compliance.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Create a rule',
        body: 'Pick a matching mode, write the pattern, draft the reply. The editor previews matches against a sample message so you know what fires before saving.',
      },
      {
        step: '02',
        title: 'Set scope and priority',
        body: 'Restrict to a channel, language, segment or time window. Drag to reorder priority. Conflicts with existing rules are flagged in line.',
      },
      {
        step: '03',
        title: 'Publish and observe',
        body: 'The rule goes live across all matching channels instantly. The hit counter starts ticking. The debug feed shows the next twenty messages it matched.',
      },
      {
        step: '04',
        title: 'Iterate or escalate',
        body: 'Refine patterns based on misses. Add escalation if the rule keeps firing for the same contact. Promote high-hit rules into a full Flow if the journey grows.',
      },
      {
        step: '05',
        title: 'Measure deflection',
        body: 'Flow Analytics rolls up rule hits per channel per day. Compare against shared-inbox volume to quantify the human-hours saved.',
      },
    ],

    integrations: ['Meta WhatsApp Cloud API', 'Instagram Graph API', 'Gmail', 'Outlook', 'Web Chat Widget', 'Shopify', 'HubSpot', 'Slack'],

    metrics: [
      { value: '<50ms', label: 'p99 rule match latency per message' },
      { value: '52%', label: 'inbound deflected by rules alone on average' },
      { value: '0', label: 'LLM cost per rule-handled message' },
      { value: '240+', label: 'rules per tenant on the median plan' },
    ],

    faqs: [
      {
        q: 'When should I use a rule versus an AI agent?',
        a: 'Use a rule when the question is closed-ended and the answer is fixed: hours, refund policy, branch list, menu navigation. Use AI when the question is open-ended or needs reasoning over your knowledge base: "does this product work with my existing setup". Rules are faster, cheaper and never hallucinate. AI is more flexible but costs money per call. Most teams end up with 60-80% rules, 20-40% AI.',
      },
      {
        q: 'Can a rule fire a flow instead of replying directly?',
        a: 'Yes. The reply action has three modes: send a message directly, hand off to the shared inbox, or trigger a SabFlow with the captured payload. This lets rules act as cheap intent classifiers — the regex catches the intent, the flow does the heavy lifting. You can also chain rules: the first rule sends a button, the button click matches a downstream rule.',
      },
      {
        q: 'How are regex rules sandboxed?',
        a: 'Every regex is compiled with a 50ms execution timeout and a 10,000-step backtrack limit. Catastrophic patterns (like nested quantifiers) are detected at save time and rejected with a hint. This means a rogue regex cannot stall the message pipeline or DoS your inbound queue.',
      },
      {
        q: 'Do rules respect the WhatsApp 24-hour service window?',
        a: 'Yes. Inside the 24-hour window, rules send free-form messages (cheap, fast). Outside the window, the rule engine automatically degrades to a Send Template action using the template you specified as fallback. If no fallback template is set, the rule logs a "service window expired" event and the conversation routes to the inbox.',
      },
      {
        q: 'Can I bulk import rules from a spreadsheet?',
        a: 'Yes. The rule list has a CSV import with columns for pattern, mode, reply, channel, priority and scope. We use this regularly to migrate teams from Freshchat, Zoko, Interakt and other rule-based bots. The importer validates each row and reports collisions before committing.',
      },
      {
        q: 'How do scoped rules interact with global rules?',
        a: 'Scope narrows the rule\'s applicability — a rule scoped to "Hindi contacts" only evaluates for contacts where language is Hindi. Within the evaluation set, priority order applies normally. This means a global priority-10 rule still beats a scoped priority-50 rule for English contacts, but for Hindi contacts both compete and priority decides.',
      },
      {
        q: 'Is there a limit on the number of rules?',
        a: 'No hard cap. We have tenants running 2,000+ rules across 14 channels with sub-50ms p99 match latency. The engine indexes rules by channel and scope on save, so adding a rule does not slow down the existing ones. Practical advice: above 200 rules, group them with tags and use the search bar to navigate.',
      },
    ],

    related: ['flow-builder', 'ai-studio', 'business-hours', 'canned-replies'],
  },

  /* ------------------------------------------------------------------ */
  /* 3. AI STUDIO                                                       */
  /* ------------------------------------------------------------------ */
  {
    slug: 'ai-studio',
    name: 'AI Studio',
    brand: 'Private LLM',
    category: 'automation',
    tagline: 'Tenant-scoped LLM with tools, retrieval and guardrails. Deploy anywhere.',
    iconKey: 'brain',
    color: '#7C3AED',
    tint: '#EDE9FE',

    seoTitle: 'AI Studio — Private LLM with Tools & RAG | SabNode',
    seoDescription:
      'Tenant-scoped AI agents with RAG, tool-calling, MCP and guardrails. Run on GPT, Claude, Gemini or Llama. Ship a production assistant in days, not quarters.',
    keywords: [
      'private llm for business',
      'rag chatbot platform',
      'tool calling ai agent',
      'tenant scoped llm whatsapp',
      'mcp server ai integration',
      'gemini whatsapp bot',
      'claude business assistant',
      'whatsapp ai agent platform',
      'enterprise ai studio',
      'no-code llm builder',
      'function calling chatbot',
      'vector embeddings rag tool',
    ],

    hero: {
      eyebrow: 'AI Studio · Private LLM',
      headline: 'Ship an AI agent that actually knows your business',
      subhead:
        'AI Studio is where you compose your model, knowledge, tools and guardrails into a production-grade assistant. Bring your own provider — OpenAI, Anthropic, Google, Mistral, or open-weight Llama on your GPUs — wire in retrieval over your docs, expose your existing APIs as tools, and deploy to WhatsApp, web chat, email or MCP clients in minutes.',
      bullets: [
        'BYO model: GPT, Claude, Gemini, Llama',
        'RAG with vector embeddings out of the box',
        'Tool-calling and MCP server included',
        'Per-tenant guardrails, PII redaction, audit log',
      ],
    },

    problem: {
      title: 'Generic chatbots, custom-built copilots, and the gap between',
      body:
        'There are two ways to ship AI in production today, and both are broken. Option one is a vendor chatbot that answers FAQs from a scraped sitemap — it cannot place an order, check a balance, or modify a subscription. It is a glorified search box. Option two is a six-month internal build where engineering wraps OpenAI, writes the embedding pipeline, builds a tool layer, adds rate limiting, builds an evaluation harness, and ships an MVP just as the model landscape shifts.\n\nThe gap is where most operators live. They need an agent that knows their catalog, their pricing rules, their refund policy, and can actually act on those — issue a refund, escalate a ticket, book a slot — not just chat about them. They need this in weeks, not quarters. They need it auditable, multi-tenant, swappable across providers, and cheap to evaluate.\n\nAI Studio is built for that gap. Pick a model, point at your knowledge sources, declare your tools, set your guardrails, and you have a deployable agent. Swap the model next quarter without rewriting your tools. Switch providers without re-embedding your docs. Ship the same agent to WhatsApp, web chat and your internal Slack with one config.',
    },

    overview: [
      'AI Studio is a composition surface for production AI agents. The unit is an Assistant: a configured combination of model, system prompt, knowledge sources, tools, and guardrails. You can have many assistants per tenant — a sales agent, a support agent, an internal HR bot — each with its own scope and personality. Each assistant is versioned, evaluated, and deployable to any channel through SabFlow nodes or our API.',
      'Retrieval is first-class. Connect a knowledge source (PDF folder, Notion workspace, Google Drive, public website, custom database query) and AI Studio handles chunking, embedding (using your provider or our local model), vector storage, and re-ranking. Every assistant response includes citation links back to the source chunks, and you can see retrieval quality in the eval harness. Updating a doc re-embeds only the changed chunks — incremental, fast, cheap.',
      'Tool-calling turns the assistant from a talker into a doer. Declare a tool — `get_order_status`, `issue_refund`, `book_slot` — with a JSON schema and a backing handler (HTTP endpoint, SabFlow, or built-in CRM action). The model decides when to call the tool based on the conversation. You see every tool call in the trace, can require human approval for sensitive operations, and rate-limit per assistant or per contact. The MCP server exposes these same tools to external AI clients (Claude Desktop, Cursor, etc.) over the Model Context Protocol.',
      'Safety and observability are non-negotiable. Every assistant ships with configurable guardrails: PII redaction on inputs (Aadhaar, PAN, credit cards, emails), output filters (no medical advice, no financial recommendations), refusal policies, and token budgets per conversation. The audit log captures every prompt, every tool call, every response — exportable for compliance review. For India deployments we honor DPDP requirements; for EU, GDPR; for healthcare, basic HIPAA-aligned redaction.',
    ],

    capabilities: [
      {
        title: 'BYO model with provider abstraction',
        body: 'Switch between OpenAI (GPT-4, GPT-4o), Anthropic (Claude Sonnet, Opus, Haiku), Google (Gemini Pro, Flash), Mistral, Cohere, or self-hosted Llama / Qwen / DeepSeek behind a unified interface. Same prompt, same tools, different backend. Swap providers per assistant or A/B test two side by side.',
      },
      {
        title: 'Retrieval Augmented Generation',
        body: 'Ingest PDFs, web pages, Notion, Google Drive, S3, GitHub wikis, or a SQL query result. We handle chunking (token-aware, semantic), embedding, vector storage and re-ranking. Every response cites the chunks it drew from. Re-index incrementally as sources change.',
      },
      {
        title: 'Tool-calling and function execution',
        body: 'Declare tools with JSON schema. Backing handler can be an HTTP endpoint, a SabFlow, or a built-in CRM action (create_lead, move_stage, add_tag). The model decides when to call. Required-approval mode pauses execution for human sign-off on sensitive tools.',
      },
      {
        title: 'MCP server included',
        body: 'Every assistant is automatically exposed as an MCP server endpoint. Connect Claude Desktop, Cursor, Zed or any MCP client and the tools you defined for WhatsApp work in your IDE. One source of truth for AI actions across customer and team-facing surfaces.',
      },
      {
        title: 'Evaluation harness',
        body: 'Upload a CSV of (input, expected_output) pairs or curate from real conversations. Run an eval against any model and prompt combination. See win-rate, latency, cost and failure modes side-by-side. Block deploys that regress eval scores below the threshold.',
      },
      {
        title: 'Guardrails and PII redaction',
        body: 'Input filters strip Aadhaar, PAN, GST numbers, credit cards, IBAN, US SSN, emails and phone numbers before they reach the model. Output filters block policy violations. Token budgets cap runaway conversations. All configurable per assistant.',
      },
      {
        title: 'Audit log and trace replay',
        body: 'Every assistant invocation captures the full trace: input message, retrieved chunks, system prompt, model response, tool calls, final output, latency, cost. Export for compliance, replay for debugging, or pipe into your observability stack via webhook.',
      },
    ],

    useCases: [
      {
        title: 'D2C product assistant on WhatsApp',
        industry: 'D2C',
        body: 'Assistant indexes the product catalog, ingredient docs and review summaries. Tools include `find_products`, `check_stock`, `add_to_cart`. A customer asks "which face wash for oily skin under ₹500" and the agent searches, filters, and replies with three options and add-to-cart buttons. Conversion lifts 2-3× over static catalog browsing.',
      },
      {
        title: 'Internal HR bot for mid-market SaaS',
        industry: 'SaaS',
        body: 'Indexed on policy docs, leave calendar API and payroll system. Tools include `request_leave`, `download_payslip`, `check_balance`. Deployed to Slack and the company intranet. Cuts HR ticket volume by 70% and gives the policy team a metric for where docs are unclear.',
      },
      {
        title: 'Loan officer copilot for NBFC',
        industry: 'Financial Services',
        body: 'Agent ingests product factsheets and regulatory rules. Tools include `pull_credit_report`, `calculate_emi`, `start_application`. PII redaction strips Aadhaar before logging. Required-approval mode forces human sign-off on `start_application`. Trace export feeds RBI audit reports.',
      },
      {
        title: 'University admissions counsellor',
        industry: 'Education',
        body: 'Assistant indexes course catalogs, fee structures, and admission timelines in five languages. Tools include `book_campus_visit`, `request_brochure`, `connect_counsellor`. Deployed on WhatsApp and the .edu site. Handles 12,000 monthly applicants with two human counsellors on standby.',
      },
      {
        title: 'Logistics support agent',
        industry: 'Logistics',
        body: 'Knowledge sources include the shipment SOP wiki and the tracking API. Tools include `track_shipment`, `raise_dispute`, `request_redelivery`. Deflects 80% of "where is my package" tickets while preserving the option for hand-off to a human for genuinely stuck shipments.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Pick a model and configure',
        body: 'Choose your provider, paste an API key (or use SabNode-managed credits), set temperature, max tokens, and the system prompt. Start with a template — sales, support, internal — and customise.',
      },
      {
        step: '02',
        title: 'Ingest knowledge sources',
        body: 'Connect Drive, Notion, S3, a website, or upload PDFs. AI Studio chunks, embeds and stores vectors. Initial ingestion runs in the background and surfaces progress per source.',
      },
      {
        step: '03',
        title: 'Declare tools and guardrails',
        body: 'Add tools with JSON schema and backing handler. Toggle guardrails: PII redaction, output filters, token budgets, refusal patterns. Mark sensitive tools as approval-required.',
      },
      {
        step: '04',
        title: 'Evaluate before shipping',
        body: 'Run the eval harness against a curated set. See win-rate, cost and latency. Iterate on prompt, model or tools until the assistant clears your threshold.',
      },
      {
        step: '05',
        title: 'Deploy to channels',
        body: 'Drop an AI Generate node in a SabFlow, expose the MCP endpoint, or call the assistant API directly. Same assistant, multiple surfaces — WhatsApp, Web Chat, Slack, IDE.',
      },
    ],

    integrations: ['OpenAI', 'Anthropic', 'Google Gemini', 'Mistral', 'Meta Llama', 'Pinecone', 'Notion', 'Google Drive'],

    metrics: [
      { value: '5×', label: 'cheaper than building RAG in-house' },
      { value: '<800ms', label: 'p50 first-token latency on Gemini Flash' },
      { value: '94%', label: 'eval accuracy on retrieval-grounded answers' },
      { value: '0', label: 'data leaves your tenant boundary' },
    ],

    faqs: [
      {
        q: 'How do I choose between GPT, Claude, Gemini and Llama?',
        a: 'The eval harness is the answer. Upload 50-200 representative (input, expected) pairs from your real conversations and run the same prompt against four models. Compare win-rate, p50 latency and cost-per-thousand. For Indian-language support, Gemini Flash and GPT-4o-mini tend to lead on price-performance. For complex reasoning, Claude Sonnet often wins. For air-gapped on-prem, Llama 3.3 or Qwen 2.5 on your GPUs.',
      },
      {
        q: 'Does my data train the model?',
        a: 'No. We send requests to providers with their no-training flags enabled (OpenAI zero-retention, Anthropic no-train, Gemini Vertex). For maximum control, deploy an open-weight model on your own infrastructure and AI Studio talks to it over a private endpoint. The audit log gives you provable evidence of every byte sent.',
      },
      {
        q: 'How does MCP integration work?',
        a: 'Every assistant exposes an MCP endpoint at `mcp.sabnode.com/{tenant}/{assistant}`. Add it to Claude Desktop, Cursor, Zed or any MCP-compatible client with one config line and bearer auth. The tools you defined become callable from the IDE — your engineers can query CRM data, trigger flows or check shipment status from inside their editor with the same auth and audit trail.',
      },
      {
        q: 'What happens when a tool call fails?',
        a: 'Three configurable behaviors. (1) Retry with backoff up to N times. (2) Return the error to the model so it can recover gracefully (recommended for non-critical tools). (3) Stop and hand off to a human agent in the inbox with the partial conversation. You set this per tool. Failed calls land in the trace log with the full request and response for debugging.',
      },
      {
        q: 'Can I prevent the agent from giving medical or financial advice?',
        a: 'Yes, through three layers. (1) System prompt instructions — "you are not a doctor, refer to a professional". (2) Output filter rules that match phrases and refuse or redact. (3) An optional moderation step where the response runs through a second model that classifies and approves. For regulated industries we recommend all three plus required-approval on any tool that triggers a transaction.',
      },
      {
        q: 'How are RAG sources kept fresh?',
        a: 'Each source has an ingestion schedule — manual, hourly, daily, or webhook-triggered. Incremental ingestion detects changed docs by hash and only re-embeds delta chunks, so a 10,000-page knowledge base updates in minutes when one page changes. Failed ingestions raise alerts. For real-time data (live inventory, shipment status), use a tool call instead of RAG.',
      },
      {
        q: 'What does it cost to run an AI Studio agent at scale?',
        a: 'Three components: model inference (passed through at provider rates plus a small uplift), embeddings (one-time per chunk, then on updates), and vector storage (included up to 10M vectors on Pro plans). For a typical D2C tenant doing 30,000 AI conversations per month on Gemini Flash with RAG, costs land between ₹8,000 and ₹15,000. The eval harness lets you forecast before scaling.',
      },
    ],

    related: ['flow-builder', 'chatbot-rules', 'mcp-server', 'rest-api'],
  },

  /* ------------------------------------------------------------------ */
  /* 4. TRIGGERS                                                        */
  /* ------------------------------------------------------------------ */
  {
    slug: 'triggers',
    name: 'Triggers',
    brand: 'SabFlow',
    category: 'automation',
    tagline: 'Fire a flow on order paid, message received, webhook call or schedule.',
    iconKey: 'zap',
    color: '#F59E0B',
    tint: '#FEF3C7',

    seoTitle: 'Triggers — Event-Driven Automation Sources | SabNode',
    seoDescription:
      'Fire SabFlow from WhatsApp messages, webhooks, Shopify events, CRM stage changes, cron schedules or REST calls. 30+ native trigger types, all observable.',
    keywords: [
      'workflow trigger automation',
      'webhook trigger flow builder',
      'shopify event automation',
      'whatsapp message trigger',
      'cron scheduled automation',
      'crm stage change trigger',
      'event driven workflow',
      'razorpay payment trigger',
      'sabflow trigger types',
      'automation entry points',
    ],

    hero: {
      eyebrow: 'SabFlow · Automation',
      headline: 'Every automation needs a start. We have 30 of them.',
      subhead:
        'Triggers are the entry point to any flow. SabFlow ships with 30+ native trigger types — message received, order paid, contact created, segment entered, cron schedule, signed webhook — plus a generic HTTP trigger for anything custom. Same observability, same retry policy, regardless of how the flow started.',
      bullets: [
        '30+ native triggers across channels and systems',
        'Signed webhook URLs with HMAC verification',
        'Cron syntax with timezone awareness',
        'Replay any trigger event from the inspector',
      ],
    },

    problem: {
      title: 'The trigger is where automation projects die',
      body:
        'Ask any team that has tried to ship a sophisticated automation and they will tell you the same story: the trigger broke. Shopify changed a webhook schema and abandoned-cart stopped firing. The cron job ran in UTC but the business operates in IST so Diwali greetings landed at 4:30am. A retry loop hammered the API and got the account rate-limited. A test webhook from a developer\'s laptop fired in production and sent 2,000 customers a duplicate offer.\n\nThese failures share a root cause: most platforms treat triggers as an afterthought. You pick from a dropdown, paste a URL, and hope. There is no replay, no schema validation, no visibility into what actually fired versus what should have. When something breaks, you discover it from a customer complaint three days later.\n\nSabFlow treats triggers as a first-class observable surface. Every incoming trigger event is captured, validated, logged and replayable. Failed triggers do not vanish — they land in a dead-letter view with the full payload, retry button, and the exception trace. Timezone is always explicit. Webhook signatures are mandatory for the integrations that support them. The trigger is the front door of your automation — we treat it like one.',
    },

    overview: [
      'SabFlow triggers fall into five categories: channel events (message received, message read, button clicked on WhatsApp, Instagram, Web Chat, Email), commerce events (Shopify order paid, Stripe payment succeeded, Razorpay refund initiated, catalog item updated), CRM events (contact created, segment entered, tag added, deal stage changed, custom field updated), schedules (one-off datetime, cron expression, recurring relative — "every Tuesday at 9am IST"), and integrations (signed webhook URL, REST API call, third-party native triggers from HubSpot, Pipedrive, Calendly, Google Sheets, etc.).',
      'Every trigger emits a typed payload that downstream nodes can reference via JSONPath. A Shopify order trigger gives you `{{trigger.order.id}}`, `{{trigger.order.line_items}}`, `{{trigger.customer.email}}` — full Shopify schema, validated on entry. A WhatsApp message trigger exposes `{{trigger.message.text}}`, `{{trigger.contact.phone}}`, `{{trigger.message.type}}` (text, image, document, button, list). This typing prevents the classic "I thought that field existed" bug at design time.',
      'Multiple triggers on one flow are supported and common. A "VIP customer onboarding" flow might trigger on (a) a Shopify customer with lifetime spend > ₹50,000, (b) a manual tag added via the CRM, or (c) a webhook from your loyalty program. All three paths converge into the same flow with the same downstream logic — you maintain the journey once, accept input from many sources.',
      'For technical teams, the generic Webhook trigger is the universal escape hatch. We give you a signed URL with HMAC-SHA256 signature verification, a JSON schema you can declare, and a payload validator that rejects malformed input at the door. The schema is enforced at runtime so a breaking change in your upstream system surfaces immediately as failed-validation events, not as a flow running on garbage data.',
    ],

    capabilities: [
      {
        title: 'Channel message triggers',
        body: 'Fire on inbound WhatsApp message, Instagram DM, Web Chat opened, Email received. Filter by message type (text, image, document, button payload, list selection), by keyword, by contact segment, or by the channel-specific metadata like template name or campaign ID.',
      },
      {
        title: 'Commerce native triggers',
        body: 'First-class support for Shopify (order paid, abandoned checkout, refund, product update), Stripe (payment succeeded, subscription renewed, invoice failed), Razorpay (payment captured, refund processed), WooCommerce and Magento. Schema-validated, retry-safe, idempotent.',
      },
      {
        title: 'CRM event triggers',
        body: 'Contact created, contact updated (per field), segment entered or exited, tag added or removed, deal stage moved, custom field changed. Dynamic segments emit enter/exit events as the segment definition matches new data — no manual polling.',
      },
      {
        title: 'Scheduled triggers',
        body: 'One-off (fire at 2024-12-31 17:00 IST), recurring cron (`0 9 * * MON-FRI`), relative recurring ("every 6 hours starting tomorrow"). All schedules honor a configurable timezone, including per-contact timezone for personalised sends.',
      },
      {
        title: 'Signed webhook triggers',
        body: 'Each webhook trigger gets a unique URL with HMAC-SHA256 signing. The upstream signs the payload with a shared secret; SabFlow verifies before firing. Declare a JSON schema and malformed requests are rejected with a 400 before they touch the flow.',
      },
      {
        title: 'Dead-letter queue and replay',
        body: 'Failed triggers — validation failure, downstream node error, rate limit — land in the DLQ with the full payload, the exception, and the retry button. Replay one event or a batch. Audit log shows who replayed what.',
      },
      {
        title: 'Idempotency keys',
        body: 'Every trigger event carries an idempotency key derived from the source. Duplicate Shopify webhooks (which happen) do not double-fire the flow. Custom webhooks can pass an `Idempotency-Key` header that SabFlow honors across a configurable dedup window.',
      },
    ],

    useCases: [
      {
        title: 'Order-paid → thank-you template',
        industry: 'E-commerce',
        body: 'Trigger on Shopify order.paid. Filter for orders above ₹1,000 to skip low-value sends. Fire a WhatsApp template with order summary and tracking link. Idempotent against duplicate webhooks. Replays available for the rare missed event.',
      },
      {
        title: 'Cron daily standup pull',
        industry: 'SaaS',
        body: 'Cron trigger at 9am IST weekdays. HTTP Request to GitHub for yesterday\'s PRs, AI Generate node summarises into a standup post, Send to Slack channel. Replaces a 15-minute manual ritual. Skips weekends and holidays via a custom calendar.',
      },
      {
        title: 'Segment-entered → re-engagement',
        industry: 'D2C',
        body: 'Dynamic segment "last purchase > 90 days ago and total spend > ₹5,000" fires segment-entered trigger. Sends a personalised WhatsApp template with a curated set of products via AI Generate. Recovers churning customers without manual list-pulling.',
      },
      {
        title: 'Webhook trigger from custom ERP',
        industry: 'Logistics',
        body: 'Internal ERP fires a signed webhook on shipment-out-for-delivery. JSON schema declared with `tracking_id`, `eta`, `customer_phone`. SabFlow validates, looks up the contact, sends WhatsApp with live tracking. End-to-end latency under two seconds.',
      },
      {
        title: 'Stage-change → onboarding handoff',
        industry: 'SaaS',
        body: 'Trigger on CRM deal stage moving to "Won". Creates the customer record, assigns onboarding manager via Slack, triggers a 30-day onboarding flow. Single trigger replaces a five-person handoff that used to rely on Slack DMs and prayer.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Pick the trigger source',
        body: 'Choose from channels, commerce, CRM, schedule or custom webhook. The selector previews the payload shape so you know what fields the downstream flow can use.',
      },
      {
        step: '02',
        title: 'Configure filters',
        body: 'Narrow firing conditions — only orders above ₹1,000, only contacts in segment X, only on weekdays. Filters run before the flow starts, saving execution cost.',
      },
      {
        step: '03',
        title: 'Validate the payload schema',
        body: 'For webhook triggers, paste a sample payload and declare a JSON schema. Future events failing the schema are rejected with a 400 instead of poisoning the flow.',
      },
      {
        step: '04',
        title: 'Test with a fired event',
        body: 'Hit Send Test from the trigger config. A synthetic event runs through the flow in debug mode. Or replay any historical event from the trigger log.',
      },
      {
        step: '05',
        title: 'Monitor the trigger log',
        body: 'Every fire, success or fail, lands in the trigger log with payload, latency and downstream result. Filter by status, replay the failures, set up alerts on DLQ depth.',
      },
    ],

    integrations: ['Shopify', 'Stripe', 'Razorpay', 'HubSpot', 'Pipedrive', 'Calendly', 'Google Sheets', 'Meta WhatsApp Cloud API'],

    metrics: [
      { value: '30+', label: 'native trigger types out of the box' },
      { value: '<2s', label: 'p95 trigger-to-flow-start latency' },
      { value: '100%', label: 'replay coverage on failed events' },
      { value: '99.99%', label: 'webhook ingestion availability SLO' },
    ],

    faqs: [
      {
        q: 'What happens if Shopify retries a webhook?',
        a: 'SabFlow uses the `X-Shopify-Webhook-Id` header as an idempotency key with a 24-hour dedup window. The first delivery fires the flow; subsequent retries within the window log the duplicate and skip execution. This matches Shopify\'s own at-least-once delivery semantic without doubling up customer messages — a common source of complaints with naive integrations.',
      },
      {
        q: 'How are timezone-sensitive cron schedules handled?',
        a: 'Every cron trigger has an explicit timezone configured (IANA, e.g. Asia/Kolkata). The scheduler computes fire times in that zone and accounts for DST changes automatically. For per-contact personalisation, the Wait node in the flow can pause until the contact\'s local 9am, which uses the contact\'s timezone field. Diwali at 4:30am no longer happens.',
      },
      {
        q: 'Can I have multiple triggers on one flow?',
        a: 'Yes. A flow can declare any number of triggers, of any mix of types. All triggers funnel into the same Trigger node at the top of the canvas with a discriminator on `trigger.source`. Downstream branches can switch on the source if needed, or treat them uniformly. This is the pattern for "any of these three things happens → run the same onboarding".',
      },
      {
        q: 'How do I verify webhook signatures?',
        a: 'Every webhook trigger has a per-trigger secret. The upstream signs the raw body with HMAC-SHA256 using that secret and sends it in the `X-SabNode-Signature` header. SabFlow verifies before parsing JSON; failures return 401 and never reach the flow. For Shopify, Stripe, Razorpay and other native integrations, we handle signature verification with each platform\'s own scheme automatically.',
      },
      {
        q: 'What is the throughput limit for triggers?',
        a: 'The platform sustains 5,000 trigger events per second per tenant on the standard plan and 50,000 per second on enterprise. Bursts above the limit queue with elastic backoff rather than dropping. If you expect a high-volume burst (e.g. campaign-driven traffic), let us know and we will pre-scale your tenant\'s ingestion fleet.',
      },
      {
        q: 'Can a flow trigger another flow?',
        a: 'Yes, three ways. (1) The Subflow node inlines another flow with named inputs and outputs — the called flow runs in the parent\'s context. (2) The Trigger Flow node fires another flow asynchronously and continues. (3) Webhook Out node calls the target flow\'s webhook URL. Use Subflow for synchronous logic reuse, Trigger Flow for fire-and-forget, Webhook Out for cross-tenant or external systems.',
      },
      {
        q: 'How long are trigger events retained?',
        a: '90 days of full payload retention on standard plans, 13 months on enterprise. After that, the event metadata (timestamp, status, duration) stays for analytics but the payload is purged. You can extend retention or set up automatic export to your S3 bucket via the export integration if you need longer-term audit.',
      },
    ],

    related: ['flow-builder', 'webhooks', 'scheduler', 'rest-api'],
  },

  /* ------------------------------------------------------------------ */
  /* 5. A/B TESTING                                                     */
  /* ------------------------------------------------------------------ */
  {
    slug: 'ab-testing',
    name: 'A/B Testing',
    brand: 'SabFlow',
    category: 'automation',
    tagline: 'Split traffic across flow variants. Pick the winner automatically.',
    iconKey: 'gitBranch',
    color: '#8B5CF6',
    tint: '#F3E8FF',

    seoTitle: 'A/B Testing — Experiment Across Flows & Templates | SabNode',
    seoDescription:
      'Split traffic across flow variants, message templates and AI prompts. Statistical significance built in. Auto-promote the winner with one click.',
    keywords: [
      'whatsapp ab testing tool',
      'message template ab test',
      'flow variant experimentation',
      'split testing automation',
      'broadcast ab test platform',
      'ai prompt ab testing',
      'multi armed bandit whatsapp',
      'statistical significance flows',
      'sabflow experimentation',
      'conversion rate testing whatsapp',
    ],

    hero: {
      eyebrow: 'SabFlow · Experimentation',
      headline: 'Stop guessing which template wins',
      subhead:
        'A/B Testing turns any branch in a flow into a statistically rigorous experiment. Split traffic across two, three or five variants — different templates, different timing, different AI prompts, different paths entirely — and let the engine declare the winner. No spreadsheet, no p-value debates, no surprise regressions.',
      bullets: [
        'Up to 5 variants per experiment',
        'Built-in significance and confidence',
        'Auto-promote winner on threshold',
        'Multi-armed bandit mode for traffic shifting',
      ],
    },

    problem: {
      title: 'The "we tried two versions" experiment that proved nothing',
      body:
        'Most teams who claim they A/B test do not actually A/B test. They send template A to one segment on Monday and template B to a different segment on Friday, declare A "won" because more people replied, and ship A everywhere. They did not control for segment composition, day-of-week effects, sample size, or random variance. They probably also did not pre-register their success metric, so they retro-fitted whichever number made A look good.\n\nThe other failure mode is the team that does run a proper split, but on a sample so small that the result is statistically meaningless. They see template A at 7.2% reply rate and template B at 6.8%, declare a 6% lift, and roll out — when the 95% confidence interval on that lift is something like [-15%, +28%]. The experiment told them nothing; they just made it feel scientific.\n\nA/B Testing in SabFlow does the math for you. You set a primary metric (reply rate, conversion, click-through, time-to-resolution), the engine splits traffic uniformly, tracks the metric per variant, computes confidence intervals using bootstrapped resampling, and tells you when you have a significant result. If you ship a variant before significance, the system warns you. If you let it run, it auto-promotes the winner when the threshold is hit.',
    },

    overview: [
      'An experiment in SabFlow is declared at a Branch node. You assign weights to each outbound arm — 50/50 for a two-way split, 33/33/34 for three-way, or weighted (90/10) when you want to test a risky variant on a small slice. The engine deterministically hashes the contact ID to an arm so the same contact always sees the same variant across re-runs and replays. This consistency matters: customers who get different messages on different days because of randomness leak the experiment.',
      'Every experiment has a primary metric and optional guardrail metrics. Primary might be "WhatsApp message reply within 24 hours" or "Shopify order placed within 7 days" — anything observable in the platform. Guardrails are metrics you do not want to regress: "unsubscribes per 1,000 sent", "agent CSAT", "complaint rate". The engine reports both. A variant that wins the primary but spikes a guardrail is flagged, not auto-promoted.',
      'Statistical analysis is built in. We compute a two-sided test (Welch\'s t for continuous metrics, Bayesian beta-binomial for conversion rates) with configurable confidence (90%, 95%, 99%). The dashboard shows the observed lift, the confidence interval, and a power estimate — how many more contacts you need to detect a target lift if the current sample is too small. No more p-value cargo culting.',
      'For traffic that needs to adapt continuously rather than wait for significance, switch to multi-armed bandit mode. Thompson sampling allocates more traffic to the better-performing arm in real time while still exploring the laggards. This is the right mode for high-volume, low-stakes experiments — broadcast subject lines, button copy, AI prompt variants — where you want to start capturing the lift the moment it emerges.',
    ],

    capabilities: [
      {
        title: 'Up to 5 variants per branch',
        body: 'Configure 2-5 arms with custom traffic weights. Each arm is its own subgraph of nodes — so variants can differ in template, timing, AI prompt, or entire downstream paths. Not just "different text" but "different journey".',
      },
      {
        title: 'Deterministic contact bucketing',
        body: 'Contacts are bucketed via a hash of (contact_id, experiment_id) so the same person always sees the same variant. Re-runs, replays and resumes all respect the original assignment. No bucket leakage when you debug or retry.',
      },
      {
        title: 'Primary + guardrail metrics',
        body: 'Pick one primary metric the experiment optimises for, plus any number of guardrails it must not regress. Reply rate as primary, unsubscribe rate as guardrail. Auto-promotion blocks if guardrails degrade beyond the threshold you set.',
      },
      {
        title: 'Statistical significance built in',
        body: 'Welch\'s t-test for means, Bayesian beta-binomial for conversion rates, 90/95/99% confidence configurable. Confidence intervals reported alongside the point estimate. "Variant B lifted reply rate by 14% [95% CI: 6%, 22%]" — not just "B looks better".',
      },
      {
        title: 'Multi-armed bandit mode',
        body: 'Switch from fixed-split to Thompson sampling. Traffic shifts toward the winning arm in real time while still exploring others. Right for broadcast subjects, button copy, AI prompts — anything where lost traffic is the cost of waiting.',
      },
      {
        title: 'Auto-promote winner',
        body: 'Set a confidence threshold and a minimum sample size. When the engine hits both, it promotes the winning variant to 100% traffic and freezes the others. You get a Slack alert with the final report. No more "we forgot the experiment was running".',
      },
      {
        title: 'Cross-experiment guardrails',
        body: 'Tenant-wide guardrails catch regressions across all running experiments. If overall opt-out rate spikes 30% in a 24-hour window, all auto-promotions pause until ops investigate. Protects the brand from collective slow drift.',
      },
    ],

    useCases: [
      {
        title: 'Template copy split for D2C launch',
        industry: 'D2C',
        body: 'Three product-launch templates: emoji-heavy, plain text, story-led. 33/33/34 split across 50,000 contacts. Primary metric: click-to-product-page. Guardrail: unsubscribe rate. Story-led wins by 22% with significance at day 3. Auto-promoted, rolled to remaining list.',
      },
      {
        title: 'Send-time optimisation',
        industry: 'E-commerce',
        body: 'Four arms: 9am, 12pm, 6pm, 9pm in contact local time. Primary metric: reply within 1 hour. Bandit mode shifts traffic to 6pm and 9pm within a week. Reveals that the standard "send at 10am" advice was costing the brand 18% in engagement.',
      },
      {
        title: 'AI prompt experimentation',
        industry: 'SaaS',
        body: 'Two AI Generate nodes with different system prompts — one concise, one consultative. Primary metric: contact resolves issue without escalation. 50/50 split, 2,000 conversations. Consultative wins on resolution but loses on response latency; ops promotes consultative with a latency optimisation.',
      },
      {
        title: 'Discount level for cart recovery',
        industry: 'E-commerce',
        body: 'Three arms: no discount, 5% off, 10% off. Primary: cart recovered. Guardrail: revenue per recovery. 5% recovers 16% of carts at full margin; 10% recovers 19% but cuts net by 8%. Ops picks 5% based on the joint view, not the headline.',
      },
      {
        title: 'Education program nurture cadence',
        industry: 'EdTech',
        body: 'Two arms: 3-message nurture vs 7-message nurture over two weeks. Primary: enrolment. Guardrail: opt-out rate. 7-message wins enrolment by 11% with opt-out unchanged. The team had assumed more messages would hurt — the data overruled the assumption.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Add a Branch with variants',
        body: 'Insert a Branch node, switch it to A/B mode, declare 2-5 variants with weights. Each variant is its own subgraph you build out independently.',
      },
      {
        step: '02',
        title: 'Pick a primary metric',
        body: 'Select from built-in metrics (reply, click, order, custom event) or define a custom one via a downstream Goal node. Add guardrails the experiment must not regress.',
      },
      {
        step: '03',
        title: 'Set confidence and stopping rules',
        body: 'Configure confidence (95% default), minimum sample size, max runtime, and auto-promotion behavior. Or run in bandit mode for continuous traffic shifting.',
      },
      {
        step: '04',
        title: 'Ship and monitor',
        body: 'Publish the flow. The experiment dashboard updates in real time — variant share, observed metric, confidence interval, power. Drill into any contact to see their assigned arm.',
      },
      {
        step: '05',
        title: 'Promote or iterate',
        body: 'When the engine hits significance, auto-promote or review and promote manually. Archive the experiment with the full report stored for audit. Spin up the next test.',
      },
    ],

    integrations: ['Shopify', 'Stripe', 'Razorpay', 'HubSpot', 'Slack', 'Google Sheets', 'Meta WhatsApp Cloud API', 'Mixpanel'],

    metrics: [
      { value: '5', label: 'max variants per experiment' },
      { value: '95%', label: 'default confidence threshold' },
      { value: '24×', label: 'faster to significance vs manual splits' },
      { value: '0', label: 'spreadsheets required to read the result' },
    ],

    faqs: [
      {
        q: 'How do I know my sample size is large enough?',
        a: 'The experiment dashboard shows current statistical power — the probability of detecting a target lift (default 10%) given your current sample. If power is below 80%, the dashboard tells you how many more contacts you need. For typical D2C broadcast lifts (5-20%), you need between 2,000 and 20,000 contacts per arm. The engine pre-flights this when you launch and warns if your audience is too small.',
      },
      {
        q: 'Can I test more than two variants at once?',
        a: 'Yes, up to five variants per Branch. Beyond five, the multiple-comparison correction starts eating statistical power — you would need much larger samples to reach significance. We recommend starting with two for headline tests and three when you have a clear hypothesis about the spectrum (e.g. low/medium/high discount). For high-dimensional exploration, bandit mode is better than fixed splits.',
      },
      {
        q: 'What happens if a contact triggers the flow twice?',
        a: 'Deterministic bucketing means the contact is hashed to the same arm both times. This prevents accidental crossover where a customer sees variant A on Monday and variant B on Friday. If you intentionally want fresh randomisation per execution (rare, but possible for true repeat-purchase tests), there is a per-run randomisation toggle on the Branch node.',
      },
      {
        q: 'Can I A/B test AI prompts in AI Studio?',
        a: 'Yes. Each AI Generate node can declare two prompt variants, and the engine routes traffic with the same A/B mechanics. Primary metric is usually downstream — did the conversation resolve, did the customer convert, did CSAT stay above threshold. Combined with the eval harness in AI Studio, this lets you ship prompt changes confidently without anecdotal "I think the new one is better".',
      },
      {
        q: 'Does the experiment account for novelty effects?',
        a: 'Yes via the minimum runtime parameter. Even if statistical significance is reached on day 1, the engine will not auto-promote until the configured minimum runtime (default 7 days, configurable per experiment) has elapsed. This guards against novelty effects where a new variant gets a temporary attention bump that does not sustain. Bandit mode has a built-in exploration floor to keep all arms alive long enough to detect this.',
      },
      {
        q: 'How is multiple-testing corrected when I have guardrails?',
        a: 'Each guardrail metric gets its own significance test with a Bonferroni-adjusted alpha based on the number of guardrails declared. With three guardrails at 95% overall confidence, each individual test runs at 98.3%. This makes it harder to trigger a false-alarm guardrail regression. You can override the correction if you have domain-specific reasons, but the default is conservative on purpose.',
      },
      {
        q: 'Can I export results for stakeholders?',
        a: 'Yes. Every experiment generates a one-page PDF report with the variants, the metric definitions, observed lifts, confidence intervals, sample sizes, and a recommendation. CSV export gives you the raw assignment and outcome data for re-analysis in R, Python or your preferred tool. Both are accessible via the API for embedding in internal dashboards.',
      },
    ],

    related: ['flow-builder', 'broadcasts', 'ai-studio', 'flow-analytics'],
  },

  /* ------------------------------------------------------------------ */
  /* 6. SCHEDULER                                                       */
  /* ------------------------------------------------------------------ */
  {
    slug: 'scheduler',
    name: 'Scheduler',
    brand: 'SabFlow',
    category: 'automation',
    tagline: 'One-off and recurring sends in the recipient\'s local timezone.',
    iconKey: 'calendar',
    color: '#06B6D4',
    tint: '#CFFAFE',

    seoTitle: 'Scheduler — Timezone-Aware Sends & Cron | SabNode',
    seoDescription:
      'Schedule one-off or recurring WhatsApp, email and flow runs in the recipient\'s local timezone. Cron syntax, holiday calendars, blackout windows and retries.',
    keywords: [
      'whatsapp scheduled message',
      'timezone aware broadcast',
      'cron job for marketing',
      'recurring whatsapp send',
      'scheduled flow automation',
      'send time optimization',
      'broadcast scheduler tool',
      'whatsapp business scheduler',
      'business hours sender',
      'campaign scheduling crm',
    ],

    hero: {
      eyebrow: 'SabFlow · Scheduling',
      headline: 'Send at the right time, in the right timezone',
      subhead:
        'Scheduler is the temporal layer underneath every flow, broadcast and reminder in SabNode. Express schedules in plain English, cron syntax, or relative time. Respect each contact\'s local timezone. Skip holidays and blackout windows. Recover gracefully from outages with bounded backfill.',
      bullets: [
        'Per-contact local timezone delivery',
        'Cron, one-off and relative recurring',
        'Holiday calendars and blackout windows',
        'Backfill control after outages',
      ],
    },

    problem: {
      title: 'Sending at 4:30am is a brand-damaging accident',
      body:
        'Every operator has a story. A scheduled "good morning" template that fired at 4:30am because the cron ran in UTC. A Black Friday campaign that hit Australia first, then EU, then US — meaning the inbox was already full of competitors by the time the US woke up. A polling reminder that landed at 11pm on Election Day. A condolence message that auto-sent on a public holiday because nobody updated the calendar.\n\nThese accidents have the same root cause: time is hard, and most platforms treat it casually. They store cron expressions, hope the server clock is right, and assume the user knows what timezone they configured. Recipient timezone is an afterthought. Holidays do not exist. Blackout windows are a feature request from 2019 that nobody shipped.\n\nScheduler in SabNode treats time as a first-class problem. Every schedule has an explicit timezone — server, business, or recipient. Holiday calendars are pluggable per region. Blackout windows enforce hard "do not send" rules even if a flow tries. Outage backfill is bounded so a 6-hour scheduler downtime does not unleash a 6-hour avalanche of belated messages on customers. The defaults are paranoid because the stakes are.',
    },

    overview: [
      'Scheduler powers four user-visible concepts: cron triggers (fire a flow on a schedule), broadcast scheduling (send a campaign at a specific time), Wait nodes (pause a flow until a condition), and reminders (one-off contact-specific events). Underneath, they share a single durable scheduling engine with millisecond precision, exactly-once semantics, and dynamic timezone resolution. Whether you set up a recurring "every Tuesday at 9am IST" or a one-off "send when the customer\'s appointment is 24 hours away", the same primitives apply.',
      'Timezone handling is per-schedule and per-contact. A broadcast can target "9am in the recipient\'s local timezone", in which case Scheduler resolves each contact\'s timezone (from CRM field, IP geolocation fallback, or business default) and stages the send for the right wall-clock moment. A flow Wait can pause "until next Monday 10am IST" globally or "until tomorrow 9am in contact timezone" per contact. The engine indexes upcoming sends by minute-bucket per timezone so peak-hour batches do not stall.',
      'Holiday calendars are a managed resource. We ship calendars for India (national + major state holidays), US, UK, EU countries, UAE, Singapore, Australia and 40 more. You can layer custom dates (your company off-days, marketing blackouts, religious observances per audience). When a schedule lands on a calendar date with "skip" rule, it shifts to the next valid moment. When it lands with "send" rule, it fires anyway. Per-channel rules — a billing reminder still goes out on a public holiday, but a marketing nudge does not.',
      'Blackout windows are hard constraints. You declare "never send marketing between 9pm and 9am in recipient timezone" at the tenant level, and Scheduler enforces it across every flow, broadcast and reminder. A flow that hits a blackout pauses until the window opens. A broadcast scheduled inside a blackout shifts to the edge. This is the safety net against the 4:30am accident. For transactional messages (order shipped, OTP), you can declare exceptions explicitly — but the default is conservative.',
    ],

    capabilities: [
      {
        title: 'Per-contact timezone resolution',
        body: 'Pick from CRM timezone field, IP geolocation, country code from phone number, or tenant default — in priority order. Missing data falls back to your business timezone. Every scheduled send carries the resolved timezone in its trace.',
      },
      {
        title: 'Cron and human syntax',
        body: 'Full cron-with-seconds (`0 0 9 * * MON-FRI`) for power users, plus human syntax for everyone else ("every Monday at 9am", "first day of each month at noon"). Both compile to the same internal representation and validate at save time.',
      },
      {
        title: 'Holiday calendars built in',
        body: 'Curated calendars for 50+ countries, updated annually. Custom calendars per tenant for your company holidays. Skip-or-send rule per schedule. Surface upcoming holidays in the schedule preview so you see what the next 30 days look like.',
      },
      {
        title: 'Blackout windows',
        body: 'Tenant-wide hard rules — never send marketing between 9pm-9am in contact timezone, never send anywhere on Republic Day. Exceptions declared explicitly per message category. Enforcement is at send-time, not configure-time — even ad-hoc flows respect it.',
      },
      {
        title: 'Outage backfill control',
        body: 'After a Scheduler outage or maintenance window, missed sends queue with a configurable backfill policy: send all (max 30 min late), send latest only, or skip entirely. Prevents a 6-hour outage from creating a 6-hour avalanche of stale messages.',
      },
      {
        title: 'Send-time optimisation',
        body: 'Optional ML-driven mode: for each contact, predict the hour-of-day with highest historical engagement and stage the send there. Falls back to the configured time if the contact has too little history. Lifts engagement 8-15% on broadcast campaigns.',
      },
      {
        title: 'Exactly-once delivery',
        body: 'Schedule entries have idempotency keys and are stored durably. A worker crash or deploy mid-send does not double-fire. Recovery resumes from the last committed state. We have run 4 billion+ scheduled events with no observed duplicate sends.',
      },
    ],

    useCases: [
      {
        title: 'Black Friday timezone rollout',
        industry: 'E-commerce',
        body: 'Single broadcast scheduled at 9am recipient-local. Scheduler stages 240,000 contacts across 14 timezones. AU fires first at midnight UTC, EU at 7am UTC, US at 13:00 UTC. No support team scrambling, no time-blocked microsegments. Engagement uplift of 23% vs flat-time send.',
      },
      {
        title: 'Renewal reminder cadence',
        industry: 'SaaS',
        body: 'Each subscription emits three reminders: 30, 7, and 1 day before renewal. All in customer local time at 10am. Holiday calendar shifts the 1-day reminder if it lands on a Sunday. Blackout window blocks any send between 9pm-9am. Renewal CTR up 11% with cleaner timing alone.',
      },
      {
        title: 'Monthly NBFC EMI nudge',
        industry: 'Financial Services',
        body: 'Cron schedule on the 28th of each month at 11am IST. Skips public holidays in India (custom calendar with regional state holidays). Fires a flow that segments by overdue status and sends the appropriate template. Replaces a manual ops process that occasionally missed cycles.',
      },
      {
        title: 'Appointment reminders in clinic chain',
        industry: 'Healthcare',
        body: 'One-off schedule per booking — fires 24 hours before appointment in patient local time. Skips reminders for patients who replied "confirmed" in the last 6 hours. Blackout 9pm-9am for non-urgent reminders. No-show rate down from 18% to 11%.',
      },
      {
        title: 'Daily standup digest',
        industry: 'SaaS',
        body: 'Cron weekday at 9:15am IST. HTTP Request pulls yesterday\'s PRs, AI summarises, Slack post. Skips Indian holidays. Skips between 22 Dec and 2 Jan automatically via a "team off" custom calendar. Internal team relies on it as the daily anchor.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Pick the schedule type',
        body: 'One-off, recurring cron, recurring relative, or trigger-based wait. The editor previews the next 10 fire times so you can sanity-check before saving.',
      },
      {
        step: '02',
        title: 'Configure timezone behavior',
        body: 'Send in business timezone, server timezone, or each recipient\'s local time. For local, pick the resolution priority chain (CRM, IP, country, default).',
      },
      {
        step: '03',
        title: 'Layer calendars and blackouts',
        body: 'Attach a holiday calendar with skip-or-send rule. Inherit tenant blackout windows or override with an exception for transactional categories.',
      },
      {
        step: '04',
        title: 'Set backfill and retries',
        body: 'Define behavior if Scheduler was down when this should have fired: backfill within N minutes, send latest only, or skip. Set retry count for failed dispatches.',
      },
      {
        step: '05',
        title: 'Monitor in the schedule view',
        body: 'See upcoming fires, recently-fired with status, and skipped (with reason). Drill into any entry for the resolved timezone and the trace.',
      },
    ],

    integrations: ['Google Calendar', 'Outlook', 'Slack', 'Shopify', 'Meta WhatsApp Cloud API', 'Twilio', 'Gmail', 'Razorpay'],

    metrics: [
      { value: '4B+', label: 'scheduled events fired without duplicates' },
      { value: '50+', label: 'pre-built country holiday calendars' },
      { value: '<1s', label: 'p95 schedule-to-fire latency at peak hour' },
      { value: '8-15%', label: 'engagement lift from send-time optimisation' },
    ],

    faqs: [
      {
        q: 'How is the recipient\'s timezone determined?',
        a: 'In priority order: (1) the contact\'s `timezone` CRM field if set, (2) IP-geolocation from the last web interaction within 30 days, (3) country code derived from phone number with a default city per country, (4) tenant business timezone as fallback. Each resolution is logged so you can audit why a contact got the time they did. For high-stakes campaigns, we recommend backfilling the CRM field via the bulk-update tool first.',
      },
      {
        q: 'Can blackout windows have exceptions for OTP and transactional?',
        a: 'Yes. Blackout windows are scoped by message category. The default policy is conservative — marketing and broadcasts respect the window, transactional categories (OTP, order updates, shipping, appointment) are exempt by default. You can customise the matrix per tenant. The send pipeline tags every outbound with its category so the rules apply automatically without flow authors thinking about it.',
      },
      {
        q: 'What is the smallest schedule resolution?',
        a: 'One-second resolution for cron and relative schedules. Per-contact timezone-aware sends round to the nearest minute (because resolving timezone-per-contact at sub-minute resolution is operationally expensive and rarely matters). For Wait nodes, durations down to 100ms are honored — useful for tight retries or rate-limited fan-out.',
      },
      {
        q: 'How does Scheduler handle daylight saving transitions?',
        a: 'All schedules use IANA timezone identifiers (e.g. `America/New_York`, not `EST`). When DST shifts, the wall-clock interpretation shifts with it — a "9am every Monday in America/New_York" cron fires at 9am EST in winter and 9am EDT in summer, automatically. The spring-forward gap (no 2:30am exists that day) shifts forward; the fall-back duplicate (two 1:30am moments) fires once on the first occurrence. Both edge cases are tested in our regression suite.',
      },
      {
        q: 'Can I see all upcoming scheduled events for a contact?',
        a: 'Yes. The contact detail page in CRM has a "Scheduled" tab showing every pending send for that contact across flows, broadcasts and reminders. You can cancel an individual entry, postpone it, or trigger it now. This is the right place to look when a customer calls asking "why did you message me yesterday but not today" — the audit log next to the upcoming queue tells the whole story.',
      },
      {
        q: 'What happens if a flow Wait node\'s deadline has already passed when the flow resumes?',
        a: 'Configurable per Wait node. Default behavior is to fire immediately on resume (the "expected window" is the relevant signal, not the precise timestamp). You can switch to "skip and continue" — the Wait counts as elapsed and the downstream node runs without the side effect. Or "abort flow" if the missed deadline invalidates the journey entirely (rare). Trace shows which path was taken and why.',
      },
      {
        q: 'How do I prevent a misconfigured cron from blasting customers?',
        a: 'Three safeguards. (1) Save-time validation rejects expressions that would fire more than once per minute against a non-trivial audience. (2) Pre-publish preview shows next 10 fire times and estimated audience volume — high volumes require a second person to approve. (3) Tenant rate limits cap total sends per hour, so even a misconfigured "every second" cron cannot trigger more than your plan allows. The combination makes 4:30am accidents very hard to ship.',
      },
    ],

    related: ['flow-builder', 'broadcasts', 'triggers', 'business-hours'],
  },

  /* ------------------------------------------------------------------ */
  /* 7. CONTACTS                                                        */
  /* ------------------------------------------------------------------ */
  {
    slug: 'contacts',
    name: 'Contacts',
    brand: 'CRM',
    category: 'customer-data',
    tagline: 'Every conversation becomes a contact record — auto-deduplicated.',
    iconKey: 'users',
    color: '#8B5CF6',
    tint: '#F3E8FF',

    seoTitle: 'Contacts — Unified Customer Records | SabNode CRM',
    seoDescription:
      'Auto-deduplicated contact records from every channel. Identity resolution, full conversation history, custom fields and opt-in status in one timeline.',
    keywords: [
      'whatsapp crm contact management',
      'unified customer profile',
      'contact deduplication crm',
      'identity resolution platform',
      'multi-channel contact record',
      'whatsapp contact database',
      'crm contact merge tool',
      'sabnode crm contacts',
      'contact 360 view',
      'customer timeline crm',
    ],

    hero: {
      eyebrow: 'CRM · Customer Data',
      headline: 'One record per human, no matter the channel',
      subhead:
        'Every WhatsApp message, Instagram DM, email reply, web chat or webhook call resolves to a single contact record in SabNode CRM. Identity resolution merges phone numbers, emails and social handles automatically. Custom fields stay populated. Opt-in status follows. The same human, the same timeline, the same conversation.',
      bullets: [
        'Automatic identity resolution across channels',
        'Conversation timeline from every surface',
        'Custom fields, tags and segments built in',
        'Bulk merge, edit and export',
      ],
    },

    problem: {
      title: 'The CRM duplication graveyard',
      body:
        'Look inside any growing business\'s CRM and you will find the same wreckage: Priya Sharma exists three times. Once with her phone, once with her email, once with her Instagram handle. Each ghost has a partial history. Marketing campaigns hit her three times. The support team has no idea she is the same person who complained last quarter. The finance team sees three "customers" and reports inflated active counts.\n\nThe usual fix is "we will run a deduplication job next sprint", which never happens, or "we are migrating to a new CRM", which buys 18 months before the new system has the same problem. The actual problem is not a data hygiene issue — it is an architecture issue. Most CRMs assume each tool (WhatsApp, email, web form) creates a contact, with no built-in resolver. Tools accumulate, contacts accumulate, the mess accumulates.\n\nSabNode CRM is built on a unified identity model from day one. Every signal that arrives — a WhatsApp message, an email reply, a webhook from Shopify with a phone, an Instagram DM — is matched against the contact graph. Strong matches merge; weak matches surface for human review. The result is one record per human, period. Marketing sees one Priya. Support sees one Priya. Finance counts one Priya.',
    },

    overview: [
      'A Contact in SabNode is an identity-resolved customer record. Each contact has a stable internal ID and a set of identifiers — phone numbers (E.164), emails, Instagram username, WhatsApp WA-ID, Shopify customer ID, custom external IDs. When a new event arrives carrying any of these identifiers, the resolver looks up the contact graph. Exact match merges into the existing record. Fuzzy match (similar email at same phone, same name and address) surfaces in a merge queue for human approval. No match creates a new contact. This happens transparently before the event hits any flow or inbox.',
      'Every contact carries a full timeline. Inbound and outbound messages across WhatsApp, Instagram, Web Chat, Email; flow executions the contact was in; broadcasts the contact received; orders, payments, refunds from connected commerce; CRM stage changes; tag adds and removes; opt-in events; agent notes. The timeline is searchable, filterable by channel or event type, exportable. An agent who picks up a conversation tomorrow has the full context — last support ticket, last purchase, last marketing nudge — without leaving the contact page.',
      'Custom fields turn contacts into structured records, not just chat partners. Define fields with types (text, number, date, boolean, JSON, file reference) and validation rules. Populate them via flows ("after KYC, set `kyc_verified=true`"), via CSV import, via the REST API, or manually. Fields drive segments, gate flow branches, personalise templates, and surface in agent UIs. The CRM scales from "chat with a customer" to "operate a regulated financial product" without rebuilding the data model.',
      'Bulk operations are pragmatic for the real-world mess. Multi-select up to 50,000 contacts at a time. Edit a field, add a tag, move them through a Kanban stage, trigger a flow, export to CSV, opt out of a channel. Merge two or twenty duplicates with field-by-field conflict resolution. Filter by anything — last message older than 90 days, segment X minus segment Y, opt-in status false on WhatsApp but true on email. The CRM is built to be operated, not just admired.',
    ],

    capabilities: [
      {
        title: 'Identity resolution engine',
        body: 'Match contacts across phone (E.164), email, WA-ID, Instagram handle, Shopify ID and custom external IDs. Strong matches auto-merge with full audit. Fuzzy matches surface in a review queue. Configurable rules per tenant — strict for finance, lenient for D2C.',
      },
      {
        title: 'Unified timeline',
        body: 'Every event from every channel lands on the contact timeline — messages, flows, broadcasts, orders, stage changes, tags, opt-ins, notes. Searchable, filterable, exportable. The single place to see the customer relationship across two years.',
      },
      {
        title: 'Custom fields with types',
        body: 'Define text, number, date, boolean, single-select, multi-select, JSON, and file-reference fields. Validation rules, default values, required flags. Fields populate from flows, imports, API or manual entry. Drive segments, branches and personalisation.',
      },
      {
        title: 'Bulk operations',
        body: 'Select up to 50,000 contacts at once. Edit, tag, move stage, trigger flow, opt out, export, delete. Every bulk action is undoable for 24 hours with a single click. Audit log captures who did what to which segment.',
      },
      {
        title: 'Manual merge with conflict resolution',
        body: 'Pick two contacts that should be one. The merge UI shows every field side-by-side with the conflict highlighted; pick a value per field or let the rule engine decide (newer wins, longer wins, manual). Messages and events combine into one timeline.',
      },
      {
        title: 'Opt-in tracking per channel',
        body: 'Each contact has independent opt-in status per channel (WhatsApp, Email, SMS, Web Push). Updates respect the channel-specific consent rules — WhatsApp opt-in via service window, email via double opt-in. Audit log retains every state transition for compliance.',
      },
      {
        title: 'Import and CSV workflows',
        body: 'CSV import with column mapping, validation, dry-run preview, and conflict resolution against existing contacts. Imports above 50,000 rows process in the background with email completion. Supports re-import to update fields without creating duplicates.',
      },
    ],

    useCases: [
      {
        title: 'D2C identity unification post-migration',
        industry: 'D2C',
        body: 'Brand migrated from Mailchimp + Interakt + Shopify and arrived with 340,000 records across three systems. Importer resolved 220,000 unique contacts via phone+email matching. The 7,000-row merge queue cleared in 48 hours with two ops people. Marketing CTR jumped because dedup eliminated duplicate-send penalty.',
      },
      {
        title: 'Fintech KYC field gating',
        industry: 'Financial Services',
        body: 'Custom field `kyc_status` enforced per contact. Flow Send Template node skips contacts where status != "verified". Compliance segment surfaces unverified contacts for ops follow-up. Custom field history lets the audit team trace exactly when KYC moved to verified for any contact.',
      },
      {
        title: 'B2B SaaS account-contact hierarchy',
        industry: 'SaaS',
        body: 'Custom field `company_id` links multiple contacts to one account. Filter shows all contacts at a company, total LTV, latest churn risk. AE\'s working a renewal see every person at the customer with their role and engagement, not just the champion they normally talk to.',
      },
      {
        title: 'Healthcare patient deduplication',
        industry: 'Healthcare',
        body: 'Clinic chain across 14 branches kept creating duplicate patients when the same person visited a different branch. Identity resolution on phone+DOB merged 18,000 duplicates. Patient timeline now spans branches. Doctors see full history. Reduced no-shows because reminder targeting is accurate.',
      },
      {
        title: 'Education lead consolidation',
        industry: 'EdTech',
        body: 'Same student fills inquiries via the website, WhatsApp, and Instagram DM. CRM resolves all three to one contact. Counsellor sees the full inquiry sequence and intent signals. Replaces a manual spreadsheet match the team used to run weekly. Lead-to-enrollment time drops 40%.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Bring contacts in',
        body: 'Import via CSV, sync from Shopify, sync from HubSpot, or let inbound channel messages create contacts automatically. Each path runs through identity resolution.',
      },
      {
        step: '02',
        title: 'Identity resolution runs',
        body: 'On each new record or event, the resolver checks the contact graph. Strong matches merge silently. Fuzzy matches enter the review queue with a confidence score.',
      },
      {
        step: '03',
        title: 'Custom fields populate',
        body: 'Set fields from flows, imports, the API, or by hand. Validation rules enforce schema. Field history captures every change for audit.',
      },
      {
        step: '04',
        title: 'Operate at scale',
        body: 'Filter, segment, tag, bulk-edit, bulk-trigger. The same UI scales from one contact to 50,000 in a single action with progress and rollback.',
      },
      {
        step: '05',
        title: 'Export and integrate',
        body: 'Export filtered slices to CSV, push to BigQuery via the export connector, or query via the REST API. Contacts power everything downstream — broadcasts, flows, AI, analytics.',
      },
    ],

    integrations: ['Shopify', 'HubSpot', 'Salesforce', 'Google Sheets', 'Mailchimp', 'Pipedrive', 'Razorpay', 'Stripe'],

    metrics: [
      { value: '92%', label: 'identity resolution accuracy on benchmark' },
      { value: '50,000', label: 'contacts per bulk operation' },
      { value: '<200ms', label: 'p95 resolution latency per inbound event' },
      { value: '0', label: 'duplicate contacts after import on average' },
    ],

    faqs: [
      {
        q: 'How does identity resolution decide a strong match versus fuzzy?',
        a: 'Strong match: identical phone in E.164 form, or identical email (case-insensitive, normalised), or identical platform ID (WA-ID, Instagram user ID, Shopify customer ID). These auto-merge silently. Fuzzy match: similar email (one-character edit distance), same phone with different country code, same name and address but different phone. These enter the review queue with a confidence score and the human picks. Rules are configurable per tenant — finance teams typically dial up strictness, D2C teams dial down.',
      },
      {
        q: 'Can I undo a merge?',
        a: 'Yes, within 30 days. Every merge captures the pre-merge state of both records. Unmerge restores both contacts with their original fields and splits the timeline events back to whichever record they originally belonged to. After 30 days the snapshot is purged for storage reasons but the audit log retains the metadata (who, when, what fields).',
      },
      {
        q: 'What happens to contacts when a message comes from an unknown phone?',
        a: 'Three configurable behaviors. (1) Auto-create with minimum data (phone + first message) — default for D2C. (2) Queue for human review before creating — common for B2B where every lead is high-touch. (3) Reject and route to a "stranger inbox" without creating a CRM record — useful when you want to filter spam before it pollutes the database. Setting is per-channel so WhatsApp can auto-create while Email can require review.',
      },
      {
        q: 'How are custom field histories tracked?',
        a: 'Every change to every field is logged with timestamp, source (flow node, API call, manual edit, import), and the previous and new values. Audit log is queryable per contact ("show every change to kyc_status for contact X") and exportable. Retention is two years on standard plans, seven years on enterprise — covers most regulatory windows.',
      },
      {
        q: 'Can contacts have multiple phone numbers or emails?',
        a: 'Yes. Each contact can hold multiple identifiers of each type with one designated as primary. Inbound messages match against any of them and update the contact accordingly. Outbound respects the primary by default but flows can target any specific identifier ("send to email of type=work"). This handles the common pattern where customers have a personal and work email or two phones.',
      },
      {
        q: 'Does the CRM scale to millions of contacts?',
        a: 'Yes. Production tenants run 5M-30M contacts comfortably. The contact list is virtualised, segments are materialised incrementally, search is backed by a dedicated index. Bulk operations stream rather than buffer so memory is bounded. We pre-scale tenants approaching 10M contacts to ensure consistent latency. If you are starting above 5M, talk to us and we will pre-provision.',
      },
      {
        q: 'How are GDPR and DPDP delete requests handled?',
        a: 'A delete request via the admin UI or API soft-deletes the contact, anonymises personally identifiable fields, retains the contact ID and aggregate metrics for billing and analytics. After 30 days the soft-delete promotes to hard delete and the row is purged from the operational store. Messages are scrubbed to a placeholder ("deleted by user request") so threads do not break. Audit log of the deletion is kept indefinitely as legal proof.',
      },
    ],

    related: ['segments', 'tags', 'custom-fields', 'opt-in-status'],
  },

  /* ------------------------------------------------------------------ */
  /* 8. SEGMENTS                                                        */
  /* ------------------------------------------------------------------ */
  {
    slug: 'segments',
    name: 'Segments',
    brand: 'CRM',
    category: 'customer-data',
    tagline: 'Dynamic audiences from any signal. Reuse across flows, broadcasts and AI.',
    iconKey: 'filter',
    color: '#4F46E5',
    tint: '#EEF2FF',

    seoTitle: 'Segments — Dynamic Audiences for CRM & Broadcast | SabNode',
    seoDescription:
      'Build dynamic audiences from any contact, conversation, order or event signal. Reuse the same segment across flows, broadcasts, AI assistants and analytics.',
    keywords: [
      'whatsapp dynamic segments',
      'crm audience builder',
      'rfm segmentation tool',
      'behavioural segmentation crm',
      'broadcast audience filter',
      'reusable segments platform',
      'customer cohort builder',
      'sabnode crm segments',
      'lifecycle stage segments',
      'event based segmentation',
    ],

    hero: {
      eyebrow: 'CRM · Customer Data',
      headline: 'Build the audience once. Use it everywhere.',
      subhead:
        'Segments turn any combination of contact, event and behavior signal into a named, dynamic audience. Reuse the same segment in broadcasts, flows, AI assistants and dashboards. Audiences stay current as data changes — no exports, no stale CSVs, no segment that worked last week and lies this week.',
      bullets: [
        'Build with 80+ contact, event and order signals',
        'Dynamic membership updates within seconds',
        'Combine segments with AND, OR, NOT',
        'Reuse in flows, broadcasts, AI and exports',
      ],
    },

    problem: {
      title: 'The CSV from last quarter is lying to you',
      body:
        'Every marketer knows the ritual: pull a CSV of "active customers who bought from us in the last 90 days", upload it to the broadcast tool, send the campaign, throw the CSV away. Three weeks later, repeat. The list is stale the moment it is pulled — customers who bought after the pull get missed, customers who unsubscribed in the interim get spammed, customers who already received the campaign from a different list get hit again.\n\nThe industrial answer is dynamic segments, where the audience is a saved query that re-evaluates on every send. But most "dynamic" segments in legacy tools are dynamic in name only — they query a single table, can not span email opens with order history with WhatsApp clicks, and absolutely can not check "customer who replied to last broadcast within 24 hours and has not yet ordered". So teams fall back to CSVs.\n\nSegments in SabNode is dynamic for real. The query language spans every signal the platform captures — contact fields, custom fields, messages across channels, flow executions, broadcast engagement, orders, payments, opt-ins, tags. Membership recomputes incrementally as events flow through the platform. The segment you built for a Diwali campaign last year still works for next year\'s Diwali, with no edits, because the definition was always about the question, not the snapshot.',
    },

    overview: [
      'A Segment is a named, dynamic audience defined by a filter expression over the contact graph. Filters combine 80+ signals: identity (phone, email, language, country, timezone), contact fields (any custom field), tags, opt-in status, lifecycle stage, Kanban column, last-message-recency, last-purchase-recency, total spend, order count, channel preference, AI conversation outcomes, broadcast engagement (opened, clicked, replied), flow executions (entered, completed, dropped at node X). Filters compose with AND, OR, NOT and nested groups — same expressive power as SQL but exposed through a clickable builder.',
      'Membership is dynamic and incremental. The segment engine listens to every event in the platform (message in/out, order, tag change, field update) and incrementally re-evaluates which segments the affected contact belongs to. A contact who just placed their fifth order automatically enters the "VIP — 5+ orders" segment within seconds, no rebuild required. The segment-entered event itself is a flow trigger, so onboarding to VIP can fire a thank-you template the same minute.',
      'Segments compose with each other. Create "VIP" and "Lapsed" as base segments, then define "Lapsed VIPs" as VIP AND Lapsed. The derived segment updates automatically when its parents do. This pattern lets teams build a library of reusable audience primitives ("Active Hindi Speakers", "High-Intent Last 30 Days", "Refund Recently") and combine them per campaign without rebuilding query logic each time.',
      'Every downstream module consumes segments. Broadcasts target by segment with a live count preview. Flows branch on "contact is in segment X". AI assistants gate access by segment for premium-only features. Dashboards filter by segment to show the funnel for just that cohort. Exports stream the current snapshot or a scheduled refresh. The segment is the universal join key across SabNode modules — define an audience once, every tool reads from the same definition.',
    ],

    capabilities: [
      {
        title: '80+ filter signals',
        body: 'Contact fields, custom fields, tags, opt-in by channel, lifecycle stage, Kanban column, messages (sent/received/replied to), broadcasts (opened/clicked), flows (entered/completed), orders (count/total/recency), payments, AI conversations, location, language, timezone, and more.',
      },
      {
        title: 'Composable boolean logic',
        body: 'AND, OR, NOT, nested groups up to 5 levels deep. Build complex audiences like "WhatsApp opted-in AND (Hindi OR Tamil) AND (last order < 30 days OR total spend > ₹10,000) AND NOT tag=staff" through the clickable builder, no SQL needed.',
      },
      {
        title: 'Live count preview',
        body: 'As you build the filter, the count updates within seconds against the live contact graph. See exactly how many contacts match before saving. Compare alternative versions of the segment to pick the right reach.',
      },
      {
        title: 'Incremental membership',
        body: 'When a contact event occurs, only the affected segments re-evaluate for that contact. No full rebuild. Segment-entered and segment-exited fire as flow triggers so downstream automations react instantly to membership changes.',
      },
      {
        title: 'Segment composition',
        body: 'Define a segment as the intersection, union or difference of other segments. Updates propagate automatically. Build a library of reusable atoms ("Hindi speakers", "Active last 30 days") and combine per campaign.',
      },
      {
        title: 'RFM and cohort segments',
        body: 'Built-in templates for recency-frequency-monetary segmentation, cohort by signup week, customer-lifecycle stage. Pick a template, tweak thresholds, save. Skip the manual rebuild of standard analytics primitives every team needs.',
      },
      {
        title: 'Scheduled exports',
        body: 'Export any segment to CSV, S3, or Google Sheets on a schedule. Hourly, daily, weekly. Lets external tools (BI dashboards, paid-media platforms) consume SabNode segments without a custom integration. Audit log captures every export.',
      },
    ],

    useCases: [
      {
        title: 'D2C Diwali VIP campaign',
        industry: 'D2C',
        body: 'Segment: "spent ≥ ₹5,000 in last 12 months AND WhatsApp opted-in AND language IN (Hindi, English)". Used in a broadcast for early access. Live count: 18,000. Same segment fed into a flow that automatically nudged the 22% who clicked but did not purchase 48 hours later. No CSV touched.',
      },
      {
        title: 'B2B SaaS expansion targeting',
        industry: 'SaaS',
        body: 'Segment: "company size ≥ 50 AND product tier = starter AND feature_used:advanced_reports IN last 14 days". Identifies starter-tier users hitting power-user behavior. Fed into a flow that schedules an AE conversation and sends a product-tier-upgrade brochure. Expansion pipeline up 31% in one quarter.',
      },
      {
        title: 'EdTech re-engagement',
        industry: 'EdTech',
        body: 'Segment: "course_enrolled = true AND last_active > 21 days AND completion < 30%". Triggers a personalised AI Generate nudge with the next-lesson summary. Re-engages 14% of would-be churners. Segment recomputes daily; new dormant students enter automatically without manual list refresh.',
      },
      {
        title: 'Healthcare appointment reminder cohort',
        industry: 'Healthcare',
        body: 'Segment: "has_upcoming_appointment within 24 hours AND no_confirmation_sent_today". Cron-driven flow runs hourly against this segment, sending interactive confirmation buttons. Membership shrinks as confirmations come in. Replaces a manual ops process that occasionally missed entire shifts.',
      },
      {
        title: 'Logistics dispute proactive outreach',
        industry: 'Logistics',
        body: 'Segment: "shipment_status = exception AND no_outbound_in_last_4h". AI assistant proactively reaches out to acknowledge the delay and offer options. Composed from atomic segments around shipment status and outbound recency — both reused in other automations.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Open the segment builder',
        body: 'Click New Segment from any module — CRM, Broadcast, Flow editor. The builder is the same surface regardless of where you start.',
      },
      {
        step: '02',
        title: 'Compose filters',
        body: 'Pick signals from the catalog, add operators, group with AND/OR/NOT. The live count updates as you build. Templates available for RFM, lifecycle and cohort patterns.',
      },
      {
        step: '03',
        title: 'Name and save',
        body: 'Give the segment a name and optional description. Save promotes it to the segment library where every module can reference it.',
      },
      {
        step: '04',
        title: 'Use it everywhere',
        body: 'Target a broadcast, branch a flow, gate an AI assistant, filter a dashboard, schedule an export. The segment is the same in every context and updates everywhere when the definition changes.',
      },
      {
        step: '05',
        title: 'Monitor and tune',
        body: 'Each segment has a usage page — where it is referenced, how membership trends week-over-week, recent enter/exit events. Tune the filter as the business evolves.',
      },
    ],

    integrations: ['Shopify', 'HubSpot', 'Google Sheets', 'BigQuery', 'Mailchimp', 'Razorpay', 'Stripe', 'Meta Ads Manager'],

    metrics: [
      { value: '80+', label: 'filter signals out of the box' },
      { value: '<5s', label: 'segment-entered to flow-fire latency' },
      { value: '500+', label: 'segments per tenant on median plan' },
      { value: '3.2×', label: 'campaign CTR lift vs flat broadcasts' },
    ],

    faqs: [
      {
        q: 'How is segment membership kept fresh?',
        a: 'Incrementally. The segment engine subscribes to the change stream from the contact graph. When a contact attribute changes — a new order arrives, a tag is added, a message is sent — only segments that reference that signal re-evaluate for that contact. Average end-to-end latency from event to updated membership is under five seconds. No nightly rebuilds, no stale audiences for daily-recompute jobs.',
      },
      {
        q: 'Can I build a segment based on flow behavior?',
        a: 'Yes. Filter signals include "entered flow X", "completed flow X", "dropped at node Y of flow X", "currently active in flow X". You can build a segment of "everyone who entered the onboarding flow but dropped at the KYC step" and automatically target them with a recovery campaign. This is one of the highest-ROI use cases — every flow drop-off becomes a re-engagement opportunity without manual list pulling.',
      },
      {
        q: 'How do I segment by AI conversation outcome?',
        a: 'AI Studio emits structured events with outcomes — resolved, escalated, declined, satisfied. Segment signals include "last AI conversation outcome = X", "AI sentiment score < Y", "AI escalation count in last 30 days ≥ Z". This lets you build cohorts like "AI declined them last week — let a human re-engage" or "high-CSAT AI conversations — upsell candidates".',
      },
      {
        q: 'What is the limit on filter complexity?',
        a: 'Up to 50 conditions per segment, nested up to 5 group levels deep. In practice almost no real segment needs more than 10-15 conditions — beyond that the audience gets so narrow you should probably split into two segments. The builder warns at 30 conditions and gates at 50. For truly complex audiences, layer segments via composition instead of one mega-filter.',
      },
      {
        q: 'Can I share segments across tenants or workspaces?',
        a: 'Within a tenant, yes — segments are tenant-scoped resources and any user with the right RBAC role can see and use them. Across tenants, no, by design — segments contain audience definitions that often reflect strategic intent and customer data. For agencies running multiple client tenants we offer segment templates that can be cloned into each tenant with one click.',
      },
      {
        q: 'How accurate is the live count preview?',
        a: 'The count is computed against the current contact graph state with no caching — every save runs the query fresh. For segments touching millions of contacts the count can take 2-5 seconds; for smaller scopes it returns in under one second. Counts include only contacts active in the current platform period (default 13 months) — older contacts are archived and excluded unless you toggle to include archived.',
      },
      {
        q: 'Can a segment trigger paid-media audience sync?',
        a: 'Yes via the Meta Ads Manager integration. Mark a segment as "sync to Meta" and the engine maintains a Custom Audience on the Meta side, adding contacts as they enter the segment and removing as they exit. This is the right way to run lookalike campaigns and exclude existing customers from acquisition spend without manual list uploads every Monday.',
      },
    ],

    related: ['contacts', 'tags', 'broadcasts', 'flow-builder'],
  },

  /* ------------------------------------------------------------------ */
  /* 9. TAGS                                                            */
  /* ------------------------------------------------------------------ */
  {
    slug: 'tags',
    name: 'Tags',
    brand: 'CRM',
    category: 'customer-data',
    tagline: 'Multi-value tags with auto-apply rules and bulk edit.',
    iconKey: 'tag',
    color: '#EC4899',
    tint: '#FCE7F3',

    seoTitle: 'Tags — Lightweight Contact Labelling | SabNode CRM',
    seoDescription:
      'Multi-value tags with auto-apply rules, bulk edit, conflict policies and full audit. Use tags as the fastest path from signal to segment.',
    keywords: [
      'whatsapp contact tags',
      'crm tag management',
      'auto apply tag rules',
      'bulk tag contacts crm',
      'contact labelling tool',
      'multi-value tag system',
      'sabnode crm tags',
      'tag based segmentation',
      'taxonomic crm tagging',
      'rule based tagging',
    ],

    hero: {
      eyebrow: 'CRM · Customer Data',
      headline: 'The fastest signal-to-segment path in the platform',
      subhead:
        'Tags are lightweight labels you stick on contacts — manually, via auto-rules, via flows, via the API. They are the path of least resistance for capturing fast-moving signal: "interested in laptop", "complained about shipping", "needs callback Friday". Stack tags freely. Surface them in segments. Audit every change.',
      bullets: [
        'Multi-value tags with categories and colors',
        'Auto-apply rules from any contact signal',
        'Bulk add or remove on filtered audiences',
        'Full add/remove audit log per contact',
      ],
    },

    problem: {
      title: 'Tags drift — until they are governed',
      body:
        'Tags are the most useful and most abused primitive in any CRM. They start clean: "VIP", "Hot Lead", "Refund Pending". Six months in, the same database has "VIP", "vip", "VIP-Customer", "vip_2023", "vipgold", "Vip ⭐", and nobody remembers which one the broadcast filter is checking. The marketing manager defends "VIPgold" because that is what her flow uses; support uses "VIP-Customer" because that is what was there when she joined. The segment that should be "all VIPs" silently misses 40% of them.\n\nThis is what happens when tags are unstructured strings with no governance. The platform lets anyone create a tag by typing it, lets two people type the same idea two ways, and never reconciles. The data eventually lies, and the team\'s confidence in segments quietly erodes.\n\nTags in SabNode CRM are governed. Tag names are canonicalised (case-insensitive, whitespace-trimmed, no duplicates). Tags can be grouped into categories ("Status", "Intent", "Source") with controlled vocabularies — only an admin can create a new tag in a category, and existing tags rename across all references atomically. Auto-apply rules eliminate the human typing inconsistency by deriving tags from signals deterministically. The result is a tag library that grows with intention, not entropy.',
    },

    overview: [
      'A Tag is a labelled flag on a contact, with optional category, color and description. Contacts can carry any number of tags simultaneously — "VIP", "Hindi speaker", "Refund pending", "B2B account" can all live on the same record without conflict. Each tag has metadata: when it was added, by whom (user, flow, rule, API), and an optional expiry date for time-bounded signals like "Promo recipient — expires in 7 days". Tag history per contact is queryable and never overwritten.',
      'Auto-apply rules are the workhorse. Define a rule like "if last_message_intent = refund_request AND no_resolution_in_24h, apply tag refund-escalation". The rule engine evaluates every relevant event and applies tags deterministically — no human typing, no inconsistency. Rules can also remove tags: "if order_status = delivered, remove tag awaiting-shipment". This is how you keep tags accurate over time without manual hygiene.',
      'Tags are second-class citizens to segments deliberately — they are cheap, fast and human-friendly while segments are the rigorous query layer. Most teams use both: tag liberally to capture signals as they happen ("interested in laptop"), then build segments that combine multiple tags with other filters ("tagged interested-in-laptop AND in segment Active-Last-30-Days"). Tags surface in flows (branch on tag), broadcasts (target by tag), and the contact UI (filter and color-coded badges).',
      'Governance is built in. An admin defines tag categories ("Lifecycle", "Intent", "Channel", "Risk") and decides whether each category is open (anyone can add a new tag value) or closed (only admins). The library page surfaces tags by usage, last-applied recency, and contact count — stale tags get flagged for cleanup. Renames propagate atomically: rename "VIP-Customer" to "VIP" and every contact, segment, flow and rule updates in one transaction. No broken references.',
    ],

    capabilities: [
      {
        title: 'Multi-value tags',
        body: 'A contact can carry unlimited tags simultaneously. Tags do not conflict — "VIP" and "At risk" can both apply when both are true. Each tag carries metadata: when, by whom, optional expiry. Tags surface as colored badges in every contact UI.',
      },
      {
        title: 'Auto-apply rules',
        body: 'Define rules that add or remove tags based on contact events, field changes, flow outcomes, broadcast engagement, AI outcomes. Rules run in real time. Replaces 80% of manual tagging and eliminates human inconsistency.',
      },
      {
        title: 'Categories with vocabularies',
        body: 'Group tags into categories like Lifecycle, Intent, Source. Mark a category as closed (only admins create values) for governance-critical fields, open (anyone) for fast-moving signal capture. Categories surface as filters in the contact UI.',
      },
      {
        title: 'Bulk add and remove',
        body: 'Select up to 50,000 contacts via filter and add or remove tags in one operation. Progress bar, partial failure reporting, and 24-hour undo. The standard tool for mass cleanup after a migration or campaign.',
      },
      {
        title: 'Tag expiry and TTL',
        body: 'Apply a tag with a TTL — "Promo recipient" expires in 7 days, "Out of office" expires on a date. Expired tags auto-remove silently. Audit log captures the auto-removal. Replaces manual cleanup of stale signals.',
      },
      {
        title: 'Atomic renames',
        body: 'Rename a tag once and every reference — contacts, segments, flows, rules, broadcasts — updates atomically in a single transaction. No half-renamed mess, no broken references. The standard tool for fixing legacy taxonomy debt.',
      },
      {
        title: 'Per-contact audit log',
        body: 'Every tag add and remove is logged with timestamp, source (manual / flow / rule / API), and the user or system that triggered it. Surfaces in the contact timeline. Critical for compliance teams who need to prove why a contact was treated a certain way.',
      },
    ],

    useCases: [
      {
        title: 'D2C interest capture mid-conversation',
        industry: 'D2C',
        body: 'Auto-apply rule: if customer mentions "laptop" or "macbook" or "thinkpad" in any inbound, apply tag interested-in-laptop with 30-day TTL. Marketing builds a segment from the tag and sends a flash sale broadcast. Tag expires automatically; campaign does not re-spam stale leads next month.',
      },
      {
        title: 'B2B SaaS deal-stage parallel signals',
        industry: 'SaaS',
        body: 'Deals live in Kanban with one stage at a time, but contacts carry parallel intent tags: "needs SSO", "wants HIPAA", "evaluating against competitor X". Auto-applied from conversation analysis. AE prep page shows all active intent tags so the next call addresses every concern, not just the latest one.',
      },
      {
        title: 'Healthcare risk flagging',
        industry: 'Healthcare',
        body: 'Auto-apply rule on AI conversation outcome: if patient mentions chest pain, apply tag clinical-priority with no TTL. Flow watches for the tag and routes to a triage nurse within 5 minutes. Tag also gates marketing — promotional broadcasts skip contacts with clinical-priority active.',
      },
      {
        title: 'Logistics dispute tracking',
        industry: 'Logistics',
        body: 'Conversation analysis tags contacts with dispute-shipping, dispute-quality, dispute-pricing. Ops dashboards show open disputes by type. Tag removed automatically when the resolution flow completes. Replaces a spreadsheet that the ops lead used to maintain by hand.',
      },
      {
        title: 'EdTech course-affinity tagging',
        industry: 'EdTech',
        body: 'Auto-apply tags by inquired course: interested-mba, interested-iit, interested-bank-exam. A single student can carry multiple. Segments combine course tag with other signals to drive targeted nurture flows. Course catalog change updates rules; tags re-derive on next event without manual re-tagging.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Create a tag',
        body: 'From the contact page, the tag library, or a flow node. Pick a category if one applies. Optional color and description. Save promotes the tag to the library.',
      },
      {
        step: '02',
        title: 'Apply manually or via rule',
        body: 'Manual: click on a contact, pick a tag. Rule: define the condition in the auto-apply rules page, the engine handles the rest as events flow. Both paths share the same audit log.',
      },
      {
        step: '03',
        title: 'Use in segments and flows',
        body: 'Filter segments by tag presence or absence. Branch flows on contact_has_tag. Target broadcasts by tag. Tags become the fastest path from "I noticed X" to "automate response Y".',
      },
      {
        step: '04',
        title: 'Govern and clean up',
        body: 'The tag library page shows usage, recency and stale tags. Rename or merge tags atomically. Mark categories closed when governance matters. Bulk remove obsolete tags from filtered contacts.',
      },
      {
        step: '05',
        title: 'Audit and export',
        body: 'Per-contact tag history surfaces in the timeline. Export the full tag matrix for analytics or BI. API endpoint lets external systems query and modify tags with the same audit guarantees.',
      },
    ],

    integrations: ['Shopify', 'HubSpot', 'Pipedrive', 'Salesforce', 'Google Sheets', 'Slack', 'Zapier', 'Meta WhatsApp Cloud API'],

    metrics: [
      { value: '50,000', label: 'contacts per bulk-tag operation' },
      { value: '<2s', label: 'auto-apply rule end-to-end latency' },
      { value: '180+', label: 'tags per tenant on the median plan' },
      { value: '100%', label: 'tag changes captured in audit log' },
    ],

    faqs: [
      {
        q: 'When should I use a tag versus a custom field?',
        a: 'Use a tag when the signal is binary, multi-value, fast-changing, or experimental — "interested in X", "needs callback". Use a custom field when the signal is structured and singular — `kyc_status` (one of: pending, verified, rejected), `birth_date` (one date). Tags are stack-friendly (a contact can have many), fields are typed and singular. In doubt, start with a tag and promote to a field if the signal becomes load-bearing.',
      },
      {
        q: 'How do auto-apply rules differ from flows?',
        a: 'Auto-apply rules are narrow and fast: they evaluate one condition and add or remove one tag. They run on every relevant event in milliseconds. Flows are broad and orchestrated: they coordinate multiple steps, calls, waits and side effects. If you need to "tag the contact and send a message and update a field", that is a flow. If you need to "tag the contact when X is true", that is a rule. Rules feed flows by changing tag state that flow triggers can observe.',
      },
      {
        q: 'Can I version tag changes?',
        a: 'Every tag change is captured in the audit log with full metadata. A contact\'s tag history is queryable end-to-end — "what tags did this contact have on 2024-08-15?". Bulk tag operations create a single audit entry covering all affected contacts so the operations team can audit the action without scanning thousands of individual entries. Tag library renames are versioned at the library level.',
      },
      {
        q: 'How does tag expiry work?',
        a: 'When you apply a tag with a TTL — relative ("expires in 7 days") or absolute ("expires on 2024-12-31") — the engine schedules an auto-remove at the expiry moment. At the scheduled time the tag is removed and an audit entry captures the auto-removal. You can extend the TTL by re-applying the tag (which updates the expiry) or remove it earlier manually. TTL is per-application, not per-tag — the same tag on different contacts can have different expiries.',
      },
      {
        q: 'Can I import tags from a CSV?',
        a: 'Yes. CSV import has a tags column that accepts comma-separated tag names. The importer canonicalises names, creates missing tags in the default category, and applies all in one transaction. For more granular control (set TTL per tag, specify category), use the bulk-edit API which accepts JSON per-row tag actions.',
      },
      {
        q: 'What is the limit on tags per contact?',
        a: 'No hard limit. Production contacts carry 5-30 active tags on average, with some power users running 100+ on key accounts. The contact UI virtualises the tag list above 20 so dense profiles stay performant. If you find yourself over 50 tags per contact regularly, consider whether some should be promoted to custom fields with structured values instead.',
      },
      {
        q: 'How are tags handled when contacts merge?',
        a: 'Tag sets union — the merged contact carries every tag from both source contacts, with the earliest timestamp preserved for "applied at". Conflicting TTLs use the longer remaining window. Audit log captures both source histories so the merged contact\'s tag history is complete. Unmerge (within 30 days) splits tags back to whichever source contact originally received them.',
      },
    ],

    related: ['contacts', 'segments', 'custom-fields', 'flow-builder'],
  },

  /* ------------------------------------------------------------------ */
  /* 10. KANBAN PIPELINE                                                */
  /* ------------------------------------------------------------------ */
  {
    slug: 'kanban-pipeline',
    name: 'Kanban Pipeline',
    brand: 'CRM',
    category: 'customer-data',
    tagline: 'Lead → qualified → proposal → won. Drag, filter, score, forecast.',
    iconKey: 'layers',
    color: '#F59E0B',
    tint: '#FEF3C7',

    seoTitle: 'Kanban Pipeline — Visual Sales & Lifecycle CRM | SabNode',
    seoDescription:
      'Multi-pipeline Kanban with custom stages, lead scoring, drag-and-drop, automations on stage change, and forecast roll-up. Built for WhatsApp-first sales.',
    keywords: [
      'whatsapp crm pipeline',
      'kanban sales board',
      'lead pipeline management',
      'sales stage automation',
      'lead scoring crm',
      'sales forecast kanban',
      'deal pipeline whatsapp',
      'sabnode crm kanban',
      'visual sales pipeline',
      'multi-pipeline crm',
    ],

    hero: {
      eyebrow: 'CRM · Customer Data',
      headline: 'Sales pipelines that breathe with your conversations',
      subhead:
        'Kanban Pipeline gives every sales motion — leads, deals, support tickets, onboarding — a visual board with custom stages, drag-and-drop, automations on entry and exit, and a forecast that updates as deals move. Built for teams who sell in WhatsApp threads, not in spreadsheets.',
      bullets: [
        'Unlimited pipelines with custom stages',
        'Drag-and-drop with automation on stage change',
        'Lead scoring with custom rules',
        'Forecast and conversion roll-up per pipeline',
      ],
    },

    problem: {
      title: 'The pipeline that updates itself, finally',
      body:
        'Sales pipelines are where CRMs go to die. The board looks great in the demo — colored columns, drag-and-drop, big numbers at the bottom. Three months in, half the deals are stuck in "Qualified" because nobody bothered to move them. The closed-won column is empty because reps forget to update after they close on WhatsApp. The forecast is fiction. Leadership distrusts the board and runs Monday standups off a Google Sheet instead.\n\nThe problem is not the visualisation — kanban boards are fine. The problem is that the board is a separate place from where the actual conversation happens. A rep closes a deal in WhatsApp on Friday afternoon and remembers to update the CRM card on Monday morning, maybe. By then three other deals have moved, and the board reflects last week\'s reality.\n\nKanban Pipeline in SabNode CRM is fused to the conversation surface. The contact card on the board is the same contact you chat with in the inbox. Stage changes can trigger flows automatically — moved to "Proposal Sent" fires the proposal template, moved to "Won" triggers onboarding, moved to "Lost" tags the contact for re-engagement in 90 days. Conversation activity feeds back: an inbound message after 14 days of silence flags the deal for follow-up. The board updates because the work updates it, not because someone remembers to.',
    },

    overview: [
      'A Pipeline is a sequence of named stages with a defined purpose — sales (Lead, Qualified, Proposal, Won, Lost), onboarding (Signed, Setup, Training, Activated), support (New, In Progress, Resolved). You can run unlimited pipelines in parallel; a contact can sit on multiple boards at once (a Won customer can simultaneously be at "Training" in onboarding and "New" in support). Each pipeline has its own stages, automations, scoring rules and forecast settings.',
      'Stages are configurable as much or as little as you need. Each stage has a name, color, an optional WIP limit (no more than 20 deals in "Proposal" at once), a target duration (deals over 14 days here are flagged stale), and entry/exit automations. Entry automation is "fire a flow when a deal enters this stage" — auto-send the proposal template when a deal moves to "Proposal Sent". Exit automation handles cleanup or notifications. No manual orchestration; the pipeline is a state machine you operate visually.',
      'Drag-and-drop is the primary interface, but every stage transition can also happen programmatically — from a flow node, an API call, an AI Studio tool, or an auto-rule. This dual-mode is critical: humans drag deals when they have context, automation moves deals when signals fire. A deal that has been silent for 21 days in "Proposal" can auto-move to "Stalled" via rule. A new inbound from a previously-Lost contact can auto-move back to "Lead — Re-engaged". The board reflects the truth the conversation is creating.',
      'Lead scoring runs in the background per pipeline. Define rules — +20 for "title contains CTO", +30 for "company size > 500", -10 for "no reply in 7 days" — and every deal carries a live score. The board sorts within each stage by score so reps work the highest-value cards first. Scores feed segments ("hot deals: score ≥ 80") and flows ("if score crosses 90, alert AE in Slack"). The forecast at the bottom of the board rolls up score-weighted deal values per stage to project pipeline coverage.',
    ],

    capabilities: [
      {
        title: 'Unlimited custom pipelines',
        body: 'Run separate pipelines for sales, onboarding, support, refund disputes, partner deals. Each pipeline has its own stages, automations, scoring rules and access controls. Contacts can sit on multiple pipelines simultaneously without conflict.',
      },
      {
        title: 'Stage entry and exit automations',
        body: 'Wire a flow to fire when a deal enters or exits a stage. Auto-send proposal on Proposal Sent, trigger onboarding on Won, tag and re-engage in 90 days on Lost. Replaces the manual playbook with deterministic execution.',
      },
      {
        title: 'WIP limits and target durations',
        body: 'Set per-stage WIP limits to enforce focus. Set target durations to surface stale deals automatically. The board highlights overflows and stalls so leads catch process issues without running reports.',
      },
      {
        title: 'Lead scoring with custom rules',
        body: 'Compose scoring rules from any contact signal — firmographic, behavioral, engagement. Scores update in real time. Board sorts within stage by score. Scores feed segments, flow branches and Slack alerts.',
      },
      {
        title: 'Forecast roll-up',
        body: 'Each deal has an expected value and a stage-based probability. Forecast at the bottom of the board sums weighted values per stage and totals pipeline coverage. Configurable probability per stage. Updates instantly on drag.',
      },
      {
        title: 'Drag-and-drop + programmatic moves',
        body: 'Humans drag deals when they have context. Flows, rules and AI tools move deals when signals fire. Both paths share the same audit log. Stage history per deal queryable for win-loss analysis.',
      },
      {
        title: 'Pipeline-level RBAC',
        body: 'Restrict who can see, edit or move deals on a pipeline. Sales reps see only their pipeline; managers see all; finance sees forecast totals only. Granular roles support agencies running multiple client pipelines in one tenant.',
      },
    ],

    useCases: [
      {
        title: 'D2C inbound WhatsApp leads',
        industry: 'D2C',
        body: 'Single sales pipeline: Inquired, Qualified, Quoted, Negotiating, Won, Lost. Auto-move from Inquired to Qualified when AI flags purchase intent. Manual drag for everything else. Entry automation on Won creates a Shopify customer and sends the onboarding sequence.',
      },
      {
        title: 'B2B SaaS multi-pipeline ops',
        industry: 'SaaS',
        body: 'Three pipelines: Sales (Lead → Closed), Onboarding (Signed → Activated), Renewals (90-day, 30-day, 7-day). A contact moves through all three over the year. Each pipeline has its own RBAC — sales reps cannot see renewals; CSMs cannot edit sales stages.',
      },
      {
        title: 'EdTech admissions counsellor board',
        industry: 'EdTech',
        body: 'Pipeline: Inquired, Counselled, Application Started, Documents Submitted, Enrolled. Scoring on student demographics and engagement. Stage entry on Enrolled triggers a payment-link flow. Counsellor wakes up to a board sorted by lead score, not random order.',
      },
      {
        title: 'Real-estate site-visit pipeline',
        industry: 'Real Estate',
        body: 'Pipeline: Inquired, Property Sent, Site Visit Scheduled, Visited, Booked. Stage entry on Site Visit Scheduled auto-sends a calendar invite and sets a reminder. Stale deals over 14 days in any pre-Booked stage auto-tag for re-engagement. Brokers focus on hot deals, not the queue.',
      },
      {
        title: 'Logistics dispute pipeline',
        industry: 'Logistics',
        body: 'Pipeline: New, Investigating, Resolution Proposed, Customer Confirmed, Closed. AI tags inbound disputes by type. Exit automation on Closed updates Shopify with the resolution code. Ops manager sees aggregate volume per dispute type and average time-to-resolution.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Define a pipeline',
        body: 'Name it, add stages, configure colors, WIP limits, target durations. Set the contact entry rules — manual only, or auto-create on a specific event.',
      },
      {
        step: '02',
        title: 'Wire automations',
        body: 'Attach flows to stage entry and exit. Configure auto-move rules from contact events (inbound silence, score threshold, custom field change).',
      },
      {
        step: '03',
        title: 'Score and forecast',
        body: 'Build scoring rules from contact signals. Set expected value and stage probability for forecast. Both update in real time as deals move.',
      },
      {
        step: '04',
        title: 'Operate the board',
        body: 'Reps drag deals based on context. Flows move deals based on signals. The board reflects current reality. Filter by owner, score, recency, custom field.',
      },
      {
        step: '05',
        title: 'Review and optimise',
        body: 'Forecast at the bottom of the board. Stage-conversion report shows leaky stages. Win-loss analysis reveals patterns. Iterate on scoring and stages quarterly.',
      },
    ],

    integrations: ['Shopify', 'HubSpot', 'Salesforce', 'Pipedrive', 'Slack', 'Google Calendar', 'Razorpay', 'Stripe'],

    metrics: [
      { value: '∞', label: 'pipelines per tenant — no cap' },
      { value: '40%', label: 'reduction in deals lost to staleness' },
      { value: '<300ms', label: 'p95 drag-to-update latency on the board' },
      { value: '2.4×', label: 'faster lead qualification with scoring' },
    ],

    faqs: [
      {
        q: 'Can a contact be on multiple pipelines at once?',
        a: 'Yes, and most production tenants run it this way. A customer can simultaneously be at "Activated" in onboarding and "New" in support — these are independent pipelines, independent stages. The contact detail page shows every pipeline they are on with current stage. RBAC controls which team sees which pipeline so cross-team views stay clean.',
      },
      {
        q: 'How does the forecast probability per stage get set?',
        a: 'Each stage has a default probability (e.g. Lead 10%, Qualified 25%, Proposal 50%, Negotiating 75%, Won 100%, Lost 0%). You set these per pipeline based on historical conversion. The forecast sums (deal_value × stage_probability) across the pipeline. Advanced mode lets you override probability per deal — a normally 50% Proposal might be 80% because of a strong signal. Audit log captures every override for win-loss accuracy review.',
      },
      {
        q: 'Can I see the conversion rate between stages?',
        a: 'Yes. The pipeline analytics page shows funnel conversion per stage pair (Qualified → Proposal: 38%, Proposal → Won: 22%), average duration per stage, and stage-where-deals-die distribution. Filter by owner, source, time window. Critical for spotting that "deals reaching Negotiating convert at 80% — we should send more there" or "Qualified to Proposal drops 60% — interview the reps".',
      },
      {
        q: 'How are deals created on a pipeline?',
        a: 'Three ways. (1) Manual: rep clicks "New Deal" on the board, picks a contact, fills required fields. (2) Auto on event: a rule like "when contact replies to broadcast X, create deal in pipeline Y at stage Z". (3) API: external systems POST to `/api/pipelines/{slug}/deals` to create programmatically. All three share the same validation and audit log.',
      },
      {
        q: 'What happens to a deal when the contact is deleted?',
        a: 'Deals are soft-deleted alongside the contact. The deal row remains in the audit log for compliance and historical reporting (win-loss totals, forecast accuracy) but is removed from the active board. If the contact is restored within 30 days (undelete window), the deal reactivates at its last stage. After 30 days, hard delete purges both.',
      },
      {
        q: 'Can two reps own the same deal?',
        a: 'Yes. Each deal has a primary owner (for SLAs and notifications) and optional collaborators. Collaborators get visibility and can edit but are not the responsible owner. This handles common patterns like an SDR who qualifies and an AE who closes — both are involved, but the responsibility transfers cleanly when the deal moves to the AE\'s stage. Ownership history is logged.',
      },
      {
        q: 'How does lead scoring stay accurate over time?',
        a: 'Scoring rules are versioned. When you adjust a rule, existing scores recompute in the background within minutes — no manual rebuild. The score history per deal is logged so you can see "this deal was 65 last week and is 82 now because of this new event". Quarterly we recommend a model review: which rules predicted outcomes, which were noise. The dashboard surfaces rule-level lift over baseline so you can prune dead weight.',
      },
    ],

    related: ['contacts', 'segments', 'tags', 'custom-fields'],
  },

  /* ------------------------------------------------------------------ */
  /* 11. CUSTOM FIELDS                                                  */
  /* ------------------------------------------------------------------ */
  {
    slug: 'custom-fields',
    name: 'Custom Fields',
    brand: 'CRM',
    category: 'customer-data',
    tagline: 'Structured properties on any contact or deal — text, date, number, JSON.',
    iconKey: 'database',
    color: '#10B981',
    tint: '#D1FAE5',

    seoTitle: 'Custom Fields — Structured Contact Properties | SabNode CRM',
    seoDescription:
      'Add typed custom fields to any contact or deal — text, number, date, boolean, JSON, file reference. Validation, history, API access and form binding included.',
    keywords: [
      'crm custom fields',
      'whatsapp custom contact properties',
      'typed contact fields',
      'json custom field crm',
      'contact data model builder',
      'crm field validation',
      'sabnode custom properties',
      'contact metadata fields',
      'custom field history audit',
      'crm form custom fields',
    ],

    hero: {
      eyebrow: 'CRM · Customer Data',
      headline: 'Stop forcing structured data into a notes field',
      subhead:
        'Custom Fields let you extend any contact or deal with typed, validated properties — KYC status, birth date, lifetime value, preferred language, JSON blob of feature flags. Fields populate from flows, imports, the API or by hand. They drive segments, gate flows, personalise templates, and never decay into free-text mush.',
      bullets: [
        'Text, number, date, boolean, select, JSON, file types',
        'Validation rules and required-field enforcement',
        'Bound to forms, flows, imports and API',
        'Full change history per contact per field',
      ],
    },

    problem: {
      title: 'The "notes" field where data goes to die',
      body:
        'Watch what happens when a team without a proper data model needs to track something new — say, KYC status. First week: a rep starts typing "KYC done" into the notes field for each verified contact. Second week: another rep types "verified" instead. Third week: someone wants a list of all unverified customers and discovers they need to regex through 80,000 unstructured strings. By month two: a spreadsheet appears, lives in someone\'s laptop, drifts from CRM reality, gets emailed around as the source of truth for the compliance audit.\n\nThis is what happens when structured data has no home. The notes field is a graveyard — convenient to write to, impossible to query against, drifts with every new typist. Promoting a signal to a structured field is the fix, but only if the platform makes it cheap: easy to define, validated, exposed to every consumer, and tracked over time.\n\nCustom Fields in SabNode CRM is built to make field creation cheap. Five clicks to define `kyc_status` as a single-select with three values. Five more clicks to backfill from a CSV. The new field shows up in segments, flow nodes, form bindings, broadcasts, the API and exports — all without engineering touch. Change history per field per contact gives compliance the trail they need. The notes field goes back to being notes.',
    },

    overview: [
      'A Custom Field is a typed property attached to a contact, deal, or company entity. Eight built-in types: short text (up to 255 chars), long text (up to 50,000 chars), number (int or decimal with precision), date (with or without time), boolean, single-select (controlled vocabulary), multi-select (multi-value controlled), and JSON (arbitrary structured blob). Each field has validation rules — required, regex pattern, min/max for numbers, allowed values for selects, JSON schema for JSON. Validation runs on every write path so bad data never enters the system.',
      'Fields populate from every direction. Manually via the contact UI. From a flow node that sets a field after an event — `set kyc_status = "verified"` after the verification flow completes. From CSV imports with column-to-field mapping. From the REST API with bulk update endpoints. From web forms via a field-binding component that creates and updates contacts with the form\'s field map. Every write path validates, audits, and propagates to segments and downstream consumers in real time.',
      'Fields are first-class everywhere they appear. Segments filter on field values with type-appropriate operators (string equals, number greater than, date within last N days, JSON path equals). Flow Branch nodes test field values to route execution. WhatsApp template variables interpolate field values — `{{contact.birth_date | date:dd MMMM}}` renders "15 August" inline. Broadcasts personalise from fields. AI Studio assistants access fields as part of the conversation context. The field is defined once and consumed everywhere by reference, not by copy.',
      'Change history is preserved field-by-field, contact-by-contact, write-by-write. Every value change captures the timestamp, the source (flow node ID, API call, manual user edit, import job), the previous value and the new value. Queryable per contact ("show every change to `kyc_status` for contact X") and exportable for compliance. Retention is two years on standard plans, seven on enterprise — sufficient for most regulatory windows (DPDP, GDPR, RBI audit, HIPAA-aligned).',
    ],

    capabilities: [
      {
        title: 'Eight typed field types',
        body: 'Short text, long text, integer, decimal, date, datetime, boolean, single-select, multi-select, JSON, file reference. Each carries type-specific validation. JSON fields accept a JSON Schema for structured validation. File references point to SabFiles entries with permissions inherited.',
      },
      {
        title: 'Validation rules built in',
        body: 'Required, unique, regex pattern, min/max length, min/max value, allowed values list, JSON schema. Validation runs on every write path — form, flow, API, import — so bad data is impossible to enter. Errors surface to the writer with field-level detail.',
      },
      {
        title: 'Multi-source population',
        body: 'Manual edit, flow node action, CSV import with column mapping, REST API bulk update, web form binding. Every source validates and audits the same way. No "this came from the import so we did not validate" surprises.',
      },
      {
        title: 'First-class everywhere',
        body: 'Fields surface in segments (filter), flows (branch and set), broadcasts (personalise), templates (interpolate), AI assistants (context), the API (CRUD), exports (column), and forms (binding). One definition, every consumer.',
      },
      {
        title: 'Change history per field',
        body: 'Every field write captures timestamp, source, previous and new values. Queryable per contact for compliance and debugging. Retention is two years standard, seven on enterprise. Hard-purges on contact delete after the retention window.',
      },
      {
        title: 'Field-level RBAC',
        body: 'Restrict who can read or write specific fields. Sales reps see `lifetime_value`, finance edits it. Support sees `account_tier`, only admins change it. Sensitive PII fields (Aadhaar, PAN) gated to ops with audit trail. RBAC enforced on every read and write path.',
      },
      {
        title: 'Backfill and migrations',
        body: 'When you add a new field, the backfill tool runs a one-shot population from a CSV, a flow execution, or a rule evaluated against existing contacts. Schema migrations (rename, type change) handled atomically with downstream reference updates. No half-migrated state.',
      },
    ],

    useCases: [
      {
        title: 'Fintech KYC structured tracking',
        industry: 'Financial Services',
        body: 'Fields: `kyc_status` (single-select: pending, verified, rejected), `pan_number` (text with regex validation, PII-restricted), `kyc_verified_at` (datetime). Segments filter on status. Flows gate transactions on verified. Audit log proves to RBI inspectors exactly when each customer was verified.',
      },
      {
        title: 'E-commerce loyalty tier',
        industry: 'E-commerce',
        body: 'Fields: `loyalty_tier` (single-select: bronze, silver, gold), `lifetime_value` (decimal, auto-updated by flow on each order), `last_purchase_at` (datetime). Tier auto-derived from lifetime_value via rule. Segments per tier drive differentiated broadcasts and offers.',
      },
      {
        title: 'EdTech course preference',
        industry: 'EdTech',
        body: 'Fields: `target_exam` (multi-select: NEET, JEE, CAT, GMAT), `preferred_language` (single-select: Hindi, English, Tamil, Telugu), `study_hours_per_week` (integer). Drives course recommendations from AI assistant and language selection for broadcast templates.',
      },
      {
        title: 'Healthcare patient demographics',
        industry: 'Healthcare',
        body: 'Fields: `dob` (date, validated > 1900), `allergies` (long text), `preferred_doctor` (single-select from doctor list), `last_consultation` (datetime). PII-restricted to clinical staff. Drives age-appropriate reminders and doctor-affinity in appointment scheduling.',
      },
      {
        title: 'B2B SaaS account metadata',
        industry: 'SaaS',
        body: 'Fields: `company_id` (text), `company_size` (integer), `mrr` (decimal), `feature_flags` (JSON with schema). Flow branches on feature_flags.advanced_reports to send relevant updates. AI assistant uses MRR for tier-appropriate response style. JSON schema prevents typos in flag names.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Define the field',
        body: 'Pick entity (contact, deal, company), name, type, validation rules. Set RBAC per field. Save and the field is immediately available everywhere.',
      },
      {
        step: '02',
        title: 'Populate from sources',
        body: 'Backfill from CSV, set from a flow node, expose in a web form, write via API. Every source validates the same way.',
      },
      {
        step: '03',
        title: 'Reference in consumers',
        body: 'Build segments filtering on the field. Branch flows on field values. Interpolate into templates. Surface in AI assistant context. All by reference — change once, propagates everywhere.',
      },
      {
        step: '04',
        title: 'Audit and govern',
        body: 'Change history per contact per field. Field-level RBAC restricts access. Schema migrations atomic across all references. Sensitive fields tagged PII with extra audit.',
      },
      {
        step: '05',
        title: 'Iterate',
        body: 'Add validation rules as data quality issues surface. Rename and migrate fields atomically when terminology evolves. Archive unused fields. Field library page shows usage and stale candidates.',
      },
    ],

    integrations: ['Shopify', 'HubSpot', 'Salesforce', 'Google Sheets', 'BigQuery', 'Stripe', 'Razorpay', 'Zapier'],

    metrics: [
      { value: '200+', label: 'custom fields per entity on enterprise plans' },
      { value: '100%', label: 'field writes validated and audited' },
      { value: '<100ms', label: 'p95 read latency for fields in segments' },
      { value: '2-7 yr', label: 'change history retention per field' },
    ],

    faqs: [
      {
        q: 'Should I make every signal a custom field?',
        a: 'No. Use a custom field when the signal is structured, singular, and queryable — `kyc_status` (one of three values), `birth_date` (one date). Use a tag for binary or multi-value fast-moving signals. Use a custom field with JSON type when the signal is structured but has many sub-properties (feature flags, address blob). The wrong choice is putting structured data in long-text notes, where it cannot be queried or validated.',
      },
      {
        q: 'Can a JSON field have validation?',
        a: 'Yes. Attach a JSON Schema to the field and every write validates against it. Common pattern: `feature_flags` field with a schema declaring known flag names and their value types. Writes with unknown flags or wrong types fail validation with a field-level error. This catches bugs at the boundary instead of letting them propagate through flows and AI prompts.',
      },
      {
        q: 'How are field renames handled?',
        a: 'Atomically. Rename a field once and every reference — in segments, flows, broadcasts, AI prompts, exports, API queries — updates in a single transaction. No "half-renamed" intermediate state. The audit log captures the rename. Old field name is reserved for 30 days after rename to catch any external integrations that referenced it; we surface a warning in the audit page for any access attempts on the old name.',
      },
      {
        q: 'What is the limit on the number of custom fields?',
        a: '50 fields per entity on Starter plans, 100 on Growth, 200 on Enterprise. In practice most tenants run with 15-40 fields. Beyond 50, consider whether some fields belong on a related entity (deal, company) instead of bloating the contact model. Field-library hygiene matters — the library page surfaces stale fields with zero writes in 90 days as candidates for archival.',
      },
      {
        q: 'Can field history be queried via API?',
        a: 'Yes. The change-history endpoint accepts contact ID, field name, and a time window, returning the full sequence of changes with timestamp and source. Useful for compliance exports, debugging "why did this contact get this template" investigations, and BI ingestion when you need historical state-over-time for cohort analysis. Rate-limited to prevent accidental scrapes.',
      },
      {
        q: 'How do PII fields differ from regular fields?',
        a: 'Mark a field as PII (Aadhaar, PAN, credit card, SSN) and the platform applies extra protections: write requires explicit RBAC permission, reads are logged separately for audit, exports require additional approval, and field values are masked in default UIs (showing last 4 digits only). AI Studio redaction strips these values before prompts reach the model. The field still functions like any other for flows and segments — protections are about who can see the raw value.',
      },
      {
        q: 'Can I prevent two writes from racing on the same field?',
        a: 'Yes via optimistic concurrency. The API accepts an `If-Match` header with the field\'s version token; writes that race against a concurrent update fail with 412 and surface the current value. For flows, set node modes are atomic — the platform serialises writes per (contact, field) so two parallel flow executions that both want to set the field cannot create a half-update. JSON fields support patch operations that merge rather than overwrite for sub-property writes.',
      },
    ],

    related: ['contacts', 'segments', 'tags', 'kanban-pipeline'],
  },

  /* ------------------------------------------------------------------ */
  /* 12. OPT-IN STATUS                                                  */
  /* ------------------------------------------------------------------ */
  {
    slug: 'opt-in-status',
    name: 'Opt-in Tracking',
    brand: 'CRM',
    category: 'customer-data',
    tagline: 'Per-channel consent tracking with audit log and export.',
    iconKey: 'shield',
    color: '#06B6D4',
    tint: '#CFFAFE',

    seoTitle: 'Opt-in Tracking — Consent & Compliance | SabNode CRM',
    seoDescription:
      'Per-channel consent tracking for WhatsApp, email and SMS with full audit log, source attribution, DLT and GDPR exports. Never send to someone who said stop.',
    keywords: [
      'whatsapp opt in tracking',
      'gdpr consent management',
      'dlt compliance crm',
      'email opt in audit log',
      'whatsapp marketing consent',
      'per channel opt in',
      'subscription preference center',
      'consent capture form',
      'unsubscribe tracking whatsapp',
      'sabnode opt in compliance',
    ],

    hero: {
      eyebrow: 'CRM · Compliance',
      headline: 'Know exactly who said yes — and when, where, how',
      subhead:
        'Opt-in Tracking captures per-channel consent across WhatsApp, Email, SMS and Web Push with source attribution, timestamp, and the literal text the contact saw. Auto-honor opt-outs at send time. Export the audit log for DLT, GDPR, DPDP and CCPA reviews. Never accidentally message someone who said stop.',
      bullets: [
        'Per-channel consent (WhatsApp, Email, SMS, Push)',
        'Source attribution with original UI snapshot',
        'Auto-enforce at send time across modules',
        'Exportable audit log for DLT, GDPR, DPDP',
      ],
    },

    problem: {
      title: 'A single mis-sent broadcast costs more than the campaign',
      body:
        'Most teams treat opt-in as a checkbox in their signup form and never think about it again. They store "subscribed = true" somewhere, the broadcast tool reads it, and as long as nothing breaks, life is fine. Then a customer who explicitly typed STOP in WhatsApp last month gets a Diwali promotion, posts a screenshot on Twitter, and the brand spends a week apologising. Or worse — Meta flags the WhatsApp Business account for repeated unsolicited messaging and the account is suspended for 24 hours during peak season.\n\nThe industrial-strength version of this problem is the regulatory audit. India\'s DPDP and TRAI DLT regimes require provable consent per channel per purpose. Europe\'s GDPR requires the same. When the regulator asks "show me proof that contact X consented to marketing WhatsApp on date Y", a CSV with "subscribed=true" does not cut it. They want the form snapshot, the timestamp, the IP, the literal consent text. Most CRMs cannot produce this and the legal team starts a six-figure remediation project.\n\nOpt-in Tracking in SabNode is consent infrastructure, not a checkbox. Every consent capture records source, timestamp, IP, the exact consent text shown, and the channel scope. Every send checks current status before dispatch. Every opt-out triggers a re-confirm flow if the contact later re-engages. The audit log is regulator-ready by design.',
    },

    overview: [
      'A Contact has independent opt-in status for each channel — WhatsApp, Email, SMS, Web Push, Voice. Status is a four-state enum: subscribed (active, can be messaged for marketing), service-only (only transactional messages, common for WhatsApp 24-hour service window), opted-out (no messaging of any kind), unknown (no consent captured yet). The send pipeline checks current status before every outbound. A marketing template to an opted-out contact fails fast with a logged "consent block" event, never reaching the BSP.',
      'Capture is multi-source. Web forms with a consent checkbox component record the IP, user agent, form ID, page URL, and the exact consent text shown. WhatsApp opt-in via interactive button (the customer clicks "Yes, subscribe me") records the message ID and timestamp. Imports support a consent-source column for backfilling historical permissions with attribution. API endpoints accept consent metadata on every write. Every capture path produces the same auditable artifact.',
      'Updates are bidirectional. Outbound: a contact who replies STOP to a WhatsApp broadcast triggers an automatic opt-out across the channel, confirmation message, and DLQ block for any in-flight sends to that contact. Outbound email unsubscribe link does the same for email. Inbound: a contact who messages "subscribe" or clicks an explicit re-opt-in button gets status flipped back with a fresh attribution record. The preference center (a hosted page or embeddable widget) lets contacts manage their own consent across all channels with a single link, audited.',
      'Compliance export is built in. The audit endpoint returns every consent state change for a contact, with full attribution, on demand. Bulk export for tenant-wide audits runs as a background job and produces a regulator-ready CSV or PDF with the timestamps, sources and consent text. For India, the DLT registration ID can be attached to each capture. For EU, lawful basis (consent, legitimate interest, contract) is selectable per capture. For California (CCPA), do-not-sell flags are first-class. The compliance team should never need to ask engineering for a query again.',
    ],

    capabilities: [
      {
        title: 'Per-channel four-state consent',
        body: 'WhatsApp, Email, SMS, Web Push, Voice each have independent status: subscribed, service-only, opted-out, unknown. Marketing sends require subscribed. Transactional (OTP, order updates) honors service-only. Opted-out blocks every send including transactional unless explicitly overridden with audit.',
      },
      {
        title: 'Source attribution per capture',
        body: 'Every consent change captures source (web form ID + URL + IP, WhatsApp button ID, import job, manual edit, API call), timestamp, user agent, and the literal consent text the contact saw. Regulator-ready evidence by default, not as a bolt-on.',
      },
      {
        title: 'Auto-enforce at send time',
        body: 'Every outbound checks current consent before dispatch. Blocked sends log a structured "consent block" event with the reason. No more "we accidentally sent to an opted-out list" — the platform makes it impossible to bypass.',
      },
      {
        title: 'STOP and unsubscribe handling',
        body: 'Inbound STOP, UNSUBSCRIBE, OPT-OUT messages on WhatsApp trigger automatic opt-out, confirmation reply, and DLQ-block for in-flight sends. Email unsubscribe links do the same. Reply analysis configurable per language so Hindi and regional opt-out keywords work.',
      },
      {
        title: 'Re-engagement flow',
        body: 'When an opted-out contact later sends an inbound message, the platform routes to a configurable re-engagement flow — typically asking explicit re-subscribe before treating them as marketable. Prevents the "they messaged us so they must want our newsletter" misinterpretation.',
      },
      {
        title: 'Preference center',
        body: 'Hosted page (or embeddable widget) where contacts manage consent across all channels with one link. Includes purpose-level granularity ("marketing", "product updates", "billing reminders") when configured. Every change captures attribution like any other source.',
      },
      {
        title: 'Compliance export',
        body: 'On-demand audit export per contact or tenant-wide. CSV or PDF with attribution, timestamps, consent text and channel. India DLT registration ID, EU lawful basis, CCPA do-not-sell flags all first-class. Regulator-ready without engineering involvement.',
      },
    ],

    useCases: [
      {
        title: 'D2C WhatsApp marketing compliance',
        industry: 'D2C',
        body: 'Web form has an explicit "I agree to receive WhatsApp marketing from Brand X" checkbox with the consent text. Submission records IP, page URL, exact text. Customer who later replies STOP gets opted out automatically with confirmation. Tenant-wide audit export pulled monthly for the legal team\'s compliance review.',
      },
      {
        title: 'NBFC DLT-compliant lending nudges',
        industry: 'Financial Services',
        body: 'Each WhatsApp template registered with TRAI DLT carries a registration ID. Capture path records the DLT ID alongside consent. Send pipeline blocks any send where the contact\'s consent does not match the DLT scope. Regulator audit pulls the export and verifies template-to-consent linkage instantly.',
      },
      {
        title: 'EdTech multi-purpose consent',
        industry: 'EdTech',
        body: 'Student opts in to "exam updates" and "course offers" as separate purposes. Marketing broadcasts target only consenting purposes. Student can later opt out of offers but keep exam updates via the preference center. Granular consent improves long-term subscription retention.',
      },
      {
        title: 'Healthcare appointment vs marketing',
        industry: 'Healthcare',
        body: 'Patient opt-out blocks marketing but preserves transactional appointment reminders via service-only status. Critical for clinics that want to respect "do not market to me" without missing safety-critical reminders. Audit log distinguishes the two so compliance can demonstrate the intentional design.',
      },
      {
        title: 'Cross-border GDPR for SaaS',
        industry: 'SaaS',
        body: 'EU contacts captured with lawful basis = consent for marketing, contract for transactional. Right-to-erasure requests honored via the contact-delete flow that purges PII but preserves anonymised consent log for proof of compliance. Audit export structured to the EDPB recommended format.',
      },
    ],

    howItWorks: [
      {
        step: '01',
        title: 'Configure channels and purposes',
        body: 'Enable channels (WhatsApp, Email, SMS, Push). Optionally define purposes (marketing, product, billing) for granular consent. Set the default state for newly-created contacts (unknown by default, never subscribed).',
      },
      {
        step: '02',
        title: 'Capture consent at every touchpoint',
        body: 'Web form components, WhatsApp opt-in buttons, import flows, API endpoints — every source captures attribution automatically. Configure the consent text once and it propagates to all sources.',
      },
      {
        step: '03',
        title: 'Enforce on every send',
        body: 'Send pipeline checks current status before dispatch. Blocks marketing to non-subscribed, blocks all to opted-out. Logged consent-block events surface in the audit feed and DLQ analytics.',
      },
      {
        step: '04',
        title: 'Handle opt-out gracefully',
        body: 'STOP keyword detection per language flips status to opted-out, sends a confirmation, blocks in-flight sends. Re-engagement flow routes any future inbound through a re-confirm gate before treating the contact as marketable again.',
      },
      {
        step: '05',
        title: 'Export and audit',
        body: 'Tenant-wide audit export on demand. Per-contact history queryable via UI and API. Regulator-ready CSV or PDF with all attribution. Compliance team self-serves without engineering tickets.',
      },
    ],

    integrations: ['Meta WhatsApp Cloud API', 'Mailchimp', 'Gmail', 'Outlook', 'Twilio', 'OneTrust', 'TRAI DLT', 'Google Forms'],

    metrics: [
      { value: '100%', label: 'sends checked against current consent state' },
      { value: '<50ms', label: 'consent check latency per outbound' },
      { value: '0', label: 'opted-out contacts ever messaged via the pipeline' },
      { value: '5 yrs', label: 'consent audit log retention by default' },
    ],

    faqs: [
      {
        q: 'What if I import contacts with consent from another platform?',
        a: 'The import CSV supports columns for consent state per channel, source attribution, original capture timestamp, and the consent text shown at the original capture. The import preserves these as the canonical audit record — no data loss when migrating from Klaviyo, Mailchimp, Interakt, or another CRM. We recommend backfilling the original consent text where available; if not, the import flags those contacts as "legacy consent" so the legal team can decide whether to re-confirm.',
      },
      {
        q: 'How is the WhatsApp 24-hour service window handled?',
        a: 'Inside the service window (a contact has messaged you in the last 24 hours), free-form messages are allowed regardless of marketing consent because the contact initiated the conversation. Outside the window, only approved templates can be sent, and only to contacts with subscribed or service-only status for the channel. The send pipeline encodes this logic so flows do not need to track the window state manually — try to send outside the window without a template and the node fails with a clear reason.',
      },
      {
        q: 'Can I override consent for a specific send?',
        a: 'Only with explicit admin RBAC permission and an audit reason. The override is logged with the user who triggered it, the reason text, and the affected contacts. This exists for legitimate exceptions — emergency safety notification, regulatory required notice — but is intentionally cumbersome so it cannot be used as a daily workaround. Most tenants disable override entirely; the workflow then routes legitimate exceptions through legal review.',
      },
      {
        q: 'How does the preference center work?',
        a: 'The preference center is a hosted page at `prefs.sabnode.com/{tenant}/{contact_token}` (or your custom subdomain). The token is a signed JWT embedded in outbound email and WhatsApp unsubscribe links. The contact lands on a page showing their current consent per channel and per purpose, with toggles to update. Changes are captured with full attribution (timestamp, IP, user agent, the page state). Embedded widget version is available for customers who want it inside their own logged-in UI.',
      },
      {
        q: 'What happens during contact merge for consent?',
        a: 'Consent state takes the more restrictive value across the two contacts being merged — if one is opted-out and the other is subscribed, the merged contact is opted-out. This prevents accidental opt-back-in through a merge. Both source histories are preserved in the merged contact\'s audit log so the compliance team can trace exactly when each state change happened, on which source contact, regardless of the merge.',
      },
      {
        q: 'Are double opt-in workflows supported?',
        a: 'Yes for email by default — a contact who opts in via a form gets a confirmation email and is marked subscribed only after they click the confirmation link. The audit log captures both the initial opt-in and the confirmation. For WhatsApp, the convention is single opt-in via explicit button click since the channel itself requires opt-in to start; if you want stronger evidence, you can configure a follow-up confirmation message that requires a "yes" reply before marking subscribed.',
      },
      {
        q: 'How long is the consent audit log retained?',
        a: 'Five years by default on standard plans, configurable up to ten years on enterprise. This covers most regulatory windows globally — India DPDP recommends three years post-deletion, EU GDPR varies by purpose, RBI requires up to seven for financial communications. After retention expires, the log is purged but a summary row remains (count of state changes, last known state) for backwards-compatibility with billing and metrics. The full export should be archived externally if longer retention is needed.',
      },
    ],

    related: ['contacts', 'segments', 'broadcasts', 'templates'],
  },
];
