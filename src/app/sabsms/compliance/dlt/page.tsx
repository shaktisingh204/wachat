"use client";

import * as React from "react";
import {
  AlertCircle,
  Building,
  Hash,
  Activity,
  Save,
  Check,
  Globe,
  Radio,
  Layers,
  Zap,
  ShieldAlert,
  ShieldCheck,
  FileKey,
  Plus,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  Dot,
  Field,
  Input,
  StatCard,
  Switch,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/sabcrm/20ui";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";

export default function DltRegistrationPage() {
  const { toast } = useToast();

  return (
    <SabsmsPageShell
      title="DLT Compliance Hub"
      description="Comprehensive configuration matrices for TRAI guidelines. Manage your PEID, Headers, Templates and Operator connectivity in a unified dashboard."
      eyebrow="Compliance"
      breadcrumbs={[
        { label: "SabSMS", href: "/sabsms" },
        { label: "Compliance", href: "/sabsms/compliance" },
        { label: "DLT Hub" },
      ]}
      primaryAction={{
        label: "Deploy Compliance Rules",
        onClick: () =>
          toast.success("Compliance settings deployed across all clusters."),
      }}
      secondaryActions={[
        {
          label: "Export Full Matrix",
          onSelectAction: () => toast({ title: "Exporting matrix as CSV." }),
        },
      ]}
    >
      <div className="space-y-8 pb-10">

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Overall Compliance Score"
            value="98.5%"
            icon={ShieldCheck}
            delta={{ value: "+2.1%", tone: "up" }}
          />
          <StatCard
            label="Active PEIDs"
            value="3"
            icon={Building}
            delta={{ value: "4 operators", tone: "neutral" }}
          />
          <StatCard
            label="Registered Headers"
            value="124"
            icon={Hash}
            delta={{ value: "+12", tone: "up" }}
          />
          <StatCard
            label="Template Scrub Rate"
            value="0.02%"
            icon={Activity}
            delta={{ value: "-0.05%", tone: "down" }}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* Main Form Accordion */}
          <div className="xl:col-span-2 space-y-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-[var(--st-text)] tracking-tight">DLT Registration Matrix</h2>
              <p className="text-sm text-[var(--st-text-secondary)]">
                Complete the configuration across all layers to ensure seamless SMS delivery in India.
                Any misconfiguration may result in severe penalties or message drops.
              </p>
            </div>

            <Accordion type="single" collapsible defaultValue="step-1" className="space-y-4">

              {/* Step 1: PEID */}
              <AccordionItem value="step-1" className="border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg)] overflow-hidden">
                <AccordionTrigger className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] flex items-center justify-center font-bold text-sm">1</div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-[var(--st-text)]">Principal Entity (PEID) Configuration</span>
                      <span className="text-xs font-normal text-[var(--st-text-secondary)]">Manage business registrations and entity IDs.</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6 px-4 pb-4">
                    <div className="bg-[var(--st-bg-secondary)] rounded-[var(--st-radius-lg)] p-5 border border-[var(--st-border)]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Field label="Business Name">
                          <Input defaultValue="SabNode Technologies Pvt. Ltd." />
                        </Field>
                        <Field label="Primary PEID">
                          <Input defaultValue="1101456789012345678" className="font-mono" />
                        </Field>
                      </div>
                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <Button size="sm" variant="primary" iconLeft={Check}>
                          Verify Entity Status
                        </Button>
                        <Button size="sm" variant="outline">
                          Upload Registration Certificate (KYC)
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-[var(--st-text)] flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" /> Operator-specific Mapping
                      </h4>

                      <Accordion type="multiple" defaultValue={["op-jio"]} className="space-y-3">
                        <AccordionItem value="op-jio" className="border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg)] overflow-hidden">
                          <AccordionTrigger className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Badge tone="neutral">Jio</Badge>
                              <span className="text-sm font-medium text-[var(--st-text)]">Reliance Jio Infocomm Ltd.</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="px-4 pb-4 grid grid-cols-2 gap-4">
                              <Field label="Mapped PEID">
                                <Input inputSize="sm" defaultValue="1101456789012345678" className="font-mono" />
                              </Field>
                              <div className="space-y-1">
                                <span className="block text-xs text-[var(--st-text-secondary)]">Status</span>
                                <Badge tone="success" dot>Active</Badge>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="op-airtel" className="border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg)] overflow-hidden">
                          <AccordionTrigger className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Badge tone="neutral">Airtel</Badge>
                              <span className="text-sm font-medium text-[var(--st-text)]">Bharti Airtel Ltd.</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="px-4 pb-4 grid grid-cols-2 gap-4">
                              <Field label="Mapped PEID">
                                <Input inputSize="sm" defaultValue="1101456789012345678" className="font-mono" />
                              </Field>
                              <div className="space-y-1">
                                <span className="block text-xs text-[var(--st-text-secondary)]">Status</span>
                                <Badge tone="success" dot>Active</Badge>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Step 2: Headers */}
              <AccordionItem value="step-2" className="border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg)] overflow-hidden">
                <AccordionTrigger className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] flex items-center justify-center font-bold text-sm">2</div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-[var(--st-text)]">Header (Sender ID) Registration</span>
                      <span className="text-xs font-normal text-[var(--st-text-secondary)]">Configure 6-alpha or 6-numeric Sender IDs for different message types.</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6 px-4 pb-4">
                    <div className="flex justify-between items-center gap-3">
                      <p className="text-sm text-[var(--st-text-secondary)]">Register and map your headers to specific routing profiles.</p>
                      <Button size="sm" variant="outline" iconLeft={Plus}>Add Header</Button>
                    </div>

                    <div className="border border-[var(--st-border)] rounded-[var(--st-radius-lg)] overflow-hidden">
                      <Table>
                        <THead>
                          <Tr>
                            <Th>Header</Th>
                            <Th>Type</Th>
                            <Th>Purpose</Th>
                            <Th align="right">Status</Th>
                          </Tr>
                        </THead>
                        <TBody>
                          <Tr>
                            <Td className="font-mono font-medium">SABOTP</Td>
                            <Td><Badge tone="info">Transactional</Badge></Td>
                            <Td>Critical Alerts &amp; OTPs</Td>
                            <Td align="right"><Badge tone="success" dot>Approved</Badge></Td>
                          </Tr>
                          <Tr>
                            <Td className="font-mono font-medium">SABPRM</Td>
                            <Td><Badge tone="neutral">Promotional</Badge></Td>
                            <Td>Marketing Campaigns</Td>
                            <Td align="right"><Badge tone="success" dot>Approved</Badge></Td>
                          </Tr>
                          <Tr>
                            <Td className="font-mono font-medium">140789</Td>
                            <Td><Badge tone="neutral">Promotional</Badge></Td>
                            <Td>Voice &amp; Bulk Promo</Td>
                            <Td align="right"><Badge tone="warning" dot>Pending</Badge></Td>
                          </Tr>
                        </TBody>
                      </Table>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Step 3: Template Matrix */}
              <AccordionItem value="step-3" className="border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg)] overflow-hidden">
                <AccordionTrigger className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] flex items-center justify-center font-bold text-sm">3</div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-[var(--st-text)]">Template Compliance Matrix</span>
                      <span className="text-xs font-normal text-[var(--st-text-secondary)]">Map internal SabSMS templates to DLT approved content structures.</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6 px-4 pb-4">

                    <div className="flex flex-col md:flex-row gap-4">
                      <Card variant="outlined" padding="md" className="flex-1 bg-[var(--st-bg-secondary)]">
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-2 bg-[var(--st-bg-muted)] text-[var(--st-text)] rounded-[var(--st-radius)]">
                            <Zap className="w-5 h-5" aria-hidden="true" />
                          </div>
                          <Badge tone="success" kind="outline">Auto-Sync Enabled</Badge>
                        </div>
                        <h4 className="font-semibold text-[var(--st-text)] mb-1">Smart Template Sync</h4>
                        <p className="text-sm text-[var(--st-text-secondary)] mb-4">Automatically pull approved templates from DLT portals and match them with internal SabSMS logic.</p>
                        <Button variant="primary" block>Sync Now</Button>
                      </Card>

                      <Card variant="outlined" padding="md" className="flex-1 bg-[var(--st-bg-secondary)]">
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-2 bg-[var(--st-bg-muted)] text-[var(--st-text)] rounded-[var(--st-radius)]">
                            <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                          </div>
                          <Badge tone="danger" kind="outline">2 Errors</Badge>
                        </div>
                        <h4 className="font-semibold text-[var(--st-text)] mb-1">Scrubbing Simulator</h4>
                        <p className="text-sm text-[var(--st-text-secondary)] mb-4">Test your payloads against the DLT content rules before sending to production.</p>
                        <Button variant="outline" block>Run Diagnostics</Button>
                      </Card>
                    </div>

                    <div className="border border-[var(--st-border)] rounded-[var(--st-radius-lg)] overflow-hidden bg-[var(--st-bg-secondary)]">
                      <div className="bg-[var(--st-bg)] px-4 py-3 border-b border-[var(--st-border)] flex flex-col sm:flex-row justify-between items-center gap-3">
                        <h5 className="font-medium text-sm text-[var(--st-text)]">Critical Mappings</h5>
                        <Input
                          inputSize="sm"
                          placeholder="Search templates."
                          aria-label="Search templates"
                          className="w-full sm:w-64"
                        />
                      </div>
                      <div className="p-4 space-y-4">

                        {/* Collapsible Template Items */}
                        <Collapsible defaultOpen className="border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg)] overflow-hidden">
                          <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 hover:bg-[var(--st-bg-muted)]">
                            <span className="text-left">
                              <span className="block text-sm font-medium text-[var(--st-text)]">OTP Verification v2</span>
                              <span className="block text-xs text-[var(--st-text-secondary)] font-mono mt-0.5">TPL-1007161718291011123</span>
                            </span>
                            <Badge tone="success">Mapped</Badge>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-4 sm:px-11 pb-4 pt-4 bg-[var(--st-bg-secondary)] border-t border-[var(--st-border)]">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <span className="block text-[10px] font-bold text-[var(--st-text-secondary)] uppercase tracking-wider mb-2">DLT Format</span>
                                  <div className="p-3 bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)] font-mono text-xs text-[var(--st-text)] whitespace-pre-wrap leading-relaxed">
                                    {`Dear {#var#},\nYour verification code is {#var#}. This code is valid for 10 minutes.\n- SabNode`}
                                  </div>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-bold text-[var(--st-text-secondary)] uppercase tracking-wider mb-2">SabSMS Internal Format</span>
                                  <div className="p-3 bg-[var(--st-bg-muted)] border border-[var(--st-border)] rounded-[var(--st-radius)] font-mono text-xs text-[var(--st-text)] whitespace-pre-wrap leading-relaxed">
                                    {`Dear {{user.name}},\nYour verification code is {{otp.code}}. This code is valid for 10 minutes.\n- SabNode`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        <Collapsible className="border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg)] overflow-hidden">
                          <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 hover:bg-[var(--st-bg-muted)]">
                            <span className="text-left">
                              <span className="block text-sm font-medium text-[var(--st-text)]">Payment Reminder</span>
                              <span className="block text-xs text-[var(--st-text-secondary)] font-mono mt-0.5">TPL-1007161718291011124</span>
                            </span>
                            <Badge tone="danger">Mismatch Error</Badge>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-4 sm:px-11 pb-4 pt-4 bg-[var(--st-bg-secondary)] border-t border-[var(--st-border)]">
                              <div className="flex items-start gap-2 mb-4 p-3 bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)]">
                                <AlertCircle className="w-4 h-4 text-[var(--st-danger)] mt-0.5 flex-shrink-0" aria-hidden="true" />
                                <p className="text-xs text-[var(--st-text-secondary)]">Variable count mismatch. DLT format requires 3 variables, but internal format provides 2. This template will fail scrubbing.</p>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <span className="block text-[10px] font-bold text-[var(--st-text-secondary)] uppercase tracking-wider mb-2">DLT Format (3 Vars)</span>
                                  <div className="p-3 bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)] font-mono text-xs text-[var(--st-text)] whitespace-pre-wrap leading-relaxed">
                                    {`Hi {#var#}, your payment of Rs. {#var#} is due on {#var#}. Please pay immediately.`}
                                  </div>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-bold text-[var(--st-text-secondary)] uppercase tracking-wider mb-2">SabSMS Internal Format (2 Vars)</span>
                                  <div className="p-3 bg-[var(--st-bg-muted)] border border-[var(--st-border)] rounded-[var(--st-radius)] font-mono text-xs text-[var(--st-text)] whitespace-pre-wrap leading-relaxed">
                                    {`Hi {{user.name}}, your payment of Rs. {{amount}} is due on today. Please pay immediately.`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Sidebar / Configuration Panel */}
          <div className="xl:col-span-1 space-y-6">

            <Card variant="outlined" padding="none" className="overflow-hidden">
              <div className="bg-[var(--st-bg-secondary)] p-5 border-b border-[var(--st-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-5 h-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                  <h3 className="font-semibold text-lg text-[var(--st-text)]">Global Parameters</h3>
                </div>
                <p className="text-xs text-[var(--st-text-secondary)] leading-relaxed">
                  These settings apply to all traffic routed through India DLT gateways.
                </p>
              </div>
              <CardBody className="p-5 space-y-6">

                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="block text-sm font-medium text-[var(--st-text)]">Enforce Quiet Hours</span>
                      <p className="text-xs text-[var(--st-text-secondary)]">Block promotional traffic between 9PM - 9AM IST.</p>
                    </div>
                    <Switch defaultChecked aria-label="Enforce Quiet Hours" />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="block text-sm font-medium text-[var(--st-text)]">Strict Scrubbing</span>
                      <p className="text-xs text-[var(--st-text-secondary)]">Drop messages before sending if internal format variables do not exactly match DLT.</p>
                    </div>
                    <Switch defaultChecked aria-label="Strict Scrubbing" />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="block text-sm font-medium text-[var(--st-text)]">Auto-Fallback Routing</span>
                      <p className="text-xs text-[var(--st-text-secondary)]">Attempt alternative operator if primary operator rejects due to DLT error.</p>
                    </div>
                    <Switch aria-label="Auto-Fallback Routing" />
                  </div>
                </div>

                <div className="pt-5 border-t border-[var(--st-border)]">
                  <h4 className="text-sm font-semibold text-[var(--st-text)] mb-3 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" /> Network Status
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-2 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] border border-[var(--st-border)]">
                      <div className="flex items-center gap-2">
                        <Dot tone="success" pulse aria-label="Jio DLT Node online" />
                        <span className="text-xs font-medium text-[var(--st-text)]">Jio DLT Node</span>
                      </div>
                      <span className="text-xs text-[var(--st-text-secondary)] font-mono">32ms</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] border border-[var(--st-border)]">
                      <div className="flex items-center gap-2">
                        <Dot tone="success" pulse aria-label="Airtel DLT Node online" />
                        <span className="text-xs font-medium text-[var(--st-text)]">Airtel DLT Node</span>
                      </div>
                      <span className="text-xs text-[var(--st-text-secondary)] font-mono">45ms</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] border border-[var(--st-border)]">
                      <div className="flex items-center gap-2">
                        <Dot tone="warning" aria-label="Vi DLT Node syncing" />
                        <span className="text-xs font-medium text-[var(--st-text)]">Vi DLT Node</span>
                      </div>
                      <span className="text-xs text-[var(--st-text-secondary)] font-mono">Syncing.</span>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card variant="outlined" padding="none" className="border-dashed bg-[var(--st-bg-secondary)]">
              <CardBody className="p-6 text-center space-y-3">
                <div className="w-12 h-12 bg-[var(--st-bg)] rounded-full border border-[var(--st-border)] flex items-center justify-center mx-auto mb-4">
                  <FileKey className="w-6 h-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
                </div>
                <h4 className="text-sm font-semibold text-[var(--st-text)]">Need help with DLT?</h4>
                <p className="text-xs text-[var(--st-text-secondary)] max-w-[240px] mx-auto">Our compliance team can help you register your business entities and templates.</p>
                <Button variant="outline" block className="mt-4">Contact Compliance Team</Button>
              </CardBody>
            </Card>

          </div>
        </div>
      </div>
    </SabsmsPageShell>
  );
}
