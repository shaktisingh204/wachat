'use client';

import { useState, useEffect } from 'react';
import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, Input, Label, PageDescription, PageHeader, PageHeading, PageTitle, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
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
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');

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
    setFormStartDate('');
    setFormEndDate('');
    setShowForm(false);
  };

  const handleCreate = () => {
    if (!formName.trim()) {
      toast({ title: 'Name required', description: 'Please enter a campaign name.', variant: 'destructive' });
      return;
    }
    const next: Campaign = {
      id: crypto.randomUUID(),
      name: formName.trim(),
      description: formDescription.trim(),
      qrCodeIds: [],
      startDate: formStartDate,
      endDate: formEndDate,
      createdAt: new Date().toISOString(),
    };
    persist([next, ...campaigns]);
    resetForm();
    toast({ title: 'Campaign created' });
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
        <PageHeader>
          <PageHeading>
            <PageTitle>Campaigns</PageTitle>
            <PageDescription>
              Group QR codes together for unified analytics.
            </PageDescription>
          </PageHeading>
        </PageHeader>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />
          New Campaign
        </Button>
      </div>

      {showForm ? (
        <Card className="p-5 space-y-4">
          <h3 className="text-[14px] text-[var(--st-text)]">Create Campaign</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-[var(--st-text-secondary)]">Name</Label>
              <Input
                placeholder="e.g., Summer 2026"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-[var(--st-text-secondary)]">Description (Optional)</Label>
              <Textarea
                placeholder="What is this campaign about?"
                value={formDescription}
                rows={1}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-[var(--st-text-secondary)]">Start Date (Optional)</Label>
              <input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="flex h-9 w-full rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 text-[13px] text-[var(--st-text)] focus:outline-none focus:border-[var(--st-text)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-[var(--st-text-secondary)]">End Date (Optional)</Label>
              <input
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                className="flex h-9 w-full rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 text-[13px] text-[var(--st-text)] focus:outline-none focus:border-[var(--st-text)]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={handleCreate}>Create</Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>
        </Card>
      ) : null}

      {campaigns.length === 0 && !showForm ? (
        <Card className="p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
            <Megaphone className="h-5 w-5" />
          </div>
          <p className="text-sm text-[var(--st-text)]">No campaigns yet</p>
          <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
            Group your QR codes into campaigns to track performance together.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" />
            Create your first campaign
          </Button>
        </Card>
      ) : campaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => {
            const start = formatDate(c.startDate);
            const end = formatDate(c.endDate);
            return (
              <Card key={c.id} className="p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[var(--st-text)] truncate">{c.name}</p>
                    {c.description ? (
                      <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)] line-clamp-2">{c.description}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="rounded p-1.5 text-[var(--st-text-secondary)] hover:bg-[var(--st-danger)]/10 hover:text-[var(--st-danger)] shrink-0"
                    aria-label="Delete campaign"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[11px]">
                    {c.qrCodeIds.length} QR code{c.qrCodeIds.length !== 1 ? 's' : ''}
                  </Badge>
                  {start || end ? (
                    <Badge variant="ghost" className="text-[11px]">
                      {start ?? '…'} → {end ?? '…'}
                    </Badge>
                  ) : null}
                </div>

                <Button size="sm" variant="outline" className="mt-auto w-full">
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
