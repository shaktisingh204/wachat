'use client';

/**
 * Gallery of curated cross-tenant library templates. Clicking "Use"
 * forks a copy into the current user's own templates collection via
 * `actionForkLibraryTemplate`.
 */
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Copy, FileText, Sparkles } from 'lucide-react';

import { Badge, Button, Card, CardBody, CardFooter, CardHeader, CardTitle, EmptyState, toast } from '@/components/sabcrm/20ui';
import { actionForkLibraryTemplate } from '@/app/actions/email/templates.actions';
import type { EmailTemplateDoc } from '@/lib/rust-client/email-templates';

export interface LibraryGalleryProps {
  templates: EmailTemplateDoc[];
}

export function LibraryGallery({ templates }: LibraryGalleryProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles />}
        title="Library is empty"
        description="Curated templates will appear here once they're published."
      />
    );
  }

  const handleUse = (template: EmailTemplateDoc) => {
    startTransition(async () => {
      const res = await actionForkLibraryTemplate(template._id);
      if (res.ok) {
        toast({ title: 'Template added', description: `Forked "${template.name}" into your templates.` });
        router.push(`/dashboard/email/templates/${res.data._id}/builder`);
      } else {
        toast({ title: 'Could not fork', description: res.error, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {templates.map((t) => (
        <Card key={t._id} className="flex flex-col overflow-hidden">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--st-bg-muted)]">
            {t.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.thumbnailUrl}
                alt={t.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--st-text-secondary)]">
                <FileText className="h-8 w-8" />
              </div>
            )}
            <Badge variant="outline" className="absolute right-2 top-2 gap-1 bg-[var(--st-bg-secondary)]">
              <Sparkles className="h-3 w-3" /> Library
            </Badge>
          </div>
          <CardHeader>
            <CardTitle className="line-clamp-1 text-sm">{t.name}</CardTitle>
          </CardHeader>
          <CardBody className="flex-1 text-xs text-[var(--st-text-secondary)]">
            {t.category ?? 'General'}
          </CardBody>
          <CardFooter>
            <Button
              type="button"
              size="sm"
              block
              disabled={pending}
              onClick={() => handleUse(t)}
            >
              <Copy /> {pending ? 'Forking…' : 'Use'}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
