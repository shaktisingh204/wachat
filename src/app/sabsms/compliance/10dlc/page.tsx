"use client";

import React, { useState } from "react";
import {
  SabsmsPageShell,
  SabsmsDataTable,
} from "@/components/sabsms/page-toolkit";
import {
  Button,
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  ZoruCardFooter,
  Input,
  Label,
  Badge,
  ZoruStatCard,
  Select,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSelectContent,
  ZoruSelectItem,
  Textarea,
  Checkbox,
  Accordion,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruAccordionContent,
  ZoruAccordion03,
  ZoruAccordion03Item,
  ZoruAccordion03Trigger,
  ZoruAccordion03Content,
  ZoruCollapsible,
  ZoruCollapsibleTrigger,
  ZoruCollapsibleContent,
  RadioGroup,
  ZoruRadioCard,
  Separator,
  Switch,
  cn,
} from "@/components/zoruui";
import { 
  Briefcase, 
  MessageSquare, 
  Settings, 
  Activity, 
  Building2, 
  Globe, 
  FileText, 
  Mail, 
  Phone, 
  ShieldCheck, 
  Zap, AlertTriangle,
  Info, ChevronDown
} from "lucide-react";

export default function TenDlcRegistrationPage() {
  const [view, setView] = useState<"brands" | "campaigns" | "settings" | "audits">("brands");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  return (
    <SabsmsPageShell
      title="10DLC Registration (US)"
      eyebrow="Compliance"
      description="Manage A2P 10DLC brands, campaigns, and throughput limits for US messaging. Complete your registration below to ensure optimal deliverability."
      breadcrumbs={[
        { label: "Compliance", href: "/sabsms/compliance" },
        { label: "10DLC" },
      ]}
      primaryAction={{
        label: "Register New Brand",
        onClick: () => {},
      }}
      helpTitle="What is 10DLC?"
      helpBody="10-Digit Long Code (10DLC) is the standard for application-to-person (A2P) SMS messaging in the US. Brands must be registered to send messages."
    >
      <div className="mb-8 flex flex-wrap gap-3">
        <Button
          variant={view === "brands" ? "default" : "outline"}
          onClick={() => setView("brands")}
          className={cn("h-11 px-6 rounded-full", view === "brands" && "shadow-md")}
        >
          <Briefcase className="mr-2 h-4 w-4" /> Brands & Entities
        </Button>
        <Button
          variant={view === "campaigns" ? "default" : "outline"}
          onClick={() => setView("campaigns")}
          className={cn("h-11 px-6 rounded-full", view === "campaigns" && "shadow-md")}
        >
          <MessageSquare className="mr-2 h-4 w-4" /> Campaigns & Use Cases
        </Button>
        <Button
          variant={view === "settings" ? "default" : "outline"}
          onClick={() => setView("settings")}
          className={cn("h-11 px-6 rounded-full", view === "settings" && "shadow-md")}
        >
          <Settings className="mr-2 h-4 w-4" /> Settings & Cost
        </Button>
        <Button
          variant={view === "audits" ? "default" : "outline"}
          onClick={() => setView("audits")}
          className={cn("h-11 px-6 rounded-full", view === "audits" && "shadow-md")}
        >
          <Activity className="mr-2 h-4 w-4" /> Audits & Rejects
        </Button>
      </div>

      <div className="grid gap-8">
        {view === "brands" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="grid gap-6 md:grid-cols-3">
              <ZoruStatCard
                label="Overall Trust Score"
                value="95 / 100"
                delta={5}
                period="Excellent standing based on recent vetting"
                className="bg-gradient-to-br from-zoru-bg to-green-50/30 dark:to-green-900/10 border-green-200/50"
              />
              <ZoruStatCard
                label="Registered Brands"
                value="12 Active"
                period="Across 4 different verticals"
              />
              <ZoruStatCard
                label="Vetting Upgrades"
                value="3 Eligible"
                period="Upgrade for higher throughput"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-zoru-line overflow-hidden shadow-sm">
                  <div className="bg-zoru-surface border-b px-6 py-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-zoru-primary/10 flex items-center justify-center text-zoru-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Premium Brand Registration</h2>
                      <p className="text-sm text-zoru-ink-muted">Complete the multi-step verification process to register a new entity.</p>
                    </div>
                  </div>
                  <ZoruCardContent className="p-0">
                    <ZoruAccordion03 type="single" defaultValue="step-1" collapsible className="p-6">
                      <ZoruAccordion03Item value="step-1">
                        <ZoruAccordion03Trigger>1. Entity Profile & Legal Info, ChevronDownrmation</ZoruAccordion03Trigger>
                        <ZoruAccordion03Content className="space-y-6">
                          <div className="grid gap-4 mt-2">
                            <Label>Entity Type</Label>
                            <RadioGroup defaultValue="private" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <ZoruRadioCard value="private" label="Private Company" description="LLC, Inc, Corp" icon={<Briefcase className="h-4 w-4" />} />
                              <ZoruRadioCard value="public" label="Public Company" description="Traded on exchange" icon={<Globe className="h-4 w-4" />} />
                              <ZoruRadioCard value="nonprofit" label="Non-Profit (501c3)" description="Registered charity" icon={<ShieldCheck className="h-4 w-4" />} />
                              <ZoruRadioCard value="gov" label="Government" description="Local or Federal" icon={<Building2 className="h-4 w-4" />} />
                            </RadioGroup>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-5">
                            <div className="space-y-2">
                              <Label>Legal Business Name</Label>
                              <Input placeholder="Acme Corporation Inc." />
                            </div>
                            <div className="space-y-2">
                              <Label>Employer Identification Number (EIN)</Label>
                              <Input placeholder="XX-XXXXXXX" />
                            </div>
                            <div className="space-y-2">
                              <Label>Doing Business As (DBA)</Label>
                              <Input placeholder="Optional" />
                            </div>
                            <div className="space-y-2">
                              <Label>Vertical / Industry</Label>
                              <Select>
                                <ZoruSelectTrigger>
                                  <ZoruSelectValue placeholder="Select vertical" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                  <ZoruSelectItem value="tech">Technology & Software</ZoruSelectItem>
                                  <ZoruSelectItem value="retail">Retail & Ecommerce</ZoruSelectItem>
                                  <ZoruSelectItem value="finance">Financial Services</ZoruSelectItem>
                                  <ZoruSelectItem value="healthcare">Healthcare</ZoruSelectItem>
                                </ZoruSelectContent>
                              </Select>
                            </div>
                          </div>
                        </ZoruAccordion03Content>
                      </ZoruAccordion03Item>

                      <ZoruAccordion03Item value="step-2" className="mt-4">
                        <ZoruAccordion03Trigger>2. Business Location</ZoruAccordion03Trigger>
                        <ZoruAccordion03Content className="space-y-5">
                          <div className="space-y-2 mt-2">
                            <Label>Street Address</Label>
                            <Input placeholder="123 Main Street" />
                          </div>
                          <div className="grid sm:grid-cols-3 gap-5">
                            <div className="space-y-2 sm:col-span-1">
                              <Label>City</Label>
                              <Input placeholder="San Francisco" />
                            </div>
                            <div className="space-y-2 sm:col-span-1">
                              <Label>State / Province</Label>
                              <Input placeholder="CA" />
                            </div>
                            <div className="space-y-2 sm:col-span-1">
                              <Label>Postal Code</Label>
                              <Input placeholder="94105" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Country</Label>
                            <Select defaultValue="us">
                              <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="Select country" />
                              </ZoruSelectTrigger>
                              <ZoruSelectContent>
                                <ZoruSelectItem value="us">United States</ZoruSelectItem>
                                <ZoruSelectItem value="ca">Canada</ZoruSelectItem>
                                <ZoruSelectItem value="uk">United Kingdom</ZoruSelectItem>
                              </ZoruSelectContent>
                            </Select>
                          </div>
                        </ZoruAccordion03Content>
                      </ZoruAccordion03Item>

                      <ZoruAccordion03Item value="step-3" className="mt-4">
                        <ZoruAccordion03Trigger>3. Contact & Support Info, ChevronDownrmation</ZoruAccordion03Trigger>
                        <ZoruAccordion03Content className="space-y-5">
                          <div className="grid sm:grid-cols-2 gap-5 mt-2">
                            <div className="space-y-2">
                              <Label>Support Email</Label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                                <Input placeholder="support@acme.com" className="pl-9" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Support Phone</Label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                                <Input placeholder="+1 (800) 555-0199" className="pl-9" />
                              </div>
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Website URL</Label>
                              <div className="relative">
                                <Globe className="absolute left-3 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                                <Input placeholder="https://www.acme.com" className="pl-9" />
                              </div>
                            </div>
                          </div>
                        </ZoruAccordion03Content>
                      </ZoruAccordion03Item>
                    </ZoruAccordion03>
                  </ZoruCardContent>
                  <div className="p-6 bg-zoru-surface border-t flex justify-end gap-3">
                    <Button variant="outline">Save Draft</Button>
                    <Button>Submit for Verification</Button>
                  </div>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <ZoruCardHeader>
                    <ZoruCardTitle className="text-base flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-zoru-primary" /> TCR Verification Status
                    </ZoruCardTitle>
                  </ZoruCardHeader>
                  <ZoruCardContent className="space-y-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zoru-ink-muted">EIN Verification</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Verified</Badge>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zoru-ink-muted">Address Matching</span>
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Pending</Badge>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zoru-ink-muted">Vetting Class</span>
                        <span className="font-medium">Standard</span>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full mt-4">
                      <Zap className="mr-2 h-4 w-4 text-amber-500" /> Apply for Enhanced Vetting
                    </Button>
                  </ZoruCardContent>
                </Card>

                <Card>
                  <ZoruCardHeader>
                    <ZoruCardTitle className="text-base">Quick Help</ZoruCardTitle>
                  </ZoruCardHeader>
                  <ZoruCardContent>
                    <Accordion type="single" collapsible className="w-full">
                      <ZoruAccordionItem value="item-1">
                        <ZoruAccordionTrigger className="text-xs py-3">Why is EIN required?</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="text-xs">
                          The Campaign Registry uses the Employer Identification Number to verify the legal existence of the business with the IRS.
                        </ZoruAccordionContent>
                      </ZoruAccordionItem>
                      <ZoruAccordionItem value="item-2">
                        <ZoruAccordionTrigger className="text-xs py-3">What if I don't have a website?</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="text-xs">
                          You must provide a valid social media presence or other online footprint if a website is not available, otherwise vetting may be rejected.
                        </ZoruAccordionContent>
                      </ZoruAccordionItem>
                    </Accordion>
                  </ZoruCardContent>
                </Card>
              </div>
            </div>

            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Number ↔ Campaign Assignment Matrix</ZoruCardTitle>
                <ZoruCardDescription>Manage your inventory of 10DLC numbers and their active campaign associations.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <SabsmsDataTable
                  rowKey={(r) => r.number}
                  columns={[
                    { id: "number", header: "Number", render: (r) => <span className="font-mono">{r.number}</span> },
                    { id: "campaign", header: "Assigned Campaign", render: (r) => <span className="font-medium">{r.campaign}</span> },
                    { id: "throughput", header: "Throughput (TPM)", render: (r) => r.throughput },
                    { id: "status", header: "Status", render: (r) => (
                      <Badge variant="secondary" className={r.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : ''}>
                        {r.status}
                      </Badge>
                    )},
                  ]}
                  rows={[
                    { number: "+1 234 567 8900", campaign: "Marketing 2026", throughput: "4,000", status: "Active" },
                    { number: "+1 987 654 3210", campaign: "OTP Alerts", throughput: "12,000", status: "Active" },
                    { number: "+1 555 123 4567", campaign: "Customer Support", throughput: "4,000", status: "Pending Verification" },
                  ]}
                />
              </ZoruCardContent>
            </Card>
          </div>
        )}

        {view === "campaigns" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <ZoruStatCard
                label="Campaign Status"
                value="3 Active"
                period="1 Pending Approval"
              />
              <ZoruStatCard
                label="Capabilities"
                value="SMS / MMS"
                period="Voice enabled on 2 numbers"
              />
              <ZoruStatCard
                label="Max Throughput"
                value="12,000 TPM"
                period="T-Mobile Tier: Top"
              />
              <Card className="flex flex-col justify-center p-4 bg-zoru-surface border-zoru-line border-dashed">
                <Button variant="outline" className="w-full">
                  Bulk Register Campaigns
                </Button>
              </Card>
            </div>

            <Card className="border-zoru-line shadow-sm overflow-hidden">
              <div className="bg-zoru-surface border-b px-6 py-5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Comprehensive Campaign Registration</h2>
                  <p className="text-sm text-zoru-ink-muted">Detail your messaging use case, samples, and opt-in flows to ensure compliance.</p>
                </div>
              </div>
              <ZoruCardContent className="p-0">
                <Accordion type="multiple" defaultValue={["uc", "samples", "opt"]} className="w-full">
                  <ZoruAccordionItem value="uc" className="px-6">
                    <ZoruAccordionTrigger className="text-base py-5">Use Case & Campaign Type</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-6 pb-6">
                      <div className="space-y-3">
                        <Label>Select Registered Brand</Label>
                        <Select defaultValue="acme">
                          <ZoruSelectTrigger>
                            <ZoruSelectValue placeholder="Select Brand" />
                          </ZoruSelectTrigger>
                          <ZoruSelectContent>
                            <ZoruSelectItem value="acme">Acme Corporation Inc.</ZoruSelectItem>
                            <ZoruSelectItem value="globex">Globex Corporation</ZoruSelectItem>
                          </ZoruSelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <Label>Campaign Use Case</Label>
                        <RadioGroup defaultValue="2fa" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <ZoruRadioCard value="2fa" label="2FA / OTP" description="Authentication codes" />
                          <ZoruRadioCard value="marketing" label="Marketing" description="Promotions & sales" />
                          <ZoruRadioCard value="alerts" label="Account Alerts" description="Notifications & updates" />
                          <ZoruRadioCard value="cs" label="Customer Care" description="Support interactions" />
                          <ZoruRadioCard value="mixed" label="Mixed" description="Multiple use cases" />
                          <ZoruRadioCard value="special" label="Special / Political" description="Requires extra vetting" />
                        </RadioGroup>
                      </div>
                      <div className="space-y-3">
                        <Label>Campaign Description</Label>
                        <Textarea placeholder="Describe how consumers will interact with this campaign..." className="min-h-[100px]" />
                      </div>
                    </ZoruAccordionContent>
                  </ZoruAccordionItem>

                  <ZoruAccordionItem value="samples" className="px-6">
                    <ZoruAccordionTrigger className="text-base py-5">Message Samples</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-6 pb-6">
                      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg p-4 flex gap-3 text-sm text-blue-800 dark:text-blue-300">
                        <Info, ChevronDown className="h-5 w-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold mb-1">Required Samples</p>
                          <p>You must provide at least 2 representative message samples. Ensure they accurately reflect the content you will be sending, including any URLs.</p>
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map((num) => (
                          <div key={num} className="space-y-2">
                            <Label className="flex justify-between">
                              Sample Message {num} {num > 2 && <span className="text-zoru-ink-muted font-normal">(Optional)</span>}
                            </Label>
                            <Textarea 
                              placeholder={`E.g., "Your Acme code is 123456. Valid for 10 minutes."`} 
                              className="font-mono text-sm resize-none h-24" 
                            />
                            <p className="text-xs text-zoru-ink-muted text-right">0 / 160 chars</p>
                          </div>
                        ))}
                      </div>
                    </ZoruAccordionContent>
                  </ZoruAccordionItem>

                  <ZoruAccordionItem value="opt" className="px-6">
                    <ZoruAccordionTrigger className="text-base py-5">Opt-In, Opt-Out & Help Workflows</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-6 pb-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>How do users opt-in?</Label>
                          <Select defaultValue="web">
                            <ZoruSelectTrigger>
                              <ZoruSelectValue placeholder="Select method" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                              <ZoruSelectItem value="web">Web Form / App Registration</ZoruSelectItem>
                              <ZoruSelectItem value="sms">SMS Keyword (e.g., START)</ZoruSelectItem>
                              <ZoruSelectItem value="paper">Paper Form / Point of Sale</ZoruSelectItem>
                              <ZoruSelectItem value="voice">Verbal Consent / IVR</ZoruSelectItem>
                            </ZoruSelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Opt-in Description / Link</Label>
                          <Input placeholder="https://www.acme.com/terms-and-conditions" />
                        </div>
                      </div>

                      <Separator />

                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label>Opt-Out Keywords (Comma separated)</Label>
                          <Input defaultValue="STOP, UNSUBSCRIBE, CANCEL, QUIT" />
                          <div className="p-3 bg-muted rounded-md text-sm border font-mono">
                            Preview: Reply STOP to unsubscribe.
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label>Help Keywords (Comma separated)</Label>
                          <Input defaultValue="HELP, INFO" />
                          <div className="p-3 bg-muted rounded-md text-sm border font-mono">
                            Preview: Reply HELP for info. Msg&Data rates apply.
                          </div>
                        </div>
                      </div>
                    </ZoruAccordionContent>
                  </ZoruAccordionItem>
                </Accordion>

                <div className="px-6 py-4 bg-zoru-bg border-b border-t">
                  <ZoruCollapsible
                    open={isAdvancedOpen}
                    onOpenChange={setIsAdvancedOpen}
                    className="w-full space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium cursor-pointer" onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}>
                        Advanced Capabilities
                      </Label>
                      <ZoruCollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-9 p-0">
                          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isAdvancedOpen ? "rotate-180" : "")} />
                          <span className="sr-only">Toggle advanced options</span>
                        </Button>
                      </ZoruCollapsibleTrigger>
                    </div>
                    <ZoruCollapsibleContent className="space-y-4 pt-4 pb-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-zoru-surface">
                          <div className="space-y-0.5">
                            <Label className="text-base">MMS Enabled</Label>
                            <p className="text-sm text-zoru-ink-muted">Send rich media</p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-zoru-surface">
                          <div className="space-y-0.5">
                            <Label className="text-base">Age Gating</Label>
                            <p className="text-sm text-zoru-ink-muted">18+ or 21+ content</p>
                          </div>
                          <Switch />
                        </div>
                        <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-zoru-surface">
                          <div className="space-y-0.5">
                            <Label className="text-base">Number Pooling</Label>
                            <p className="text-sm text-zoru-ink-muted">&gt;50 numbers</p>
                          </div>
                          <Switch />
                        </div>
                        <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-zoru-surface">
                          <div className="space-y-0.5">
                            <Label className="text-base">Direct Lending</Label>
                            <p className="text-sm text-zoru-ink-muted">Financial lending</p>
                          </div>
                          <Switch />
                        </div>
                        <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-zoru-surface">
                          <div className="space-y-0.5">
                            <Label className="text-base">Embedded Links</Label>
                            <p className="text-sm text-zoru-ink-muted">Contains URLs</p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-zoru-surface">
                          <div className="space-y-0.5">
                            <Label className="text-base">Embedded Phone</Label>
                            <p className="text-sm text-zoru-ink-muted">Contains phone numbers</p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                      </div>
                    </ZoruCollapsibleContent>
                  </ZoruCollapsible>
                </div>
              </ZoruCardContent>
              <div className="p-6 bg-zoru-surface flex justify-end gap-3">
                <Button variant="outline">Save Campaign</Button>
                <Button>Register Campaign ($15.00)</Button>
              </div>
            </Card>
          </div>
        )}

        {view === "settings" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="h-full">
                <ZoruCardHeader>
                  <ZoruCardTitle>TCR Fee Schedule & Cost Preview</ZoruCardTitle>
                  <ZoruCardDescription>Current pricing for The Campaign Registry passes through directly.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                  <div className="space-y-4">
                    <div className="bg-zoru-surface rounded-lg p-4 border">
                      <h4 className="font-semibold text-sm mb-3 text-zoru-ink-muted uppercase tracking-wider">One-Time Fees</h4>
                      <div className="flex justify-between py-2 border-b">
                        <span>Brand Vetting (Standard)</span>
                        <strong className="text-zoru-ink">$40.00</strong>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span>Campaign Registration</span>
                        <strong className="text-zoru-ink">$15.00</strong>
                      </div>
                    </div>
                    
                    <div className="bg-zoru-surface rounded-lg p-4 border">
                      <h4 className="font-semibold text-sm mb-3 text-zoru-ink-muted uppercase tracking-wider">Recurring Monthly Fees</h4>
                      <div className="flex justify-between py-2 border-b">
                        <span>Campaign Maintenance (Standard)</span>
                        <strong className="text-zoru-ink">$10.00 / mo</strong>
                      </div>
                      <div className="flex justify-between py-2">
                        <span>Low Volume Campaign</span>
                        <strong className="text-zoru-ink">$1.50 / mo</strong>
                      </div>
                    </div>
                  </div>
                </ZoruCardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <ZoruCardHeader>
                    <ZoruCardTitle>Renewal Notifications</ZoruCardTitle>
                    <ZoruCardDescription>Configure alerts to avoid campaign expiration.</ZoruCardDescription>
                  </ZoruCardHeader>
                  <ZoruCardContent className="space-y-4">
                    <div className="flex items-start space-x-3 p-3 bg-zoru-surface rounded-lg border">
                      <Checkbox id="remind-30" defaultChecked className="mt-1" />
                      <div>
                        <Label htmlFor="remind-30" className="font-medium text-base">30 Days Prior</Label>
                        <p className="text-sm text-zoru-ink-muted">Receive early warning for upcoming renewals.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 bg-zoru-surface rounded-lg border">
                      <Checkbox id="remind-7" defaultChecked className="mt-1" />
                      <div>
                        <Label htmlFor="remind-7" className="font-medium text-base">7 Days Prior</Label>
                        <p className="text-sm text-zoru-ink-muted">Critical final warning before expiration.</p>
                      </div>
                    </div>
                  </ZoruCardContent>
                </Card>

                <Card>
                  <ZoruCardHeader>
                    <ZoruCardTitle>Reseller Configuration</ZoruCardTitle>
                    <ZoruCardDescription>Manage relationships with downstream providers.</ZoruCardDescription>
                  </ZoruCardHeader>
                  <ZoruCardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Reseller TCR ID (Optional)</Label>
                      <Input placeholder="R-XXXXXXXX" />
                    </div>
                    <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-zoru-surface mt-4">
                      <div className="space-y-0.5">
                        <Label className="text-base">Campaign Sharing</Label>
                        <p className="text-sm text-zoru-ink-muted">Allow reseller to view active campaigns</p>
                      </div>
                      <Switch />
                    </div>
                  </ZoruCardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {view === "audits" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <ZoruCardHeader>
                  <ZoruCardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" /> Action Required
                  </ZoruCardTitle>
                  <ZoruCardDescription>Review rejected or flagged campaigns.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                  <div className="rounded-lg border p-5 bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-red-900 dark:text-red-400 text-lg">Marketing 2026</h4>
                        <p className="text-sm text-red-700/80 dark:text-red-300/80 mt-1">Campaign Registration</p>
                      </div>
                      <Badge variant="outline" className="text-red-600 border-red-300">Rejected</Badge>
                    </div>
                    <Separator className="bg-red-200 dark:bg-red-800/50 my-3" />
                    <p className="text-sm font-medium text-red-900 dark:text-red-400 mb-2">Rejection Reason (TCR Code: 301):</p>
                    <p className="text-sm text-red-800 dark:text-red-300">Opt-out language missing in sample message 3. The phrase "Reply STOP to cancel" or similar must be clearly visible in promotional samples.</p>
                    <div className="mt-5 flex gap-3">
                      <Button variant="outline" size="sm" className="bg-white dark:bg-zoru-bg border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20">
                        View Details
                      </Button>
                      <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                        Edit & Re-submit
                      </Button>
                    </div>
                  </div>
                </ZoruCardContent>
              </Card>

              <Card>
                <ZoruCardHeader>
                  <ZoruCardTitle>Submission Audit Trail</ZoruCardTitle>
                  <ZoruCardDescription>Recent state changes for your entities.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                  <div className="relative border-l border-zoru-line ml-3 space-y-6 pb-2">
                    <div className="relative pl-6">
                      <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-zoru-bg bg-green-500" />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">Vetting Completed (Score: 95)</span>
                        <span className="text-xs text-zoru-ink-muted mt-1">Acme Corporation Inc. • Oct 14, 02:30 PM</span>
                      </div>
                    </div>
                    <div className="relative pl-6">
                      <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-zoru-bg bg-blue-500" />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">Submitted to TCR</span>
                        <span className="text-xs text-zoru-ink-muted mt-1">Acme Corporation Inc. • Oct 12, 10:00 AM</span>
                      </div>
                    </div>
                    <div className="relative pl-6">
                      <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-zoru-bg bg-zoru-line-strong" />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">Draft Created</span>
                        <span className="text-xs text-zoru-ink-muted mt-1">System User • Oct 10, 09:15 AM</span>
                      </div>
                    </div>
                  </div>
                </ZoruCardContent>
              </Card>
            </div>

            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Full Activity Log</ZoruCardTitle>
                <ZoruCardDescription>Comprehensive log of all compliance activities across brands and campaigns.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <SabsmsDataTable
                  rowKey={(r) => r.id}
                  columns={[
                    { id: "date", header: "Date & Time", render: (r) => <span className="text-sm">{r.date}</span> },
                    { id: "entity", header: "Entity", render: (r) => <span className="font-medium text-sm">{r.entity}</span> },
                    { id: "user", header: "User / System", render: (r) => r.user },
                    { id: "action", header: "Action", render: (r) => r.action },
                  ]}
                  rows={[
                    { id: 1, date: "2026-05-20 14:32:00", entity: "Acme Corp", user: "Admin", action: "Created Brand Registration Draft" },
                    { id: 2, date: "2026-05-21 09:15:22", entity: "Acme Corp", user: "Admin", action: "Submitted to TCR for Vetting" },
                    { id: 3, date: "2026-05-22 11:05:45", entity: "Acme Corp", user: "System", action: "Brand Verified (Score: 95)" },
                    { id: 4, date: "2026-05-22 11:30:10", entity: "Marketing 2026", user: "Admin", action: "Campaign Registered" },
                  ]}
                />
              </ZoruCardContent>
            </Card>
          </div>
        )}
      </div>
    </SabsmsPageShell>
  );
}
