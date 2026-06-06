'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Pencil, Trash2, FilePlus } from 'lucide-react';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, useToast } from '@/components/sabcrm/20ui/compat';
import {
  deleteContractTemplate,
  saveContractTemplate,
} from '@/app/actions/worksuite/contracts-ext.actions';

interface TemplateDetailActionsProps {
  templateId: string;
  name: string;
  body: string;
}

export function TemplateDetailActions({
  templateId,
  name,
  body,
}: TemplateDetailActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = React.useTransition();

  const onUseTemplate = () => {
    router.push(
      `/dashboard/crm/sales/contracts/new?templateId=${encodeURIComponent(templateId)}`,
    );
  };

  const onDuplicate = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append('name', `${name} (copy)`);
      fd.append('body', body ?? '');
      const res = await saveContractTemplate(undefined as any, fd);
      if (res.error) {
        toast({
          title: 'Duplicate failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Template duplicated' });
      if (res.id) {
        router.push(`/dashboard/crm/contracts/templates/${res.id}`);
      } else {
        router.refresh();
      }
    });
  };

  const onDelete = () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete template "${name}"? This cannot be undone.`)
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteContractTemplate(templateId);
      if (!res.success) {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Template deleted' });
      router.push('/dashboard/crm/contracts/templates');
    });
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={onUseTemplate}>
        <FilePlus className="h-4 w-4" />
        Use template
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href={`/dashboard/crm/contracts/templates?edit=${templateId}`}>
          <Pencil className="h-4 w-4" />
          Edit
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            More
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy className="mr-2 h-4 w-4" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={onDelete}
            className="text-[var(--st-text)] focus:text-[var(--st-text)]"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
