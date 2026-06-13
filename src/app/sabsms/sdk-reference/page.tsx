"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BookOpen, Code, Copy, MessageSquare, Search, Terminal } from "lucide-react";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  useToast,
} from "@/components/sabcrm/20ui";

import {
  buildSabsmsOpenApiSpec,
  sabsmsDocEndpoints,
} from "@/lib/sabsms/apikeys/openapi";

import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

/**
 * /sabsms/sdk-reference (V2.13) — quickstart snippets (cURL, Node fetch,
 * Python requests) generated from the SAME OpenAPI spec object that
 * serves /api/v1/sms/openapi.json. No fake SDKs — plain HTTP only.
 */

type Language = "cURL" | "Node.js" | "Python";
type ViewMode = "snippets" | "explorer";

const LANGUAGES: Language[] = ["cURL", "Node.js", "Python"];

export default function SdkReferencePage() {
  const [lang, setLang] = useState<Language>("cURL");
  const [viewMode, setViewMode] = useState<ViewMode>("snippets");
  const { toast } = useToast();

  const spec = useMemo(() => buildSabsmsOpenApiSpec(), []);
  const endpoints = useMemo(() => sabsmsDocEndpoints(), []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Snippet copied to clipboard");
  };

  return (
    <SabsmsPageShell
      title="SDK Reference"
      eyebrow="Developers"
      description="Quickstart snippets for the SabSMS public API — cURL, Node fetch and Python requests, generated from the OpenAPI spec."
      breadcrumbs={[{ label: "Developers" }, { label: "SDK Reference" }]}
      primaryAction={{
        label: "API docs",
        href: "/sabsms/api-docs",
      }}
      secondaryActions={[
        { label: "Manage API keys", onSelectHref: "/sabsms/api-keys" },
        {
          label: "openapi.json",
          icon: <Code className="h-4 w-4" aria-hidden="true" />,
          onSelectAction: () => window.open("/api/v1/sms/openapi.json", "_blank"),
        },
      ]}
      toolbar={
        <div className="mb-6 flex flex-col gap-4 border-b pb-4">
          <div className="flex items-center justify-between">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="snippets" className="flex items-center gap-2">
                  <Code className="h-4 w-4" aria-hidden="true" /> Code snippets
                </TabsTrigger>
                <TabsTrigger value="explorer" className="flex items-center gap-2">
                  <Search className="h-4 w-4" aria-hidden="true" /> API explorer
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Badge variant="secondary" className="font-mono text-[10px]">
              v{spec.info.version}
            </Badge>
          </div>

          {viewMode === "snippets" && (
            <Tabs value={lang} onValueChange={(v) => setLang(v as Language)}>
              <TabsList>
                {LANGUAGES.map((l) => (
                  <TabsTrigger key={l} value={l}>
                    {l === "cURL" ? "cURL" : l === "Node.js" ? "Node (fetch)" : "Python (requests)"}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>
      }
    >
      {viewMode === "snippets" ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="space-y-1 md:col-span-1">
            {endpoints.map((ep) => {
              const Icon =
                ep.method === "GET" ? BookOpen : ep.method === "POST" ? MessageSquare : Terminal;
              return (
                <a
                  key={ep.id}
                  href={`#${ep.id}`}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[var(--st-text-secondary)] transition-colors hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{ep.title}</span>
                </a>
              );
            })}
          </div>

          <div className="space-y-8 md:col-span-3">
            {endpoints.map((ep) => {
              const code = ep.codeExamples[lang] ?? ep.codeExamples.cURL;
              return (
                <Card key={ep.id} id={ep.id} className="scroll-mt-24">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {ep.method} {ep.path}
                      </Badge>
                      {ep.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="font-mono text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                    <CardTitle className="mt-2 text-lg">{ep.title}</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <div className="group relative overflow-hidden rounded-md border bg-[var(--st-text)] p-4">
                      <pre className="overflow-x-auto whitespace-pre font-mono text-sm text-white">
                        <code>{code}</code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-8 w-8 text-[var(--st-text-secondary)] opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                        aria-label={`Copy ${ep.title} snippet`}
                        onClick={() => handleCopy(code)}
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </CardBody>
                  <CardFooter className="flex items-center justify-between bg-[var(--st-bg-muted)]/50 py-3">
                    <div className="text-xs text-[var(--st-text-secondary)]">
                      Generated from{" "}
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        /api/v1/sms/openapi.json
                      </Badge>
                    </div>
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      Replace YOUR_HOST + sk_live_… with your deployment and key.
                    </span>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="min-h-[600px] rounded-md border bg-white p-4 shadow-sm">
          <SwaggerUI spec={spec} />
        </div>
      )}
    </SabsmsPageShell>
  );
}
