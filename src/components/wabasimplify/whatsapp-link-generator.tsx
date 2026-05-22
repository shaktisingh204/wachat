'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Label,
  Input,
  Textarea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  useState,
  useMemo } from 'react';
import type { WithId } from 'mongodb';
import type { Project } from '@/lib/definitions';

import { Link, Copy, Check } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { WhatsAppIcon } from './custom-sidebar-components';

interface WhatsappLinkGeneratorProps {
  project: WithId<Project>;
}

export function WhatsappLinkGenerator({ project }: WhatsappLinkGeneratorProps) {
  const [selectedPhone, setSelectedPhone] = useState<string>(project.phoneNumbers?.[0]?.display_phone_number || '');
  const [message, setMessage] = useState('');
  const { isCopied, copy } = useCopyToClipboard();

  const generatedLink = useMemo(() => {
    if (!selectedPhone) return '';
    const baseUrl = `https://wa.me/${selectedPhone.replace(/\D/g, '')}`;
    if (!message.trim()) return baseUrl;
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }, [selectedPhone, message]);

  return (
    <ZoruCard className="card-gradient card-gradient-green">
      <ZoruCardHeader>
        <div className="flex items-center gap-3">
            <WhatsAppIcon className="h-8 w-8" />
            <div>
                <ZoruCardTitle>WhatsApp Link Generator</ZoruCardTitle>
                <ZoruCardDescription>Create a shareable link that opens a WhatsApp chat with a pre-filled message.</ZoruCardDescription>
            </div>
        </div>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <ZoruLabel htmlFor="phone-number">Phone Number</ZoruLabel>
                <ZoruSelect value={selectedPhone} onValueChange={setSelectedPhone}>
                    <ZoruSelectTrigger id="phone-number">
                        <ZoruSelectValue placeholder="Select a number..." />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {project.phoneNumbers.map(phone => (
                            <ZoruSelectItem key={phone.id} value={phone.display_phone_number}>
                                {phone.display_phone_number} ({phone.verified_name})
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>
            </div>
        </div>
        <div className="space-y-2">
            <ZoruLabel htmlFor="prefilled-message">Pre-filled Message (Optional)</ZoruLabel>
            <ZoruTextarea
                id="prefilled-message"
                placeholder="e.g., Hello, I'm interested in your services..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-24"
            />
        </div>
        <div className="space-y-2">
            <ZoruLabel>Generated Link</ZoruLabel>
            <div className="flex items-center gap-2">
                <ZoruInput
                    readOnly
                    value={generatedLink}
                    className="font-mono text-xs"
                />
                <ZoruButton variant="outline" size="icon" onClick={() => copy(generatedLink)} disabled={!generatedLink}>
                    {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </ZoruButton>
            </div>
        </div>
      </ZoruCardContent>
    </ZoruCard>
  );
}
