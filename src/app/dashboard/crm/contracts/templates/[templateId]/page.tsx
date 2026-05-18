'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSkeleton, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  use,
  useActionState,
  useEffect,
  useState,
  useTransition,
} from 'react';
import Link from 'next/link';
import { FileText, ArrowLeft, LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';

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
  const { toast } = useZoruToast();
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
            <ZoruButton
              variant="outline"
             
            >
              Back
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard>
        {isLoading && !tpl ? (
          <div className="space-y-3 p-6">
            <ZoruSkeleton className="h-10 w-full" />
            <ZoruSkeleton className="h-64 w-full" />
          </div>
        ) : (
          <form action={saveFormAction} className="space-y-4 p-6">
            <input type="hidden" name="_id" value={templateId} />
            <div>
              <ZoruLabel htmlFor="name" className="text-foreground">
                Template Name <span className="text-destructive">*</span>
              </ZoruLabel>
              <ZoruInput
                id="name"
                name="name"
                required
                defaultValue={tpl?.name || ''}
                className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="body" className="text-foreground">
                Body <span className="text-destructive">*</span>
              </ZoruLabel>
              <ZoruTextarea
                id="body"
                name="body"
                required
                rows={20}
                defaultValue={tpl?.body || ''}
                className="mt-1.5 rounded-lg border-border bg-card font-mono text-[13px]"
                placeholder="Contract body..."
              />
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Supported placeholders: {'{{client_name}}'}, {'{{start_date}}'},{' '}
                {'{{end_date}}'}, {'{{value}}'}, {'{{currency}}'}
              </p>
            </div>
            <div className="flex justify-end">
              <ZoruButton
                type="submit"
               
                disabled={isSaving}
               
              >
                Save
              </ZoruButton>
            </div>
          </form>
        )}
      </ZoruCard>
    </div>
  );
}
