'use client';

import { useState } from 'react';
import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  cn,
} from '@/components/zoruui';
import { ArrowLeft, Database, Shield, Copy, Check } from 'lucide-react';
import Link from 'next/link';

const wachatApiDocs = [
    {
        endpoint: 'GET /v1/projects/list',
        description: 'Retrieves a list of all projects accessible by the API key user.',
        bodyParams: [],
        example: `curl -X GET \\
  https://yourapp.com/api/v1/projects/list \\
  -H 'Authorization: Bearer YOUR_API_KEY'`,
        response: `{
  "success": true,
  "data": [
    {
      "_id": "60d5f1b4c7b8c2a3e4f5a6b7",
      "name": "My Main Project",
      "wabaId": "1234567890"
    }
  ]
}`
    },
    {
        endpoint: 'POST /v1/contacts/create',
        description: 'Creates a new contact within a specified project.',
        bodyParams: [
            { name: 'projectId', type: 'string', desc: 'The ID of the project to add the contact to.' },
            { name: 'phoneNumberId', type: 'string', desc: 'The phone number ID within the project to associate with.' },
            { name: 'name', type: 'string', desc: 'The name of the new contact.' },
            { name: 'waId', type: 'string', desc: 'The contact\'s WhatsApp ID (phone number with country code).' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/contacts/create \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "projectId": "60d5f1b4c7b8c2a3e4f5a6b7",
    "phoneNumberId": "10987654321",
    "name": "Jane Doe",
    "waId": "15559876543"
  }'`,
        response: `{
  "success": true,
  "message": "Contact added successfully.",
  "contactId": "62e8c9a3b9f8d4e7f8a1b2c4"
}`
    },
    {
        endpoint: 'POST /v1/broadcasts/start',
        description: 'Starts a new broadcast campaign to a list of contacts based on tags.',
        bodyParams: [
            { name: 'projectId', type: 'string', desc: 'The ID of the project to send from.' },
            { name: 'phoneNumberId', type: 'string', desc: 'The phone number ID within the project to send from.' },
            { name: 'templateId', type: 'string', desc: 'The ID of the approved message template to send.' },
            { name: 'tagIds', type: 'string[]', desc: 'An array of Tag IDs. The broadcast will be sent to all contacts with these tags.' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/broadcasts/start \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "projectId": "60d5f1b4c7b8c2a3e4f5a6b7",
    "phoneNumberId": "10987654321",
    "templateId": "61e8c9a3b9f8d4e7f8a1b2c3",
    "tagIds": ["60d5f1b4c7b8c2a3e4f5a6b8", "60d5f1b4c7b8c2a3e4f5a6b9"]
  }'`,
        response: `{
  "success": true,
  "message": "Broadcast successfully queued for 150 contacts. Sending will begin shortly."
}`
    },
    {
        endpoint: 'POST /v1/broadcasts/start-bulk',
        description: 'Starts a new broadcast campaign by providing a list of contacts directly in the request body.',
        bodyParams: [
            { name: 'projectId', type: 'string', desc: 'The ID of the project to send from.' },
            { name: 'phoneNumberId', type: 'string', desc: 'The phone number ID within the project to send from.' },
            { name: 'templateId', type: 'string', desc: 'The ID of the approved message template to send.' },
            { name: 'contacts', type: 'object[]', desc: 'An array of contact objects. Each object must have a `phone` property and can have properties for variables (e.g., `variable1`, `variable2`).' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/broadcasts/start-bulk \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "projectId": "60d5f1b4c7b8c2a3e4f5a6b7",
    "phoneNumberId": "10987654321",
    "templateId": "61e8c9a3b9f8d4e7f8a1b2c3",
    "contacts": [
        { "phone": "15551112222", "variable1": "John", "variable2": "your recent order" },
        { "phone": "15553334444", "variable1": "Jane", "variable2": "your appointment" }
    ]
  }'`,
        response: `{
  "success": true,
  "message": "Broadcast successfully queued via API for 2 contacts. Sending will begin shortly."
}`
    },
    {
        endpoint: 'POST /v1/messages/send-text',
        description: 'Sends a simple text message to a contact.',
        bodyParams: [
            { name: 'contactId', type: 'string', desc: 'The internal ID of the contact to send to. (Required if waId is not provided)' },
            { name: 'waId', type: 'string', desc: 'The recipient\'s WhatsApp ID (phone number). (Required if contactId is not provided)' },
            { name: 'projectId', type: 'string', desc: 'The project ID to send from. (Required with waId)' },
            { name: 'phoneNumberId', type: 'string', desc: 'The phone number ID to send from. (Required with waId)' },
            { name: 'messageText', type: 'string', desc: 'The text content of the message. (Required)' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/messages/send-text \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "contactId": "60d5f1b4c7b8c2a3e4f5a6b7",
    "messageText": "Hello from the SabNode API!"
  }'`,
        response: `{
  "success": true,
  "message": "Message sent successfully."
}`
    },
    {
        endpoint: 'POST /v1/messages/send-template',
        description: 'Sends a pre-approved message template to a contact.',
        bodyParams: [
            { name: 'contactId', type: 'string', desc: 'The ID of the contact.' },
            { name: 'templateId', type: 'string', desc: 'The ID of the approved template.' },
            { name: 'headerMediaUrl', type: 'string', desc: 'URL for header media (image, video, doc), if required by the template. (Optional)' },
            { name: 'variables', type: 'object', desc: 'Key-value pairs for template variables, e.g., {"1": "John", "2": "Order #555"}. (Optional)' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/messages/send-template \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "contactId": "60d5f1b4c7b8c2a3e4f5a6b7",
    "templateId": "61e8c9a3b9f8d4e7f8a1b2c3",
    "variables": {
      "1": "David",
      "2": "your recent order"
    }
  }'`,
        response: `{
  "success": true,
  "message": "Template message sent successfully."
}`
    },
     {
        endpoint: 'POST /v1/templates/create',
        description: 'Creates a new message template for submission to Meta.',
        bodyParams: [
            { name: 'projectId', type: 'string', desc: 'The ID of the project to create the template for.' },
            { name: 'name', type: 'string', desc: 'Template name (lowercase, numbers, underscores). e.g., order_confirmation_v2' },
            { name: 'category', type: "'MARKETING' | 'UTILITY'", desc: 'The template category.' },
            { name: 'language', type: 'string', desc: 'Language code. e.g., en_US' },
            { name: 'body', type: 'string', desc: 'The main message content. Use {{1}}, {{2}} for variables.' },
            { name: 'headerFormat', type: "'NONE' | 'TEXT' | 'IMAGE' | ...", desc: 'Type of header. (Optional)' },
            { name: 'headerText', type: 'string', desc: 'Text for TEXT header. (Conditional)' },
            { name: 'buttons', type: 'object[]', desc: 'Array of button objects (QUICK_REPLY or URL). (Optional)' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/templates/create \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "projectId": "60d5f1b4c7b8c2a3e4f5a6b7",
    "name": "new_promo_template",
    "category": "MARKETING",
    "language": "en_US",
    "body": "Hi {{1}}, check out our new summer sale!",
    "buttons": [{ "type": "URL", "text": "Shop Now", "url": "https://example.com/sale" }]
  }'`,
        response: `{
  "success": true,
  "message": "Template 'new_promo_template' submitted successfully!"
}`
    }
];

function CodeTerminal({ title, code, response }: { title: string; code: string; response?: string }) {
  const [copiedReq, setCopiedReq] = useState(false);
  const [copiedRes, setCopiedRes] = useState(false);

  const handleCopyReq = () => {
    navigator.clipboard.writeText(code);
    setCopiedReq(true);
    setTimeout(() => setCopiedReq(false), 2000);
  };

  const handleCopyRes = () => {
    if (response) {
      navigator.clipboard.writeText(response);
      setCopiedRes(true);
      setTimeout(() => setCopiedRes(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-lg overflow-hidden font-mono text-[12px]">
      {/* Top Window Bar */}
      <div className="flex items-center justify-between border-b border-zinc-900 bg-zinc-900 px-4 py-2.5 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-zinc-850 border border-zinc-750" />
          <span className="h-2 w-2 rounded-full bg-zinc-850 border border-zinc-750" />
          <span className="h-2 w-2 rounded-full bg-zinc-850 border border-zinc-750" />
          <span className="ml-2 font-medium tracking-tight text-zinc-400">{title}</span>
        </div>
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">cURL // BASH</span>
      </div>

      {/* Code Container */}
      <div className="p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">
            <span>// REQUEST PAYLOAD</span>
            <button
              onClick={handleCopyReq}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase"
            >
              {copiedReq ? <Check className="h-3 w-3 text-zinc-400" /> : <Copy className="h-3 w-3" />}
              <span>{copiedReq ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="overflow-x-auto whitespace-pre p-3 rounded-lg bg-zinc-900/50 border border-zinc-900/80 leading-relaxed text-zinc-300">
            <code>{code.trim()}</code>
          </pre>
        </div>

        {response ? (
          <div>
            <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">
              <span>// RESPONSE BLOB</span>
              <button
                onClick={handleCopyRes}
                className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase"
              >
                {copiedRes ? <Check className="h-3 w-3 text-zinc-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedRes ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre p-3 rounded-lg bg-zinc-900/50 border border-zinc-900/80 leading-relaxed text-zinc-300">
              <code>{response.trim()}</code>
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="zoruui max-w-6xl mx-auto space-y-12">
      {/* HEADER SECTION */}
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-2 text-zinc-500 hover:text-black">
          <Link href="/dashboard/api" className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-tight">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to API Keys
          </Link>
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-black font-mono">
            SABNODE // API.DOCUMENTATION
          </h1>
          <p className="text-[13px] text-zinc-500">
            Integrate your applications with SabNode using our secure REST API protocol.
          </p>
        </div>
      </div>

      {/* AUTHENTICATION SECTION (OpenAPI split) */}
      <div className="grid gap-8 lg:grid-cols-5 border-t border-zinc-200 pt-8">
        {/* Left Column: Docs & Table */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-zinc-100 border border-zinc-300 px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-800 uppercase tracking-wider">
              SECURE
            </span>
            <span className="font-mono text-[13px] text-black font-semibold">
              Bearer Token Security
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-black font-mono mt-1">
            Authentication Protocols
          </h2>
          <p className="text-[13px] text-zinc-500 leading-relaxed">
            Authenticate your API requests by including your secret API key in the <code>Authorization</code> header of every request. All API requests must be made over HTTPS. Requests made over plain HTTP will fail.
          </p>

          <Card className="border border-zinc-200 shadow-none">
            <ZoruCardHeader className="border-b border-zinc-200 py-3 bg-zinc-50">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-zinc-400" />
                <ZoruCardTitle className="text-[12px] font-mono uppercase tracking-wider text-zinc-600">
                  Header Parameters
                </ZoruCardTitle>
              </div>
            </ZoruCardHeader>
            <ZoruCardContent className="p-0">
              <Table>
                <ZoruTableHeader className="bg-zinc-50/50">
                  <ZoruTableRow>
                    <ZoruTableHead className="font-mono text-[11.5px] text-zinc-600">Parameter</ZoruTableHead>
                    <ZoruTableHead className="font-mono text-[11.5px] text-zinc-600">Type</ZoruTableHead>
                    <ZoruTableHead className="font-mono text-[11.5px] text-zinc-600 text-right">Value</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  <ZoruTableRow>
                    <ZoruTableCell className="font-mono text-[12.5px] text-black font-bold">Authorization</ZoruTableCell>
                    <ZoruTableCell className="font-mono text-[11px] text-zinc-500">string</ZoruTableCell>
                    <ZoruTableCell className="text-right text-[12px] font-mono text-zinc-600">Bearer YOUR_API_KEY</ZoruTableCell>
                  </ZoruTableRow>
                </ZoruTableBody>
              </Table>
            </ZoruCardContent>
          </Card>
          <p className="text-[12px] text-zinc-500 italic mt-1 font-mono">
            * You can generate, manage, or rotate API keys from the <Link href="/dashboard/api" className="text-black font-bold hover:underline">API settings page</Link>.
          </p>
        </div>

        {/* Right Column: Terminal Panel */}
        <div className="lg:col-span-2">
          <CodeTerminal
            title="Authorization Header"
            code="Authorization: Bearer YOUR_API_KEY"
          />
        </div>
      </div>

      {/* ENDPOINTS SECTION */}
      <div className="space-y-12">
        <div className="border-t border-zinc-200 pt-8">
          <h2 className="text-2xl font-bold tracking-tight text-black font-mono">
            Wachat Suite APIs
          </h2>
          <p className="text-[13px] text-zinc-500 mt-1">
            Standard endpoint reference specifications for orchestrating projects, templates, campaigns, and WhatsApp message logs.
          </p>
        </div>

        {wachatApiDocs.map((endpoint, i) => {
          const [method, path] = endpoint.endpoint.split(' ');
          return (
            <div key={i} className="grid gap-8 lg:grid-cols-5 border-t border-zinc-200 pt-8">
              {/* Left Column: Spec */}
              <div className="flex flex-col gap-4 lg:col-span-3">
                <div className="flex items-center gap-2.5">
                  <span className={cn(
                    "rounded font-mono text-[10px] font-bold px-2 py-0.5 border uppercase tracking-wider",
                    method === 'GET'
                      ? "bg-zinc-100 text-zinc-800 border-zinc-300"
                      : "bg-black text-white border-black"
                  )}>
                    {method}
                  </span>
                  <span className="font-mono text-[13px] text-black font-bold tracking-tight">
                    {path}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-black font-mono">
                    {path.split('/').pop()?.replace(/-/g, ' ').toUpperCase() || 'Endpoint Specification'}
                  </h3>
                  <p className="text-[13px] text-zinc-500 mt-1 leading-relaxed">
                    {endpoint.description}
                  </p>
                </div>

                {endpoint.bodyParams.length > 0 ? (
                  <Card className="border border-zinc-200 shadow-none">
                    <ZoruCardHeader className="border-b border-zinc-200 py-3 bg-zinc-50">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-zinc-400" />
                        <ZoruCardTitle className="text-[12px] font-mono uppercase tracking-wider text-zinc-600">
                          Request Body Parameters
                        </ZoruCardTitle>
                      </div>
                    </ZoruCardHeader>
                    <ZoruCardContent className="p-0">
                      <Table>
                        <ZoruTableHeader className="bg-zinc-50/50">
                          <ZoruTableRow>
                            <ZoruTableHead className="font-mono text-[11.5px] text-zinc-600">Parameter</ZoruTableHead>
                            <ZoruTableHead className="font-mono text-[11.5px] text-zinc-600">Type</ZoruTableHead>
                            <ZoruTableHead className="font-mono text-[11.5px] text-zinc-600">Description</ZoruTableHead>
                          </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                          {endpoint.bodyParams.map(param => (
                            <ZoruTableRow key={param.name}>
                              <ZoruTableCell className="font-mono text-[12.5px] text-black font-bold">{param.name}</ZoruTableCell>
                              <ZoruTableCell className="font-mono text-[11px] text-zinc-500">{param.type}</ZoruTableCell>
                              <ZoruTableCell className="text-zinc-600 text-[12px] leading-normal">{param.desc}</ZoruTableCell>
                            </ZoruTableRow>
                          ))}
                        </ZoruTableBody>
                      </Table>
                    </ZoruCardContent>
                  </Card>
                ) : null}
              </div>

              {/* Right Column: Code Terminal */}
              <div className="lg:col-span-2">
                <CodeTerminal
                  title={path}
                  code={endpoint.example}
                  response={endpoint.response}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

