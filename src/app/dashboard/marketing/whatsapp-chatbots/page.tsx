import React from 'react';
import { getWhatsappBots } from '@/app/actions/marketing/whatsapp-chatbots.actions';
import { WhatsappBotClient } from './_whatsapp-chatbots-client';

export default async function WhatsappBotPage() {
  const data = await getWhatsappBots();
  
  return <WhatsappBotClient initialData={data} />;
}
