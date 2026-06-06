"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Code,
  Download,
  Search,
  Share,
  Sparkles,
  Terminal,
  AlertTriangle,
  Book,
  Activity,
  Play,
  Key,
  Copy,
  Check,
  ChevronRight,
  Menu,
  X,
  Lock
} from "lucide-react";
import { Button, Card, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Label, Badge, ScrollArea, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/sabcrm/20ui';
import { cn } from '@/components/sabcrm/20ui';

// ---------------------------------------------------------------------------
// DATA MODEL
// ---------------------------------------------------------------------------

type Parameter = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

type Endpoint = {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  group: string;
  title: string;
  description: string;
  badges: string[];
  parameters: Parameter[];
  codeExamples: Record<string, string>;
  response: string | null;
};

const ENDPOINTS: Endpoint[] = [
  {
    id: "send-message",
    method: "POST",
    path: "/v1/messages",
    group: "Messages",
    title: "Send a Message",
    description: "Send an outbound SMS, MMS, or WhatsApp message to a single recipient.",
    badges: ["Core API"],
    parameters: [
      { name: "to", type: "string (E.164)", required: true, description: "The destination phone number in E.164 format." },
      { name: "from", type: "string", required: false, description: "The sender phone number or alphanumeric sender ID." },
      { name: "body", type: "string", required: true, description: "The text content of the message." },
      { name: "media_urls", type: "array[string]", required: false, description: "An array of URLs for media attachments (MMS/WhatsApp)." },
      { name: "status_callback", type: "string (URL)", required: false, description: "A URL to receive delivery status webhooks." },
    ],
    codeExamples: {
      cURL: `curl -X POST https://api.sabsms.com/v1/messages \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+1234567890",
    "from": "+1987654321",
    "body": "Your verification code is 49201"
  }'`,
      "Node.js": `const { SabSMS } = require('sabsms');
const client = new SabSMS('sk_live_your_api_key');

const message = await client.messages.create({
  to: '+1234567890',
  from: '+1987654321',
  body: 'Your verification code is 49201'
});

console.log(message.id);`,
      "Python": `from sabsms import SabSMS

client = SabSMS('sk_live_your_api_key')

message = client.messages.create(
    to='+1234567890',
    from_='+1987654321',
    body='Your verification code is 49201'
)

print(message.id)`,
    },
    response: `{
  "id": "msg_01H1234567890ABCDEF",
  "to": "+1234567890",
  "from": "+1987654321",
  "body": "Your verification code is 49201",
  "status": "queued",
  "direction": "outbound-api",
  "segments": 1,
  "price": "0.015",
  "created_at": "2026-05-22T12:00:00Z"
}`
  },
  {
    id: "list-messages",
    method: "GET",
    path: "/v1/messages",
    group: "Messages",
    title: "List Messages",
    description: "Retrieve a list of messages associated with your workspace. Results are paginated.",
    badges: [],
    parameters: [
      { name: "limit", type: "integer", required: false, description: "Number of messages to return. Max 100. Default 20." },
      { name: "status", type: "string", required: false, description: "Filter by status (e.g., delivered, failed, queued)." },
      { name: "to", type: "string", required: false, description: "Filter by destination number." },
      { name: "cursor", type: "string", required: false, description: "Pagination cursor for the next page of results." },
    ],
    codeExamples: {
      cURL: `curl -X GET "https://api.sabsms.com/v1/messages?limit=10" \\
  -H "Authorization: Bearer sk_live_your_api_key"`,
      "Node.js": `const { SabSMS } = require('sabsms');
const client = new SabSMS('sk_live_your_api_key');

const messages = await client.messages.list({ limit: 10 });
console.log(messages.data);`,
    },
    response: `{
  "data": [
    {
      "id": "msg_01H1234567890ABCDEF",
      "to": "+1234567890",
      "from": "+1987654321",
      "body": "Your verification code is 49201",
      "status": "delivered",
      "created_at": "2026-05-22T12:00:00Z"
    }
  ],
  "has_more": false,
  "next_cursor": null
}`
  },
  {
    id: "retrieve-message",
    method: "GET",
    path: "/v1/messages/{id}",
    group: "Messages",
    title: "Retrieve a Message",
    description: "Fetch the details of a specific message by its unique ID.",
    badges: [],
    parameters: [
      { name: "id", type: "path", required: true, description: "The unique identifier of the message." },
    ],
    codeExamples: {
      cURL: `curl -X GET "https://api.sabsms.com/v1/messages/msg_01H1234567890ABCDEF" \\
  -H "Authorization: Bearer sk_live_your_api_key"`,
      "Node.js": `const { SabSMS } = require('sabsms');
const client = new SabSMS('sk_live_your_api_key');

const message = await client.messages.retrieve('msg_01H1234567890ABCDEF');
console.log(message.status);`,
    },
    response: `{
  "id": "msg_01H1234567890ABCDEF",
  "to": "+1234567890",
  "from": "+1987654321",
  "body": "Your verification code is 49201",
  "status": "delivered",
  "error_code": null,
  "created_at": "2026-05-22T12:00:00Z",
  "updated_at": "2026-05-22T12:00:05Z"
}`
  },
  {
    id: "create-phone-number",
    method: "POST",
    path: "/v1/phone-numbers",
    group: "Phone Numbers",
    title: "Provision a Number",
    description: "Purchase and provision a new phone number for your workspace.",
    badges: ["Billing Affected"],
    parameters: [
      { name: "phone_number", type: "string", required: true, description: "The specific phone number to provision." },
      { name: "capabilities", type: "array[string]", required: false, description: "Desired capabilities: ['sms', 'mms', 'voice']." },
    ],
    codeExamples: {
      cURL: `curl -X POST https://api.sabsms.com/v1/phone-numbers \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone_number": "+1234567890",
    "capabilities": ["sms", "mms"]
  }'`,
      "Node.js": `const { SabSMS } = require('sabsms');
const client = new SabSMS('sk_live_your_api_key');

const number = await client.phoneNumbers.create({
  phoneNumber: '+1234567890',
  capabilities: ['sms', 'mms']
});`,
    },
    response: `{
  "id": "pn_01H...",
  "phone_number": "+1234567890",
  "capabilities": ["sms", "mms"],
  "status": "active",
  "monthly_fee": "1.00",
  "created_at": "2026-05-22T12:10:00Z"
}`
  },
  {
    id: "verify-signature",
    method: "POST",
    path: "/v1/webhooks/verify",
    group: "Webhooks",
    title: "Verify Signature",
    description: "Learn how to cryptographically verify that webhooks originated from SabSMS. This is not an actual endpoint you call, but a standard for validating incoming requests.",
    badges: ["Security", "Guide"],
    parameters: [
      { name: "SabSMS-Signature", type: "header", required: true, description: "The signature to verify, provided in the request headers." },
      { name: "SabSMS-Timestamp", type: "header", required: true, description: "The timestamp of the webhook, used to prevent replay attacks." },
    ],
    codeExamples: {
      "Node.js": `const crypto = require('crypto');

function verifySignature(payload, signature, timestamp, secret) {
  const data = timestamp + '.' + payload;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}`,
      "Python": `import hmac
import hashlib

def verify_signature(payload: str, signature: str, timestamp: str, secret: str) -> bool:
    data = f"{timestamp}.{payload}".encode('utf-8')
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        data,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)`
    },
    response: null
  }
];

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------

const getMethodColor = (method: string) => {
  switch (method) {
    case "GET": return "bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/20 dark:text-[var(--st-text-secondary)] border-[var(--st-border)] dark:border-[var(--st-border)]/30";
    case "POST": return "bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/20 dark:text-[var(--st-text-secondary)] border-[var(--st-border)] dark:border-[var(--st-border)]/30";
    case "PUT": return "bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/20 dark:text-[var(--st-text-secondary)] border-[var(--st-border)] dark:border-[var(--st-border)]/30";
    case "DELETE": return "bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/20 dark:text-[var(--st-text-secondary)] border-[var(--st-border)] dark:border-[var(--st-border)]/30";
    case "PATCH": return "bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/20 dark:text-[var(--st-text-secondary)] border-[var(--st-border)] dark:border-[var(--st-border)]/30";
    default: return "bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-[var(--st-text-secondary)] border-[var(--st-border)] dark:border-[var(--st-border)]";
  }
};

const highlightJSON = (json: string) => {
  if (typeof json !== 'string') return json;
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'text-[var(--st-text-secondary)]';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'text-[var(--st-text-secondary)]';
      } else {
        cls = 'text-[var(--st-text-secondary)]'; // string value
      }
    } else if (/true|false/.test(match)) {
      cls = 'text-[var(--st-text-secondary)]';
    } else if (/null/.test(match)) {
      cls = 'text-[var(--st-text)]';
    } else {
      cls = 'text-[var(--st-text-secondary)]'; // number
    }
    return `<span class="${cls}">${match}</span>`;
  });
};

const highlightCode = (code: string) => {
  // Simple regex-based highlighter for non-JSON code (JS/Python/cURL)
  let highlighted = code
    .replace(/\b(const|let|var|function|return|import|from|require|await|async|def|import|class|print)\b/g, '<span class="text-[var(--st-text-secondary)]">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="text-[var(--st-text-secondary)]">$1</span>')
    .replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, '<span class="text-[var(--st-text-secondary)]">$&</span>')
    .replace(/\b(\d+)\b/g, '<span class="text-[var(--st-text-secondary)]">$1</span>')
    // Highlight cURL specific flags
    .replace(/(-\w|--\w+)/g, '<span class="text-[var(--st-text-secondary)]">$1</span>')
    .replace(/(https?:\/\/[\w\.\/\-]+)/g, '<span class="text-[var(--st-text-secondary)] underline decoration-[var(--st-text-secondary)]/30 underline-offset-2">$1</span>');
  return highlighted;
};

// ---------------------------------------------------------------------------
// COMPONENTS
// ---------------------------------------------------------------------------

function CodeBlock({ code, language = "json", className }: { code: string; language?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isJson = language.toLowerCase() === "json";
  const processedCode = isJson ? highlightJSON(code) : highlightCode(code);

  return (
    <div className={cn("group relative rounded-xl bg-[var(--st-text)] border border-[var(--st-border)] shadow-2xl overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--st-border)]/60 bg-[var(--st-text)]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[var(--st-text)]/50" />
            <div className="w-3 h-3 rounded-full bg-[var(--st-text)]/50" />
            <div className="w-3 h-3 rounded-full bg-[var(--st-text)]/50" />
          </div>
          <span className="ml-2 text-xs font-medium text-[var(--st-text-secondary)] uppercase tracking-wider">{language}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-[var(--st-text-secondary)] hover:text-white hover:bg-[var(--st-text)] transition-colors"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-[13px] leading-relaxed font-mono text-[var(--st-text-secondary)]">
          <code dangerouslySetInnerHTML={{ __html: processedCode }} />
        </pre>
      </div>
    </div>
  );
}

function InteractivePlayground({ endpoint }: { endpoint: Endpoint }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleRun = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setResult(endpoint.response || '{\n  "success": true\n}');
    }, 800);
  };

  return (
    <div className="mt-8 rounded-2xl border border-[var(--st-border)] bg-white shadow-sm overflow-hidden dark:bg-[var(--st-text)] dark:border-[var(--st-border)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 dark:bg-[var(--st-text)]/50 dark:border-[var(--st-border)]">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
          <Play className="h-4 w-4 text-[var(--st-text)]" />
          Test Endpoint
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] border-none">
            Using Test Key
          </Badge>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {endpoint.parameters.filter(p => p.required).length > 0 && (
          <div className="space-y-3">
            {endpoint.parameters.filter(p => p.required).map(p => (
              <div key={p.name} className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">{p.name}</Label>
                <Input placeholder={`Enter ${p.name}...`} className="h-9 font-mono text-xs" />
              </div>
            ))}
          </div>
        )}
        <Button onClick={handleRun} disabled={loading} className="w-full bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white shadow-sm transition-all active:scale-[0.98]">
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Sending Request...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Send Request
            </div>
          )}
        </Button>
        
        {result && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-[var(--st-text)]" />
              <span className="text-xs font-medium text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">200 OK</span>
            </div>
            <CodeBlock code={result} language="json" />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN LAYOUT
// ---------------------------------------------------------------------------

export default function ApiDocsClient() {
  const [activeEndpoint, setActiveEndpoint] = useState<string>(ENDPOINTS[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeLang, setActiveLang] = useState("cURL");

  // Group endpoints for sidebar
  const groups = Array.from(new Set(ENDPOINTS.map(e => e.group)));

  const filteredEndpoints = ENDPOINTS.filter(e => 
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const endpointData = ENDPOINTS.find(e => e.id === activeEndpoint) || ENDPOINTS[0];

  return (
    <div className="min-h-screen bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] font-sans text-[var(--st-text)] dark:text-white">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[var(--st-border)] bg-white/80 px-4 backdrop-blur-md dark:border-[var(--st-border)] dark:bg-[var(--st-text)]/80 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-text)] text-white shadow-sm">
              <Code className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">API Reference</span>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex ml-2 font-mono text-[10px]">v1.0.0</Badge>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3 sm:gap-6">
          <div className="hidden max-w-sm flex-1 items-center md:flex relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--st-text-secondary)] group-focus-within:text-[var(--st-text)] transition-colors" />
            <Input 
              placeholder="Search endpoints, guides..." 
              className="pl-9 bg-[var(--st-bg-muted)]/50 border-transparent focus:bg-white focus:border-[var(--st-border)] focus:ring-2 focus:ring-[var(--st-border)]/20 transition-all dark:bg-[var(--st-text)] dark:focus:bg-[var(--st-text)] h-9 rounded-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--st-border)] bg-white shadow-sm dark:border-[var(--st-border)] dark:bg-[var(--st-text)]">
            <div className="h-2 w-2 rounded-full bg-[var(--st-text)] animate-pulse" />
            <span className="text-xs font-medium">API Status: Operational</span>
          </div>
        </div>
      </header>

      <div className="flex w-full">
        {/* Sidebar Navigation */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 mt-16 w-72 border-r border-[var(--st-border)] bg-white transition-transform duration-300 ease-in-out dark:border-[var(--st-border)] dark:bg-[var(--st-text)] lg:static lg:mt-0 lg:translate-x-0 lg:h-[calc(100vh-4rem)] lg:sticky lg:top-16",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <ScrollArea className="h-full py-6">
            <div className="px-6 pb-4 md:hidden">
              <Input 
                placeholder="Search..." 
                className="h-9 w-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-8 px-4">
              {groups.map(group => {
                const groupEndpoints = filteredEndpoints.filter(e => e.group === group);
                if (groupEndpoints.length === 0) return null;
                
                return (
                  <div key={group} className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--st-text)] px-3">{group}</h4>
                    <div className="space-y-1">
                      {groupEndpoints.map(endpoint => {
                        const isActive = activeEndpoint === endpoint.id;
                        return (
                          <button
                            key={endpoint.id}
                            onClick={() => {
                              setActiveEndpoint(endpoint.id);
                              setMobileMenuOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                              isActive 
                                ? "bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/10 dark:text-[var(--st-text-secondary)]" 
                                : "text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] dark:text-[var(--st-text-secondary)] dark:hover:bg-[var(--st-text)]/50 dark:hover:text-white"
                            )}
                          >
                            <span className={cn(
                              "flex h-5 w-11 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
                              getMethodColor(endpoint.method)
                            )}>
                              {endpoint.method}
                            </span>
                            <span className="truncate text-left">{endpoint.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--st-text)] px-3">Resources</h4>
                <div className="space-y-1 text-sm font-medium text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                  <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] dark:hover:bg-[var(--st-text)]/50">
                    <Book className="h-4 w-4" /> Authentication
                  </button>
                  <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] dark:hover:bg-[var(--st-text)]/50">
                    <AlertTriangle className="h-4 w-4" /> Errors
                  </button>
                  <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] dark:hover:bg-[var(--st-text)]/50">
                    <Activity className="h-4 w-4" /> Rate Limits
                  </button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Backdrop for mobile */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 z-30 bg-[var(--st-text)]/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          <div className="h-full xl:flex xl:h-[calc(100vh-4rem)]">
            
            {/* Center Column: Documentation */}
            <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 xl:px-12 pb-24 xl:pb-12">
              <div className="max-w-3xl mx-auto xl:max-w-none">
                
                <div className="flex items-center gap-3 mb-4">
                  {endpointData.badges.map(badge => (
                    <Badge key={badge} variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)] border-none font-medium">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {badge}
                    </Badge>
                  ))}
                </div>

                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--st-text)] dark:text-white mb-4">
                  {endpointData.title}
                </h1>
                
                <p className="text-lg text-[var(--st-text)] dark:text-[var(--st-text-secondary)] mb-8 leading-relaxed">
                  {endpointData.description}
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-12 p-1 rounded-xl bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/50 border border-[var(--st-border)] dark:border-[var(--st-border)] w-fit">
                  <span className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm",
                    getMethodColor(endpointData.method).split(" ")[0],
                    getMethodColor(endpointData.method).split(" ")[1],
                    "border border-current"
                  )}>
                    {endpointData.method}
                  </span>
                  <div className="flex items-center px-2 py-1.5 overflow-x-auto w-full">
                    <span className="text-[var(--st-text)] font-mono text-sm shrink-0">https://api.sabsms.com</span>
                    <span className="text-[var(--st-text)] dark:text-white font-mono text-sm font-semibold whitespace-nowrap ml-1">{endpointData.path}</span>
                  </div>
                </div>

                <div className="mb-12">
                  <h2 className="text-xl font-bold text-[var(--st-text)] dark:text-white mb-6 flex items-center gap-2 border-b border-[var(--st-border)] dark:border-[var(--st-border)] pb-2">
                    <div className="h-6 w-1 bg-[var(--st-text)] rounded-full" />
                    Parameters
                  </h2>
                  
                  {endpointData.parameters.length > 0 ? (
                    <div className="space-y-6">
                      {endpointData.parameters.map(param => (
                        <div key={param.name} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6 border-b border-[var(--st-border)] dark:border-[var(--st-border)]/50 pb-6 last:border-0 last:pb-0">
                          <div className="w-full sm:w-48 shrink-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-semibold text-[var(--st-text)] dark:text-white bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] px-1.5 py-0.5 rounded">
                                {param.name}
                              </code>
                              {param.required && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--st-text)] bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/10 px-1.5 py-0.5 rounded">Required</span>
                              )}
                            </div>
                            <div className="text-xs font-mono text-[var(--st-text)]">{param.type}</div>
                          </div>
                          <div className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)] text-sm leading-relaxed mt-1 sm:mt-0">
                            {param.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--st-text)] italic">No parameters required for this endpoint.</p>
                  )}
                </div>

                <div className="mb-12">
                  <h2 className="text-xl font-bold text-[var(--st-text)] dark:text-white mb-6 flex items-center gap-2 border-b border-[var(--st-border)] dark:border-[var(--st-border)] pb-2">
                    <div className="h-6 w-1 bg-[var(--st-text)] rounded-full" />
                    Authentication
                  </h2>
                  <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4 dark:border-[var(--st-border)]/50 dark:bg-[var(--st-text)]/20">
                    <div className="flex gap-3">
                      <Lock className="h-5 w-5 text-[var(--st-text)] dark:text-[var(--st-text-secondary)] shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">Bearer Token</h4>
                        <p className="mt-1 text-sm text-[var(--st-text)]/80 dark:text-white/70">
                          Authenticate your API requests using your workspace's API keys. Pass the key in the Authorization header.
                        </p>
                        <code className="mt-3 block text-xs bg-white/60 dark:bg-[var(--st-text)]/50 p-2 rounded text-[var(--st-text)] dark:text-[var(--st-text-secondary)] font-mono border border-[var(--st-border)] dark:border-[var(--st-border)]/30">
                          Authorization: Bearer sk_live_...
                        </code>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile-only Code and Playground section */}
                <div className="xl:hidden mt-12 space-y-8">
                  <h2 className="text-xl font-bold text-[var(--st-text)] dark:text-white border-b border-[var(--st-border)] dark:border-[var(--st-border)] pb-2">
                    Request & Response
                  </h2>
                  
                  <div className="bg-[var(--st-text)] rounded-2xl p-1 pb-4 shadow-xl">
                    <div className="flex gap-1 mb-2 px-3 pt-3 overflow-x-auto hide-scrollbar">
                      {Object.keys(endpointData.codeExamples).map(lang => (
                        <button
                          key={lang}
                          onClick={() => setActiveLang(lang)}
                          className={cn(
                            "px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                            activeLang === lang 
                              ? "bg-[var(--st-text)] text-white" 
                              : "text-[var(--st-text-secondary)] hover:text-white hover:bg-[var(--st-text)]/50"
                          )}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                    <CodeBlock 
                      code={endpointData.codeExamples[activeLang]} 
                      language={activeLang} 
                      className="border-none bg-transparent shadow-none" 
                    />
                  </div>

                  {endpointData.response && (
                    <div className="space-y-3 mt-8">
                      <h3 className="text-sm font-bold text-[var(--st-text)] dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[var(--st-text)]" />
                        Example Response
                      </h3>
                      <CodeBlock code={endpointData.response} language="json" />
                    </div>
                  )}

                  <InteractivePlayground endpoint={endpointData} />
                </div>

              </div>
            </div>

            {/* Right Column: Code snippets & Playground (Desktop only) */}
            <div className="hidden xl:flex w-[480px] 2xl:w-[560px] flex-col border-l border-[var(--st-border)] bg-[var(--st-text)] dark:border-[var(--st-border)] overflow-y-auto">
              <div className="p-6 space-y-8">
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Request</h3>
                  </div>
                  
                  <div className="bg-[var(--st-text)] rounded-2xl border border-[var(--st-border)]/60 overflow-hidden shadow-2xl">
                    <div className="flex gap-1 p-2 border-b border-[var(--st-border)]/60 bg-[var(--st-text)] overflow-x-auto hide-scrollbar">
                      {Object.keys(endpointData.codeExamples).map(lang => (
                        <button
                          key={lang}
                          onClick={() => setActiveLang(lang)}
                          className={cn(
                            "px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                            activeLang === lang 
                              ? "bg-[var(--st-text)]/10 text-[var(--st-text-secondary)] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2)]" 
                              : "text-[var(--st-text-secondary)] hover:text-white hover:bg-[var(--st-text)]/50"
                          )}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                    <CodeBlock 
                      code={endpointData.codeExamples[activeLang]} 
                      language={activeLang} 
                      className="border-none bg-transparent shadow-none rounded-none" 
                    />
                  </div>
                </div>

                {endpointData.response && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[var(--st-text)] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                      Response
                    </h3>
                    <CodeBlock code={endpointData.response} language="json" />
                  </div>
                )}

                <div className="pt-8 border-t border-[var(--st-border)]/50">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Playground</h3>
                  <div className="bg-[var(--st-text)] border border-[var(--st-border)] rounded-2xl p-5 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-[var(--st-text-secondary)]">Sandbox Test</span>
                      <Switch defaultChecked id="desktop-sandbox" />
                    </div>
                    
                    <div className="space-y-4">
                      {endpointData.parameters.filter(p => p.required).map(p => (
                        <div key={p.name} className="space-y-1.5">
                          <label className="text-xs font-medium text-[var(--st-text-secondary)] block">{p.name}</label>
                          <Input 
                            placeholder={`Enter ${p.name}...`} 
                            className="bg-[var(--st-text)] border-[var(--st-border)] text-white placeholder:text-[var(--st-text)] focus:border-[var(--st-border)] focus:ring-[var(--st-border)]/20" 
                          />
                        </div>
                      ))}
                      
                      <Button className="w-full mt-2 bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white border-none shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                        <Play className="h-4 w-4 mr-2" />
                        Send API Request
                      </Button>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
