'use client';

import { Video } from 'lucide-react';
import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';

export default function InstagramReelsPage() {
  return (
    <ZoruCard className="text-center p-6">
      <ZoruCardHeader>
        <ZoruCardTitle>
          <span className="inline-flex items-center justify-center gap-2">
            <Video className="h-5 w-5" />
            Coming Soon!
          </span>
        </ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent>
        <p className="text-zoru-ink-muted">The Instagram Reels manager is under development.</p>
      </ZoruCardContent>
    </ZoruCard>
  );
}
