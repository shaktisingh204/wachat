

'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { User, Phone, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ContactMessageContentProps {
  contacts: any[]; // The `contacts` array from the message payload
}

export function ContactMessageContent({ contacts }: ContactMessageContentProps) {
  if (!contacts || contacts.length === 0) {
    return <p className="text-sm italic text-muted-foreground">[Empty contact message]</p>;
  }

  const mainContact = contacts[0];
  const name = mainContact.name?.formatted_name || 'Unknown Contact';
  const phone = mainContact.phones?.[0]?.phone || 'No phone number';
  const org = mainContact.org?.title || 'No organization';

  return (
    <div className="w-64">
      <Card className="shadow-none border-0 bg-transparent">
        <CardHeader className="p-2">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Contact Card</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-2 space-y-2 text-sm">
          <p className="font-semibold">{name}</p>
          <div className="text-muted-foreground space-y-1">
            <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {phone}</p>
            <p className="flex items-center gap-2"><Briefcase className="h-4 w-4" /> {org}</p>
          </div>
          <Button variant="outline" size="sm" className="w-full mt-2">
            View Contact
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
