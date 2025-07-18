
'use client';

import { useState, useMemo } from 'react';
import type { WithId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    <Card className="card-gradient card-gradient-green">
      <CardHeader>
        <div className="flex items-center gap-3">
            <WhatsAppIcon className="h-8 w-8" />
            <div>
                <CardTitle>WhatsApp Link Generator</CardTitle>
                <CardDescription>Create a shareable link that opens a WhatsApp chat with a pre-filled message.</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="phone-number">Phone Number</Label>
                <Select value={selectedPhone} onValueChange={setSelectedPhone}>
                    <SelectTrigger id="phone-number">
                        <SelectValue placeholder="Select a number..." />
                    </SelectTrigger>
                    <SelectContent>
                        {project.phoneNumbers.map(phone => (
                            <SelectItem key={phone.id} value={phone.display_phone_number}>
                                {phone.display_phone_number} ({phone.verified_name})
                            </SelectItem>
                        ))}
                    </SelectContent>
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
                <Button variant="outline" size="icon" onClick={() => copy(generatedLink)} disabled={!generatedLink}>
                    {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
