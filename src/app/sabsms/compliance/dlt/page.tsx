"use client";

import * as React from "react";
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  Hash,
  Activity,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronRight,
  Save,
  UploadCloud,
  Check,
  BarChart,
  FileKey,
  Globe,
  Radio,
  Briefcase,
  Layers,
  Zap,
  Server,
  Lock
} from "lucide-react";

import { cn } from "@/components/zoruui/lib/cn";

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  StatCard,
  Switch,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  useZoruToast,
  ZoruAccordion03,
  ZoruAccordion03Item,
  ZoruAccordion03Trigger,
  ZoruAccordion03Content,
  ZoruCollapsible,
  ZoruCollapsibleTrigger,
  ZoruCollapsibleContent,
  ZoruAccordion,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruAccordionContent,
} from "@/components/zoruui";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";

export default function DltRegistrationPage() {
  const { toast } = useZoruToast();
  
  // States for collapsibles
  const [isJioOpen, setIsJioOpen] = React.useState(false);
  const [isAirtelOpen, setIsAirtelOpen] = React.useState(false);
  const [isViOpen, setIsViOpen] = React.useState(false);

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
        icon: <Save className="w-4 h-4" />,
        onClick: () => toast({ title: "Compliance settings deployed across all clusters." }),
      }}
      secondaryActions={[
        {
          label: "Export Full Matrix",
          onClick: () => toast({ title: "Exporting matrix as CSV..." }),
        },
      ]}
    >
      <div className="space-y-8 pb-10">
        
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Overall Compliance Score"
            value="98.5%"
            period="Excellent standing"
            icon={<ShieldCheck className="w-4 h-4 text-zoru-ink" />}
            trend={{ value: 2.1, isPositive: true }}
          />
          <StatCard
            label="Active PEIDs"
            value="3"
            period="Across 4 Operators"
            icon={<Building className="w-4 h-4 text-zoru-ink" />}
          />
          <StatCard
            label="Registered Headers"
            value="124"
            period="8 pending approval"
            icon={<Hash className="w-4 h-4 text-zoru-ink" />}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            label="Template Scrub Rate"
            value="0.02%"
            period="Blocked due to mismatch"
            icon={<Activity className="w-4 h-4 text-zoru-ink" />}
            trend={{ value: 0.05, isPositive: false }}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Main Form Accordion */}
          <div className="xl:col-span-2 space-y-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-zoru-ink tracking-tight">DLT Registration Matrix</h2>
              <p className="text-sm text-zoru-ink">
                Complete the configuration across all layers to ensure seamless SMS delivery in India. 
                Any misconfiguration may result in severe penalties or message drops.
              </p>
            </div>
            
            <ZoruAccordion03 type="single" defaultValue="step-1" className="space-y-4">
              
              {/* Step 1: PEID */}
              <ZoruAccordion03Item value="step-1">
                <ZoruAccordion03Trigger>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zoru-surface-2 text-zoru-ink flex items-center justify-center font-bold text-sm">1</div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-zoru-ink">Principal Entity (PEID) Configuration</span>
                      <span className="text-xs font-normal text-zoru-ink">Manage business registrations and entity IDs.</span>
                    </div>
                  </div>
                </ZoruAccordion03Trigger>
                <ZoruAccordion03Content>
                  <div className="space-y-6 px-11">
                    <div className="bg-zoru-surface-2/50 rounded-xl p-5 border border-zoru-line shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-zoru-ink uppercase tracking-wider">Business Name</Label>
                          <Input defaultValue="SabNode Technologies Pvt. Ltd." className="bg-white" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-zoru-ink uppercase tracking-wider">Primary PEID</Label>
                          <Input defaultValue="1101456789012345678" className="font-mono text-zoru-ink bg-white" />
                        </div>
                      </div>
                      <div className="mt-6 flex items-center gap-3">
                        <Button size="sm" variant="default" className="shadow-sm">
                          <Check className="w-4 h-4 mr-2" /> Verify Entity Status
                        </Button>
                        <Button size="sm" variant="outline">
                          Upload Registration Certificate (KYC)
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-zoru-ink flex items-center gap-2">
                        <Layers className="w-4 h-4 text-zoru-ink-muted" /> Operator-specific Mapping
                      </h4>
                      
                      <ZoruAccordion type="multiple" defaultValue={["op-jio"]} className="space-y-3">
                        <ZoruAccordionItem value="op-jio" className="border rounded-lg bg-white overflow-hidden">
                          <ZoruAccordionTrigger className="px-4 py-3 hover:bg-zoru-surface-2 data-[state=open]:bg-zoru-surface-2 border-b border-transparent data-[state=open]:border-zoru-line">
                            <div className="flex items-center gap-3">
                              <Badge variant="default" className="bg-zoru-surface-2 text-zoru-ink border-zoru-line hover:bg-zoru-surface-2">Jio</Badge>
                              <span className="text-sm font-medium">Reliance Jio Infocomm Ltd.</span>
                            </div>
                          </ZoruAccordionTrigger>
                          <ZoruAccordionContent className="px-4 py-4 bg-zoru-surface-2/30">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label className="text-xs text-zoru-ink">Mapped PEID</Label>
                                <Input defaultValue="1101456789012345678" className="h-8 text-sm font-mono bg-white" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-zoru-ink">Status</Label>
                                <div className="flex items-center gap-2 h-8">
                                  <Badge className="bg-zoru-surface-2 text-zoru-ink border-zoru-line shadow-none hover:bg-zoru-surface-2">Active</Badge>
                                </div>
                              </div>
                            </div>
                          </ZoruAccordionContent>
                        </ZoruAccordionItem>

                        <ZoruAccordionItem value="op-airtel" className="border rounded-lg bg-white overflow-hidden">
                          <ZoruAccordionTrigger className="px-4 py-3 hover:bg-zoru-surface-2 data-[state=open]:bg-zoru-surface-2 border-b border-transparent data-[state=open]:border-zoru-line">
                            <div className="flex items-center gap-3">
                              <Badge variant="default" className="bg-zoru-surface-2 text-zoru-ink border-zoru-line hover:bg-zoru-surface-2">Airtel</Badge>
                              <span className="text-sm font-medium">Bharti Airtel Ltd.</span>
                            </div>
                          </ZoruAccordionTrigger>
                          <ZoruAccordionContent className="px-4 py-4 bg-zoru-surface-2/30">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label className="text-xs text-zoru-ink">Mapped PEID</Label>
                                <Input defaultValue="1101456789012345678" className="h-8 text-sm font-mono bg-white" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-zoru-ink">Status</Label>
                                <div className="flex items-center gap-2 h-8">
                                  <Badge className="bg-zoru-surface-2 text-zoru-ink border-zoru-line shadow-none hover:bg-zoru-surface-2">Active</Badge>
                                </div>
                              </div>
                            </div>
                          </ZoruAccordionContent>
                        </ZoruAccordionItem>
                      </ZoruAccordion>
                    </div>
                  </div>
                </ZoruAccordion03Content>
              </ZoruAccordion03Item>

              {/* Step 2: Headers */}
              <ZoruAccordion03Item value="step-2">
                <ZoruAccordion03Trigger>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zoru-surface-2 text-zoru-ink flex items-center justify-center font-bold text-sm">2</div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-zoru-ink">Header (Sender ID) Registration</span>
                      <span className="text-xs font-normal text-zoru-ink">Configure 6-alpha or 6-numeric Sender IDs for different message types.</span>
                    </div>
                  </div>
                </ZoruAccordion03Trigger>
                <ZoruAccordion03Content>
                  <div className="space-y-6 px-11">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-zoru-ink">Register and map your headers to specific routing profiles.</p>
                      <Button size="sm" variant="outline" className="bg-white"><Plus className="w-4 h-4 mr-1"/> Add Header</Button>
                    </div>

                    <div className="border rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-zoru-surface-2 border-b">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-zoru-ink">Header</th>
                            <th className="px-4 py-3 font-semibold text-zoru-ink">Type</th>
                            <th className="px-4 py-3 font-semibold text-zoru-ink">Purpose</th>
                            <th className="px-4 py-3 font-semibold text-zoru-ink text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y bg-white">
                          <tr className="hover:bg-zoru-surface-2/50">
                            <td className="px-4 py-3 font-mono font-medium text-zoru-ink">SABOTP</td>
                            <td className="px-4 py-3"><Badge variant="secondary" className="bg-zoru-surface-2 hover:bg-zoru-surface-2 text-zoru-ink border-none">Transactional</Badge></td>
                            <td className="px-4 py-3 text-zoru-ink">Critical Alerts & OTPs</td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zoru-ink">
                                <span className="w-1.5 h-1.5 rounded-full bg-zoru-ink"></span> Approved
                              </span>
                            </td>
                          </tr>
                          <tr className="hover:bg-zoru-surface-2/50">
                            <td className="px-4 py-3 font-mono font-medium text-zoru-ink">SABPRM</td>
                            <td className="px-4 py-3"><Badge variant="secondary" className="bg-zoru-surface-2 hover:bg-zoru-surface-2 text-zoru-ink border-none">Promotional</Badge></td>
                            <td className="px-4 py-3 text-zoru-ink">Marketing Campaigns</td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zoru-ink">
                                <span className="w-1.5 h-1.5 rounded-full bg-zoru-ink"></span> Approved
                              </span>
                            </td>
                          </tr>
                          <tr className="hover:bg-zoru-surface-2/50">
                            <td className="px-4 py-3 font-mono font-medium text-zoru-ink">140789</td>
                            <td className="px-4 py-3"><Badge variant="secondary" className="bg-zoru-surface-2 hover:bg-zoru-surface-2 text-zoru-ink border-none">Promotional</Badge></td>
                            <td className="px-4 py-3 text-zoru-ink">Voice & Bulk Promo</td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zoru-ink">
                                <span className="w-1.5 h-1.5 rounded-full bg-zoru-ink"></span> Pending
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </ZoruAccordion03Content>
              </ZoruAccordion03Item>

              {/* Step 3: Template Matrix */}
              <ZoruAccordion03Item value="step-3">
                <ZoruAccordion03Trigger>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zoru-surface-2 text-zoru-ink flex items-center justify-center font-bold text-sm">3</div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-zoru-ink">Template Compliance Matrix</span>
                      <span className="text-xs font-normal text-zoru-ink">Map internal SabSMS templates to DLT approved content structures.</span>
                    </div>
                  </div>
                </ZoruAccordion03Trigger>
                <ZoruAccordion03Content>
                  <div className="space-y-6 px-11">
                    
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 bg-gradient-to-br from-zoru-surface-2 to-white border border-zoru-line rounded-xl p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-2 bg-zoru-surface-2 text-zoru-ink rounded-lg">
                            <Zap className="w-5 h-5" />
                          </div>
                          <Badge variant="outline" className="text-zoru-ink border-zoru-line bg-white">Auto-Sync Enabled</Badge>
                        </div>
                        <h4 className="font-semibold text-zoru-ink mb-1">Smart Template Sync</h4>
                        <p className="text-sm text-zoru-ink mb-4">Automatically pull approved templates from DLT portals and match them with internal SabSMS logic.</p>
                        <Button className="w-full bg-zoru-ink hover:bg-zoru-ink text-white shadow-sm border-none">Sync Now</Button>
                      </div>

                      <div className="flex-1 bg-gradient-to-br from-zoru-surface-2 to-white border border-zoru-line rounded-xl p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-2 bg-zoru-surface-2 text-zoru-ink rounded-lg">
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          <Badge variant="outline" className="text-zoru-ink border-zoru-line bg-white">2 Errors</Badge>
                        </div>
                        <h4 className="font-semibold text-zoru-ink mb-1">Scrubbing Simulator</h4>
                        <p className="text-sm text-zoru-ink mb-4">Test your payloads against the DLT content rules before sending to production.</p>
                        <Button variant="outline" className="w-full bg-white border-zoru-line text-zoru-ink hover:bg-zoru-surface-2">Run Diagnostics</Button>
                      </div>
                    </div>

                    <div className="border rounded-xl overflow-hidden shadow-sm bg-zoru-surface-2/50">
                      <div className="bg-white px-4 py-3 border-b flex flex-col sm:flex-row justify-between items-center gap-3">
                        <h5 className="font-medium text-sm text-zoru-ink">Critical Mappings</h5>
                        <div className="relative w-full sm:w-auto">
                          <Input placeholder="Search templates..." className="h-8 w-full sm:w-64 text-xs bg-white" />
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        
                        {/* Collapsible Template Items */}
                        <ZoruCollapsible open={isJioOpen} onOpenChange={setIsJioOpen} className="border border-zoru-line rounded-lg bg-white overflow-hidden transition-all duration-200 shadow-sm">
                          <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zoru-surface-2" onClick={() => setIsJioOpen(!isJioOpen)}>
                            <div className="flex items-center gap-4">
                              <ChevronRight className={cn("w-4 h-4 text-zoru-ink-muted transition-transform duration-200", isJioOpen && "rotate-90")} />
                              <div>
                                <h6 className="text-sm font-medium text-zoru-ink">OTP Verification v2</h6>
                                <p className="text-xs text-zoru-ink font-mono mt-0.5">TPL-1007161718291011123</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className="bg-zoru-surface-2 text-zoru-ink border-zoru-line hover:bg-zoru-surface-2">Mapped</Badge>
                            </div>
                          </div>
                          <ZoruCollapsibleContent>
                            <div className="px-4 sm:px-11 pb-4 pt-4 bg-zoru-surface-2/50 border-t border-zoru-line">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <Label className="text-[10px] font-bold text-zoru-ink uppercase tracking-wider mb-2 block">DLT Format</Label>
                                  <div className="p-3 bg-white border rounded-md font-mono text-xs text-zoru-ink whitespace-pre-wrap leading-relaxed shadow-sm">
                                    {`Dear {#var#},\nYour verification code is {#var#}. This code is valid for 10 minutes.\n- SabNode`}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-[10px] font-bold text-zoru-ink uppercase tracking-wider mb-2 block">SabSMS Internal Format</Label>
                                  <div className="p-3 bg-zoru-surface-2/50 border border-zoru-line rounded-md font-mono text-xs text-zoru-ink whitespace-pre-wrap leading-relaxed shadow-sm">
                                    {`Dear {{user.name}},\nYour verification code is {{otp.code}}. This code is valid for 10 minutes.\n- SabNode`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </ZoruCollapsibleContent>
                        </ZoruCollapsible>

                        <ZoruCollapsible open={isAirtelOpen} onOpenChange={setIsAirtelOpen} className="border border-zoru-line rounded-lg bg-white overflow-hidden transition-all duration-200 shadow-sm">
                          <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zoru-surface-2" onClick={() => setIsAirtelOpen(!isAirtelOpen)}>
                            <div className="flex items-center gap-4">
                              <ChevronRight className={cn("w-4 h-4 text-zoru-ink-muted transition-transform duration-200", isAirtelOpen && "rotate-90")} />
                              <div>
                                <h6 className="text-sm font-medium text-zoru-ink">Payment Reminder</h6>
                                <p className="text-xs text-zoru-ink font-mono mt-0.5">TPL-1007161718291011124</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="destructive" className="bg-zoru-surface-2 text-zoru-ink border-zoru-line hover:bg-zoru-surface-2">Mismatch Error</Badge>
                            </div>
                          </div>
                          <ZoruCollapsibleContent>
                            <div className="px-4 sm:px-11 pb-4 pt-4 bg-zoru-surface-2/30 border-t border-zoru-line">
                               <div className="flex items-start gap-2 mb-4 p-3 bg-white border border-zoru-line rounded-lg shadow-sm">
                                  <AlertCircle className="w-4 h-4 text-zoru-ink mt-0.5 flex-shrink-0" />
                                  <p className="text-xs text-zoru-ink">Variable count mismatch. DLT format requires 3 variables, but internal format provides 2. This template will fail scrubbing.</p>
                               </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <Label className="text-[10px] font-bold text-zoru-ink uppercase tracking-wider mb-2 block">DLT Format (3 Vars)</Label>
                                  <div className="p-3 bg-white border rounded-md font-mono text-xs text-zoru-ink whitespace-pre-wrap leading-relaxed shadow-sm">
                                    {`Hi {#var#}, your payment of Rs. {#var#} is due on {#var#}. Please pay immediately.`}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-[10px] font-bold text-zoru-ink uppercase tracking-wider mb-2 block">SabSMS Internal Format (2 Vars)</Label>
                                  <div className="p-3 bg-zoru-surface-2/50 border border-zoru-line rounded-md font-mono text-xs text-zoru-ink whitespace-pre-wrap leading-relaxed shadow-sm">
                                    {`Hi {{user.name}}, your payment of Rs. {{amount}} is due on today. Please pay immediately.`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </ZoruCollapsibleContent>
                        </ZoruCollapsible>

                      </div>
                    </div>
                  </div>
                </ZoruAccordion03Content>
              </ZoruAccordion03Item>
            </ZoruAccordion03>
          </div>

          {/* Sidebar / Configuration Panel */}
          <div className="xl:col-span-1 space-y-6">
            
            <Card className="border-zoru-line shadow-sm overflow-hidden">
              <div className="bg-gradient-to-br from-zoru-ink to-zoru-ink p-5 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-5 h-5 text-zoru-ink-muted" />
                  <h3 className="font-semibold text-lg">Global Parameters</h3>
                </div>
                <p className="text-xs text-zoru-ink-muted opacity-90 leading-relaxed">
                  These settings apply to all traffic routed through India DLT gateways.
                </p>
              </div>
              <ZoruCardContent className="p-5 space-y-6">
                
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-zoru-ink cursor-pointer">Enforce Quiet Hours</Label>
                      <p className="text-xs text-zoru-ink">Block promotional traffic between 9PM - 9AM IST.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-zoru-ink cursor-pointer">Strict Scrubbing</Label>
                      <p className="text-xs text-zoru-ink">Drop messages before sending if internal format variables do not exactly match DLT.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-zoru-ink cursor-pointer">Auto-Fallback Routing</Label>
                      <p className="text-xs text-zoru-ink">Attempt alternative operator if primary operator rejects due to DLT error.</p>
                    </div>
                    <Switch />
                  </div>
                </div>

                <div className="pt-5 border-t border-zoru-line">
                  <h4 className="text-sm font-semibold text-zoru-ink mb-3 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-zoru-ink-muted" /> Network Status
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-2 rounded-md bg-zoru-surface-2/50 border border-zoru-line">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-zoru-ink animate-pulse"></div>
                        <span className="text-xs font-medium text-zoru-ink">Jio DLT Node</span>
                      </div>
                      <span className="text-xs text-zoru-ink font-mono">32ms</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-zoru-surface-2/50 border border-zoru-line">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-zoru-ink animate-pulse"></div>
                        <span className="text-xs font-medium text-zoru-ink">Airtel DLT Node</span>
                      </div>
                      <span className="text-xs text-zoru-ink font-mono">45ms</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-zoru-surface-2/50 border border-zoru-line">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-zoru-ink"></div>
                        <span className="text-xs font-medium text-zoru-ink">Vi DLT Node</span>
                      </div>
                      <span className="text-xs text-zoru-ink font-mono">Syncing...</span>
                    </div>
                  </div>
                </div>
              </ZoruCardContent>
            </Card>

            <Card className="border-zoru-line shadow-sm border-dashed bg-zoru-surface-2/50">
              <ZoruCardContent className="p-6 text-center space-y-3">
                <div className="w-12 h-12 bg-white rounded-full border shadow-sm flex items-center justify-center mx-auto mb-4">
                  <FileKey className="w-6 h-6 text-zoru-ink-muted" />
                </div>
                <h4 className="text-sm font-semibold text-zoru-ink">Need help with DLT?</h4>
                <p className="text-xs text-zoru-ink max-w-[240px] mx-auto">Our compliance team can help you register your business entities and templates.</p>
                <Button variant="outline" className="mt-4 w-full bg-white text-zoru-ink hover:bg-zoru-surface-2">Contact Compliance Team</Button>
              </ZoruCardContent>
            </Card>

          </div>
        </div>
      </div>
    </SabsmsPageShell>
  );
}
