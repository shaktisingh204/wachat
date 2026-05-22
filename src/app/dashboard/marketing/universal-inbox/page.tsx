import React from 'react';
import { getInboxMessages } from '@/app/actions/marketing/universal-inbox.actions';
import { UniversalInboxClient } from './_universal-inbox-client';

export default async function UniversalInboxPage() {
  const data = await getInboxMessages();
  return <UniversalInboxClient initialData={data} />;
}
