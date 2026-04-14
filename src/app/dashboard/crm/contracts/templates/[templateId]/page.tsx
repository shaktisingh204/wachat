'use client';

import {
  use,
  useActionState,
  useEffect,
  useState,
  useTransition,
} from 'react';
import Link from 'next/link';
import { FileText, ArrowLeft, LoaderCircle } from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getContractTemplateById,
  saveContractTemplate,
} from '@/app/actions/worksuite/contracts-ext.actions';
import type { WsContractTemplate } from '@/lib/worksuite/contracts-ext-types';

type Template = WsContractTemplate & { _id: string };

export default function ContractTemplateEditorPage(props: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = use(props.params);
  const { toast } = useToast();
  const [tpl, setTpl] = useState<Template | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveContractTemplate,
    { message: '', error: '' } as any,
  );

  useEffect(() => {
    startLoading(async () => {
      const data = await getContractTemplateById(templateId);
      setTpl(data as unknown as Template);
    });
  }, [templateId]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
    }
    if (saveState?.error) {
      toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
    }
  }, [saveState, toast]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={tpl?.name || 'Contract Template'}
        subtitle="Edit template body. Supports placeholders like {{client_name}}."
        icon={FileText}
        actions={
          <Link href="/dashboard/crm/contracts/templates">
            <ClayButton
              variant="pill"
              leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />}
            >
              Back
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        {isLoading && !tpl ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <form action={saveFormAction} className="space-y-4 p-6">
            <input type="hidden" name="_id" value={templateId} />
            <div>
              <Label htmlFor="name" className="text-clay-ink">
                Template Name <span className="text-clay-red">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={tpl?.name || ''}
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="body" className="text-clay-ink">
                Body <span className="text-clay-red">*</span>
              </Label>
              <Textarea
                id="body"
                name="body"
                required
                rows={20}
                defaultValue={tpl?.body || ''}
                className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface font-mono text-[13px]"
                placeholder="Contract body..."
              />
              <p className="mt-1 text-[11.5px] text-clay-ink-muted">
                Supported placeholders: {'{{client_name}}'}, {'{{start_date}}'},{' '}
                {'{{end_date}}'}, {'{{value}}'}, {'{{currency}}'}
              </p>
            </div>
            <div className="flex justify-end">
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isSaving}
                leading={
                  isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                  ) : null
                }
              >
                Save
              </ClayButton>
            </div>
          </form>
        )}
      </ClayCard>
    </div>
  );
}
