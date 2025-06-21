import { Button } from '@/components/ui/button';
import { TemplateCard } from '@/components/wabasimplify/template-card';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { connectToDatabase } from '@/lib/mongodb';
import { WithId } from 'mongodb';

export const metadata: Metadata = {
  title: 'Message Templates | WABASimplify',
};

type Template = {
  name: string;
  category: string;
  body: string;
};

async function getTemplates(): Promise<WithId<Template>[]> {
  try {
    const { db } = await connectToDatabase();
    const templates = await db.collection<Template>('templates').find({}).toArray();
    return templates;
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return [];
  }
}

export default async function TemplatesPage() {
  const templates = await getTemplates();

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
      
      {templates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template._id.toString()}
              name={template.name}
              category={template.category}
              body={template.body}
            />
          ))}
        </div>
      ) : (
        <div className="md:col-span-3">
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-20 text-center">
            <h3 className="text-xl font-semibold">No Templates Yet</h3>
            <p className="text-muted-foreground mt-2">
              Click "Create New Template" to get started.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
