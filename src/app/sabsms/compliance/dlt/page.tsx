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
            icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
            trend={{ value: 2.1, isPositive: true }}
          />
          <StatCard
            label="Active PEIDs"
            value="3"
            period="Across 4 Operators"
            icon={<Building className="w-4 h-4 text-indigo-500" />}
          />
          <StatCard
            label="Registered Headers"
            value="124"
            period="8 pending approval"
            icon={<Hash className="w-4 h-4 text-blue-500" />}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            label="Template Scrub Rate"
            value="0.02%"
            period="Blocked due to mismatch"
            icon={<Activity className="w-4 h-4 text-rose-500" />}
            trend={{ value: 0.05, isPositive: false }}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Main Form Accordion */}
          <div className="xl:col-span-2 space-y-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-slate-900 tracking-tight">DLT Registration Matrix</h2>
              <p className="text-sm text-slate-500">
                Complete the configuration across all layers to ensure seamless SMS delivery in India. 
                Any misconfiguration may result in severe penalties or message drops.
              </p>
            </div>
            
            <ZoruAccordion03 type="single" defaultValue="step-1" className="space-y-4">
              
              {/* Step 1: PEID */}
              <ZoruAccordion03Item value="step-1">
                <ZoruAccordion03Trigger>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">1</div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-slate-900">Principal Entity (PEID) Configuration</span>
                      <span className="text-xs font-normal text-slate-500">Manage business registrations and entity IDs.</span>
                    </div>
                  </div>
                </ZoruAccordion03Trigger>
                <ZoruAccordion03Content>
                  <div className="space-y-6 px-11">
                    <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Business Name</Label>
                          <Input defaultValue="SabNode Technologies Pvt. Ltd." className="bg-white" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Primary PEID</Label>
                          <Input defaultValue="1101456789012345678" className="font-mono text-indigo-600 bg-white" />
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
                      <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-400" /> Operator-specific Mapping
                      </h4>
                      
                      <ZoruAccordion type="multiple" defaultValue={["op-jio"]} className="space-y-3">
                        <ZoruAccordionItem value="op-jio" className="border rounded-lg bg-white overflow-hidden">
                          <ZoruAccordionTrigger className="px-4 py-3 hover:bg-slate-50 data-[state=open]:bg-slate-50 border-b border-transparent data-[state=open]:border-slate-100">
                            <div className="flex items-center gap-3">
                              <Badge variant="default" className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200">Jio</Badge>
                              <span className="text-sm font-medium">Reliance Jio Infocomm Ltd.</span>
                            </div>
                          </ZoruAccordionTrigger>
                          <ZoruAccordionContent className="px-4 py-4 bg-slate-50/30">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">Mapped PEID</Label>
                                <Input defaultValue="1101456789012345678" className="h-8 text-sm font-mono bg-white" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">Status</Label>
                                <div className="flex items-center gap-2 h-8">
                                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 shadow-none hover:bg-emerald-100">Active</Badge>
                                </div>
                              </div>
                            </div>
                          </ZoruAccordionContent>
                        </ZoruAccordionItem>

                        <ZoruAccordionItem value="op-airtel" className="border rounded-lg bg-white overflow-hidden">
                          <ZoruAccordionTrigger className="px-4 py-3 hover:bg-slate-50 data-[state=open]:bg-slate-50 border-b border-transparent data-[state=open]:border-slate-100">
                            <div className="flex items-center gap-3">
                              <Badge variant="default" className="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200">Airtel</Badge>
                              <span className="text-sm font-medium">Bharti Airtel Ltd.</span>
                            </div>
                          </ZoruAccordionTrigger>
                          <ZoruAccordionContent className="px-4 py-4 bg-slate-50/30">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">Mapped PEID</Label>
                                <Input defaultValue="1101456789012345678" className="h-8 text-sm font-mono bg-white" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">Status</Label>
                                <div className="flex items-center gap-2 h-8">
                                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 shadow-none hover:bg-emerald-100">Active</Badge>
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
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">2</div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-slate-900">Header (Sender ID) Registration</span>
                      <span className="text-xs font-normal text-slate-500">Configure 6-alpha or 6-numeric Sender IDs for different message types.</span>
                    </div>
                  </div>
                </ZoruAccordion03Trigger>
                <ZoruAccordion03Content>
                  <div className="space-y-6 px-11">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-slate-600">Register and map your headers to specific routing profiles.</p>
                      <Button size="sm" variant="outline" className="bg-white"><Plus className="w-4 h-4 mr-1"/> Add Header</Button>
                    </div>

                    <div className="border rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-slate-700">Header</th>
                            <th className="px-4 py-3 font-semibold text-slate-700">Type</th>
                            <th className="px-4 py-3 font-semibold text-slate-700">Purpose</th>
                            <th className="px-4 py-3 font-semibold text-slate-700 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y bg-white">
                          <tr className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono font-medium text-indigo-600">SABOTP</td>
                            <td className="px-4 py-3"><Badge variant="secondary" className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-none">Transactional</Badge></td>
                            <td className="px-4 py-3 text-slate-600">Critical Alerts & OTPs</td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Approved
                              </span>
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono font-medium text-indigo-600">SABPRM</td>
                            <td className="px-4 py-3"><Badge variant="secondary" className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-none">Promotional</Badge></td>
                            <td className="px-4 py-3 text-slate-600">Marketing Campaigns</td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Approved
                              </span>
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono font-medium text-slate-500">140789</td>
                            <td className="px-4 py-3"><Badge variant="secondary" className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-none">Promotional</Badge></td>
                            <td className="px-4 py-3 text-slate-600">Voice & Bulk Promo</td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Pending
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
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">3</div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-slate-900">Template Compliance Matrix</span>
                      <span className="text-xs font-normal text-slate-500">Map internal SabSMS templates to DLT approved content structures.</span>
                    </div>
                  </div>
                </ZoruAccordion03Trigger>
                <ZoruAccordion03Content>
                  <div className="space-y-6 px-11">
                    
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                            <Zap className="w-5 h-5" />
                          </div>
                          <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-white">Auto-Sync Enabled</Badge>
                        </div>
                        <h4 className="font-semibold text-slate-900 mb-1">Smart Template Sync</h4>
                        <p className="text-sm text-slate-600 mb-4">Automatically pull approved templates from DLT portals and match them with internal SabSMS logic.</p>
                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm border-none">Sync Now</Button>
                      </div>

                      <div className="flex-1 bg-gradient-to-br from-rose-50 to-white border border-rose-100 rounded-xl p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          <Badge variant="outline" className="text-rose-600 border-rose-200 bg-white">2 Errors</Badge>
                        </div>
                        <h4 className="font-semibold text-slate-900 mb-1">Scrubbing Simulator</h4>
                        <p className="text-sm text-slate-600 mb-4">Test your payloads against the DLT content rules before sending to production.</p>
                        <Button variant="outline" className="w-full bg-white border-rose-200 text-rose-700 hover:bg-rose-50">Run Diagnostics</Button>
                      </div>
                    </div>

                    <div className="border rounded-xl overflow-hidden shadow-sm bg-slate-50/50">
                      <div className="bg-white px-4 py-3 border-b flex flex-col sm:flex-row justify-between items-center gap-3">
                        <h5 className="font-medium text-sm text-slate-800">Critical Mappings</h5>
                        <div className="relative w-full sm:w-auto">
                          <Input placeholder="Search templates..." className="h-8 w-full sm:w-64 text-xs bg-white" />
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        
                        {/* Collapsible Template Items */}
                        <ZoruCollapsible open={isJioOpen} onOpenChange={setIsJioOpen} className="border border-slate-200 rounded-lg bg-white overflow-hidden transition-all duration-200 shadow-sm">
                          <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50" onClick={() => setIsJioOpen(!isJioOpen)}>
                            <div className="flex items-center gap-4">
                              <ChevronRight className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isJioOpen && "rotate-90")} />
                              <div>
                                <h6 className="text-sm font-medium text-slate-900">OTP Verification v2</h6>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">TPL-1007161718291011123</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Mapped</Badge>
                            </div>
                          </div>
                          <ZoruCollapsibleContent>
                            <div className="px-4 sm:px-11 pb-4 pt-4 bg-slate-50/50 border-t border-slate-100">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">DLT Format</Label>
                                  <div className="p-3 bg-white border rounded-md font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm">
                                    {`Dear {#var#},\nYour verification code is {#var#}. This code is valid for 10 minutes.\n- SabNode`}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">SabSMS Internal Format</Label>
                                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-md font-mono text-xs text-indigo-900 whitespace-pre-wrap leading-relaxed shadow-sm">
                                    {`Dear {{user.name}},\nYour verification code is {{otp.code}}. This code is valid for 10 minutes.\n- SabNode`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </ZoruCollapsibleContent>
                        </ZoruCollapsible>

                        <ZoruCollapsible open={isAirtelOpen} onOpenChange={setIsAirtelOpen} className="border border-slate-200 rounded-lg bg-white overflow-hidden transition-all duration-200 shadow-sm">
                          <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50" onClick={() => setIsAirtelOpen(!isAirtelOpen)}>
                            <div className="flex items-center gap-4">
                              <ChevronRight className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isAirtelOpen && "rotate-90")} />
                              <div>
                                <h6 className="text-sm font-medium text-slate-900">Payment Reminder</h6>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">TPL-1007161718291011124</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="destructive" className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100">Mismatch Error</Badge>
                            </div>
                          </div>
                          <ZoruCollapsibleContent>
                            <div className="px-4 sm:px-11 pb-4 pt-4 bg-rose-50/30 border-t border-rose-100">
                               <div className="flex items-start gap-2 mb-4 p-3 bg-white border border-rose-200 rounded-lg shadow-sm">
                                  <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                                  <p className="text-xs text-rose-700">Variable count mismatch. DLT format requires 3 variables, but internal format provides 2. This template will fail scrubbing.</p>
                               </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">DLT Format (3 Vars)</Label>
                                  <div className="p-3 bg-white border rounded-md font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm">
                                    {`Hi {#var#}, your payment of Rs. {#var#} is due on {#var#}. Please pay immediately.`}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">SabSMS Internal Format (2 Vars)</Label>
                                  <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-md font-mono text-xs text-rose-900 whitespace-pre-wrap leading-relaxed shadow-sm">
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
            
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-5 h-5 text-blue-400" />
                  <h3 className="font-semibold text-lg">Global Parameters</h3>
                </div>
                <p className="text-xs text-slate-300 opacity-90 leading-relaxed">
                  These settings apply to all traffic routed through India DLT gateways.
                </p>
              </div>
              <ZoruCardContent className="p-5 space-y-6">
                
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-slate-900 cursor-pointer">Enforce Quiet Hours</Label>
                      <p className="text-xs text-slate-500">Block promotional traffic between 9PM - 9AM IST.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-slate-900 cursor-pointer">Strict Scrubbing</Label>
                      <p className="text-xs text-slate-500">Drop messages before sending if internal format variables do not exactly match DLT.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-slate-900 cursor-pointer">Auto-Fallback Routing</Label>
                      <p className="text-xs text-slate-500">Attempt alternative operator if primary operator rejects due to DLT error.</p>
                    </div>
                    <Switch />
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-slate-400" /> Network Status
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-2 rounded-md bg-emerald-50/50 border border-emerald-100">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs font-medium text-emerald-800">Jio DLT Node</span>
                      </div>
                      <span className="text-xs text-emerald-600 font-mono">32ms</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-emerald-50/50 border border-emerald-100">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs font-medium text-emerald-800">Airtel DLT Node</span>
                      </div>
                      <span className="text-xs text-emerald-600 font-mono">45ms</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-amber-50/50 border border-amber-100">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span className="text-xs font-medium text-amber-800">Vi DLT Node</span>
                      </div>
                      <span className="text-xs text-amber-600 font-mono">Syncing...</span>
                    </div>
                  </div>
                </div>
              </ZoruCardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm border-dashed bg-slate-50/50">
              <ZoruCardContent className="p-6 text-center space-y-3">
                <div className="w-12 h-12 bg-white rounded-full border shadow-sm flex items-center justify-center mx-auto mb-4">
                  <FileKey className="w-6 h-6 text-slate-400" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900">Need help with DLT?</h4>
                <p className="text-xs text-slate-500 max-w-[240px] mx-auto">Our compliance team can help you register your business entities and templates.</p>
                <Button variant="outline" className="mt-4 w-full bg-white text-slate-700 hover:bg-slate-50">Contact Compliance Team</Button>
              </ZoruCardContent>
            </Card>

          </div>
        </div>
      </div>
    </SabsmsPageShell>
  );
}
