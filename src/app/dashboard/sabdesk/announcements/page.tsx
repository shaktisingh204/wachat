"use client";

import React, { useState } from "react";
import {
  Megaphone,
  BarChart,
  Bell,
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Edit2,
  Layout,
  Type,
  Image as ImageIcon,
  Clock,
  Target,
  Smartphone,
  XCircle,
  Maximize2,
  Monitor,
  LayoutTemplate,
  Lock,
} from "lucide-react";
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Switch,
  SegmentedControl,
  Badge,
  StatCard,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
  type BadgeTone,
} from "@/components/sabcrm/20ui";

// Mock Data
const announcements = [
  { id: 1, title: "SabDesk v2.0 Launch", type: "Banner", status: "Active", audience: "All Users", views: "45.2k", clicks: "12.4k", ctr: "27.4%" },
  { id: 2, title: "Scheduled Maintenance", type: "Modal", status: "Scheduled", audience: "Enterprise", views: "0", clicks: "0", ctr: "0%" },
  { id: 3, title: "New Feature: AI Summaries", type: "Push", status: "Draft", audience: "Beta Testers", views: "-", clicks: "-", ctr: "-" },
  { id: 4, title: "Holiday Support Hours", type: "Banner", status: "Ended", audience: "All Users", views: "120.5k", clicks: "5.2k", ctr: "4.3%" },
  { id: 5, title: "Webinar: Best Practices", type: "Email + Push", status: "Ended", audience: "Admins", views: "15k", clicks: "3.1k", ctr: "20.6%" },
];

const analyticsStats: Array<{
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
}> = [
  { label: "Total Impressions", value: "2.4M", change: "+15.2% vs last month", trend: "up" },
  { label: "Average CTR", value: "8.4%", change: "+2.1% vs last month", trend: "up" },
  { label: "Dismissal Rate", value: "42.1%", change: "-5.4% vs last month", trend: "down" },
  { label: "Conversion Rate", value: "3.2%", change: "+0.8% vs last month", trend: "up" },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  Active: "success",
  Scheduled: "info",
  Draft: "neutral",
  Ended: "danger",
};

const STATUS_ICON: Record<string, typeof Play> = {
  Active: Play,
  Scheduled: Clock,
  Draft: Edit2,
  Ended: Pause,
};

const FORMAT_OPTIONS = [
  { value: "banner", label: "Top Banner", icon: Layout },
  { value: "modal", label: "Modal Popup", icon: Maximize2 },
  { value: "push", label: "Push Notif", icon: Bell },
  { value: "inapp", label: "In-App Msg", icon: Smartphone },
];

const BG_SWATCHES = [
  { value: "bg-indigo-600", color: "#4f46e5" },
  { value: "bg-slate-900", color: "#0f172a" },
  { value: "bg-rose-600", color: "#e11d48" },
  { value: "bg-emerald-600", color: "#059669" },
  { value: "bg-amber-600", color: "#d97706" },
  { value: "bg-blue-600", color: "#2563eb" },
  { value: "bg-purple-600", color: "#9333ea" },
];

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [campaignName, setCampaignName] = useState("New Campaign");
  const [format, setFormat] = useState("banner");
  const [bannerConfig, setBannerConfig] = useState({
    text: "We just launched SabDesk v2.0. Check out what's new.",
    ctaText: "Read Announcement",
    ctaUrl: "",
    bgColor: "bg-indigo-600",
    textColor: "text-white",
    position: "top",
    hasCloseBtn: true,
  });

  const openComposer = () => setActiveTab("composer");

  return (
    <div className="20ui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-3">
            <Megaphone className="w-7 h-7 text-[var(--st-accent)]" aria-hidden="true" />
            Announcements &amp; Campaigns
          </PageTitle>
          <PageDescription>
            Design, target, and measure announcements across your product.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openComposer}>
            New Campaign
          </Button>
        </PageActions>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="campaigns">
            <span className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" aria-hidden="true" /> All Campaigns
            </span>
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <span className="flex items-center gap-2">
              <BarChart className="w-4 h-4" aria-hidden="true" /> Performance Analytics
            </span>
          </TabsTrigger>
          <TabsTrigger value="audience">
            <span className="flex items-center gap-2">
              <Target className="w-4 h-4" aria-hidden="true" /> Audience Segments
            </span>
          </TabsTrigger>
          <TabsTrigger value="composer">
            <span className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4" aria-hidden="true" /> Campaign Builder
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Campaigns List */}
        <TabsContent value="campaigns" className="mt-6">
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 border-b border-[var(--st-border)] flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex gap-2">
                <div className="max-w-sm w-full">
                  <Field label="Search campaigns" className="[&_.u-field\\_\\_label]:sr-only">
                    <Input
                      type="text"
                      placeholder="Search campaigns..."
                      iconLeft={Search}
                    />
                  </Field>
                </div>
                <Button variant="outline" iconLeft={Filter}>
                  Filters
                </Button>
              </div>
              <div className="flex gap-2">
                <Select defaultValue="all-types">
                  <SelectTrigger aria-label="Filter by type">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-types">All Types</SelectItem>
                    <SelectItem value="banner">Banner</SelectItem>
                    <SelectItem value="modal">Modal</SelectItem>
                    <SelectItem value="push">Push Notification</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all-statuses">
                  <SelectTrigger aria-label="Filter by status">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-statuses">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="ended">Ended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-auto">
              <Table stickyHeader hover>
                <THead>
                  <Tr>
                    <Th>Campaign Name</Th>
                    <Th>Status</Th>
                    <Th>Target Audience</Th>
                    <Th>Performance</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {announcements.map((ann) => {
                    const StatusIcon = STATUS_ICON[ann.status];
                    const FormatIcon =
                      ann.type === "Banner" ? Layout : ann.type === "Modal" ? Maximize2 : Bell;
                    return (
                      <Tr key={ann.id} className="group">
                        <Td>
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-[var(--st-radius)] flex items-center justify-center border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-accent)]">
                              <FormatIcon className="w-5 h-5" aria-hidden="true" />
                            </span>
                            <div>
                              <div className="font-medium text-[var(--st-text)]">{ann.title}</div>
                              <div className="text-xs text-[var(--st-text-secondary)]">{ann.type}</div>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <Badge tone={STATUS_TONE[ann.status]} dot>
                            <span className="inline-flex items-center gap-1">
                              {StatusIcon ? <StatusIcon className="w-3 h-3" aria-hidden="true" /> : null}
                              {ann.status}
                            </span>
                          </Badge>
                        </Td>
                        <Td>
                          <span className="flex items-center gap-2 text-sm text-[var(--st-text)]">
                            <Users className="w-4 h-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                            {ann.audience}
                          </span>
                        </Td>
                        <Td>
                          <div className="flex gap-4">
                            <div>
                              <div className="text-xs text-[var(--st-text-secondary)]">Views</div>
                              <div className="text-sm font-medium text-[var(--st-text)]">{ann.views}</div>
                            </div>
                            <div>
                              <div className="text-xs text-[var(--st-text-secondary)]">Clicks</div>
                              <div className="text-sm font-medium text-[var(--st-text)]">{ann.clicks}</div>
                            </div>
                            <div>
                              <div className="text-xs text-[var(--st-text-secondary)]">CTR</div>
                              <div className="text-sm font-medium text-[var(--st-accent)]">{ann.ctr}</div>
                            </div>
                          </div>
                        </Td>
                        <Td align="right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <IconButton
                              label="Edit campaign"
                              icon={Edit2}
                              size="sm"
                              onClick={() => toast.info(`Editing "${ann.title}"`)}
                            />
                            <IconButton
                              label="Delete campaign"
                              icon={Trash2}
                              size="sm"
                              variant="danger"
                              onClick={() => toast.error(`Deleted "${ann.title}"`)}
                            />
                            <IconButton label="More actions" icon={MoreVertical} size="sm" />
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          <h2 className="text-xl font-bold text-[var(--st-text)] mb-6">Global Engagement Analytics</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {analyticsStats.map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                delta={{ value: stat.change, tone: stat.trend }}
              />
            ))}
          </div>

          <Card variant="outlined" padding="lg">
            <EmptyState
              icon={BarChart}
              title="Impressions vs Clicks over time"
              description="The engagement chart will render here once campaign data is collected."
            />
          </Card>
        </TabsContent>

        {/* Audience Segments Tab */}
        <TabsContent value="audience" className="mt-6">
          <Card variant="outlined" padding="lg">
            <EmptyState
              icon={Target}
              title="No audience segments yet"
              description="Create reusable segments to target announcements at the right users."
              action={
                <Button variant="primary" iconLeft={Plus} onClick={() => toast.info("New segment")}>
                  New Segment
                </Button>
              }
            />
          </Card>
        </TabsContent>

        {/* Campaign Builder (Composer Tab) */}
        <TabsContent value="composer" className="mt-6">
          <Card padding="none" className="overflow-hidden">
            <div className="flex flex-col xl:flex-row min-h-[700px]">
              {/* Editor Sidebar */}
              <div className="w-full xl:w-[400px] border-b xl:border-b-0 xl:border-r border-[var(--st-border)] flex-shrink-0 flex flex-col">
                <div className="p-4 border-b border-[var(--st-border)]">
                  <Field label="Campaign name" className="[&_.u-field\\_\\_label]:sr-only">
                    <Input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="Campaign name"
                    />
                  </Field>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-6">
                  {/* Type Selection */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-[var(--st-text)]">Format</p>
                    <SegmentedControl
                      aria-label="Announcement format"
                      items={FORMAT_OPTIONS}
                      value={format}
                      onChange={setFormat}
                    />
                  </div>

                  {/* Content Configuration */}
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-[var(--st-text)] flex items-center gap-2">
                      <Type className="w-4 h-4" aria-hidden="true" /> Content
                    </p>

                    <Field label="Announcement Message">
                      <Textarea
                        rows={3}
                        value={bannerConfig.text}
                        onChange={(e) => setBannerConfig({ ...bannerConfig, text: e.target.value })}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Call to Action (CTA)">
                        <Input
                          type="text"
                          value={bannerConfig.ctaText}
                          onChange={(e) => setBannerConfig({ ...bannerConfig, ctaText: e.target.value })}
                        />
                      </Field>
                      <Field label="CTA Link URL">
                        <Input
                          type="text"
                          prefix="https://"
                          placeholder="app.sabdesk.com/whats-new"
                          value={bannerConfig.ctaUrl}
                          onChange={(e) => setBannerConfig({ ...bannerConfig, ctaUrl: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>

                  {/* Appearance */}
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-[var(--st-text)] flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" aria-hidden="true" /> Appearance
                    </p>

                    <Field label="Background Color">
                      <div className="flex gap-2">
                        {BG_SWATCHES.map((swatch) => {
                          const selected = bannerConfig.bgColor === swatch.value;
                          const swatchName = swatch.value.replace("bg-", "").replace("-", " ");
                          return (
                            <Button
                              key={swatch.value}
                              variant="ghost"
                              size="sm"
                              aria-label={`Background ${swatchName}`}
                              aria-pressed={selected}
                              title={swatchName}
                              onClick={() => setBannerConfig({ ...bannerConfig, bgColor: swatch.value })}
                              className={`h-8 w-8 rounded-full border border-[var(--st-border)] p-0${
                                selected
                                  ? " ring-2 ring-[var(--st-accent)] ring-offset-2 ring-offset-[var(--st-bg-secondary)]"
                                  : ""
                              }`}
                              style={{ background: swatch.color }}
                            />
                          );
                        })}
                      </div>
                    </Field>

                    <div className="flex items-center justify-between p-3 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                      <div>
                        <div className="text-sm font-medium text-[var(--st-text)]">Allow Dismissal</div>
                        <div className="text-xs text-[var(--st-text-secondary)]">Show a close button</div>
                      </div>
                      <Switch
                        aria-label="Allow dismissal"
                        checked={bannerConfig.hasCloseBtn}
                        onCheckedChange={(checked) => setBannerConfig({ ...bannerConfig, hasCloseBtn: checked })}
                      />
                    </div>
                  </div>

                  {/* Targeting */}
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-[var(--st-text)] flex items-center gap-2">
                      <Target className="w-4 h-4" aria-hidden="true" /> Targeting &amp; Schedule
                    </p>

                    <Field label="Audience Segment">
                      <Select defaultValue="all">
                        <SelectTrigger aria-label="Audience segment">
                          <SelectValue placeholder="All Users" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="premium">Premium Subscribers</SelectItem>
                          <SelectItem value="new">New Users (Last 30 Days)</SelectItem>
                          <SelectItem value="custom">Custom Segment...</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Start Date">
                        <Input type="datetime-local" />
                      </Field>
                      <Field label="End Date">
                        <Input type="datetime-local" />
                      </Field>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-[var(--st-border)] flex justify-end gap-3 mt-auto">
                  <Button variant="outline" onClick={() => toast.success("Draft saved")}>
                    Save Draft
                  </Button>
                  <Button variant="primary" iconLeft={Play} onClick={() => toast.success("Campaign launched")}>
                    Launch Campaign
                  </Button>
                </div>
              </div>

              {/* Preview Area */}
              <div className="flex-1 bg-[var(--st-bg-secondary)] p-8 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <p className="text-sm font-semibold text-[var(--st-text-secondary)] flex items-center gap-2">
                    <Monitor className="w-4 h-4" aria-hidden="true" /> Live Preview
                  </p>
                  <SegmentedControl
                    size="sm"
                    aria-label="Preview device"
                    items={[
                      { value: "desktop", label: "", icon: Monitor },
                      { value: "mobile", label: "", icon: Smartphone },
                    ]}
                    value={previewDevice}
                    onChange={setPreviewDevice}
                  />
                </div>

                {/* Fake Browser Window */}
                <div className="flex-1 border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden bg-white shadow-2xl flex flex-col max-w-5xl mx-auto w-full">
                  {/* Browser Chrome */}
                  <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-rose-400" aria-hidden="true" />
                      <span className="w-3 h-3 rounded-full bg-amber-400" aria-hidden="true" />
                      <span className="w-3 h-3 rounded-full bg-emerald-400" aria-hidden="true" />
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-white border border-slate-200 h-6 rounded text-[10px] text-slate-400 flex items-center px-3 justify-center">
                        <Lock className="w-3 h-3 mr-1" aria-hidden="true" /> your-app.sabdesk.com
                      </div>
                    </div>
                  </div>

                  {/* Simulated App Area */}
                  <div className="flex-1 bg-slate-50 relative flex flex-col">
                    {/* LIVE BANNER PREVIEW */}
                    {bannerConfig.position === "top" && (
                      <div
                        className={`${bannerConfig.bgColor} ${bannerConfig.textColor} px-4 py-3 flex items-center justify-between text-sm font-medium shadow-md relative z-50`}
                      >
                        <div className="flex-1 text-center flex justify-center items-center gap-4">
                          <span>{bannerConfig.text || "Your announcement text goes here"}</span>
                          {bannerConfig.ctaText && (
                            <span className="px-3 py-1 bg-white/20 rounded text-xs font-bold">
                              {bannerConfig.ctaText}
                            </span>
                          )}
                        </div>
                        {bannerConfig.hasCloseBtn && (
                          <XCircle className="w-4 h-4 text-white/70" aria-hidden="true" />
                        )}
                      </div>
                    )}

                    {/* App Mock Content */}
                    <div className="flex-1 p-8 flex gap-8 opacity-40 grayscale pointer-events-none">
                      <div className="w-64 bg-white border border-slate-200 rounded-xl h-full p-4 space-y-4">
                        <div className="h-8 bg-slate-200 rounded w-3/4 mb-8" />
                        <div className="h-4 bg-slate-200 rounded w-full" />
                        <div className="h-4 bg-slate-200 rounded w-5/6" />
                        <div className="h-4 bg-slate-200 rounded w-full" />
                        <div className="h-4 bg-slate-200 rounded w-4/6" />
                      </div>
                      <div className="flex-1 space-y-6">
                        <div className="h-12 bg-white border border-slate-200 rounded-xl w-full" />
                        <div className="h-64 bg-white border border-slate-200 rounded-xl w-full p-6">
                          <div className="h-6 bg-slate-200 rounded w-1/4 mb-6" />
                          <div className="space-y-3">
                            <div className="h-4 bg-slate-200 rounded w-full" />
                            <div className="h-4 bg-slate-200 rounded w-full" />
                            <div className="h-4 bg-slate-200 rounded w-3/4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
