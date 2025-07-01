
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, FileJson, GitFork, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const commonPatterns = [
    {
        title: 'Lead Generation',
        description: 'Capture valuable customer information directly in WhatsApp.',
        steps: [
            'Create a "Welcome" screen with a heading and body text explaining the offer.',
            'Add `TextInput` components for Name, Email, and Phone Number.',
            'The footer button should navigate to a "Thank You" screen.',
            'The final screen can confirm submission, e.g., "Thanks, a representative will contact you shortly!"',
        ],
    },
    {
        title: 'Appointment Booking',
        description: 'Allow customers to schedule appointments without leaving the chat.',
        steps: [
            'Use a `DatePicker` component to let users select a date.',
            'Add a `Dropdown` or `RadioButtons` for available time slots.',
            'Use a `TextInput` for any special requests.',
            'The footer button can submit this data to your endpoint for processing.',
            'Consider a final screen that confirms the appointment details.',
        ],
    },
    {
        title: 'Customer Feedback Survey',
        description: 'Gather feedback with simple, interactive surveys.',
        steps: [
            'Use `RadioButtons` for single-choice questions (e.g., star ratings).',
            'Use `CheckboxGroup` for multiple-choice questions.',
            'Add a `TextInput` for open-ended comments or suggestions.',
            'The final button submits the survey data.',
        ],
    },
];

export default function FlowsUserGuidePage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-4">
          <Link href="/dashboard/flows">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Meta Flows
          </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <GitFork className="h-8 w-8"/>
            Building Interactive Experiences with Meta Flows
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
            A guide to creating multi-step, interactive forms and journeys inside WhatsApp.
        </p>
      </div>
      
      <Card>
          <CardHeader>
            <CardTitle>What are Meta Flows?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground/90">Meta Flows are rich, native experiences that you can launch within WhatsApp conversations. Think of them as mini-apps or forms inside the chat. Instead of asking a user for their name, then their email, then their availability one message at a time, you can send a single Flow that collects all this information on one or more screens.</p>
            <div className="p-4 bg-muted/50 rounded-lg border">
                 <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 mt-1 text-primary flex-shrink-0"/>
                    <div>
                        <h4 className="font-semibold">Key Advantage</h4>
                        <p className="text-sm text-muted-foreground">Flows reduce friction for the user, leading to higher completion rates for tasks like booking appointments, generating leads, or collecting feedback.</p>
                    </div>
                </div>
            </div>
          </CardContent>
      </Card>
      
      <Separator />

       <div>
            <h2 className="text-2xl font-bold font-headline">Common Patterns & Use Cases</h2>
            <p className="text-muted-foreground mt-1">
                Here are some ideas for flows you can build, and how to structure them.
            </p>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {commonPatterns.map(pattern => (
            <Card key={pattern.title} className="flex flex-col">
                <CardHeader>
                    <CardTitle>{pattern.title}</CardTitle>
                    <CardDescription>{pattern.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                        {pattern.steps.map((step, index) => <li key={index}>{step}</li>)}
                    </ol>
                </CardContent>
            </Card>
        ))}
      </div>

    </div>
  );
}
