import { Button } from '@/components/ui/button';
import { TemplateCard } from '@/components/wabasimplify/template-card';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Message Templates | WABASimplify',
};

const templates = [
  {
    name: 'Appointment Reminder',
    category: 'Utility',
    body: 'Hi {{1}}, this is a reminder for your appointment on {{2}} at {{3}}. Please reply YES to confirm.',
  },
  {
    name: 'Order Confirmation',
    category: 'Utility',
    body: 'Your order #{{1}} has been confirmed! We will notify you once it ships. Thank you for shopping with us!',
  },
  {
    name: 'Weekly Newsletter',
    category: 'Marketing',
    body: "This week's top deals are here! Don't miss out on our exclusive offers. Tap here: {{1}}",
  },
  {
    name: 'Account Alert',
    category: 'Authentication',
    body: 'A new device has signed into your account. If this wasn\'t you, please secure your account immediately.',
  },
   {
    name: 'Feedback Request',
    category: 'Marketing',
    body: 'Thanks for your recent purchase! We\'d love to hear your feedback. Please take a moment to review: {{1}}',
  },
  {
    name: 'Shipping Update',
    category: 'Utility',
    body: 'Good news! Your order #{{1}} has shipped and is on its way. Track it here: {{2}}',
  },
];

export default function TemplatesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Message Templates</h1>
          <p className="text-muted-foreground">Create and manage your WhatsApp message templates.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/templates/create">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Template
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template, index) => (
          <TemplateCard key={index} {...template} />
        ))}
      </div>
    </div>
  );
}
