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
import { useRouter } from "next/navigation"
import { PageHeader, Alert, AlertDescription, AlertTitle, Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter, Accordion, AccordionItem, AccordionTrigger, AccordionContent, Button, Input, Label, Textarea, Switch, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from '@/components/sabcrm/20ui';

import { listSegments, type SegmentListRow } from "../../segments/actions"
import {
  createCampaignAction,
  estimateCampaignAction,
  launchCampaignAction,
  rcsCapabilityEstimateAction,
} from "../actions"
import { segmentInfo } from "@/lib/sabsms/segments"
import type { CampaignEstimate } from "../launch-helpers"
import type { SabsmsMessageCategory } from "@/lib/sabsms/types"

/** Compact "x ago" formatter for the segment cards. */
function timeAgo(iso?: string): string {
  if (!iso) return "never"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "just now"
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

const STEPS = [
  { id: 1, title: 'Basics', icon: Settings2, description: 'Core details' },
  { id: 2, title: 'Audience', icon: Users, description: 'Targeting rules' },
  { id: 3, title: 'Content', icon: Megaphone, description: 'Message design' },
  { id: 4, title: 'Review', icon: CalendarClock, description: 'Schedule & send' },
]

export default function CreateCampaignPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  // Form State
  const [campaignName, setCampaignName] = useState("")
  const [senderId, setSenderId] = useState("SABNODE")
  const [campaignType, setCampaignType] = useState("marketing")
  const [selectedSegment, setSelectedSegment] = useState<string>("")
  const [message, setMessage] = useState("Hi {{first_name}}, check out our new offers!")
  const [scheduleType, setScheduleType] = useState("now")
  const [scheduledAt, setScheduledAt] = useState("")
  const [smartRouting, setSmartRouting] = useState(true)
  const [abTest, setAbTest] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Real data wiring (V2.3)
  const [segments, setSegments] = useState<SegmentListRow[]>([])
  const [segmentsLoading, setSegmentsLoading] = useState(true)
  const [segmentsError, setSegmentsError] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<CampaignEstimate | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)
  // V2.11 — sampled RCS-capability estimate for the review step.
  const [rcsEstimate, setRcsEstimate] = useState<
    { percent: number; sampled: number; capable: number } | null
  >(null)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)

  // Load real segments (existing segments module actions).
  useEffect(() => {
    let alive = true
    setSegmentsLoading(true)
    listSegments({ pageSize: 50 })
      .then((res) => {
        if (!alive) return
        if (res.ok) {
          setSegments(res.rows)
          setSelectedSegment((prev) => prev || res.rows[0]?.id || "")
        } else {
          setSegmentsError(res.error)
        }
      })
      .catch((e) => alive && setSegmentsError((e as Error).message))
      .finally(() => alive && setSegmentsLoading(false))
    return () => {
      alive = false
    }
  }, [])

  // Server-side estimate when reaching review (exact audience count,
  // engine-parity segments, country-aware credit pricing, quiet-hours
  // warnings).
  useEffect(() => {
    if (step !== 4 || !selectedSegment) return
    let alive = true
    setEstimateLoading(true)
    estimateCampaignAction({
      body: message,
      category: campaignType as SabsmsMessageCategory,
      audience: { kind: "segment", segmentId: selectedSegment },
    })
      .then((res) => {
        if (!alive) return
        setEstimate(res.ok ? res.estimate : null)
      })
      .catch(() => alive && setEstimate(null))
      .finally(() => alive && setEstimateLoading(false))
    return () => {
      alive = false
    }
  }, [step, selectedSegment, message, campaignType])

  // V2.11 — "~N% RCS-capable" audience hint (sampled ≤200 phones via the
  // engine's identity-graph-cached capability endpoint). Best-effort:
  // failures simply hide the hint.
  useEffect(() => {
    if (step !== 4 || !selectedSegment) return
    let alive = true
    rcsCapabilityEstimateAction({
      audience: { kind: "segment", segmentId: selectedSegment },
    })
      .then((res) => {
        if (alive) setRcsEstimate(res.ok ? res : null)
      })
      .catch(() => alive && setRcsEstimate(null))
    return () => {
      alive = false
    }
  }, [step, selectedSegment])

  async function handleLaunch() {
    setLaunchError(null)
    if (!selectedSegment) {
      setLaunchError("Pick a target segment first.")
      return
    }
    if (!message.trim()) {
      setLaunchError("Write a message body first.")
      return
    }
    if (scheduleType === "later" && !scheduledAt) {
      setLaunchError("Pick a date and time for the scheduled send.")
      return
    }
    setLaunching(true)
    try {
      const created = await createCampaignAction({
        name: campaignName.trim() || "Untitled Campaign",
        body: message,
        category: campaignType as SabsmsMessageCategory,
        audience: { kind: "segment", segmentId: selectedSegment },
        schedule:
          scheduleType === "later"
            ? { kind: "scheduledAt", at: new Date(scheduledAt).toISOString() }
            : { kind: "now" },
        throttlePerSec: 10,
        from: senderId,
      })
      if (!created.ok) {
        setLaunchError(created.error)
        return
      }
      const launched = await launchCampaignAction({ campaignId: created.id })
      if (!launched.ok) {
        setLaunchError(launched.error)
        return
      }
      localStorage.removeItem("sabsms_quick_campaign_draft")
      router.push("/sabsms/campaigns")
    } catch (e) {
      setLaunchError((e as Error).message ?? "Launch failed")
    } finally {
      setLaunching(false)
    }
  }

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
        if (parsed.scheduledAt) setScheduledAt(parsed.scheduledAt)
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
      step, campaignName, senderId, campaignType, selectedSegment, message, scheduleType, scheduledAt, smartRouting, abTest
    }
    localStorage.setItem("sabsms_quick_campaign_draft", JSON.stringify(draft))
  }, [isMounted, step, campaignName, senderId, campaignType, selectedSegment, message, scheduleType, scheduledAt, smartRouting, abTest])

  // Template variables — resolved per-recipient from contact fields at
  // launch time; unresolved ones surface in the server estimate's
  // warnings on the review step.
  const usedVariables = [...new Set(
    (message.match(/{{([^}]+)}}/g) || []).map(m => m.replace(/^{{|}}$/g, '').split('|')[0].trim())
  )]

  // Live local counter (engine-parity GSM-7/UCS-2 math); the review
  // step swaps in the exact server-side estimate.
  const info = segmentInfo(message)
  const segmentCount = info.segments
  const selectedSegmentRow = segments.find(s => s.id === selectedSegment)
  const targetUsers = estimate?.recipients ?? selectedSegmentRow?.size ?? 0
  const estimatedCredits = estimate?.credits ?? targetUsers * segmentCount

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
        breadcrumb={<span className="text-[var(--st-text-secondary)]">SAB SMS / Campaigns / Quick Create</span>}
        mesh
        actions={
          <div className="flex items-center gap-2">
            <Link href="/sabsms/campaigns/new">
              <Button variant="outline" className="gap-2">
                Switch to Advanced Builder <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => localStorage.removeItem("sabsms_quick_campaign_draft")}>Clear Draft</Button>
            {isLastStep && (
              <Button variant="premium" onClick={handleLaunch} disabled={launching}>
                {launching ? "Launching…" : "Launch Campaign"} <Send className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        }
      />

      <Alert className="mb-8 border-[var(--st-border)] bg-[var(--st-text)]">
        <Info className="h-4 w-4 text-[var(--st-text)]" />
        <AlertTitle className="text-[var(--st-text)] font-semibold">Quick Broadcast Mode</AlertTitle>
        <AlertDescription className="text-[var(--st-text-secondary)]">
          You are using the quick broadcast tool, designed for fast, single-segment announcements. Your progress is auto-saved locally. For multi-segment workflows, drips, and full CRM integration, switch to the <Link href="/sabsms/campaigns/new" className="text-[var(--st-text)] hover:underline font-medium">Advanced Builder</Link>.
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
                isActive ? "bg-[var(--st-bg-secondary)] border-[var(--st-border)] shadow-[0_0_20px_-5px_hsl(var(--prism-indigo)/0.2)]" : 
                isCompleted ? "bg-[var(--st-bg-secondary)]/50 border-transparent opacity-80" : "bg-transparent border-dashed opacity-50"
              )}
            >
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
                isActive ? "bg-[var(--st-text)] text-white shadow-md" : 
                isCompleted ? "bg-[var(--st-text)] text-white" : "bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
              )}>
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="flex flex-col min-w-0">
                <span className={cn("text-sm font-semibold truncate", isActive && "text-[var(--st-text)]")}>
                  Step {s.id}: {s.title}
                </span>
                <span className="text-xs text-[var(--st-text-secondary)] truncate">{s.description}</span>
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
                    <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-[var(--st-text)]" /> Campaign Fundamentals</CardTitle>
                    <CardDescription>Define the core details and routing preferences for this broadcast.</CardDescription>
                  </CardHeader>
                  <CardBody className="space-y-6">
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
                          <div className="flex items-center justify-between rounded-lg border p-4 bg-[var(--st-bg-muted)]/30">
                            <div className="space-y-0.5">
                              <Label className="text-base font-medium">Smart Routing</Label>
                              <p className="text-sm text-[var(--st-text-secondary)]">
                                Automatically select the most reliable gateway based on real-time telco latency.
                              </p>
                            </div>
                            <Switch checked={smartRouting} onCheckedChange={setSmartRouting} />
                          </div>
                          
                          <div className="flex items-center justify-between rounded-lg border p-4 bg-[var(--st-bg-muted)]/30">
                            <div className="space-y-0.5">
                              <Label className="text-base font-medium">A/B Testing</Label>
                              <p className="text-sm text-[var(--st-text-secondary)]">
                                Split your audience to test multiple message variants.
                              </p>
                            </div>
                            <Switch checked={abTest} onCheckedChange={setAbTest} />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardBody>
                </Card>
              )}

              {/* STEP 2: AUDIENCE */}
              {step === 2 && (
                <Card variant="elevated" className="border-t-4 border-t-[hsl(var(--prism-indigo))]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-[var(--st-text)]" /> Audience Targeting</CardTitle>
                    <CardDescription>Select who will receive this campaign. You can combine multiple segments or apply exclusion rules.</CardDescription>
                  </CardHeader>
                  <CardBody className="space-y-6">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">Target Segments</Label>
                      <Link href="/sabsms/segments/new">
                        <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Create New</Button>
                      </Link>
                    </div>

                    {segmentsLoading && (
                      <p className="text-sm text-[var(--st-text-secondary)]">Loading segments…</p>
                    )}
                    {segmentsError && (
                      <Alert variant="destructive" className="py-2 px-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">{segmentsError}</AlertDescription>
                      </Alert>
                    )}
                    {!segmentsLoading && !segmentsError && segments.length === 0 && (
                      <p className="text-sm text-[var(--st-text-secondary)]">
                        No segments yet — <Link href="/sabsms/segments/new" className="underline">create one</Link> to target this campaign.
                      </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {segments.map(seg => (
                        <Card
                          key={seg.id}
                          variant={selectedSegment === seg.id ? "interactive" : "default"}
                          className={cn(
                            "cursor-pointer transition-all",
                            selectedSegment === seg.id ? "border-[var(--st-border)] ring-1 ring-[var(--st-border)] bg-[var(--st-text)]" : ""
                          )}
                          onClick={() => setSelectedSegment(seg.id)}
                        >
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold">{seg.name}</h4>
                              <Badge variant={seg.kind === 'dynamic' ? 'prism' : 'secondary'}>{seg.kind === 'dynamic' ? 'Dynamic' : 'Static'}</Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm text-[var(--st-text-secondary)]">
                              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {seg.size.toLocaleString()}</span>
                              <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" /> {timeAgo(seg.lastRefreshedAt)}</span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="exclusion">
                        <AccordionTrigger className="text-sm text-[var(--st-text)] hover:text-[var(--st-text)]">Exclusion Rules</AccordionTrigger>
                        <AccordionContent>
                          <div className="p-4 border border-[var(--st-border)] dark:border-[var(--st-border)]/50 rounded-lg bg-[var(--st-bg-muted)]/50 dark:bg-[var(--st-text)]/10 space-y-4">
                            <p className="text-sm text-[var(--st-text-secondary)]">Select segments or criteria to exclude from this campaign.</p>
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
                  </CardBody>
                </Card>
              )}

              {/* STEP 3: CONTENT */}
              {step === 3 && (
                <Card variant="elevated" className="border-t-4 border-t-[hsl(var(--prism-indigo))]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-[var(--st-text)]" /> Message Content</CardTitle>
                    <CardDescription>Craft your SMS payload. Use variables to personalize the message for each recipient.</CardDescription>
                  </CardHeader>
                  <CardBody className="space-y-6">
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
                      <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
                        <span>Encoding: <strong className="text-[var(--st-text)]">{info.encoding === 'gsm7' ? 'GSM-7' : 'UCS-2'}</strong></span>
                        <span>{info.length} characters • {segmentCount} segment(s)</span>
                      </div>

                      {usedVariables.length > 0 && (
                        <Alert className="mt-2 py-2 px-3">
                          <Info className="h-4 w-4" />
                          <AlertTitle className="text-sm font-semibold mb-1">Personalisation variables</AlertTitle>
                          <AlertDescription className="text-xs">
                            {usedVariables.map(v => `{{${v}}}`).join(', ')} will be filled
                            from each contact&apos;s fields at launch. Recipients missing a
                            value keep the literal placeholder — the review step flags them.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="rounded-lg border bg-[var(--st-bg-muted)]/40 p-4">
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2"><Globe2 className="h-4 w-4" /> Link Tracking</h4>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[var(--st-text-secondary)]">Automatically shorten URLs and track click-through rates.</p>
                        <Switch defaultChecked />
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* STEP 4: REVIEW */}
              {step === 4 && (
                <Card variant="elevated" className="border-t-4 border-t-[hsl(var(--prism-indigo))]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-[var(--st-text)]" /> Schedule & Review</CardTitle>
                    <CardDescription>Final check before your campaign goes live. Set the delivery schedule.</CardDescription>
                  </CardHeader>
                  <CardBody className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card 
                        variant={scheduleType === 'now' ? "interactive" : "default"}
                        className={cn("cursor-pointer", scheduleType === 'now' ? "border-[var(--st-border)]" : "")}
                        onClick={() => setScheduleType('now')}
                      >
                        <div className="p-4 flex items-center gap-3">
                          <div className="p-2 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/30 rounded-full text-[var(--st-text)]">
                            <Zap className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold">Send Immediately</h4>
                            <p className="text-xs text-[var(--st-text-secondary)]">Dispatch as soon as you hit Launch.</p>
                          </div>
                        </div>
                      </Card>
                      
                      <Card 
                        variant={scheduleType === 'later' ? "interactive" : "default"}
                        className={cn("cursor-pointer", scheduleType === 'later' ? "border-[var(--st-border)]" : "")}
                        onClick={() => setScheduleType('later')}
                      >
                        <div className="p-4 flex items-center gap-3">
                          <div className="p-2 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-full text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                            <Clock className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold">Schedule for Later</h4>
                            <p className="text-xs text-[var(--st-text-secondary)]">Pick a specific date and time.</p>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {scheduleType === 'later' && (
                      <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-[var(--st-bg-muted)]/20 animate-in fade-in zoom-in-95">
                        <div className="space-y-2">
                          <Label htmlFor="scheduled-at">Date &amp; Time</Label>
                          <Input
                            id="scheduled-at"
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Timezone</Label>
                          <p className="flex h-9 items-center text-sm text-[var(--st-text-secondary)]">
                            Your local time ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl border p-5 bg-[var(--st-bg-secondary)] shadow-sm space-y-4">
                      <h3 className="font-semibold text-lg border-b pb-2">Pre-flight Checklist</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--st-text-secondary)]">Campaign Name</span>
                          <span className="font-medium">{campaignName || "Untitled Campaign"}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--st-text-secondary)]">Sender ID</span>
                          <span className="font-medium">{senderId}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--st-text-secondary)]">Target Audience</span>
                          <span className="font-medium">
                            {selectedSegmentRow?.name ?? "No segment selected"}
                            <Badge variant="secondary" className="ml-2">{targetUsers.toLocaleString()} recipients</Badge>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--st-text-secondary)]">Estimated Cost</span>
                          <div className="text-right">
                            <span className="font-medium text-[var(--st-text)] block">
                              {estimateLoading ? "Estimating…" : `~${estimatedCredits.toLocaleString()} credits`}
                            </span>
                            <span className="text-[10px] text-[var(--st-text-secondary)]">
                              {estimate
                                ? `${estimate.segmentsTotal.toLocaleString()} billable segment(s) across ${estimate.recipients.toLocaleString()} recipients`
                                : `${segmentCount} segment(s) × ${targetUsers.toLocaleString()} recipients`}
                            </span>
                          </div>
                        </div>
                        {rcsEstimate && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--st-text-secondary)]">RCS reach</span>
                            <div className="text-right">
                              <span className="font-medium text-[var(--st-text)] block">
                                ~{rcsEstimate.percent}% RCS-capable
                              </span>
                              <span className="text-[10px] text-[var(--st-text-secondary)]">
                                {rcsEstimate.capable} of {rcsEstimate.sampled} sampled phones
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {estimate && estimate.warnings.length > 0 && (
                        <div className="space-y-2 border-t pt-3">
                          {estimate.warnings.map((w) => (
                            <div key={w} className="flex items-start gap-2 text-xs text-[var(--st-text-secondary)]">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {launchError && (
                      <Alert variant="destructive" className="py-2 px-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="text-sm font-semibold mb-1">Launch failed</AlertTitle>
                        <AlertDescription className="text-xs">{launchError}</AlertDescription>
                      </Alert>
                    )}
                  </CardBody>
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
              <Button
                variant="premium"
                size="lg"
                className="w-40 font-bold"
                onClick={handleLaunch}
                disabled={launching}
              >
                {launching ? "Launching…" : "Launch"} <Send className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar / Preview Area */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            {/* Phone Preview */}
            <Card variant="glass" className="overflow-hidden border-0 shadow-xl bg-gradient-to-b from-card to-muted/50">
              <CardHeader className="pb-4 bg-[var(--st-bg-muted)]/50 border-b flex flex-row items-center justify-center gap-2">
                <Smartphone className="h-4 w-4 text-[var(--st-text-secondary)]" />
                <CardTitle className="text-sm font-medium text-[var(--st-text-secondary)]">Device Preview</CardTitle>
              </CardHeader>
              <CardBody className="p-6 flex justify-center bg-[var(--prism-mesh)] bg-opacity-10 min-h-[400px]">
                {/* Mock iPhone Frame */}
                <div className="w-[280px] h-[580px] bg-white dark:bg-black rounded-[40px] border-[8px] border-[var(--st-border)] dark:border-[var(--st-border)] shadow-2xl relative overflow-hidden flex flex-col">
                  {/* Notch */}
                  <div className="absolute top-0 inset-x-0 h-6 flex justify-center">
                    <div className="w-32 h-6 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-b-3xl"></div>
                  </div>
                  
                  {/* App Header */}
                  <div className="pt-12 pb-4 px-4 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] border-b dark:border-[var(--st-border)] flex items-center justify-center">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded-full flex items-center justify-center mb-1 text-xs font-bold text-[var(--st-text)]">
                        {senderId.charAt(0)}
                      </div>
                      <span className="text-xs font-semibold">{senderId}</span>
                    </div>
                  </div>
                  
                  {/* Messages Area */}
                  <div className="flex-1 p-4 bg-white dark:bg-black flex flex-col justify-end">
                    <div className="flex justify-start mb-4">
                      <div className="bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] text-[var(--st-text)] dark:text-white px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%] text-[13px] leading-relaxed shadow-sm">
                        {message || "Message preview will appear here..."}
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Campaign Stats Mini */}
            <Card variant="default">
              <CardBody className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--st-text)] text-[var(--st-text)] rounded-lg">
                    <BarChart className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Delivery Estimate</h4>
                    <p className="text-xs text-[var(--st-text-secondary)]">Based on historical data</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--st-text-secondary)]">Deliverability</span>
                    <span className="font-medium text-[var(--st-text)]">98.4%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--st-text-secondary)]">Avg. Latency</span>
                    <span className="font-medium">1.2s</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
