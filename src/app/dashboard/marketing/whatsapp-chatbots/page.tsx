import React, { Suspense } from 'react';
import { getWhatsappBots } from '@/app/actions/marketing/whatsapp-chatbots.actions';
import { WhatsappBotClient } from './_whatsapp-chatbots-client';
import Loading from './loading';

export const dynamic = 'force-dynamic';

async function WhatsappBotsData() {
  const data = await getWhatsappBots();

  if (!data) {
    throw new Error('Failed to load WhatsApp Chatbots data.');
  }
  
  return <WhatsappBotClient initialData={data} />;
}

export default function WhatsappBotPage() {
  return (
    <Suspense fallback={<Loading />}>
      <WhatsappBotsData />
    </Suspense>
  );
}
