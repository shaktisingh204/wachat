'use client';

import { WhatsAppIcon, MetaIcon, SeoIcon, InstagramIcon, SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { sabnodeAppData } from './data';
import { getIconEntry } from './icons';

// Platform-specific custom icons take priority
const customIconMap: Record<string, any> = {
  'wachat': WhatsAppIcon,
  'sabchat': SabChatIcon,
  'meta': MetaIcon,
  'instagram': InstagramIcon,
  'seo-suite': SeoIcon,
};

export const sabnodeAppActions = sabnodeAppData.map(app => {
  const entry = getIconEntry(app.appId);
  return {
    ...app,
    icon: customIconMap[app.appId] ?? entry.icon,
    iconColor: app.iconColor || entry.iconColor,
  };
});
