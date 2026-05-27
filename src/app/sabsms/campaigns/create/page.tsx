"use client"

import React, { useState, useEffect } from "react"
import { m, AnimatePresence } from "motion/react"
import { 

  Megaphone, 
  Users, 
  CalendarClock, 
  Settings2, 
  ArrowRight, 
  ArrowLeft, 
  Send, 
  Plus, 
  Trash2, 
  Smartphone, 
  Search, 
  RefreshCw, 
  BarChart,
  CheckCircle2,
  Clock,
  Globe2,
  Zap,
  Info,
  AlertTriangle,
  ExternalLink
} from "lucide-react"

import Link from "next/link"
import {
  PageHeader,
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Accordion,
  ZoruAccordionItem as AccordionItem,
  ZoruAccordionTrigger as AccordionTrigger,
  ZoruAccordionContent as AccordionContent,
  Button,
  Input,
  Label,
  Textarea,
  Switch,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@/components/zoruui"

const MOCK_SEGMENTS = [
  { id: 'seg-1', name: 'High Value Customers', count: 12450, lastSync: '2 hours ago', type: 'Dynamic', engagement: 'High' },
  { id: 'seg-2', name: 'Churn Risk (30 days)', count: 3200, lastSync: '5 hours ago', type: 'Dynamic', engagement: 'Low' },
  { id: 'seg-3', name: 'Beta Testers', count: 450, lastSync: '1 day ago', type: 'Static', engagement: 'Very High' },
  { id: 'seg-4', name: 'All Subscribers', count: 89000, lastSync: '10 mins ago', type: 'Dynamic', engagement: 'Medium' },
]

const STEPS = [
  { id: 1, title: 'Basics', icon: Settings2, description: 'Core details' },
  { id: 2, title: 'Audience', icon: Users, description: 'Targeting rules' },
  { id: 3, title: 'Content', icon: Megaphone, description: 'Message design' },
  { id: 4, title: 'Review', icon: CalendarClock, description: 'Schedule & send' },
]

export default function CreateCampaignPage() {
  const [step, setStep] = useState(1)
  
  // Form State
  const [campaignName, setCampaignName] = useState("")
  const [senderId, setSenderId] = useState("SABNODE")
  const [campaignType, setCampaignType] = useState("marketing")
  const [selectedSegment, setSelectedSegment] = useState<string>("seg-1")
  const [message, setMessage] = useState("Hi {{first_name}}, check out our new offers!")
  const [scheduleType, setScheduleType] = useState("now")
  const [smartRouting, setSmartRouting] = useState(true)
  const [abTest, setAbTest] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Load from local storage
  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem("sabsms_quick_campaign_draft")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.step) setStep(parsed.step)
        if (parsed.campaignName !== undefined) setCampaignName(parsed.campaignName)
        if (parsed.senderId) setSenderId(parsed.senderId)
        if (parsed.campaignType) setCampaignType(parsed.campaignType)
        if (parsed.selectedSegment) setSelectedSegment(parsed.selectedSegment)
        if (parsed.message !== undefined) setMessage(parsed.message)
        if (parsed.scheduleType) setScheduleType(parsed.scheduleType)
        if (parsed.smartRouting !== undefined) setSmartRouting(parsed.smartRouting)
        if (parsed.abTest !== undefined) setAbTest(parsed.abTest)
      } catch (e) {
        console.error("Failed to parse quick campaign draft", e)
      }
    }
  }, [])

  // Auto-save to local storage
  useEffect(() => {
    if (!isMounted) return
    const draft = {
      step, campaignName, senderId, campaignType, selectedSegment, message, scheduleType, smartRouting, abTest
    }
    localStorage.setItem("sabsms_quick_campaign_draft", JSON.stringify(draft))
  }, [isMounted, step, campaignName, senderId, campaignType, selectedSegment, message, scheduleType, smartRouting, abTest])

  // Template Variable Validation
  const ALLOWED_VARIABLES = ["first_name", "last_name", "order_id", "opt_out_link", "company"]
  const extractVariables = (text: string) => {
    const matches = text.match(/{{([^}]+)}}/g) || []
    return matches.map(m => m.replace(/^{{|}}$/g, ''))
  }
  
  const usedVariables = extractVariables(message)
  const invalidVariables = [...new Set(usedVariables.filter(v => !ALLOWED_VARIABLES.includes(v)))]

  // Cost Estimation
  const segmentCount = Math.ceil(message.length / 160) || 1
  const targetUsers = MOCK_SEGMENTS.find(s => s.id === selectedSegment)?.count || 0
  const costPerSegment = 0.012
  const estimatedCost = (targetUsers * segmentCount * costPerSegment).toFixed(2)

  const handleNext = () => setStep(s => Math.min(4, s + 1))
  const handlePrev = () => setStep(s => Math.max(1, s - 1))

  const isLastStep = step === 4
  const isFirstStep = step === 1

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl min-h-screen">
      <PageHeader
        title="Create Campaign"
        subtitle="Configure your quick SMS broadcast. For advanced multi-step automation, use the new Advanced Campaign builder."
        icon={Zap}
        breadcrumb={<span className="text-zoru-ink-muted">SAB SMS / Campaigns / Quick Create</span>}
        mesh
        actions={
          <div className="flex items-center gap-2">
            <Link href="/sabsms/campaigns/new">
              <Button variant="outline" className="gap-2">
                Switch to Advanced Builder <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => localStorage.removeItem("sabsms_quick_campaign_draft")}>Clear Draft</Button>
            {isLastStep && <Button variant="premium">Launch Campaign <Send className="ml-2 h-4 w-4" /></Button>}
          </div>
        }
      />

      <Alert className="mb-8 border-zoru-line bg-zoru-ink">
        <Info className="h-4 w-4 text-zoru-ink" />
        <AlertTitle className="text-zoru-ink font-semibold">Quick Broadcast Mode</AlertTitle>
        <AlertDescription className="text-zoru-ink-muted">
          You are using the quick broadcast tool, designed for fast, single-segment announcements. Your progress is auto-saved locally. For multi-segment workflows, drips, and full CRM integration, switch to the <Link href="/sabsms/campaigns/new" className="text-zoru-ink hover:underline font-medium">Advanced Builder</Link>.
        </AlertDescription>
      </Alert>

      {/* Progress Indicator */}
      <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {STEPS.map((s, index) => {
          const isActive = step === s.id
          const isCompleted = step > s.id
          const Icon = s.icon
          
          return (
            <div 
              key={s.id}
              className={cn(
                "relative flex items-center gap-3 p-4 rounded-xl border transition-all duration-300",
                isActive ? "bg-zoru-surface border-zoru-line shadow-[0_0_20px_-5px_hsl(var(--prism-indigo)/0.2)]" : 
                isCompleted ? "bg-zoru-surface/50 border-transparent opacity-80" : "bg-transparent border-dashed opacity-50"
              )}
            >
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
                isActive ? "bg-zoru-ink text-white shadow-md" : 
                isCompleted ? "bg-zoru-ink text-white" : "bg-zoru-surface-2 text-zoru-ink-muted"
              )}>
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="flex flex-col min-w-0">
                <span className={cn("text-sm font-semibold truncate", isActive && "text-zoru-ink")}>
                  Step {s.id}: {s.title}
                </span>
                <span className="text-xs text-zoru-ink-muted truncate">{s.description}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form Area */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            <m.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* STEP 1: BASICS */}
              {step === 1 && (
                <Card variant="elevated" className="border-t-4 border-t-[hsl(var(--prism-indigo))]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-zoru-ink" /> Campaign Fundamentals</CardTitle>
                    <CardDescription>Define the core details and routing preferences for this broadcast.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Campaign Name</Label>
                      <Input 
                        id="name" 
                        placeholder="e.g. Summer Sale 2026" 
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="max-w-md"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="sender">Sender ID</Label>
                        <Select value={senderId} onValueChange={setSenderId}>
                          <SelectTrigger id="sender">
                            <SelectValue placeholder="Select sender ID" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SABNODE">SABNODE (Default)</SelectItem>
                            <SelectItem value="ALERTS">ALERTS (Transactional)</SelectItem>
                            <SelectItem value="PROMO">PROMO (Marketing)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="type">Campaign Type</Label>
                        <Select value={campaignType} onValueChange={setCampaignType}>
                          <SelectTrigger id="type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="marketing">Marketing / Promotional</SelectItem>
                            <SelectItem value="transactional">Transactional / Alerts</SelectItem>
                            <SelectItem value="otp">OTP / Verification</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Accordion type="single" collapsible className="w-full mt-4">
                      <AccordionItem value="advanced">
                        <AccordionTrigger className="text-sm">Advanced Routing Options</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                          <div className="flex items-center justify-between rounded-lg border p-4 bg-zoru-surface-2/30">
                            <div className="space-y-0.5">
                              <Label className="text-base font-medium">Smart Routing</Label>
                              <p className="text-sm text-zoru-ink-muted">
                                Automatically select the most reliable gateway based on real-time telco latency.
                              </p>
                            </div>
                            <Switch checked={smartRouting} onCheckedChange={setSmartRouting} />
                          </div>
                          
                          <div className="flex items-center justify-between rounded-lg border p-4 bg-zoru-surface-2/30">
                            <div className="space-y-0.5">
                              <Label className="text-base font-medium">A/B Testing</Label>
                              <p className="text-sm text-zoru-ink-muted">
                                Split your audience to test multiple message variants.
                              </p>
                            </div>
                            <Switch checked={abTest} onCheckedChange={setAbTest} />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              )}

              {/* STEP 2: AUDIENCE */}
              {step === 2 && (
                <Card variant="elevated" className="border-t-4 border-t-[hsl(var(--prism-indigo))]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-zoru-ink" /> Audience Targeting</CardTitle>
                    <CardDescription>Select who will receive this campaign. You can combine multiple segments or apply exclusion rules.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">Target Segments</Label>
                      <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Create New</Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {MOCK_SEGMENTS.map(seg => (
                        <Card 
                          key={seg.id} 
                          variant={selectedSegment === seg.id ? "interactive" : "default"}
                          className={cn(
                            "cursor-pointer transition-all",
                            selectedSegment === seg.id ? "border-zoru-line ring-1 ring-zoru-line bg-zoru-ink" : ""
                          )}
                          onClick={() => setSelectedSegment(seg.id)}
                        >
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold">{seg.name}</h4>
                              <Badge variant={seg.type === 'Dynamic' ? 'prism' : 'secondary'}>{seg.type}</Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm text-zoru-ink-muted">
                              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {seg.count.toLocaleString()}</span>
                              <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" /> {seg.lastSync}</span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="exclusion">
                        <AccordionTrigger className="text-sm text-zoru-ink hover:text-zoru-ink">Exclusion Rules</AccordionTrigger>
                        <AccordionContent>
                          <div className="p-4 border border-zoru-line dark:border-zoru-line/50 rounded-lg bg-zoru-surface-2/50 dark:bg-zoru-ink/10 space-y-4">
                            <p className="text-sm text-zoru-ink-muted">Select segments or criteria to exclude from this campaign.</p>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="Select exclusion segment..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="dnd">Global DND List</SelectItem>
                                <SelectItem value="bounced">Hard Bounced (Last 30 days)</SelectItem>
                                <SelectItem value="complained">Spam Complaints</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              )}

              {/* STEP 3: CONTENT */}
              {step === 3 && (
                <Card variant="elevated" className="border-t-4 border-t-[hsl(var(--prism-indigo))]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-zoru-ink" /> Message Content</CardTitle>
                    <CardDescription>Craft your SMS payload. Use variables to personalize the message for each recipient.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Message Body</Label>
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" className="h-7 text-xs">{"{{first_name}}"}</Button>
                          <Button variant="secondary" size="sm" className="h-7 text-xs">{"{{order_id}}"}</Button>
                          <Button variant="secondary" size="sm" className="h-7 text-xs">{"{{opt_out_link}}"}</Button>
                        </div>
                      </div>
                      <Textarea 
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type your message here..."
                        className="min-h-[150px] resize-none font-mono text-sm"
                      />
                      <div className="flex items-center justify-between text-xs text-zoru-ink-muted">
                        <span>Encoding: <strong className="text-zoru-ink">GSM-7</strong></span>
                        <span>{message.length} characters • {segmentCount} segment(s)</span>
                      </div>
                      
                      {invalidVariables.length > 0 && (
                        <Alert variant="destructive" className="mt-2 py-2 px-3">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle className="text-sm font-semibold mb-1">Invalid Variables Detected</AlertTitle>
                          <AlertDescription className="text-xs">
                            Unknown variables: <strong>{invalidVariables.map(v => `{{${v}}}`).join(', ')}</strong>. 
                            Allowed variables are: {ALLOWED_VARIABLES.map(v => `{{${v}}}`).join(', ')}.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="rounded-lg border bg-zoru-surface-2/40 p-4">
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2"><Globe2 className="h-4 w-4" /> Link Tracking</h4>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-zoru-ink-muted">Automatically shorten URLs and track click-through rates.</p>
                        <Switch defaultChecked />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* STEP 4: REVIEW */}
              {step === 4 && (
                <Card variant="elevated" className="border-t-4 border-t-[hsl(var(--prism-indigo))]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-zoru-ink" /> Schedule & Review</CardTitle>
                    <CardDescription>Final check before your campaign goes live. Set the delivery schedule.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card 
                        variant={scheduleType === 'now' ? "interactive" : "default"}
                        className={cn("cursor-pointer", scheduleType === 'now' ? "border-zoru-line" : "")}
                        onClick={() => setScheduleType('now')}
                      >
                        <div className="p-4 flex items-center gap-3">
                          <div className="p-2 bg-zoru-surface-2 dark:bg-zoru-ink/30 rounded-full text-zoru-ink">
                            <Zap className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold">Send Immediately</h4>
                            <p className="text-xs text-zoru-ink-muted">Dispatch as soon as you hit Launch.</p>
                          </div>
                        </div>
                      </Card>
                      
                      <Card 
                        variant={scheduleType === 'later' ? "interactive" : "default"}
                        className={cn("cursor-pointer", scheduleType === 'later' ? "border-zoru-line" : "")}
                        onClick={() => setScheduleType('later')}
                      >
                        <div className="p-4 flex items-center gap-3">
                          <div className="p-2 bg-zoru-surface-2 dark:bg-zoru-ink rounded-full text-zoru-ink dark:text-zoru-ink-muted">
                            <Clock className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold">Schedule for Later</h4>
                            <p className="text-xs text-zoru-ink-muted">Pick a specific date and time.</p>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {scheduleType === 'later' && (
                      <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-zoru-surface-2/20 animate-in fade-in zoom-in-95">
                        <div className="space-y-2">
                          <Label>Date & Time</Label>
                          <Input type="datetime-local" />
                        </div>
                        <div className="space-y-2">
                          <Label>Timezone</Label>
                          <Select defaultValue="utc">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="utc">UTC (Coordinated Universal Time)</SelectItem>
                              <SelectItem value="est">EST (Eastern Standard Time)</SelectItem>
                              <SelectItem value="ist">IST (Indian Standard Time)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl border p-5 bg-zoru-surface shadow-sm space-y-4">
                      <h3 className="font-semibold text-lg border-b pb-2">Pre-flight Checklist</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zoru-ink-muted">Campaign Name</span>
                          <span className="font-medium">{campaignName || "Untitled Campaign"}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zoru-ink-muted">Sender ID</span>
                          <span className="font-medium">{senderId}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zoru-ink-muted">Target Audience</span>
                          <span className="font-medium">
                            {MOCK_SEGMENTS.find(s => s.id === selectedSegment)?.name} 
                            <Badge variant="secondary" className="ml-2">{MOCK_SEGMENTS.find(s => s.id === selectedSegment)?.count.toLocaleString()} users</Badge>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zoru-ink-muted">Estimated Cost</span>
                          <div className="text-right">
                            <span className="font-medium text-zoru-ink block">~${estimatedCost}</span>
                            <span className="text-[10px] text-zoru-ink-muted">{segmentCount} segment(s) × {targetUsers.toLocaleString()} users @ ${costPerSegment}/seg</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </m.div>
          </AnimatePresence>

          {/* Form Actions */}
          <div className="flex items-center justify-between mt-6">
            <Button 
              variant="outline" 
              onClick={handlePrev} 
              disabled={isFirstStep}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            
            {!isLastStep ? (
              <Button variant="default" onClick={handleNext}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button variant="premium" size="lg" className="w-40 font-bold">
                Launch <Send className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar / Preview Area */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            {/* Phone Preview */}
            <Card variant="glass" className="overflow-hidden border-0 shadow-xl bg-gradient-to-b from-card to-muted/50">
              <CardHeader className="pb-4 bg-zoru-surface-2/50 border-b flex flex-row items-center justify-center gap-2">
                <Smartphone className="h-4 w-4 text-zoru-ink-muted" />
                <CardTitle className="text-sm font-medium text-zoru-ink-muted">Device Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex justify-center bg-[var(--prism-mesh)] bg-opacity-10 min-h-[400px]">
                {/* Mock iPhone Frame */}
                <div className="w-[280px] h-[580px] bg-white dark:bg-black rounded-[40px] border-[8px] border-zoru-line dark:border-zoru-line shadow-2xl relative overflow-hidden flex flex-col">
                  {/* Notch */}
                  <div className="absolute top-0 inset-x-0 h-6 flex justify-center">
                    <div className="w-32 h-6 bg-zoru-surface-2 dark:bg-zoru-ink rounded-b-3xl"></div>
                  </div>
                  
                  {/* App Header */}
                  <div className="pt-12 pb-4 px-4 bg-zoru-surface-2 dark:bg-zoru-ink border-b dark:border-zoru-line flex items-center justify-center">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 bg-zoru-surface-2 dark:bg-zoru-ink rounded-full flex items-center justify-center mb-1 text-xs font-bold text-zoru-ink">
                        {senderId.charAt(0)}
                      </div>
                      <span className="text-xs font-semibold">{senderId}</span>
                    </div>
                  </div>
                  
                  {/* Messages Area */}
                  <div className="flex-1 p-4 bg-white dark:bg-black flex flex-col justify-end">
                    <div className="flex justify-start mb-4">
                      <div className="bg-zoru-surface-2 dark:bg-zoru-ink text-zoru-ink dark:text-white px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%] text-[13px] leading-relaxed shadow-sm">
                        {message || "Message preview will appear here..."}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Campaign Stats Mini */}
            <Card variant="default">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zoru-ink text-zoru-ink rounded-lg">
                    <BarChart className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Delivery Estimate</h4>
                    <p className="text-xs text-zoru-ink-muted">Based on historical data</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zoru-ink-muted">Deliverability</span>
                    <span className="font-medium text-zoru-ink">98.4%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zoru-ink-muted">Avg. Latency</span>
                    <span className="font-medium">1.2s</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
