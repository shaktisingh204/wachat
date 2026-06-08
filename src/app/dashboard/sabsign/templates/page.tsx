'use client';

import React, { useState, useMemo } from 'react';
import {
  Search, Plus, Filter, LayoutGrid, List as ListIcon,
  MoreVertical, FileSignature, FileText, Users, Clock,
  Tag as TagIcon, Settings, Eye, FolderOpen,
  Shield, ChevronLeft, ChevronRight, Star,
  FileCheck, History, UploadCloud, Zap, AlertCircle,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Badge,
  Tag,
  Card,
  CardBody,
  Field,
  Input,
  Textarea,
  Checkbox,
  Modal,
  EmptyState,
  Spinner,
  SegmentedControl,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';

// --- Types & Interfaces ---
interface Role {
  id: string;
  name: string;
  description: string;
  tone: BadgeTone;
  required: boolean;
}

interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  roles: Role[];
  pages: number;
  lastUpdated: string;
  creator: string;
  isFavorite: boolean;
  status: 'active' | 'draft' | 'archived';
  usageCount: number;
  thumbnailUrl: string;
}

// --- Mock Data ---
const CATEGORIES = ['All', 'Human Resources', 'Sales', 'Legal', 'Operations', 'Finance', 'Real Estate', 'IT'];
const TAGS = ['NDA', 'Onboarding', 'Contract', 'Offer Letter', 'Invoice', 'Policy', 'Agreement', 'Lease', 'Compliance'];

// Roles cycle through Badge tones so colour only ever carries meaning, not decoration.
const ROLE_TONES: BadgeTone[] = ['info', 'success', 'accent', 'warning', 'danger'];

// --- Wizard Modal Component ---
function UseTemplateWizard({ template, onClose }: { template: Template; onClose: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [recipients, setRecipients] = useState<Record<string, { name: string; email: string }>>({});

  const steps = [
    { num: 1, title: 'Assign Roles', icon: Users, desc: 'Map roles to recipients' },
    { num: 2, title: 'Envelope Settings', icon: Settings, desc: 'Subject, expiration' },
    { num: 3, title: 'Review & Send', icon: FileSignature, desc: 'Final checks' },
  ];

  const handleSend = () => {
    toast.success(`Envelope for "${template.title}" sent to recipients.`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-[var(--st-accent)]" aria-hidden="true" />
          Use Template: {template.title}
        </span>
      }
      description="Configure recipients and envelope settings"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <div className="flex gap-3">
            {step > 1 && (
              <Button variant="secondary" iconLeft={ChevronLeft} onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button variant="primary" iconRight={ChevronRight} onClick={() => setStep(step + 1)}>
                Continue
              </Button>
            ) : (
              <Button variant="primary" iconLeft={UploadCloud} onClick={handleSend}>
                Send Envelope
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex gap-8">
        {/* Sidebar Steps */}
        <ol className="hidden w-56 shrink-0 flex-col gap-6 md:flex">
          {steps.map((s) => {
            const StepIcon = s.icon;
            const active = step === s.num;
            const done = step > s.num;
            return (
              <li key={s.num} className={`flex gap-3 transition-opacity ${active ? 'opacity-100' : 'opacity-50'}`}>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                    active
                      ? 'border-[var(--st-accent)] bg-[var(--st-accent)] text-[var(--st-text-inverted)]'
                      : done
                        ? 'border-[var(--st-status-ok)] bg-[var(--st-bg-secondary)] text-[var(--st-status-ok)]'
                        : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]'
                  }`}
                  aria-hidden="true"
                >
                  {done ? <FileCheck className="h-4 w-4" /> : s.num}
                </span>
                <span className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--st-text)]">
                    <StepIcon className="h-3.5 w-3.5" aria-hidden="true" /> {s.title}
                  </span>
                  <span className="mt-0.5 text-xs text-[var(--st-text-tertiary)]">{s.desc}</span>
                </span>
              </li>
            );
          })}
        </ol>

        {/* Main Content Area */}
        <div className="min-w-0 flex-1">
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium text-[var(--st-text)]">Assign Recipients to Roles</h3>
                <Badge tone="accent">{template.roles.length} Required Roles</Badge>
              </div>

              {template.roles.map((role) => (
                <Card key={role.id} variant="outlined" padding="md" className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={role.tone}>{role.name}</Badge>
                      {role.description ? (
                        <span className="text-sm text-[var(--st-text-secondary)]">{role.description}</span>
                      ) : null}
                    </div>
                    {role.required && (
                      <span className="flex items-center gap-1 text-xs text-[var(--st-danger)]">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" /> Required
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Full Name">
                      <Input
                        type="text"
                        placeholder="John Doe"
                        value={recipients[role.id]?.name || ''}
                        onChange={(e) =>
                          setRecipients({ ...recipients, [role.id]: { ...recipients[role.id], name: e.target.value } })
                        }
                      />
                    </Field>
                    <Field label="Email Address">
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        value={recipients[role.id]?.email || ''}
                        onChange={(e) =>
                          setRecipients({ ...recipients, [role.id]: { ...recipients[role.id], email: e.target.value } })
                        }
                      />
                    </Field>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-base font-medium text-[var(--st-text)]">Envelope Settings</h3>

              <Field label="Email Subject">
                <Input type="text" defaultValue={`Please sign: ${template.title}`} />
              </Field>

              <Field label="Email Message (Optional)">
                <Textarea rows={4} placeholder="Add a personalized message for the recipients..." />
              </Field>

              <div className="grid grid-cols-1 gap-6 pt-2 sm:grid-cols-2">
                <Card variant="outlined" padding="md">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]" aria-hidden="true">
                      <Clock className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-[var(--st-text)]">Expiration</h4>
                      <p className="mt-1 text-xs text-[var(--st-text-secondary)]">Envelope expires in</p>
                      <div className="mt-2">
                        <Select defaultValue="7">
                          <SelectTrigger aria-label="Expiration period">
                            <SelectValue placeholder="Pick a period" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">7 days</SelectItem>
                            <SelectItem value="14">14 days</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card variant="outlined" padding="md">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-status-ok)]" aria-hidden="true">
                      <Shield className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-[var(--st-text)]">Authentication</h4>
                      <p className="mt-1 text-xs text-[var(--st-text-secondary)]">Require extra verification</p>
                      <div className="mt-2">
                        <Select defaultValue="none">
                          <SelectTrigger aria-label="Authentication method">
                            <SelectValue placeholder="Pick a method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None (Email link only)</SelectItem>
                            <SelectItem value="code">Access Code</SelectItem>
                            <SelectItem value="sms">SMS OTP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex flex-col items-center border-b border-[var(--st-border)] pb-6 text-center">
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--st-radius-lg)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]" aria-hidden="true">
                  <FileCheck className="h-8 w-8" />
                </span>
                <h3 className="text-lg font-semibold text-[var(--st-text)]">Ready to Send</h3>
                <p className="mt-2 max-w-sm text-sm text-[var(--st-text-secondary)]">
                  Please review the details below. Once sent, all recipients will be notified in sequence.
                </p>
              </div>

              <Card variant="outlined" padding="md">
                <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)]">
                  Recipients Summary
                </h4>
                <div className="space-y-3">
                  {template.roles.map((role, idx) => (
                    <div key={role.id} className="flex items-center gap-4">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-xs font-medium text-[var(--st-text-secondary)]" aria-hidden="true">
                        {idx + 1}
                      </span>
                      <div className="flex flex-1 items-center justify-between gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium text-[var(--st-text)]">
                            {recipients[role.id]?.name || 'Not provided'}
                          </span>
                          <span className="truncate text-xs text-[var(--st-text-tertiary)]">
                            {recipients[role.id]?.email || 'No email'}
                          </span>
                        </div>
                        <Badge tone={role.tone}>{role.name}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// --- Main Page Component ---
export default function SabSignTemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTemplateModal, setActiveTemplateModal] = useState<Template | null>(null);

  React.useEffect(() => {
    import('@/app/actions/sabsign.actions').then(({ listTemplates }) => {
      listTemplates({ limit: 100 }).then((res) => {
        const mapped = res.items.map((doc: any, i: number) => ({
          id: doc._id,
          title: doc.name || 'Untitled Template',
          description: doc.description || 'No description provided.',
          category: 'All', // Since categories aren't strictly stored in doc yet
          tags: [],
          roles: (doc.recipientSlots || []).map((slot: any, idx: number) => ({
            id: `role-${idx}`,
            name: slot.label || slot.role || `Role ${idx + 1}`,
            description: slot.role || '',
            tone: ROLE_TONES[idx % ROLE_TONES.length],
            required: true,
          })),
          pages: 1,
          lastUpdated: doc.updatedAt || doc.createdAt,
          creator: doc.userId || 'System',
          isFavorite: false,
          status: doc.status || 'active',
          usageCount: 0,
          thumbnailUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${i}&backgroundColor=121214&shape1Color=3f3f46`,
        }));
        setTemplates(mapped);
        setLoading(false);
      }).catch((err) => {
        console.error('Failed to list templates', err);
        toast.error('Failed to load templates.');
        setLoading(false);
      });
    });
  }, [toast]);

  // Filter Logic
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesSearch =
        tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = activeCategory === 'All' || tpl.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, activeCategory]);

  return (
    <div className="20ui dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      {/* Top Header Section */}
      <div className="sticky top-0 z-30 border-b border-[var(--st-border)] bg-[var(--st-bg)]/85 px-8 py-5 backdrop-blur-xl">
        <div className="mx-auto max-w-[1600px]">
          <PageHeader bordered={false}>
            <PageHeaderHeading>
              <PageTitle>Templates Catalog</PageTitle>
              <PageDescription>
                Manage, share, and launch workflows from standardized document templates.
              </PageDescription>
            </PageHeaderHeading>

            <PageActions>
              <Input
                type="search"
                aria-label="Search templates"
                iconLeft={Search}
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-72"
              />
              <Button variant="secondary" iconLeft={UploadCloud} onClick={() => toast.info('Import is coming soon.')}>
                Import
              </Button>
              <Button variant="primary" iconLeft={Plus} onClick={() => toast.info('Template creator is coming soon.')}>
                Create New Template
              </Button>
            </PageActions>
          </PageHeader>
        </div>
      </div>

      {/* Main Layout Area */}
      <main className="mx-auto flex max-w-[1600px] gap-8 px-8 py-8">
        {/* Left Sidebar Filters */}
        <aside className="hidden w-64 shrink-0 space-y-8 lg:block">
          {/* Categories */}
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)]">
              <FolderOpen className="h-4 w-4" aria-hidden="true" /> Categories
            </h2>
            <div className="flex flex-col gap-1">
              {CATEGORIES.map((category) => {
                const count = category === 'All' ? templates.length : templates.filter((t) => t.category === category).length;
                return (
                  <Button
                    key={category}
                    variant={activeCategory === category ? 'secondary' : 'ghost'}
                    block
                    className="justify-between"
                    onClick={() => setActiveCategory(category)}
                    aria-pressed={activeCategory === category}
                  >
                    <span>{category}</span>
                    <span className="text-xs text-[var(--st-text-tertiary)]">{count}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)]">
              <TagIcon className="h-4 w-4" aria-hidden="true" /> Popular Tags
            </h2>
            <div className="flex flex-wrap gap-2">
              {TAGS.slice(0, 15).map((tag) => (
                <Tag key={tag} onClick={() => setSearchQuery(tag)}>{tag}</Tag>
              ))}
            </div>
          </div>

          {/* Quick Filters */}
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)]">
              <Filter className="h-4 w-4" aria-hidden="true" /> Quick Filters
            </h2>
            <div className="flex flex-col gap-2">
              <Checkbox label="My Templates" />
              <Checkbox
                label={
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-[var(--st-warn)]" aria-hidden="true" /> Favorites
                  </span>
                }
              />
              <Checkbox label="Recently Updated" />
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="min-w-0 flex-1">
          {/* Controls Bar */}
          <Card variant="outlined" padding="sm" className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4 px-2 text-sm text-[var(--st-text-secondary)]">
              <span>
                Showing <strong className="text-[var(--st-text)]">{filteredTemplates.length}</strong> templates
              </span>
            </div>

            <SegmentedControl
              aria-label="View mode"
              value={viewMode}
              onChange={setViewMode}
              items={[
                { value: 'grid', label: 'Grid', icon: LayoutGrid },
                { value: 'list', label: 'List', icon: ListIcon },
              ]}
            />
          </Card>

          {/* Templates Display */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Spinner size="lg" label="Loading templates" />
              <p className="mt-4 text-sm text-[var(--st-text-secondary)]">Loading templates...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No templates found"
              description="Try adjusting your search queries, or clear your filters to see the full catalog of templates."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('All');
                  }}
                >
                  Clear Filters
                </Button>
              }
            />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTemplates.map((template) => (
                <Card key={template.id} variant="interactive" padding="none" className="flex flex-col overflow-hidden">
                  {/* Thumbnail Area */}
                  <div className="relative flex h-40 items-center justify-center overflow-hidden border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                    <img
                      src={template.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover opacity-40 mix-blend-luminosity"
                    />

                    {/* Status Badges */}
                    <div className="absolute left-3 top-3 flex flex-col gap-2">
                      {template.status === 'draft' && <Badge tone="warning">Draft</Badge>}
                      {template.status === 'archived' && <Badge tone="danger">Archived</Badge>}
                    </div>

                    <div className="absolute right-3 top-3">
                      <IconButton label="Template actions" icon={MoreVertical} size="sm" variant="secondary" />
                    </div>

                    <div className="absolute bottom-3 left-3">
                      <Badge tone="neutral" dot={false}>
                        <FileText className="h-3 w-3 text-[var(--st-accent)]" aria-hidden="true" /> {template.pages} pages
                      </Badge>
                    </div>
                  </div>

                  {/* Body Info */}
                  <CardBody className="flex flex-1 flex-col">
                    <h3 className="mb-2 line-clamp-2 font-medium leading-tight text-[var(--st-text)]" title={template.title}>
                      {template.title}
                    </h3>

                    <p className="mb-4 line-clamp-2 flex-1 text-xs text-[var(--st-text-secondary)]">
                      {template.description}
                    </p>

                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {template.roles.slice(0, 3).map((role) => (
                        <Badge key={role.id} tone={role.tone}>{role.name}</Badge>
                      ))}
                      {template.roles.length > 3 && (
                        <Badge tone="neutral">+{template.roles.length - 3} more</Badge>
                      )}
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-[var(--st-border)] pt-4 text-xs text-[var(--st-text-tertiary)]">
                      <span className="flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5" aria-hidden="true" />
                        {new Date(template.lastUpdated).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-[var(--st-accent)]" aria-hidden="true" />
                        {template.usageCount} uses
                      </span>
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <Button variant="primary" block iconLeft={Zap} onClick={() => setActiveTemplateModal(template)}>
                        Use Template
                      </Button>
                      <Button variant="secondary" block iconLeft={Eye} onClick={() => toast.info('Role preview is coming soon.')}>
                        Preview Roles
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : (
            // Detailed List View
            <Card variant="outlined" padding="none" className="overflow-hidden">
              <Table>
                <THead>
                  <Tr>
                    <Th>Template Name</Th>
                    <Th>Category</Th>
                    <Th>Roles Defined</Th>
                    <Th>Last Updated</Th>
                    <Th>Usage</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {filteredTemplates.map((template) => (
                    <Tr key={template.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]" aria-hidden="true">
                            <FileSignature className="h-5 w-5 text-[var(--st-accent)]" />
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium text-[var(--st-text)]">{template.title}</div>
                            <div className="w-64 truncate text-xs text-[var(--st-text-tertiary)]">{template.description}</div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone="neutral">{template.category}</Badge>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          {template.roles.slice(0, 4).map((r) => (
                            <Badge key={r.id} tone={r.tone}>{r.name}</Badge>
                          ))}
                          {template.roles.length > 4 && (
                            <Badge tone="neutral">+{template.roles.length - 4}</Badge>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <span className="text-[var(--st-text-secondary)]">
                          {new Date(template.lastUpdated).toLocaleDateString()}
                        </span>
                      </Td>
                      <Td>
                        <span className="flex items-center gap-2 text-[var(--st-text-secondary)]">
                          <Zap className="h-4 w-4 text-[var(--st-status-ok)]" aria-hidden="true" />
                          {template.usageCount}
                        </span>
                      </Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-2">
                          <IconButton label="Preview template" icon={Eye} size="sm" onClick={() => toast.info('Preview is coming soon.')} />
                          <Button variant="primary" size="sm" onClick={() => setActiveTemplateModal(template)}>
                            Use
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </Card>
          )}
        </div>
      </main>

      {/* Wizard Modal */}
      {activeTemplateModal && (
        <UseTemplateWizard template={activeTemplateModal} onClose={() => setActiveTemplateModal(null)} />
      )}
    </div>
  );
}
