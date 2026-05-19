'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Pencil, Trash2, FilePlus } from 'lucide-react';

import {
  ZoruButton,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  useZoruToast,
} from '@/components/zoruui';
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
  const { toast } = useZoruToast();
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
      <ZoruButton size="sm" variant="outline" onClick={onUseTemplate}>
        <FilePlus className="h-4 w-4" />
        Use template
      </ZoruButton>
      <ZoruButton asChild size="sm" variant="outline">
        <Link href={`/dashboard/crm/contracts/templates?edit=${templateId}`}>
          <Pencil className="h-4 w-4" />
          Edit
        </Link>
      </ZoruButton>
      <ZoruDropdownMenu>
        <ZoruDropdownMenuTrigger asChild>
          <ZoruButton size="sm" variant="outline">
            More
          </ZoruButton>
        </ZoruDropdownMenuTrigger>
        <ZoruDropdownMenuContent align="end">
          <ZoruDropdownMenuItem onSelect={onDuplicate}>
            <Copy className="mr-2 h-4 w-4" /> Duplicate
          </ZoruDropdownMenuItem>
          <ZoruDropdownMenuSeparator />
          <ZoruDropdownMenuItem
            onSelect={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </ZoruDropdownMenuItem>
        </ZoruDropdownMenuContent>
      </ZoruDropdownMenu>
    </>
  );
}
