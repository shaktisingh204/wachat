import { CreateTemplateForm } from '@/components/wabasimplify/create-template-form';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Template | WABASimplify',
};

export default function CreateTemplatePage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-4">
          <Link href="/dashboard/templates">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Templates
          </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline">Create New Message Template</h1>
        <p className="text-muted-foreground">Design your template and get AI-powered content suggestions.</p>
      </div>

      <CreateTemplateForm />
    </div>
  );
}
