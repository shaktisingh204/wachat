'use client';

import { useState, useEffect } from 'react';
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardHeader,
  CardTitle,
  DatePicker,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import { Plus, Trash2, Megaphone } from 'lucide-react';

const STORAGE_KEY = 'qr-campaigns';

type Campaign = {
  id: string;
  name: string;
  description: string;
  qrCodeIds: string[];
  startDate: string;
  endDate: string;
  createdAt: string;
};

export default function QrCampaignsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartDate, setFormStartDate] = useState<Date | undefined>(undefined);
  const [formEndDate, setFormEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setCampaigns(raw ? JSON.parse(raw) : []);
    } catch { /* ignore */ }
  }, []);

  const persist = (next: Campaign[]) => {
    setCampaigns(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormStartDate(undefined);
    setFormEndDate(undefined);
    setShowForm(false);
  };

  const handleCreate = () => {
    if (!formName.trim()) {
      toast({ title: 'Name required', description: 'Please enter a campaign name.', tone: 'danger' });
      return;
    }
    const next: Campaign = {
      id: crypto.randomUUID(),
      name: formName.trim(),
      description: formDescription.trim(),
      qrCodeIds: [],
      startDate: formStartDate ? formStartDate.toISOString() : '',
      endDate: formEndDate ? formEndDate.toISOString() : '',
      createdAt: new Date().toISOString(),
    };
    persist([next, ...campaigns]);
    resetForm();
    toast({ title: 'Campaign created', tone: 'success' });
  };

  const handleDelete = (id: string) => {
    persist(campaigns.filter((c) => c.id !== id));
    toast({ title: 'Campaign deleted' });
  };

  const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString() : null);

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/qr-code-maker">QR Code Maker</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Campaigns</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader bordered={false}>
          <PageHeading>
            <PageTitle>Campaigns</PageTitle>
            <PageDescription>
              Group QR codes together for unified analytics.
            </PageDescription>
          </PageHeading>
        </PageHeader>
        <Button size="sm" iconLeft={Plus} onClick={() => setShowForm((v) => !v)}>
          New Campaign
        </Button>
      </div>

      {showForm ? (
        <Card padding="lg" className="space-y-4">
          <CardHeader>
            <CardTitle>Create Campaign</CardTitle>
          </CardHeader>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Name">
              <Input
                placeholder="e.g., Summer 2026"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </Field>
            <Field label="Description (Optional)">
              <Textarea
                placeholder="What is this campaign about?"
                value={formDescription}
                rows={1}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </Field>
            <Field label="Start Date (Optional)">
              <DatePicker
                value={formStartDate}
                onChange={setFormStartDate}
                placeholder="Pick a start date"
              />
            </Field>
            <Field label="End Date (Optional)">
              <DatePicker
                value={formEndDate}
                onChange={setFormEndDate}
                placeholder="Pick an end date"
              />
            </Field>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" variant="primary" onClick={handleCreate}>Create</Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>
        </Card>
      ) : null}

      {campaigns.length === 0 && !showForm ? (
        <Card padding="lg">
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Group your QR codes into campaigns to track performance together."
            action={
              <Button size="sm" iconLeft={Plus} variant="primary" onClick={() => setShowForm(true)}>
                Create your first campaign
              </Button>
            }
          />
        </Card>
      ) : campaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => {
            const start = formatDate(c.startDate);
            const end = formatDate(c.endDate);
            return (
              <Card key={c.id} padding="lg" className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[var(--st-text)] truncate">{c.name}</p>
                    {c.description ? (
                      <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)] line-clamp-2">{c.description}</p>
                    ) : null}
                  </div>
                  <IconButton
                    icon={Trash2}
                    label="Delete campaign"
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(c.id)}
                    className="shrink-0"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral" kind="outline">
                    {c.qrCodeIds.length} QR code{c.qrCodeIds.length !== 1 ? 's' : ''}
                  </Badge>
                  {start || end ? (
                    <Badge tone="neutral" kind="soft">
                      {start ?? 'Open'} to {end ?? 'Open'}
                    </Badge>
                  ) : null}
                </div>

                <Button size="sm" variant="outline" block className="mt-auto">
                  View
                </Button>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
