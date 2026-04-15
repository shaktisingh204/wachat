'use client';

import { Send } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveOfferLetter } from '@/app/actions/hr.actions';

export default function NewOfferPage() {
  return (
    <HrFormPage
      title="New Offer"
      subtitle="Draft an offer letter for a candidate."
      icon={Send}
      backHref="/dashboard/hrm/hr/offers"
      singular="Offer"
      fields={fields}
      sections={sections}
      saveAction={saveOfferLetter}
    />
  );
}
