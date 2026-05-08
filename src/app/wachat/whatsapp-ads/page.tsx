'use client';

import { Megaphone } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="WhatsApp Ads"
      description="Create click-to-WhatsApp campaigns, manage audiences, review creatives, and export lead-ready campaign data from the Wachat workspace."
      eyebrow="Wachat growth"
      icon={Megaphone}
      accent="#16A34A"
      storageKey="wachat-whatsapp-ads"
      primaryActionLabel="Create ad campaign"
  quickLinks={[
    {
        "label": "Open setup",
        "href": "/wachat/whatsapp-ads/setup"
    },
    {
        "label": "View roadmap",
        "href": "/wachat/whatsapp-ads/roadmap"
    }
]}
    />
  );
}
