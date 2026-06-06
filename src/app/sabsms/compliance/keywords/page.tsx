"use client";

import React, { useState } from "react";
import {
  SabsmsPageShell,
  SabsmsDataTable,
} from "@/components/sabsms/page-toolkit";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter, Input, Label, Badge, StatCard, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Textarea, Checkbox } from '@/components/sabcrm/20ui';
import { Key, ShieldAlert, Settings, Activity, Upload, Download, Sparkles, MessageSquare, Filter, Code2, ShieldCheck, ListFilter, Globe2 } from "lucide-react";

export default function KeywordsPage() {
  const [view, setView] = useState<"keywords" | "responses" | "config" | "tools">("keywords");

  return (
    <SabsmsPageShell
      title="STOP / HELP Keywords"
      eyebrow="Compliance"
      description="Manage opt-out and help keywords, auto-responses, and carrier compliance rules."
      breadcrumbs={[
        { label: "Compliance", href: "/sabsms/compliance" },
        { label: "Keywords" },
      ]}
      primaryAction={{
        label: "Add Keyword",
        onClick: () => {},
      }}
      secondaryAction={{
        label: "Roadmap (Feature 20)",
        onClick: () => {},
      }}
      helpTitle="Keyword Management"
      helpBody="Configure standard opt-out/opt-in keywords (STOP, UNSTOP, HELP) and localized variants required by carriers."
    >
      <div className="mb-6 flex gap-2 overflow-x-auto">
        <Button
          variant={view === "keywords" ? "default" : "outline"}
          onClick={() => setView("keywords")}
        >
          <Key className="mr-2 h-4 w-4" /> Keywords
        </Button>
        <Button
          variant={view === "responses" ? "default" : "outline"}
          onClick={() => setView("responses")}
        >
          <MessageSquare className="mr-2 h-4 w-4" /> Responses & Rules
        </Button>
        <Button
          variant={view === "config" ? "default" : "outline"}
          onClick={() => setView("config")}
        >
          <Settings className="mr-2 h-4 w-4" /> Config & Import
        </Button>
        <Button
          variant={view === "tools" ? "default" : "outline"}
          onClick={() => setView("tools")}
        >
          <Activity className="mr-2 h-4 w-4" /> Tools & Audit
        </Button>
      </div>

      <div className="grid gap-6">
        {view === "keywords" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard
                label="Active Keywords"
                value="24"
                delta={2}
                period="Across 5 Locales"
              />
              <StatCard
                label="Global Suppressions"
                value="14,890"
                delta={450}
                period="Last 30 Days"
              />
              <StatCard
                label="Auto-Responses Sent"
                value="8,902"
                delta={120}
                period="Help & Info Requests"
              />
              <StatCard
                label="Carrier Compliant"
                value="100%"
                period="CTIA / CWTA / TRAI"
              />
            </div>

            <Card className="border-[var(--st-border)] shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between bg-[var(--st-bg-muted)]/20 pb-4 border-b">
                <div>
                  <CardTitle className="text-xl">Keyword & Suppression Mapping</CardTitle>
                  <CardDescription className="mt-1">
                    Manage how inbound keywords (e.g., STOP, START) map to global and local suppression lists.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input placeholder="Search keywords..." className="w-64 bg-[var(--st-bg-secondary)]" />
                  <Button variant="outline"><Filter className="w-4 h-4 mr-2" /> Filter</Button>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                <SabsmsDataTable
                  rowKey={(r) => r.id}
                  columns={[
                    { 
                      id: "keyword", 
                      header: "Keyword Pattern", 
                      render: (r) => (
                        <div className="flex flex-col py-2">
                          <span className="font-mono font-bold text-[15px]">{r.keyword}</span>
                          <span className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1 mt-1">
                            <Code2 className="w-3 h-3"/> {r.matchType} Match
                          </span>
                        </div>
                      ) 
                    },
                    { 
                      id: "actionType", 
                      header: "Intent / Action", 
                      render: (r) => (
                        <Badge 
                          variant={r.actionType === "Opt-out" ? "destructive" : r.actionType === "Opt-in" ? "default" : "secondary"}
                          className={r.actionType === "Opt-in" ? "bg-[var(--st-text)]/10 text-[var(--st-text)] hover:bg-[var(--st-text)]/20 border-[var(--st-border)]/20" : ""}
                        >
                          {r.actionType}
                        </Badge>
                      ) 
                    },
                    { 
                      id: "suppressionList", 
                      header: "Suppression Routing", 
                      render: (r) => (
                        <div className="flex items-center gap-2">
                          {r.actionType === "Opt-out" ? (
                            <ShieldAlert className="w-4 h-4 text-[var(--st-text)]/70"/>
                          ) : r.actionType === "Opt-in" ? (
                            <ShieldCheck className="w-4 h-4 text-[var(--st-text)]/70"/>
                          ) : (
                            <ListFilter className="w-4 h-4 text-[var(--st-text-secondary)]"/>
                          )}
                          <span className="font-medium text-sm">{r.suppressionList}</span>
                        </div>
                      ) 
                    },
                    { 
                      id: "locale", 
                      header: "Locale", 
                      render: (r) => (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Globe2 className="w-3.5 h-3.5 text-[var(--st-text-secondary)]" /> {r.locale}
                        </div>
                      )
                    },
                    { 
                      id: "network", 
                      header: "Compliance Rules", 
                      render: (r) => (
                        <div className="flex flex-wrap gap-1">
                          {r.networks.length > 0 ? r.networks.map(n => (
                            <Badge key={n} variant="outline" className="text-[10px] uppercase font-semibold bg-[var(--st-bg-muted)]/30">
                              {n}
                            </Badge>
                          )) : <span className="text-xs text-[var(--st-text-secondary)] italic">None</span>}
                        </div>
                      ) 
                    },
                    { 
                      id: "count", 
                      header: "Triggers (30d)", 
                      render: (r) => <span className="font-mono text-sm">{r.count.toLocaleString()}</span> 
                    },
                    { 
                      id: "status", 
                      header: "Status", 
                      render: (r) => (
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span className={`w-2 h-2 rounded-full ${r.status === 'Active' ? 'bg-[var(--st-text)] shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-[var(--st-text)]'}`} />
                          {r.status}
                        </div>
                      )
                    },
                  ]}
                  rows={[
                    { id: "1", keyword: "STOP", matchType: "Exact", actionType: "Opt-out", suppressionList: "Global Master Suppression", locale: "en-US", networks: ["CTIA", "T-Mobile"], count: 12450, status: "Active" },
                    { id: "2", keyword: "CANCEL", matchType: "Fuzzy", actionType: "Opt-out", suppressionList: "Global Master Suppression", locale: "en-US", networks: ["CTIA"], count: 3420, status: "Active" },
                    { id: "3", keyword: "UNSUBSCRIBE", matchType: "Exact", actionType: "Opt-out", suppressionList: "Marketing Opt-outs", locale: "en-GB", networks: ["UK DPA"], count: 890, status: "Active" },
                    { id: "4", keyword: "START", matchType: "Opt-in", suppressionList: "Remove from All Lists", locale: "en-US", networks: ["CTIA"], count: 520, status: "Active" },
                    { id: "5", keyword: "UNSTOP", matchType: "Exact", actionType: "Opt-in", suppressionList: "Remove from All Lists", locale: "en-US", networks: ["CTIA", "AT&T"], count: 110, status: "Active" },
                    { id: "6", keyword: "ARRET", matchType: "Exact", actionType: "Opt-out", suppressionList: "Global Master Suppression", locale: "fr-CA", networks: ["CWTA"], count: 45, status: "Active" },
                    { id: "7", keyword: "HELP", matchType: "Exact", actionType: "Help", suppressionList: "N/A (Auto-Reply Only)", locale: "Global", networks: ["CTIA"], count: 8900, status: "Active" },
                    { id: "8", keyword: "INFO", matchType: "Exact", actionType: "Help", suppressionList: "N/A (Auto-Reply Only)", locale: "en-US", networks: ["CTIA"], count: 1200, status: "Active" },
                    { id: "9", keyword: "PROMO(.*)", matchType: "Regex", actionType: "Custom", suppressionList: "N/A", locale: "en-US", networks: [], count: 450, status: "Inactive" },
                  ]}
                />
              </CardBody>
            </Card>
          </div>
        )}

        {view === "responses" && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Per-Keyword Response Template (Feature 2)</CardTitle>
                  <CardDescription>Define the auto-reply when a keyword is triggered.</CardDescription>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Keyword</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="STOP" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stop">STOP</SelectItem>
                        <SelectItem value="help">HELP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Response Message</Label>
                    <Textarea placeholder="You have been unsubscribed. Reply START to resubscribe." rows={3} />
                  </div>
                </CardBody>
                <CardFooter>
                  <Button>Save Response</Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Confirmation Template Editor (Feature 9)</CardTitle>
                  <CardDescription>Edit double opt-in or state change confirmations.</CardDescription>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="space-y-2">
                    <Label>Template Body</Label>
                    <Textarea placeholder="Please reply YES to confirm your subscription." rows={3} />
                  </div>
                </CardBody>
                <CardFooter>
                  <Button>Save Confirmation</Button>
                </CardFooter>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Handling Rules & Precedence</CardTitle>
                <CardDescription>Configure edge cases and match order.</CardDescription>
              </CardHeader>
              <CardBody className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-base">UNSTOP / START Handling Rules (Feature 12)</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="auto-unsuppress" defaultChecked />
                    <Label htmlFor="auto-unsuppress">Automatically remove from suppression list on START/UNSTOP</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="welcome-message" defaultChecked />
                    <Label htmlFor="welcome-message">Send welcome message on resubscription</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-base">Match Precedence Editor (Feature 15)</Label>
                  <p className="text-sm text-[var(--st-text-secondary)]">Drag to reorder precedence (mocked UI).</p>
                  <div className="p-3 border rounded-md bg-[var(--st-bg-muted)]/50 font-mono text-sm">
                    1. Exact word match (e.g., "STOP")<br/>
                    2. Prefix match (e.g., "STOP promotions")<br/>
                    3. Fuzzy match / Typo tolerance
                  </div>
                </div>
              </CardBody>
            </Card>
          </>
        )}

        {view === "config" && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Global Configuration</CardTitle>
                  <CardDescription>Set rate limits and channel toggles.</CardDescription>
                </CardHeader>
                <CardBody className="space-y-6">
                  <div className="space-y-2">
                    <Label>Auto-reply Rate Limit (Feature 8)</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" defaultValue={1} className="w-24" />
                      <span className="text-sm text-[var(--st-text-secondary)]">replies per minute per contact</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Per-Channel Toggle (Feature 10)</Label>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="ch-sms" defaultChecked />
                        <Label htmlFor="ch-sms">SMS</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="ch-mms" defaultChecked />
                        <Label htmlFor="ch-mms">MMS</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="ch-rcs" />
                        <Label htmlFor="ch-rcs">RCS</Label>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className="border-[var(--st-border)] dark:border-[var(--st-border)]">
                <CardHeader>
                  <div className="flex items-center gap-2 text-[var(--st-text)] dark:text-[var(--st-text)]">
                    <ShieldAlert className="h-5 w-5" />
                    <CardTitle>Carrier-Blocked Warnings (Feature 11)</CardTitle>
                  </div>
                  <CardDescription>Alerts regarding carrier restrictions on keywords.</CardDescription>
                </CardHeader>
                <CardBody>
                  <div className="text-sm p-3 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/30 rounded-md">
                    <strong>Warning:</strong> The keyword <em>"FREE"</em> is heavily filtered by US carriers on 10DLC. Avoid using this as a custom trigger.
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Bulk Operations</CardTitle>
                <CardDescription>Import or export your keyword set.</CardDescription>
              </CardHeader>
              <CardBody className="flex gap-4">
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" /> Bulk Import (Feature 16)
                </Button>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" /> Bulk Export (Feature 17)
                </Button>
              </CardBody>
            </Card>
          </>
        )}

        {view === "tools" && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Test Keyword (Feature 5)</CardTitle>
                  <CardDescription>Simulate an inbound message.</CardDescription>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="space-y-2">
                    <Label>Inbound Message Content</Label>
                    <div className="flex gap-2">
                      <Input placeholder="E.g., Pls stop sending" />
                      <Button>Test</Button>
                    </div>
                  </div>
                  <div className="p-3 border rounded text-sm text-[var(--st-text-secondary)]">
                    Result: Matches <span className="font-bold text-[var(--st-text)]">STOP</span> (Fuzzy match)
                  </div>
                </CardBody>
              </Card>

              <Card className="bg-[var(--st-text)]/5 border-primary/20">
                <CardHeader>
                  <div className="flex items-center gap-2 text-[var(--st-text)]">
                    <Sparkles className="h-5 w-5" />
                    <CardTitle>AI Insights (Feature 18)</CardTitle>
                  </div>
                  <CardDescription>Suggest keywords from inbound corpus.</CardDescription>
                </CardHeader>
                <CardBody>
                  <p className="text-sm mb-4">Analyze recent inbound messages to discover unrecognized opt-out intents.</p>
                  <Button variant="default" className="w-full">
                    <Sparkles className="mr-2 h-4 w-4" /> Suggest Keywords
                  </Button>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>Keyword fires and configuration changes.</CardDescription>
              </CardHeader>
              <CardBody className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-base">Per-Keyword Fires (Feature 6)</Label>
                  <SabsmsDataTable
                    rowKey={(r) => r.keyword}
                    columns={[
                      { id: "keyword", header: "Keyword", render: (r) => r.keyword },
                      { id: "count", header: "Fires (24h)", render: (r) => r.count },
                      { id: "action", header: "Result", render: (r) => r.action },
                    ]}
                    rows={[
                      { keyword: "STOP", count: 142, action: "Suppressed" },
                      { keyword: "HELP", count: 38, action: "Auto-reply sent" },
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base">System Audit Log (Feature 19)</Label>
                  <SabsmsDataTable
                    rowKey={(r) => r.id}
                    columns={[
                      { id: "time", header: "Time", render: (r) => r.time },
                      { id: "user", header: "User", render: (r) => r.user },
                      { id: "event", header: "Event", render: (r) => r.event },
                    ]}
                    rows={[
                      { id: "1", time: "10 mins ago", user: "Admin", event: "Updated HELP response template" },
                      { id: "2", time: "2 hours ago", user: "System", event: "Imported 5 keywords via Bulk Import" },
                    ]}
                  />
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </SabsmsPageShell>
  );
}
