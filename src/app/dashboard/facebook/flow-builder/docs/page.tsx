'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, Separator } from '@/components/sabcrm/20ui';
import {
  useParams,
  useRouter } from 'next/navigation';
import { ArrowLeft,
  BookOpen,
  ChevronRight } from 'lucide-react';

/**
 * /dashboard/facebook/flow-builder/docs — inline reference (Ui20).
 *
 * Replaces the @/components/ui/* version. Same content (block reference
 * + variables guide), now rendered in the neutral Ui20 palette using
 * Accordion. No tab UI.
 */

import * as React from 'react';

const blockDocs = [
  {
    title: 'Start',
    description:
      'Every flow must begin with a Start block. This defines how the flow is triggered.',
    properties: [
      {
        name: 'Trigger Keywords',
        desc: 'A comma-separated list of words. If an incoming message contains any of these words, this flow will begin. (e.g., "help, support, menu")',
      },
    ],
    outputs: ['One main output that connects to the first block of your flow.'],
  },
  {
    title: 'Send Message',
    description: 'Sends a simple text message to the user.',
    properties: [
      {
        name: 'Message Text',
        desc: 'The content of the message you want to send. You can use variables here, like "Hello {{name}}".',
      },
    ],
    outputs: ['One main output to continue the flow after the message is sent.'],
  },
  {
    title: 'Send Image',
    description: 'Sends an image with an optional caption.',
    properties: [
      {
        name: 'Image URL',
        desc: 'A public URL for the image you want to send. Must be a direct link to a JPG or PNG file.',
      },
      { name: 'Caption', desc: 'Optional text that will be sent along with the image.' },
    ],
    outputs: ['One main output to continue the flow.'],
  },
  {
    title: 'Add Quick Replies',
    description:
      "Sends a message with interactive Quick Reply buttons. The user's choice can be used to branch the flow.",
    properties: [
      { name: 'Message Text', desc: 'The text that appears above the buttons.' },
      {
        name: 'Quick Replies',
        desc: 'You can add up to 13 Quick Reply buttons. Each button press can lead to a different path in your flow.',
      },
    ],
    outputs: [
      'Each button acts as its own output path. Connect each button to a different block to create branching logic.',
    ],
    notes: 'This block waits for the user to press a button before continuing.',
  },
  {
    title: 'Get User Input',
    description:
      'Asks the user a question and saves their text response to a variable.',
    properties: [
      {
        name: 'Question to Ask',
        desc: 'The message sent to the user to prompt their input.',
      },
      {
        name: 'Save Answer to Variable',
        desc: 'The name of the variable where the user\'s reply will be stored (e.g., "user_name"). Do not use brackets here.',
      },
    ],
    outputs: ['One main output that is followed after the user provides their response.'],
    notes: 'This block waits for the user to send a text message before continuing.',
  },
  {
    title: 'Add Condition',
    description:
      "Create branches in your flow based on rules and variables. This block can either check a pre-existing variable or pause the flow to wait for the user's next message.",
    properties: [
      {
        name: 'Condition Type',
        desc: 'Choose what to check. "Variable" checks data already saved in a variable. "User Response" pauses the flow and checks the next message the user sends.',
      },
      {
        name: 'Variable (if type is Variable)',
        desc: 'The variable to check, e.g., {{user_input}} or {{age}}.',
      },
      {
        name: 'Operator',
        desc: 'The comparison to perform: Equals, Contains, Is one of, etc.',
      },
      {
        name: 'Value',
        desc: 'The value to compare against. This can be a fixed value (e.g., "yes") or another variable (e.g., {{expected_answer}}).',
      },
    ],
    outputs: ['Yes: If the condition is true.', 'No: If the condition is false.'],
    notes:
      "If you connect a button to this block, it will automatically use the button's text for the condition check, regardless of the \"Condition Type\" setting. This makes building menus very easy.",
  },
  {
    title: 'Add Delay',
    description: 'Pauses the flow for a specified number of seconds.',
    properties: [
      {
        name: 'Delay (seconds)',
        desc: 'The number of seconds to wait before proceeding.',
      },
      {
        name: 'Show typing indicator',
        desc: 'If checked, a "typing..." indicator will be shown to the user during the delay.',
      },
    ],
    outputs: ['One main output that is followed after the delay is complete.'],
  },
  {
    title: 'Call API / Webhook',
    description:
      'Make a request to an external server or API and save parts of the response to variables.',
    properties: [
      { name: 'Method', desc: 'The HTTP method for the request (GET, POST, PUT).' },
      {
        name: 'URL',
        desc: 'The endpoint URL to send the request to. You can use variables here.',
      },
      {
        name: 'Headers / Body',
        desc: 'Provide JSON for request headers or the request body. Variables are supported.',
      },
      {
        name: 'Response to Variable Mappings',
        desc: 'Define how to extract data from the API response and save it to flow variables.',
      },
    ],
    outputs: ['One main output that is followed after the API call is complete.'],
    notes:
      'In the mappings, use dot notation for the Response Path (e.g., `user.address.city` or `items[0].name`). The value found at that path will be saved to the Variable Name you provide, which you can then use as `{{your_variable_name}}` in later steps.',
  },
];

export default function FlowBuilderDocsPage() {
  const router = useRouter();
  const params = useParams();
  const shopId = (params?.shopId as string | undefined) ?? '';

  const backHref = shopId
    ? `/dashboard/facebook/custom-ecommerce/manage/${shopId}/flow-builder`
    : '/dashboard/facebook/flow-builder';

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook/flow-builder">
              Flow Builder
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Documentation</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page header */}
      <PageHeader className="mt-4">
        <PageHeading>
          <PageEyebrow>Meta Suite · Reference</PageEyebrow>
          <PageTitle>Flow Builder Documentation</PageTitle>
          <PageDescription>
            Learn about each building block and how to combine them into
            powerful Messenger automations.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(backHref)}
          >
            <ArrowLeft /> Back to Flow Builder
          </Button>
        </PageActions>
      </PageHeader>

      {/* Variables intro */}
      <Card className="mt-6 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)] [&_svg]:size-4">
            <BookOpen />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] text-[var(--st-text)]">Using Variables</h3>
            <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
              Variables let you personalise flows and use data dynamically.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 text-[13px] leading-relaxed text-[var(--st-text)]">
          <p>
            Variables are placeholders for data that can change, such as a
            user&apos;s name or their answer to a question. In the Flow
            Builder, you use double curly braces to insert a variable, like
            this:{' '}
            <Badge variant="outline" className="font-mono">
              {'{{name}}'}
            </Badge>
            .
          </p>
          <p>
            The &ldquo;Get User Input&rdquo; block is the primary way to
            create custom variables. When you configure it to save an answer
            to a variable named{' '}
            <Badge variant="outline">color</Badge>, you can later use
            the user&apos;s answer by writing{' '}
            <Badge variant="outline" className="font-mono">
              {'{{color}}'}
            </Badge>{' '}
            in a &ldquo;Send Message&rdquo; block.
          </p>
          <p>
            There are also pre-defined variables you can use:{' '}
            <Badge variant="outline" className="font-mono">
              {'{{name}}'}
            </Badge>{' '}
            (the user&apos;s Messenger profile name) and{' '}
            <Badge variant="outline" className="font-mono">
              {'{{psid}}'}
            </Badge>{' '}
            (the user&apos;s unique Page-Scoped ID).
          </p>
        </div>
      </Card>

      <Separator className="my-8" />

      {/* Blocks reference */}
      <div>
        <h2 className="text-[20px] tracking-tight text-[var(--st-text)] leading-none">
          Flow Blocks
        </h2>
        <p className="mt-1.5 text-[12.5px] text-[var(--st-text-secondary)]">
          An overview of every available block and its configuration.
        </p>
      </div>

      <Card className="mt-4 px-4">
        <Accordion type="single" collapsible className="w-full">
          {blockDocs.map((doc, index) => (
            <AccordionItem value={`item-${index}`} key={doc.title}>
              <AccordionTrigger className="text-[14px]">
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[11px] text-[var(--st-text-secondary)]">
                    {index + 1}
                  </span>
                  {doc.title}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-4 pb-2 pt-1">
                  <p className="text-[13px] text-[var(--st-text)]">{doc.description}</p>

                  <div className="flex flex-col gap-1.5">
                    <h4 className="text-[12px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                      Properties
                    </h4>
                    <ul className="flex flex-col gap-1.5 pl-4">
                      {doc.properties.map((prop) => (
                        <li
                          key={prop.name}
                          className="list-disc text-[13px] text-[var(--st-text)]"
                        >
                          <span className="text-[var(--st-text)]">{prop.name}:</span>{' '}
                          <span className="text-[var(--st-text-secondary)]">{prop.desc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <h4 className="text-[12px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                      Outputs
                    </h4>
                    <ul className="flex flex-col gap-1.5 pl-4">
                      {doc.outputs.map((out) => (
                        <li
                          key={out}
                          className="list-disc text-[13px] text-[var(--st-text-secondary)]"
                        >
                          {out}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {doc.notes && (
                    <div className="flex items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2.5 text-[12.5px] text-[var(--st-text-secondary)]">
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--st-text-tertiary)]" />
                      <span>
                        <span className="text-[var(--st-text)]">Note:</span> {doc.notes}
                      </span>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}
