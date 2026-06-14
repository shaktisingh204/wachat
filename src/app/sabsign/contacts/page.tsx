'use client';

import * as React from 'react';
import { Contact, UserPlus, Users, Search } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';

export default function ContactsPage() {
  return (
    <main className="flex w-full max-w-6xl flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabSign</PageEyebrow>
          <PageTitle>Address book</PageTitle>
          <PageDescription>
            Save the people you send to so you can add signers in a couple of
            keystrokes.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" size="sm" iconLeft={UserPlus} disabled>
            Add contact
          </Button>
        </PageActions>
      </PageHeader>

      <div className="w-full sm:w-80">
        <Field>
          <Input
            type="search"
            iconLeft={Search}
            placeholder="Search contacts by name or email"
            aria-label="Search contacts by name or email"
            disabled
          />
        </Field>
      </div>

      <Card variant="outlined" padding="none">
        <CardBody>
          <EmptyState
            icon={Contact}
            tone="info"
            title="No saved contacts yet"
            description="A shared address book is coming to SabSign. People you have sent documents to will be saved here for one-click reuse."
            action={
              <Button variant="outline" size="sm" iconLeft={Users}>
                Import from CRM
              </Button>
            }
          />
        </CardBody>
      </Card>
    </main>
  );
}
