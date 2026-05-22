"use client";

import React, { useState } from "react";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Github, MessageSquare, Copy, Download, Sparkles, Terminal, FileCode2, History } from "lucide-react";
import { useZoruToast } from "@/components/zoruui/use-zoru-toast";

type Language = "typescript" | "python" | "go" | "ruby";

const SNIPPETS = {
  typescript: {
    install: "npm install sabsms",
    auth: "import { SabSMS } from 'sabsms';\n\nconst client = new SabSMS('YOUR_API_KEY');",
    send: "const response = await client.messages.create({\n  to: '+1234567890',\n  body: 'Hello from SabSMS!'\n});",
    list: "const messages = await client.messages.list({ limit: 10 });",
    reply: "const reply = await client.conversations.reply('conv_id', {\n  body: 'Yes, we are open!'\n});",
    webhook: "const isValid = client.webhooks.verifySignature(rawBody, signature, secret);",
    idempotency: "const res = await client.messages.create(payload, {\n  idempotencyKey: 'request-id-123'\n});",
    streaming: "const stream = client.messages.stream();\nstream.on('data', (msg) => console.log(msg));",
    retry: "const client = new SabSMS('KEY', { maxRetries: 3 });",
    bulk: "const batch = await client.messages.createBulk([\n  { to: '+1', body: 'A' },\n  { to: '+2', body: 'B' }\n]);"
  },
  python: {
    install: "pip install sabsms",
    auth: "from sabsms import SabSMS\n\nclient = SabSMS('YOUR_API_KEY')",
    send: "response = client.messages.create(\n    to='+1234567890',\n    body='Hello from SabSMS!'\n)",
    list: "messages = client.messages.list(limit=10)",
    reply: "reply = client.conversations.reply('conv_id', body='Yes, we are open!')",
    webhook: "is_valid = client.webhooks.verify_signature(raw_body, signature, secret)",
    idempotency: "res = client.messages.create(payload, idempotency_key='request-id-123')",
    streaming: "for msg in client.messages.stream():\n    print(msg)",
    retry: "client = SabSMS('KEY', max_retries=3)",
    bulk: "batch = client.messages.create_bulk([\n    {'to': '+1', 'body': 'A'},\n    {'to': '+2', 'body': 'B'}\n])"
  },
  go: {
    install: "go get github.com/sabsms/sabsms-go",
    auth: "import \"github.com/sabsms/sabsms-go\"\n\nclient := sabsms.NewClient(\"YOUR_API_KEY\")",
    send: "resp, err := client.Messages.Create(&sabsms.MessageParams{\n    To: \"+1234567890\",\n    Body: \"Hello from SabSMS!\",\n})",
    list: "messages, err := client.Messages.List(&sabsms.ListParams{Limit: 10})",
    reply: "reply, err := client.Conversations.Reply(\"conv_id\", \"Yes, we are open!\")",
    webhook: "isValid := client.Webhooks.VerifySignature(rawBody, signature, secret)",
    idempotency: "resp, err := client.Messages.Create(payload, sabsms.WithIdempotencyKey(\"request-id-123\"))",
    streaming: "stream := client.Messages.Stream()\nfor msg := range stream.C {\n    fmt.Println(msg)\n}",
    retry: "client := sabsms.NewClient(\"KEY\", sabsms.WithMaxRetries(3))",
    bulk: "batch, err := client.Messages.CreateBulk([]sabsms.MessageParams{\n    {To: \"+1\", Body: \"A\"},\n    {To: \"+2\", Body: \"B\"},\n})"
  },
  ruby: {
    install: "gem install sabsms",
    auth: "require 'sabsms'\n\nclient = SabSMS::Client.new('YOUR_API_KEY')",
    send: "response = client.messages.create(\n  to: '+1234567890',\n  body: 'Hello from SabSMS!'\n)",
    list: "messages = client.messages.list(limit: 10)",
    reply: "reply = client.conversations.reply('conv_id', body: 'Yes, we are open!')",
    webhook: "is_valid = client.webhooks.verify_signature(raw_body, signature, secret)",
    idempotency: "res = client.messages.create(payload, idempotency_key: 'request-id-123')",
    streaming: "client.messages.stream do |msg|\n  puts msg\nend",
    retry: "client = SabSMS::Client.new('KEY', max_retries: 3)",
    bulk: "batch = client.messages.create_bulk([\n  { to: '+1', body: 'A' },\n  { to: '+2', body: 'B' }\n])"
  }
};

const CATEGORIES = [
  { id: "install", label: "Installation", icon: Terminal },
  { id: "auth", label: "Authentication", icon: FileCode2 },
  { id: "send", label: "Send Message", icon: MessageSquare },
  { id: "list", label: "List Messages", icon: BookOpen },
  { id: "reply", label: "Conversation Reply", icon: MessageSquare },
  { id: "webhook", label: "Verify Webhook", icon: FileCode2 },
  { id: "idempotency", label: "Idempotency", icon: Terminal },
  { id: "streaming", label: "Streaming", icon: Terminal },
  { id: "retry", label: "Retry & Backoff", icon: History },
  { id: "bulk", label: "Bulk Send", icon: Copy },
] as const;

export default function SdkReferencePage() {
  const [lang, setLang] = useState<Language>("typescript");
  const { toast } = useZoruToast();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard", description: "Code snippet copied.", variant: "success" });
  };

  const handleCurlCopy = () => {
    toast({ title: "Copied as cURL", description: "Equivalent cURL command copied.", variant: "success" });
  };

  const handleCodeBin = () => {
    toast({ title: "Code Bin Exported", description: "Private gist created via SabFiles.", variant: "success" });
  };

  const handleAiConvert = () => {
    toast({ title: "AI Conversion Started", description: "Converting snippet...", variant: "default" });
  };

  return (
    <SabsmsPageShell
      title="SDK Reference"
      eyebrow="Developers"
      description="Integration snippets and client libraries for the SabSMS API."
      breadcrumbs={[{ label: "Developers" }, { label: "SDK Reference" }]}
      primaryAction={{ label: "View API Docs", onClick: () => window.open('https://docs.sabsms.com', '_blank') }}
      secondaryActions={[
        { label: "Sample Apps", icon: <Github className="h-4 w-4" />, onSelectAction: () => window.open('https://github.com/sabsms/samples', '_blank') },
        { label: "Issue Tracker", icon: <Github className="h-4 w-4" />, onSelectAction: () => window.open('https://github.com/sabsms/issues', '_blank') },
        { label: "Community", icon: <MessageSquare className="h-4 w-4" />, onSelectAction: () => window.open('https://discord.gg/sabsms', '_blank') },
      ]}
      toolbar={
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <Tabs value={lang} onValueChange={(v) => setLang(v as Language)}>
            <TabsList>
              <TabsTrigger value="typescript">TypeScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="go">Go</TabsTrigger>
              <TabsTrigger value="ruby">Ruby</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-3">
            <Select defaultValue="v1.2.0">
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="v1.2.0">v1.2.0 (Latest)</SelectItem>
                <SelectItem value="v1.1.0">v1.1.0</SelectItem>
                <SelectItem value="v1.0.0">v1.0.0</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => toast({ title: "Types Viewer", description: "Opening type definitions viewer..." })}>
              <FileCode2 className="mr-2 h-4 w-4" />
              Types
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast({ title: "Changelog", description: `Viewing changelog for ${lang}...` })}>
              <History className="mr-2 h-4 w-4" />
              Changelog
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <a
                key={cat.id}
                href={`#${cat.id}`}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors text-muted-foreground hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {cat.label}
              </a>
            );
          })}
        </div>
        
        <div className="md:col-span-3 space-y-8">
          {CATEGORIES.map((cat) => {
            const code = SNIPPETS[lang][cat.id as keyof typeof SNIPPETS[typeof lang]];
            return (
              <Card key={cat.id} id={cat.id} className="scroll-mt-24">
                <CardHeader>
                  <CardTitle className="text-lg">{cat.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative group rounded-md bg-zinc-950 p-4 border overflow-hidden">
                    <pre className="text-sm text-zinc-50 font-mono overflow-x-auto">
                      <code>{code}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-zinc-400 hover:text-white"
                      onClick={() => handleCopy(code)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/50 py-3 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Requires <Badge variant="secondary" className="font-mono text-[10px]">sabsms &gt;= 1.0.0</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-8" onClick={handleCurlCopy}>
                      <Terminal className="mr-2 h-3 w-3" />
                      cURL
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8" onClick={handleCodeBin}>
                      <Download className="mr-2 h-3 w-3" />
                      Code Bin
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-indigo-500 hover:text-indigo-600" onClick={handleAiConvert}>
                      <Sparkles className="mr-2 h-3 w-3" />
                      Convert
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </SabsmsPageShell>
  );
}
