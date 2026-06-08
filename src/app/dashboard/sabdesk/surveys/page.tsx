"use client";

import React, { useState } from 'react';
import {
  PieChart, Activity, Star,
  MessageSquare, Plus, Settings, Search, Filter, Download, MoreVertical,
  CheckCircle, Clock, LayoutGrid, Type, AlignLeft, Hash,
  CheckSquare, CircleDot, Calendar, Image as ImageIcon,
  ChevronDown, ChevronRight, GripVertical, Trash2, Edit3, Copy,
  Eye, Save, Send, Bell, Target, FileText,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  StatCard,
  Field,
  Input,
  Textarea,
  Switch,
  Checkbox,
  Badge,
  EmptyState,
  SegmentedControl,
  Avatar,
  AvatarImage,
  AvatarFallback,
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';

// --- MOCK DATA ---

const METRICS_DATA = {
  nps: { value: 72, trend: '+5', previous: 67 },
  csat: { value: 94, trend: '+2', previous: 92 },
  responses: { value: 12450, trend: '+12%', previous: 11116 },
  completionRate: { value: 88, trend: '-1%', previous: 89 },
};

const RECENT_RESPONSES = Array.from({ length: 50 }).map((_, i) => ({
  id: `RESP-${1000 + i}`,
  user: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  score: ((i * 7) % 10) + 1,
  feedback: ['Great service.', 'Could be better.', 'Loved the new features.', 'Support was helpful.', 'A little pricey.'][i % 5],
  date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
  status: i % 5 === 0 ? 'Pending' : 'Reviewed',
  sentiment: (['Positive', 'Neutral', 'Negative'] as const)[i % 3],
  segment: (['Enterprise', 'SMB', 'Startup', 'Individual'])[i % 4],
}));

const SURVEY_TEMPLATES = [
  { id: 't1', name: 'Customer Satisfaction (CSAT)', uses: 1240, rating: 4.8 },
  { id: 't2', name: 'Net Promoter Score (NPS)', uses: 3500, rating: 4.9 },
  { id: 't3', name: 'Product Feedback', uses: 890, rating: 4.5 },
  { id: 't4', name: 'Employee Engagement', uses: 450, rating: 4.7 },
  { id: 't5', name: 'Onboarding Experience', uses: 670, rating: 4.6 },
];

type FormFieldType =
  | 'short_text' | 'long_text' | 'number' | 'rating' | 'nps'
  | 'multiple_choice' | 'checkboxes' | 'dropdown' | 'date' | 'image';

const FORM_ELEMENTS: Array<{ type: FormFieldType; label: string; icon: typeof Type }> = [
  { type: 'short_text', label: 'Short Text', icon: Type },
  { type: 'long_text', label: 'Long Text', icon: AlignLeft },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'rating', label: 'Rating', icon: Star },
  { type: 'nps', label: 'NPS Scale', icon: Activity },
  { type: 'multiple_choice', label: 'Multiple Choice', icon: CircleDot },
  { type: 'checkboxes', label: 'Checkboxes', icon: CheckSquare },
  { type: 'dropdown', label: 'Dropdown', icon: ChevronDown },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'image', label: 'Image Upload', icon: ImageIcon },
];

// Deterministic bar heights so the chart renders identically server/client.
const CHART_BARS = [
  { month: 'Jan', value: 42 }, { month: 'Feb', value: 58 }, { month: 'Mar', value: 35 },
  { month: 'Apr', value: 71 }, { month: 'May', value: 64 }, { month: 'Jun', value: 48 },
  { month: 'Jul', value: 82 }, { month: 'Aug', value: 76 }, { month: 'Sep', value: 55 },
  { month: 'Oct', value: 90 }, { month: 'Nov', value: 67 }, { month: 'Dec', value: 73 },
];

interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
}

type SentimentTone = 'success' | 'neutral' | 'danger';
function sentimentTone(sentiment: string): SentimentTone {
  if (sentiment === 'Positive') return 'success';
  if (sentiment === 'Neutral') return 'neutral';
  return 'danger';
}

function scoreTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 9) return 'success';
  if (score >= 7) return 'warning';
  return 'danger';
}

// --- COMPONENTS ---

function ChartMockup({ title }: { title: string }) {
  return (
    <Card variant="elevated" padding="lg" className="flex flex-col h-80">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-[var(--st-text)]">{title}</h3>
        <IconButton label="Chart options" icon={MoreVertical} />
      </div>
      <div className="flex-1 flex items-end justify-between gap-2 pb-4">
        {CHART_BARS.map((bar) => (
          <div key={bar.month} className="w-full flex flex-col justify-end items-center group">
            <div className="opacity-0 group-hover:opacity-100 text-xs text-[var(--st-text-secondary)] mb-2 transition-opacity">
              {bar.value}
            </div>
            <div
              className="w-full bg-[var(--st-accent)] rounded-t-[var(--st-radius)] transition-all duration-500 group-hover:opacity-90"
              style={{ height: `${bar.value}%` }}
            />
            <div className="mt-2 text-[10px] text-[var(--st-text-tertiary)] font-medium uppercase">
              {bar.month}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// --- MAIN PAGE COMPONENT ---

export default function SurveysFeedbackPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [responseFilter, setResponseFilter] = useState('all');

  // Form Builder State
  const [formFields, setFormFields] = useState<FormField[]>([
    { id: 'f1', type: 'nps', label: 'How likely are you to recommend us?', required: true },
    { id: 'f2', type: 'long_text', label: 'What could we do better?', required: false },
  ]);
  const [selectedField, setSelectedField] = useState<string | null>(null);

  const addFormField = (type: FormFieldType) => {
    const newField: FormField = {
      id: `f${Date.now()}`,
      type,
      label: `New ${type.replace('_', ' ')} field`,
      required: false,
    };
    setFormFields([...formFields, newField]);
    setSelectedField(newField.id);
  };

  const removeFormField = (id: string) => {
    setFormFields(formFields.filter((f) => f.id !== id));
    if (selectedField === id) setSelectedField(null);
    toast.success('Question removed');
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Net Promoter Score" value={METRICS_DATA.nps.value} icon={Activity} delta={{ value: METRICS_DATA.nps.trend, tone: 'up' }} />
        <StatCard label="Customer Satisfaction" value={`${METRICS_DATA.csat.value}%`} icon={Star} delta={{ value: METRICS_DATA.csat.trend, tone: 'up' }} />
        <StatCard label="Total Responses" value={METRICS_DATA.responses.value.toLocaleString()} icon={MessageSquare} delta={{ value: METRICS_DATA.responses.trend, tone: 'up' }} />
        <StatCard label="Completion Rate" value={`${METRICS_DATA.completionRate.value}%`} icon={CheckCircle} delta={{ value: METRICS_DATA.completionRate.trend, tone: 'down' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartMockup title="Response Volume and Sentiment Over Time" />
        </div>

        {/* Recent Activity Feed */}
        <Card variant="elevated" padding="lg" className="h-80 flex flex-col">
          <h3 className="font-semibold text-[var(--st-text)] mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" /> Recent Activity
          </h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {RECENT_RESPONSES.slice(0, 8).map((resp) => (
              <div key={resp.id} className="flex items-start gap-3 pb-3 border-b border-[var(--st-border)] last:border-0">
                <Avatar name={resp.user} size="sm" />
                <div>
                  <p className="text-sm text-[var(--st-text-secondary)]">
                    <span className="font-medium text-[var(--st-text)]">{resp.user}</span> submitted feedback
                  </p>
                  <p className="text-xs text-[var(--st-text-tertiary)] mt-1 flex items-center gap-1">
                    <Star className="w-3 h-3 text-[var(--st-warn)]" aria-hidden="true" />
                    {resp.score}/10 . {resp.sentiment}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recommended Templates */}
      <div>
        <h3 className="text-xl font-semibold text-[var(--st-text)] mb-4">Recommended Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {SURVEY_TEMPLATES.map((template) => (
            <Card
              key={template.id}
              variant="interactive"
              padding="md"
              role="button"
              tabIndex={0}
              onClick={() => toast.success(`Loaded template: ${template.name}`)}
              className="cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-accent)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" aria-hidden="true" />
              </div>
              <h4 className="text-[var(--st-text)] font-medium text-sm mb-2">{template.name}</h4>
              <div className="flex items-center justify-between text-xs text-[var(--st-text-tertiary)]">
                <span>{template.uses.toLocaleString()} uses</span>
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-[var(--st-warn)]" aria-hidden="true" /> {template.rating}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFormBuilder = () => (
    <div className="flex h-[calc(100vh-220px)] gap-6">
      {/* Sidebar Elements */}
      <Card variant="elevated" padding="none" className="w-72 flex flex-col overflow-hidden">
        <CardHeader className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
          <CardTitle>Elements</CardTitle>
        </CardHeader>
        <div className="p-4 overflow-y-auto flex-1 grid grid-cols-2 gap-3">
          {FORM_ELEMENTS.map((el) => (
            <Button
              key={el.type}
              variant="outline"
              iconLeft={el.icon}
              onClick={() => addFormField(el.type)}
              className="flex-col h-auto py-4 text-center"
            >
              {el.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Canvas */}
      <div className="flex-1 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card variant="outlined" padding="lg" className="border-t-4 border-t-[var(--st-accent)]">
            <Field label="Survey title" className="mb-4">
              <Input defaultValue="Customer Satisfaction Survey 2026" aria-label="Survey title" />
            </Field>
            <Field label="Survey description">
              <Input
                defaultValue="Please help us improve our services by providing your honest feedback."
                aria-label="Survey description"
              />
            </Field>
          </Card>

          {formFields.map((field, idx) => (
            <Card
              key={field.id}
              variant={selectedField === field.id ? 'elevated' : 'outlined'}
              padding="lg"
              onClick={() => setSelectedField(field.id)}
              className={`cursor-pointer relative group ${selectedField === field.id ? 'ring-2 ring-[var(--st-accent)]' : ''}`}
            >
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-[var(--st-bg-secondary)] rounded-full border border-[var(--st-border)] cursor-grab">
                <GripVertical className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
              </div>

              {selectedField === field.id && (
                <div className="absolute top-4 right-4 flex gap-2">
                  <IconButton label="Duplicate question" icon={Copy} variant="secondary" />
                  <IconButton
                    label="Delete question"
                    icon={Trash2}
                    variant="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFormField(field.id);
                    }}
                  />
                </div>
              )}

              <Field label="Question" className="mb-4">
                <Input
                  value={field.label}
                  aria-label="Question label"
                  onChange={(e) => {
                    const newFields = [...formFields];
                    newFields[idx] = { ...newFields[idx], label: e.target.value };
                    setFormFields(newFields);
                  }}
                />
              </Field>

              <div className="opacity-70 pointer-events-none">
                {field.type === 'short_text' && (
                  <div className="border-b border-[var(--st-border)] pb-2 text-[var(--st-text-tertiary)] w-1/2">Short answer text</div>
                )}
                {field.type === 'long_text' && (
                  <div className="border-b border-[var(--st-border)] pb-8 text-[var(--st-text-tertiary)] w-3/4">Long answer text</div>
                )}
                {field.type === 'nps' && (
                  <div className="flex justify-between items-center bg-[var(--st-bg-secondary)] p-4 rounded-[var(--st-radius)]">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <div key={n} className="w-10 h-10 rounded-full flex items-center justify-center border border-[var(--st-border)] text-[var(--st-text-secondary)] font-medium">{n}</div>
                    ))}
                  </div>
                )}
                {['multiple_choice', 'checkboxes'].includes(field.type) && (
                  <div className="space-y-3">
                    <div className="flex items-center text-[var(--st-text-tertiary)] gap-2"><CircleDot className="w-4 h-4" aria-hidden="true" /> Option 1</div>
                    <div className="flex items-center text-[var(--st-text-tertiary)] gap-2"><CircleDot className="w-4 h-4" aria-hidden="true" /> Option 2</div>
                  </div>
                )}
              </div>
            </Card>
          ))}

          <Button variant="ghost" iconLeft={Plus} block onClick={() => addFormField('short_text')} className="py-4 border border-dashed border-[var(--st-border)]">
            Add Question
          </Button>
        </div>
      </div>

      {/* Properties Panel */}
      {selectedField && (
        <Card variant="elevated" padding="none" className="w-80 flex flex-col">
          <CardHeader className="flex justify-between items-center">
            <span className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
              <CardTitle>Properties</CardTitle>
            </span>
            <IconButton label="Close properties" icon={ChevronRight} onClick={() => setSelectedField(null)} />
          </CardHeader>
          <CardBody className="space-y-6 overflow-y-auto">
            <Field label="Question Type">
              <Select defaultValue={formFields.find((f) => f.id === selectedField)?.type}>
                <SelectTrigger aria-label="Question type">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {FORM_ELEMENTS.map((el) => (
                    <SelectItem key={el.type} value={el.type}>{el.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="pt-4 border-t border-[var(--st-border)]">
              <Switch
                label="Required Field"
                defaultChecked={formFields.find((f) => f.id === selectedField)?.required}
              />
            </div>

            <div className="pt-4 border-t border-[var(--st-border)]">
              <Field label="Description (Optional)">
                <Textarea placeholder="Add helpful text..." rows={4} />
              </Field>
            </div>

            <div className="pt-4 border-t border-[var(--st-border)]">
              <Button variant="secondary" block onClick={() => toast.info('Logic jumps coming soon')}>
                Configure Logic Jumps
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );

  const renderResponses = () => (
    <Card variant="elevated" padding="none" className="overflow-hidden flex flex-col h-[calc(100vh-220px)]">
      {/* Toolbar */}
      <div className="p-4 border-b border-[var(--st-border)] flex flex-wrap gap-4 justify-between items-center">
        <div className="flex items-center gap-3">
          <Input
            iconLeft={Search}
            placeholder="Search responses..."
            aria-label="Search responses"
            className="w-64"
          />
          <SegmentedControl
            aria-label="Filter responses by sentiment"
            value={responseFilter}
            onChange={setResponseFilter}
            items={[
              { value: 'all', label: 'All' },
              { value: 'positive', label: 'Positive' },
              { value: 'negative', label: 'Negative' },
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" iconLeft={Filter} onClick={() => toast.info('Filters coming soon')}>
            Filter
          </Button>
          <Button variant="primary" iconLeft={Download} onClick={() => toast.success('Export started')}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-auto">
        <Table stickyHeader hover>
          <THead>
            <Tr>
              <Th align="center" width={48}>
                <Checkbox aria-label="Select all responses" />
              </Th>
              <Th>ID</Th>
              <Th>User</Th>
              <Th>Score</Th>
              <Th>Feedback</Th>
              <Th>Sentiment</Th>
              <Th>Segment</Th>
              <Th>Date</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {RECENT_RESPONSES.map((row) => (
              <Tr key={row.id} className="group">
                <Td align="center">
                  <Checkbox aria-label={`Select ${row.id}`} />
                </Td>
                <Td>
                  <span className="text-sm font-medium text-[var(--st-text-secondary)]">{row.id}</span>
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={row.user} size="sm" />
                    <div>
                      <div className="text-sm font-medium text-[var(--st-text)]">{row.user}</div>
                      <div className="text-xs text-[var(--st-text-tertiary)]">{row.email}</div>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge tone={scoreTone(row.score)}>{row.score}</Badge>
                </Td>
                <Td truncate className="max-w-xs">{row.feedback}</Td>
                <Td>
                  <Badge tone={sentimentTone(row.sentiment)} kind="outline">{row.sentiment}</Badge>
                </Td>
                <Td>
                  <span className="text-sm text-[var(--st-text-secondary)]">{row.segment}</span>
                </Td>
                <Td>
                  <span className="text-sm text-[var(--st-text-secondary)]">{row.date}</span>
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton label={`View ${row.id}`} icon={Eye} />
                    <IconButton label={`More actions for ${row.id}`} icon={MoreVertical} />
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
      <div className="p-4 border-t border-[var(--st-border)] flex items-center justify-between text-sm text-[var(--st-text-secondary)]">
        <span>Showing 1 to 50 of {METRICS_DATA.responses.value} entries</span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled>Prev</Button>
          <Button variant="secondary" size="sm">Next</Button>
        </div>
      </div>
    </Card>
  );

  const NAV_ITEMS = [
    { id: 'dashboard', icon: LayoutGrid, label: 'Dashboard' },
    { id: 'builder', icon: Edit3, label: 'Form Builder' },
    { id: 'responses', icon: MessageSquare, label: 'Responses & Data' },
    { id: 'analytics', icon: PieChart, label: 'Analytics' },
    { id: 'distribution', icon: Send, label: 'Distribution' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="20ui dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] flex flex-col">
      {/* Top Header */}
      <header className="h-16 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-[var(--st-accent)] rounded-[var(--st-radius)] flex items-center justify-center">
            <Target className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-[var(--st-text)]">SabDesk Surveys</h1>
          <Badge tone="accent">Enterprise</Badge>
        </div>
        <div className="flex items-center gap-4">
          <IconButton label="Notifications" icon={Bell} />
          <Avatar size="md">
            <AvatarImage src="https://i.pravatar.cc/150?img=11" alt="Your avatar" />
            <AvatarFallback>SD</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Navigation Sidebar */}
        <aside className={`bg-[var(--st-bg-secondary)] border-r border-[var(--st-border)] flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
          <nav className="p-4 flex-1 space-y-2">
            {NAV_ITEMS.map((nav) => (
              <Button
                key={nav.id}
                variant={activeTab === nav.id ? 'secondary' : 'ghost'}
                iconLeft={nav.icon}
                block
                onClick={() => setActiveTab(nav.id)}
                aria-current={activeTab === nav.id ? 'page' : undefined}
                title={!sidebarOpen ? nav.label : undefined}
                className={`justify-start ${activeTab === nav.id ? 'text-[var(--st-accent)]' : ''}`}
              >
                {sidebarOpen ? nav.label : ''}
              </Button>
            ))}
          </nav>

          <div className="p-4 border-t border-[var(--st-border)]">
            <IconButton
              label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              icon={ChevronRight}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={sidebarOpen ? 'rotate-180' : ''}
            />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col bg-[var(--st-bg)]">
          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            {/* Contextual Header based on active tab */}
            <PageHeader className="mb-8">
              <PageHeaderHeading>
                <PageTitle className="capitalize">{activeTab.replace('_', ' ')}</PageTitle>
                <PageDescription>
                  {activeTab === 'dashboard' && 'Overview of your survey performance and recent activity.'}
                  {activeTab === 'builder' && 'Design and customize your survey forms visually.'}
                  {activeTab === 'responses' && 'Analyze and manage individual survey submissions.'}
                </PageDescription>
              </PageHeaderHeading>

              {activeTab === 'builder' && (
                <PageActions>
                  <Button variant="secondary" iconLeft={Eye} onClick={() => toast.info('Opening preview')}>
                    Preview
                  </Button>
                  <Button variant="primary" iconLeft={Save} onClick={() => toast.success('Form saved')}>
                    Save Form
                  </Button>
                </PageActions>
              )}
            </PageHeader>

            {/* Content Renderers */}
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'builder' && renderFormBuilder()}
            {activeTab === 'responses' && renderResponses()}

            {/* Placeholders for other tabs */}
            {['analytics', 'distribution', 'settings'].includes(activeTab) && (
              <EmptyState
                icon={Settings}
                title="Module Under Construction"
                description="This specialized view is being rendered by other modules in the SabDesk architecture."
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
