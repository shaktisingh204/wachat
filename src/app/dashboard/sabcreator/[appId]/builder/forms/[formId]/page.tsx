import { notFound } from 'next/navigation';

import {
  getSabcreatorApp,
  getSabcreatorForm,
} from '@/app/actions/sabcreator.actions';

import { FormDesignerClient } from './_components/form-designer-client';

export const dynamic = 'force-dynamic';

interface RouteParams {
  appId: string;
  formId: string;
}

export default async function FormDesignerPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { appId, formId } = await params;
  const [app, form] = await Promise.all([
    getSabcreatorApp(appId).catch(() => null),
    getSabcreatorForm(formId).catch(() => null),
  ]);
  if (!app || !form) notFound();
  return <FormDesignerClient app={app} form={form} />;
}
