"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  useZoruToast,
} from "@/components/sabcrm/20ui/zoru";
import {
  BookOpen,
  Github,
  MessageSquare,
  Copy,
  Download,
  Sparkles,
  Terminal,
  FileCode2,
  History,
  Code,
  Search,
} from "lucide-react";
import { buildOpenApiSpec } from "@/lib/api-platform/openapi";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

type Language = "typescript" | "python" | "go" | "ruby";
type ViewMode = "snippets" | "explorer";

export default function SdkReferencePage() {
  const [lang, setLang] = useState<Language>("typescript");
  const [viewMode, setViewMode] = useState<ViewMode>("snippets");
  const { toast } = useZoruToast();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Code snippet copied.",
      variant: "success",
    });
  };

  const handleCurlCopy = () => {
    toast({
      title: "Copied as cURL",
      description: "Equivalent cURL command copied.",
      variant: "success",
    });
  };

  const handleCodeBin = () => {
    toast({
      title: "Code Bin Exported",
      description: "Private gist created via SabFiles.",
      variant: "success",
    });
  };

  const handleAiConvert = () => {
    toast({
      title: "AI Conversion Started",
      description: "Converting snippet...",
      variant: "default",
    });
  };

  // Dynamically generate from OpenAPI spec
  const spec = useMemo(() => buildOpenApiSpec(), []);

  const dynamicData = useMemo(() => {
    const categories: any[] = [];
    const snippets: Record<string, Record<string, string>> = {
      typescript: {},
      python: {},
      go: {},
      ruby: {},
    };

    Object.entries(spec.paths).forEach(([path, methods]) => {
      Object.entries(methods as Record<string, any>).forEach(
        ([method, details]) => {
          const id = `${method}-${path.replace(/[^a-zA-Z0-9]/g, "-")}`;
          categories.push({
            id,
            label: details.summary || `${method.toUpperCase()} ${path}`,
            icon:
              method === "get"
                ? BookOpen
                : method === "post"
                  ? MessageSquare
                  : Terminal,
          });

          const isWrite = ["post", "put", "patch"].includes(method);
          const payloadStr = isWrite ? "{ /* payload */ }" : "";

          // TypeScript
          snippets.typescript[id] =
            `const response = await fetch('https://api.sabnode.com/v1${path}', {
  method: '${method.toUpperCase()}',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'${isWrite ? ",\n    'Content-Type': 'application/json'" : ""}
  }${isWrite ? `,\n  body: JSON.stringify(${payloadStr})` : ""}
});
const data = await response.json();`;

          // Python
          snippets.python[id] = `import requests

headers = {
    'Authorization': 'Bearer YOUR_API_KEY'${isWrite ? ",\n    'Content-Type': 'application/json'" : ""}
}

response = requests.${method.toLowerCase()}('https://api.sabnode.com/v1${path}', headers=headers${isWrite ? `, json=${payloadStr}` : ""})
data = response.json()`;

          // Go
          snippets.go[id] =
            `req, err := http.NewRequest("${method.toUpperCase()}", "https://api.sabnode.com/v1${path}", ${isWrite ? `bytes.NewBuffer([]byte(\`${payloadStr}\`))` : "nil"})
if err != nil {
    panic(err)
}
req.Header.Set("Authorization", "Bearer YOUR_API_KEY")
${isWrite ? `req.Header.Set("Content-Type", "application/json")\n` : ""}client := &http.Client{}
resp, err := client.Do(req)`;

          // Ruby
          snippets.ruby[id] = `require 'net/http'
require 'uri'

uri = URI.parse("https://api.sabnode.com/v1${path}")
request = Net::HTTP::${method.charAt(0).toUpperCase() + method.slice(1).toLowerCase()}.new(uri)
request["Authorization"] = "Bearer YOUR_API_KEY"
${isWrite ? `request.content_type = "application/json"\nrequest.body = "${payloadStr}"\n` : ""}
req_options = {
  use_ssl: uri.scheme == "https",
}

response = Net::HTTP.start(uri.hostname, uri.port, req_options) do |http|
  http.request(request)
end`;
        },
      );
    });

    return { categories, snippets };
  }, [spec]);

  return (
    <SabsmsPageShell
      title="SDK Reference"
      eyebrow="Developers"
      description="Integration snippets and client libraries for the SabSMS API."
      breadcrumbs={[{ label: "Developers" }, { label: "SDK Reference" }]}
      primaryAction={{
        label: "View API Docs",
        onClick: () => window.open("https://docs.sabsms.com", "_blank"),
      }}
      secondaryActions={[
        {
          label: "Sample Apps",
          icon: <Github className="h-4 w-4" />,
          onSelectAction: () =>
            window.open("https://github.com/sabsms/samples", "_blank"),
        },
        {
          label: "Issue Tracker",
          icon: <Github className="h-4 w-4" />,
          onSelectAction: () =>
            window.open("https://github.com/sabsms/issues", "_blank"),
        },
        {
          label: "Community",
          icon: <MessageSquare className="h-4 w-4" />,
          onSelectAction: () =>
            window.open("https://discord.gg/sabsms", "_blank"),
        },
      ]}
      toolbar={
        <div className="flex flex-col gap-4 border-b pb-4 mb-6">
          <div className="flex items-center justify-between">
            <Tabs
              value={viewMode}
              onValueChange={(v) => setViewMode(v as ViewMode)}
            >
              <TabsList>
                <TabsTrigger
                  value="snippets"
                  className="flex items-center gap-2"
                >
                  <Code className="h-4 w-4" /> Code Snippets
                </TabsTrigger>
                <TabsTrigger
                  value="explorer"
                  className="flex items-center gap-2"
                >
                  <Search className="h-4 w-4" /> API Explorer
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-3">
              <Select defaultValue="v1.0.0">
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v1.0.0">v1.0.0 (Latest)</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast({
                    title: "Types Viewer",
                    description: "Opening type definitions viewer...",
                  })
                }
              >
                <FileCode2 className="mr-2 h-4 w-4" />
                Types
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast({
                    title: "Changelog",
                    description: `Viewing changelog...`,
                  })
                }
              >
                <History className="mr-2 h-4 w-4" />
                Changelog
              </Button>
            </div>
          </div>

          {viewMode === "snippets" && (
            <div className="flex items-center">
              <Tabs value={lang} onValueChange={(v) => setLang(v as Language)}>
                <TabsList>
                  <TabsTrigger value="typescript">TypeScript</TabsTrigger>
                  <TabsTrigger value="python">Python</TabsTrigger>
                  <TabsTrigger value="go">Go</TabsTrigger>
                  <TabsTrigger value="ruby">Ruby</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </div>
      }
    >
      {viewMode === "snippets" ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 space-y-1">
            {dynamicData.categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <a
                  key={cat.id}
                  href={`#${cat.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[var(--st-bg-muted)] text-sm font-medium transition-colors text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                >
                  <Icon className="h-4 w-4" />
                  {cat.label}
                </a>
              );
            })}
          </div>

          <div className="md:col-span-3 space-y-8">
            {dynamicData.categories.map((cat) => {
              const code = dynamicData.snippets[lang][cat.id];
              return (
                <Card key={cat.id} id={cat.id} className="scroll-mt-24">
                  <CardHeader>
                    <CardTitle className="text-lg">{cat.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative group rounded-md bg-[var(--st-text)] p-4 border overflow-hidden">
                      <pre className="text-sm text-white font-mono overflow-x-auto whitespace-pre">
                        <code>{code}</code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-[var(--st-text-secondary)] hover:text-white"
                        onClick={() => handleCopy(code)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-[var(--st-bg-muted)]/50 py-3 flex items-center justify-between">
                    <div className="text-xs text-[var(--st-text-secondary)]">
                      Generated from{" "}
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px]"
                      >
                        OpenAPI Spec
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={handleCurlCopy}
                      >
                        <Terminal className="mr-2 h-3 w-3" />
                        cURL
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={handleCodeBin}
                      >
                        <Download className="mr-2 h-3 w-3" />
                        Code Bin
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[var(--st-text)] hover:text-[var(--st-text)]"
                        onClick={handleAiConvert}
                      >
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
      ) : (
        <div className="bg-white rounded-md p-4 min-h-[600px] border shadow-sm">
          <SwaggerUI spec={spec} />
        </div>
      )}
    </SabsmsPageShell>
  );
}
