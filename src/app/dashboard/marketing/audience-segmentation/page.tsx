import React from 'react';
import { getAudienceSegments } from '@/app/actions/marketing/audience-segmentation.actions';
import { AudienceSegmentClient } from './_audience-segmentation-client';

export default async function AudienceSegmentPage() {
  const data = await getAudienceSegments();
  
  return <AudienceSegmentClient initialData={data} />;
}
