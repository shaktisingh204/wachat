'use client';

/**
 * SabBigin — email presentation form (client).
 *
 * Lets the user set the from-name + signature SabBigin uses when it sends mail.
 * Connecting a provider is a separate, heavier flow; this surface focuses on the
 * presentation fields and clearly reports the connection status.
 */

import * as React from 'react';
import { Save } from 'lucide-react';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Field,
  Input,
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';
import { saveSabbiginEmailPresentation } from '@/app/actions/sabbigin-email-settings.actions';

export interface EmailSettingsFormProps {
  fromName: string;
  signature: string;
}

export function EmailSettingsForm({
  fromName: initialFromName,
  signature: initialSignature,
}: EmailSettingsFormProps) {
  const [fromName, setFromName] = React.useState(initialFromName);
  const [signature, setSignature] = React.useState(initialSignature);
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await saveSabbiginEmailPresentation({ fromName, signature });
      if (res.success) {
        toast.success({ title: 'Email settings saved' });
      } else {
        toast.error({
          title: 'Could not save',
          description: res.error ?? 'Please try again.',
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="none">
      <CardHeader>
        <CardTitle>Sender identity</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-4 pt-0">
        <Field
          label="From name"
          help="The display name recipients see on email you send."
        >
          <Input
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="e.g. Priya from Acme"
            maxLength={120}
          />
        </Field>

        <Field
          label="Signature"
          help="Appended to outgoing email. Plain text."
        >
          <Textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            rows={5}
            placeholder={'—\nPriya Sharma\nAcme Studio\n+91 …'}
          />
        </Field>

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            iconLeft={Save}
            loading={saving}
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
