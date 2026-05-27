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
import { saveGeneratedLink } from '@/app/wachat/integrations/whatsapp-link-generator/actions';

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
    <Card className="card-gradient card-gradient-green">
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
                <Label htmlFor="phone-number">Phone Number</Label>
                <Select value={selectedPhone} onValueChange={setSelectedPhone}>
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
                </Select>
            </div>
        </div>
        <div className="space-y-2">
            <Label htmlFor="prefilled-message">Pre-filled Message (Optional)</Label>
            <Textarea
                id="prefilled-message"
                placeholder="e.g., Hello, I'm interested in your services..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-24"
            />
        </div>
        <div className="space-y-2">
            <Label>Generated Link</Label>
            <div className="flex items-center gap-2">
                <Input
                    readOnly
                    value={generatedLink}
                    className="font-mono text-xs"
                />
                <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => {
                        copy(generatedLink);
                        if (generatedLink) {
                            saveGeneratedLink(project._id.toString(), generatedLink).catch(console.error);
                        }
                    }} 
                    disabled={!generatedLink}
                >
                    {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
            </div>
        </div>
      </ZoruCardContent>
    </Card>
  );
}
