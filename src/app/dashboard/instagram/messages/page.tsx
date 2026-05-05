'use client';

import { MessageSquare } from 'lucide-react';
import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';

export default function InstagramMessagesPage() {
  return (
    <ZoruCard className="text-center p-6">
      <ZoruCardHeader>
        <ZoruCardTitle>
          <span className="inline-flex items-center justify-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Coming Soon!
          </span>
        </ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent>
        <p className="text-zoru-ink-muted">The Instagram messages inbox is under development.</p>
      </ZoruCardContent>
    </ZoruCard>
  );
}
