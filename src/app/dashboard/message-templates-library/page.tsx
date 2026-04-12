'use client';

/**
 * Wachat Message Templates Library — browse premade template categories.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuBookOpen, LuCopy, LuCheck } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

const TEMPLATES = [
  { id: '1', name: 'Welcome Greeting', category: 'Welcome', preview: 'Hi {{name}}! Welcome to {{business}}. We are excited to have you on board. How can we help you today?' },
  { id: '2', name: 'New Customer Intro', category: 'Welcome', preview: 'Hello {{name}}, thanks for reaching out to us! Our team is here to assist you with anything you need.' },
  { id: '3', name: 'Order Confirmation', category: 'Order Updates', preview: 'Your order #{{order_id}} has been confirmed and is being processed. Estimated delivery: {{date}}.' },
  { id: '4', name: 'Shipping Update', category: 'Order Updates', preview: 'Great news! Your order #{{order_id}} has been shipped. Track it here: {{tracking_link}}' },
  { id: '5', name: 'Appointment Reminder', category: 'Appointment', preview: 'Reminder: You have an appointment on {{date}} at {{time}}. Reply YES to confirm or NO to reschedule.' },
  { id: '6', name: 'Appointment Confirmed', category: 'Appointment', preview: 'Your appointment on {{date}} at {{time}} has been confirmed. We look forward to seeing you!' },
  { id: '7', name: 'Payment Received', category: 'Payment', preview: 'We have received your payment of {{amount}}. Transaction ID: {{txn_id}}. Thank you!' },
  { id: '8', name: 'Payment Reminder', category: 'Payment', preview: 'Hi {{name}}, this is a reminder that your payment of {{amount}} is due on {{date}}. Please pay to avoid late fees.' },
  { id: '9', name: 'Support Ticket Created', category: 'Support', preview: 'Your support ticket #{{ticket_id}} has been created. Our team will get back to you within 24 hours.' },
  { id: '10', name: 'Issue Resolved', category: 'Support', preview: 'Your support ticket #{{ticket_id}} has been resolved. Please let us know if you need further assistance.' },
  { id: '11', name: 'Back in Stock', category: 'Order Updates', preview: 'Good news! {{product_name}} is back in stock. Order now before it sells out again: {{link}}' },
  { id: '12', name: 'Booking Follow-up', category: 'Appointment', preview: 'Thank you for visiting us on {{date}}. We hope you had a great experience. Please rate us: {{link}}' },
];

const CATEGORIES = ['All', 'Welcome', 'Order Updates', 'Appointment', 'Payment', 'Support'];
const CATEGORY_COLORS: Record<string, string> = {
  Welcome: 'bg-emerald-100 text-emerald-700',
  'Order Updates': 'bg-blue-100 text-blue-700',
  Appointment: 'bg-violet-100 text-violet-700',
  Payment: 'bg-amber-100 text-amber-700',
  Support: 'bg-rose-100 text-rose-700',
};

export default function MessageTemplatesLibraryPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = activeCategory === 'All'
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === activeCategory);

  const handleCopy = async (template: typeof TEMPLATES[0]) => {
    await navigator.clipboard.writeText(template.preview);
    setCopiedId(template.id);
    toast({ title: 'Copied', description: `"${template.name}" copied to clipboard.` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Template Library' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Message Templates Library</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Browse premade templates by category. Click &quot;Use Template&quot; to copy to clipboard.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <ClayButton key={cat} variant={activeCategory === cat ? 'obsidian' : 'pill'} size="sm" onClick={() => setActiveCategory(cat)}>
            {cat}
          </ClayButton>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <ClayCard key={t.id} padded={false} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-[15px] font-semibold text-clay-ink">{t.name}</h3>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_COLORS[t.category] || ''}`}>
                {t.category}
              </span>
            </div>
            <p className="flex-1 text-[12.5px] text-clay-ink-muted leading-relaxed">{t.preview}</p>
            <div className="mt-4">
              <ClayButton size="sm" variant="pill" onClick={() => handleCopy(t)}
                leading={copiedId === t.id
                  ? <LuCheck className="h-3.5 w-3.5 text-emerald-600" />
                  : <LuCopy className="h-3.5 w-3.5" />}
              >
                {copiedId === t.id ? 'Copied!' : 'Use Template'}
              </ClayButton>
            </div>
          </ClayCard>
        ))}
      </div>

      {filtered.length === 0 && (
        <ClayCard className="p-12 text-center">
          <LuBookOpen className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No templates in this category.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
