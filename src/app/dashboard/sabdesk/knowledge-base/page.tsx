"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Search,
  Plus,
  FolderTree,
  FileText,
  Settings,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  BarChart2,
  Filter,
  Download,
  Globe,
  Lock,
  Users,
  Clock,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  Quote,
  Maximize2,
  Save,
  Folder,
  History,
} from "lucide-react";
import {
  Button,
  IconButton,
  Card,
  StatCard,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Input,
  Field,
  Textarea,
  Badge,
  Tag,
  Radio,
  RadioGroup,
  EmptyState,
  Pagination,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from "@/components/sabcrm/20ui";
import { SabFilePickerButton } from "@/components/sabfiles";
import type { BadgeTone } from "@/components/sabcrm/20ui";

// Mock Data
const kbMetrics: {
  id: number;
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
}[] = [
  { id: 1, title: "Total Articles", value: "1,248", change: "+12%", trend: "up" },
  { id: 2, title: "Total Views", value: "845.2K", change: "+24%", trend: "up" },
  { id: 3, title: "Helpful Rating", value: "94.2%", change: "+1.5%", trend: "up" },
  { id: 4, title: "Needs Update", value: "42", change: "-8%", trend: "down" },
];

const categoryTree = [
  {
    id: "cat-1",
    name: "Getting Started",
    articles: 45,
    children: [
      { id: "cat-1-1", name: "Installation", articles: 12 },
      { id: "cat-1-2", name: "Account Setup", articles: 28 },
      { id: "cat-1-3", name: "Quickstart Guide", articles: 5 },
    ],
  },
  {
    id: "cat-2",
    name: "Core Features",
    articles: 156,
    children: [
      { id: "cat-2-1", name: "Dashboard Overview", articles: 34 },
      { id: "cat-2-2", name: "User Management", articles: 89 },
      { id: "cat-2-3", name: "Reporting & Analytics", articles: 33 },
    ],
  },
  {
    id: "cat-3",
    name: "Integrations",
    articles: 89,
    children: [
      { id: "cat-3-1", name: "API Documentation", articles: 45 },
      { id: "cat-3-2", name: "Webhooks", articles: 22 },
      { id: "cat-3-3", name: "Third-party Apps", articles: 22 },
    ],
  },
  {
    id: "cat-4",
    name: "Troubleshooting",
    articles: 234,
    children: [
      { id: "cat-4-1", name: "Common Errors", articles: 150 },
      { id: "cat-4-2", name: "Performance Issues", articles: 45 },
      { id: "cat-4-3", name: "Security FAQs", articles: 39 },
    ],
  },
];

const articles = Array.from({ length: 25 }).map((_, i) => ({
  id: `art-${i}`,
  title:
    [
      "How to configure SSO with Okta",
      "Understanding Billing Cycles",
      "Advanced Workflow Automation",
      "Setting up Custom Domains",
      "Resolving Sync Conflicts",
    ][i % 5] + ` (Part ${i + 1})`,
  category: ["Security", "Billing", "Features", "Settings", "Troubleshooting"][i % 5],
  author: ["Sarah Chen", "Alex Rivera", "Jamie Smith", "Taylor Wong"][i % 4],
  status: ["Published", "Draft", "Review", "Archived"][i % 4],
  views: Math.floor(((i * 7919) % 50000)),
  helpful: ((i * 37) % 100) + 1,
  unhelpful: (i * 11) % 20,
  lastUpdated: new Date(Date.now() - i * 86400000).toISOString().split("T")[0],
}));

const STATUS_META: Record<
  string,
  { tone: BadgeTone; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  Published: { tone: "success", icon: CheckCircle2 },
  Draft: { tone: "neutral", icon: Edit },
  Review: { tone: "warning", icon: Eye },
  Archived: { tone: "danger", icon: Trash2 },
};

export default function KnowledgeBasePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("articles");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "cat-1": true,
  });
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [accessLevel, setAccessLevel] = useState("public");
  const [logoName, setLogoName] = useState<string | null>(null);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const navItems: { id: string; label: string; icon: typeof FileText }[] = [
    { id: "articles", label: "All Articles", icon: FileText },
    { id: "categories", label: "Categories", icon: FolderTree },
    { id: "settings", label: "KB Settings", icon: Settings },
  ];

  return (
    <div className="ui20 dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] p-6">
      {/* Header */}
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-[var(--st-accent)]" aria-hidden="true" />
            Knowledge Base
          </PageTitle>
          <PageDescription>
            Manage articles, categories, and self-service portals.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="secondary"
            iconLeft={Globe}
            onClick={() => toast.success("Opening the public help portal")}
          >
            View Portal
          </Button>
          <Button variant="primary" iconLeft={Plus} onClick={() => setIsEditorOpen(true)}>
            New Article
          </Button>
        </PageActions>
      </PageHeader>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8 mb-8">
        {kbMetrics.map((metric) => (
          <StatCard
            key={metric.id}
            icon={BarChart2}
            label={metric.title}
            value={metric.value}
            delta={{ value: `${metric.change} vs last month`, tone: metric.trend }}
          />
        ))}
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Sidebar */}
        <div className="xl:w-80 flex-shrink-0 space-y-6">
          {/* Navigation */}
          <Card padding="sm">
            <nav className="flex flex-col gap-1" aria-label="Knowledge base sections">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    iconLeft={Icon}
                    block
                    onClick={() => setActiveTab(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className="justify-start"
                  >
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </Card>

          {/* Category Tree Quick View */}
          <Card>
            <h3 className="text-sm font-semibold text-[var(--st-text)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <FolderTree className="w-4 h-4" aria-hidden="true" /> Directory
            </h3>
            <div className="space-y-1">
              {categoryTree.map((cat) => {
                const isOpen = !!expandedCategories[cat.id];
                return (
                  <div key={cat.id} className="text-sm">
                    <Button
                      variant="ghost"
                      block
                      onClick={() => toggleCategory(cat.id)}
                      aria-expanded={isOpen}
                      className="justify-between"
                    >
                      <span className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown
                            className="w-4 h-4 text-[var(--st-text-tertiary)]"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronRight
                            className="w-4 h-4 text-[var(--st-text-tertiary)]"
                            aria-hidden="true"
                          />
                        )}
                        <Folder className="w-4 h-4 text-[var(--st-accent)]" aria-hidden="true" />
                        {cat.name}
                      </span>
                      <Badge tone="neutral">{cat.articles}</Badge>
                    </Button>
                    {isOpen && (
                      <div className="ml-6 pl-2 border-l border-[var(--st-border)] mt-1 space-y-1">
                        {cat.children.map((child) => (
                          <Button
                            key={child.id}
                            variant="ghost"
                            block
                            onClick={() => setActiveTab("articles")}
                            className="justify-between"
                          >
                            <span className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
                              {child.name}
                            </span>
                            <span className="text-xs text-[var(--st-text-tertiary)]">
                              {child.articles}
                            </span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Main Content Area */}
        <Card
          padding="none"
          className="flex-1 overflow-hidden flex flex-col h-[800px]"
        >
          {activeTab === "articles" && (
            <>
              {/* Toolbar */}
              <div className="p-4 border-b border-[var(--st-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 max-w-md">
                  <Field label="Search articles" className="m-0">
                    <Input
                      iconLeft={Search}
                      placeholder="Search articles..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton
                    label="Filter articles"
                    icon={Filter}
                    variant="outline"
                    onClick={() => toast({ title: "Filters coming soon", tone: "info" })}
                  />
                  <IconButton
                    label="Export articles"
                    icon={Download}
                    variant="outline"
                    onClick={() => toast.success("Export started")}
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger aria-label="Filter by status" className="min-w-[160px]">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                <Table stickyHeader>
                  <THead>
                    <Tr>
                      <Th>Article</Th>
                      <Th>Category</Th>
                      <Th>Status</Th>
                      <Th>Metrics</Th>
                      <Th align="right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {articles.map((article) => {
                      const meta = STATUS_META[article.status] ?? STATUS_META.Draft;
                      const StatusIcon = meta.icon;
                      return (
                        <Tr key={article.id}>
                          <Td>
                            <div className="flex flex-col">
                              <span className="font-medium text-[var(--st-text)]">
                                {article.title}
                              </span>
                              <span className="text-xs text-[var(--st-text-tertiary)] mt-1 flex items-center gap-1">
                                <Users className="w-3 h-3" aria-hidden="true" /> {article.author}
                                <Clock className="w-3 h-3 ml-2" aria-hidden="true" />{" "}
                                {article.lastUpdated}
                              </span>
                            </div>
                          </Td>
                          <Td>
                            <Tag color="var(--st-accent)">{article.category}</Tag>
                          </Td>
                          <Td>
                            <Badge tone={meta.tone}>
                              <StatusIcon size={12} className="mr-1" />
                              {article.status}
                            </Badge>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-4 text-xs text-[var(--st-text-secondary)]">
                              <span className="flex items-center gap-1" title="Views">
                                <Eye className="w-3.5 h-3.5" aria-hidden="true" />{" "}
                                {(article.views / 1000).toFixed(1)}k
                              </span>
                              <span
                                className="flex items-center gap-1 text-[var(--st-status-ok)]"
                                title="Helpful"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />{" "}
                                {article.helpful}
                              </span>
                              <span
                                className="flex items-center gap-1 text-[var(--st-danger)]"
                                title="Unhelpful"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" aria-hidden="true" />{" "}
                                {article.unhelpful}
                              </span>
                            </div>
                          </Td>
                          <Td align="right">
                            <div className="flex items-center justify-end gap-1">
                              <IconButton
                                label={`Edit ${article.title}`}
                                icon={Edit}
                                size="sm"
                                onClick={() => setIsEditorOpen(true)}
                              />
                              <IconButton
                                label={`Delete ${article.title}`}
                                icon={Trash2}
                                size="sm"
                                variant="danger"
                                onClick={() => toast.error("Article deleted")}
                              />
                              <IconButton
                                label={`More actions for ${article.title}`}
                                icon={MoreVertical}
                                size="sm"
                              />
                            </div>
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
              <div className="p-4 border-t border-[var(--st-border)] flex items-center justify-between text-sm text-[var(--st-text-secondary)]">
                <span>Showing 1 to 10 of 1,248 entries</span>
                <Pagination
                  page={page}
                  pageCount={125}
                  onPageChange={setPage}
                  size="compact"
                />
              </div>
            </>
          )}

          {activeTab === "categories" && (
            <div className="p-8 flex flex-col items-center justify-center h-full">
              <EmptyState
                icon={FolderTree}
                tone="info"
                title="Category Management"
                description="Organize your knowledge base content into a hierarchical structure to help users find information easily."
                action={
                  <Button
                    variant="primary"
                    iconLeft={Plus}
                    onClick={() => toast.success("New root category created")}
                  >
                    Add Root Category
                  </Button>
                }
              />
            </div>
          )}

          {activeTab === "settings" && (
            <div className="p-8 overflow-auto h-full">
              <h2 className="text-xl font-bold text-[var(--st-text)] mb-6 pb-4 border-b border-[var(--st-border)]">
                Knowledge Base Settings
              </h2>

              <div className="space-y-8 max-w-3xl">
                {/* General Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider">
                    General
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Portal Name">
                      <Input defaultValue="SabDesk Help Center" />
                    </Field>
                    <Field label="Support Email">
                      <Input type="email" defaultValue="support@sabdesk.com" />
                    </Field>
                  </div>
                </div>

                {/* Appearance */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider">
                    Appearance
                  </h3>
                  <Card>
                    <div className="space-y-4">
                      <div>
                        <span className="block text-sm font-medium text-[var(--st-text)] mb-2">
                          Primary Color
                        </span>
                        <div className="flex items-center gap-3">
                          {[
                            "var(--st-accent)",
                            "#06b6d4",
                            "#f43f5e",
                            "#10b981",
                            "#f59e0b",
                          ].map((color, idx) => (
                            <IconButton
                              key={color}
                              label={`Select color ${idx + 1}`}
                              icon={idx === 0 ? CheckCircle2 : Folder}
                              variant="ghost"
                              className="rounded-full border-2 border-[var(--st-border)]"
                              style={{ background: color, color: "#fff" }}
                            />
                          ))}
                          <IconButton
                            label="Add custom color"
                            icon={Plus}
                            variant="outline"
                            className="rounded-full border-2 border-dashed"
                          />
                        </div>
                      </div>
                      <Field label="Logo">
                        <div className="flex items-center gap-3">
                          <SabFilePickerButton
                            accept="image"
                            onPick={(pick) => {
                              setLogoName(pick.name);
                              toast.success(`Logo "${pick.name}" attached`);
                            }}
                          >
                            <Plus size={14} /> Upload Logo
                          </SabFilePickerButton>
                          <span className="text-xs text-[var(--st-text-tertiary)]">
                            {logoName ?? "PNG, JPG, SVG up to 2MB"}
                          </span>
                        </div>
                      </Field>
                    </div>
                  </Card>
                </div>

                {/* Access Control */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider">
                    Access Control
                  </h3>
                  <RadioGroup
                    value={accessLevel}
                    onValueChange={setAccessLevel}
                    aria-label="Access control"
                    className="space-y-3"
                  >
                    <label className="flex items-start gap-3 p-4 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] cursor-pointer hover:border-[var(--st-accent)] transition-colors">
                      <span className="mt-0.5">
                        <Radio value="public" />
                      </span>
                      <span>
                        <span className="block font-medium text-[var(--st-text)]">
                          Public Access
                        </span>
                        <span className="block text-sm text-[var(--st-text-secondary)] mt-1">
                          Anyone on the internet can view the knowledge base.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 p-4 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] cursor-pointer hover:border-[var(--st-accent)] transition-colors">
                      <span className="mt-0.5">
                        <Radio value="restricted" />
                      </span>
                      <span>
                        <span className="font-medium text-[var(--st-text)] flex items-center gap-2">
                          Restricted Access{" "}
                          <Lock className="w-3.5 h-3.5 text-[var(--st-warn)]" aria-hidden="true" />
                        </span>
                        <span className="block text-sm text-[var(--st-text-secondary)] mt-1">
                          Only authenticated users can access the knowledge base.
                        </span>
                      </span>
                    </label>
                  </RadioGroup>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-[var(--st-border)]">
                  <Button variant="ghost" onClick={() => setActiveTab("articles")}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    iconLeft={Save}
                    onClick={() => toast.success("Settings saved")}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Editor Modal / Fullscreen Overlay */}
      {isEditorOpen && (
        <div className="ui20 dark fixed inset-0 z-50 bg-[var(--st-bg)] flex flex-col">
          {/* Editor Header */}
          <div className="h-16 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <IconButton
                label="Close editor"
                icon={ChevronRight}
                onClick={() => setIsEditorOpen(false)}
                className="rotate-180"
              />
              <span className="h-6 w-px bg-[var(--st-border)]" aria-hidden="true" />
              <span className="text-sm font-medium text-[var(--st-text-secondary)]">Editing:</span>
              <span className="text-sm font-medium text-[var(--st-text)]">New Article</span>
              <Badge tone="neutral">Draft</Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--st-text-tertiary)] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Saved just now
              </span>
              <Button variant="outline" onClick={() => toast({ title: "Opening preview", tone: "info" })}>
                Preview
              </Button>
              <Button variant="primary" onClick={() => toast.success("Article published")}>
                Publish Article
              </Button>
            </div>
          </div>

          {/* Editor Body */}
          <div className="flex-1 flex overflow-hidden">
            {/* Main Editing Area */}
            <div className="flex-1 flex flex-col border-r border-[var(--st-border)] bg-[var(--st-bg)] relative">
              {/* Toolbar */}
              <div className="h-12 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center px-4 gap-1 overflow-x-auto">
                <Select defaultValue="paragraph">
                  <SelectTrigger aria-label="Text style" className="min-w-[140px]">
                    <SelectValue placeholder="Paragraph" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paragraph">Paragraph</SelectItem>
                    <SelectItem value="h1">Heading 1</SelectItem>
                    <SelectItem value="h2">Heading 2</SelectItem>
                    <SelectItem value="h3">Heading 3</SelectItem>
                  </SelectContent>
                </Select>
                <span className="w-px h-6 bg-[var(--st-border)] mx-1" aria-hidden="true" />
                <IconButton label="Bold" icon={Bold} size="sm" />
                <IconButton label="Italic" icon={Italic} size="sm" />
                <IconButton label="Underline" icon={Underline} size="sm" />
                <span className="w-px h-6 bg-[var(--st-border)] mx-1" aria-hidden="true" />
                <IconButton label="Align left" icon={AlignLeft} size="sm" />
                <IconButton label="Align center" icon={AlignCenter} size="sm" />
                <IconButton label="Align right" icon={AlignRight} size="sm" />
                <span className="w-px h-6 bg-[var(--st-border)] mx-1" aria-hidden="true" />
                <IconButton label="Bulleted list" icon={List} size="sm" />
                <IconButton label="Numbered list" icon={ListOrdered} size="sm" />
                <span className="w-px h-6 bg-[var(--st-border)] mx-1" aria-hidden="true" />
                <IconButton label="Insert link" icon={LinkIcon} size="sm" />
                <IconButton label="Insert image" icon={ImageIcon} size="sm" />
                <IconButton label="Insert code block" icon={Code} size="sm" />
                <IconButton label="Insert quote" icon={Quote} size="sm" />
                <div className="flex-1" />
                <IconButton label="Toggle fullscreen" icon={Maximize2} size="sm" />
              </div>

              {/* Text Area */}
              <div className="flex-1 overflow-auto p-8 lg:p-12">
                <div className="max-w-4xl mx-auto space-y-8">
                  <Field label="Article title" className="m-0">
                    <Input placeholder="Article Title..." inputSize="lg" />
                  </Field>
                  <Field label="Article body" className="m-0">
                    <Textarea
                      placeholder="Start writing your article here..."
                      rows={20}
                      className="text-lg leading-relaxed"
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* Sidebar Settings */}
            <div className="w-80 bg-[var(--st-bg-secondary)] overflow-auto flex-shrink-0">
              <div className="p-6 space-y-8">
                {/* Taxonomy */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--st-text)] flex items-center gap-2 border-b border-[var(--st-border)] pb-2">
                    <Folder className="w-4 h-4 text-[var(--st-accent)]" aria-hidden="true" />{" "}
                    Organization
                  </h3>
                  <Field label="Category">
                    <Select defaultValue="">
                      <SelectTrigger aria-label="Category">
                        <SelectValue placeholder="Select a category..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="getting-started">Getting Started</SelectItem>
                        <SelectItem value="core-features">Core Features</SelectItem>
                        <SelectItem value="integrations">Integrations</SelectItem>
                        <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Tags">
                    <div className="min-h-[42px] bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)] p-1.5 flex flex-wrap items-center gap-1.5">
                      <Tag onRemove={() => toast({ title: "Tag removed", tone: "info" })}>
                        Authentication
                      </Tag>
                      <input type="hidden" name="tags" value="Authentication" />
                      <Input
                        placeholder="Add tag..."
                        className="flex-1 min-w-[80px] border-none bg-transparent"
                      />
                    </div>
                  </Field>
                </div>

                {/* Visibility */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--st-text)] flex items-center gap-2 border-b border-[var(--st-border)] pb-2">
                    <Eye className="w-4 h-4 text-[var(--st-accent)]" aria-hidden="true" /> Visibility
                    and SEO
                  </h3>
                  <Field label="Access Level">
                    <Select defaultValue="public">
                      <SelectTrigger aria-label="Access level">
                        <SelectValue placeholder="Public" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="logged-in">Logged-in Users Only</SelectItem>
                        <SelectItem value="internal">Internal Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Meta Description">
                    <Textarea rows={3} placeholder="Brief summary for search results..." />
                  </Field>
                </div>

                {/* History */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--st-text)] flex items-center gap-2 border-b border-[var(--st-border)] pb-2">
                    <History className="w-4 h-4 text-[var(--st-accent)]" aria-hidden="true" /> Revision
                    History
                  </h3>
                  <div className="space-y-3">
                    <div className="flex gap-3 relative">
                      <span
                        className="w-px h-full bg-[var(--st-border)] absolute left-1 top-2"
                        aria-hidden="true"
                      />
                      <span
                        className="w-2 h-2 rounded-full bg-[var(--st-accent)] relative z-10 mt-1.5"
                        aria-hidden="true"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-[var(--st-text)]">Current Draft</p>
                        <p className="text-xs text-[var(--st-text-tertiary)]">
                          Saved 2 mins ago by You
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 relative">
                      <span
                        className="w-2 h-2 rounded-full bg-[var(--st-text-tertiary)] relative z-10 mt-1.5"
                        aria-hidden="true"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-[var(--st-text-secondary)]">Initial Creation</p>
                        <p className="text-xs text-[var(--st-text-tertiary)]">Oct 12, 10:42 AM</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
