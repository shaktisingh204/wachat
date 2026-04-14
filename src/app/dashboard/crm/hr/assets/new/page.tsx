'use client';

import { Package } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { saveAsset } from '@/app/actions/hr.actions';
import { fields, sections } from '../_config';

export default function NewAssetPage() {
  return (
    <HrFormPage
      title="New Asset"
      subtitle="Register a new company-owned asset."
      icon={Package}
      backHref="/dashboard/crm/hr/assets"
      singular="Asset"
      fields={fields}
      sections={sections}
      saveAction={saveAsset}
    />
  );
}
