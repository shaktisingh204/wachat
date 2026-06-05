'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Callout,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from '@/components/sabcrm/20ui';
import { ChevronLeft } from 'lucide-react';

import Link from 'next/link';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const blockDocs = [
  {
    title: 'Start',
    description:
      'Every flow must begin with a Start block. This defines how the flow is triggered.',
    properties: [
      {
        name: 'Trigger keywords',
        desc: 'A comma-separated list of words. If an incoming message contains any of these words, this flow will begin. (e.g. "help, support, menu")',
      },
    ],
    outputs: ['One main output that connects to the first block of your flow.'],
  },
  {
    title: 'Send message',
    description: 'Sends a simple text message to the user.',
    properties: [
      {
        name: 'Message text',
        desc: 'The content of the message you want to send. You can use variables here, like "Hello {{name}}".',
      },
    ],
    outputs: ['One main output to continue the flow after the message is sent.'],
  },
  {
    title: 'Send image',
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
    title: 'Add buttons',
    description:
      "Sends a message with interactive Quick Reply buttons. The user's choice can be used to branch the flow.",
    properties: [
      { name: 'Message text', desc: 'The text that appears above the buttons.' },
      {
        name: 'Buttons',
        desc: 'You can add up to 3 Quick Reply buttons. Each button press can lead to a different path in your flow.',
      },
    ],
    outputs: [
      'Each button acts as its own output path. Connect each button to a different block to create branching logic.',
    ],
    notes:
      'This block waits for the user to press a button before continuing. Due to WhatsApp API limitations, only Quick Reply buttons are supported in flows.',
  },
  {
    title: 'Get user input',
    description:
      "Asks the user a question and saves their text response to a variable.",
    properties: [
      { name: 'Question to ask', desc: 'The message sent to the user to prompt their input.' },
      {
        name: 'Save answer to variable',
        desc: "The name of the variable where the user's reply will be stored (e.g. \"user_name\"). Do not use brackets here.",
      },
    ],
    outputs: ['One main output that is followed after the user provides their response.'],
    notes: 'This block waits for the user to send a text message before continuing.',
  },
  {
    title: 'Add condition',
    description:
      "Create branches in your flow based on rules and variables. This block can either check a pre-existing variable or pause the flow to wait for the user's next message.",
    properties: [
      {
        name: 'Condition type',
        desc: 'Choose what to check. "Variable" checks data already saved in a variable. "User response" pauses the flow and checks the next message the user sends.',
      },
      {
        name: 'Variable (if type is Variable)',
        desc: 'The variable to check, e.g. {{user_input}} or {{age}}.',
      },
      {
        name: 'Operator',
        desc: 'The comparison to perform: Equals, Contains, Is one of, etc.',
      },
      {
        name: 'Value',
        desc: 'The value to compare against. This can be a fixed value (e.g. "yes") or another variable (e.g. {{expected_answer}}).',
      },
    ],
    outputs: ['Yes: If the condition is true.', 'No: If the condition is false.'],
    notes:
      "If you connect a button to this block, it will automatically use the button's text for the condition check, regardless of the \"Condition type\" setting. This makes building menus very easy.",
  },
  {
    title: 'Add delay',
    description: 'Pauses the flow for a specified number of seconds.',
    properties: [
      { name: 'Delay (seconds)', desc: 'The number of seconds to wait before proceeding.' },
      {
        name: 'Show typing indicator',
        desc: 'If checked, a "typing…" indicator will be shown to the user during the delay.',
      },
    ],
    outputs: ['One main output that is followed after the delay is complete.'],
  },
  {
    title: 'Call API / webhook',
    description:
      'Make a request to an external server or API and save parts of the response to variables.',
    properties: [
      { name: 'Method', desc: 'The HTTP method for the request (GET, POST, PUT).' },
      {
        name: 'URL',
        desc: 'The endpoint URL to send the request to. You can use variables here.',
      },
      {
        name: 'Headers / body',
        desc: 'Provide JSON for request headers or the request body. Variables are supported.',
      },
      {
        name: 'Response → variable mappings',
        desc: 'Define how to extract data from the API response and save it to flow variables.',
      },
    ],
    outputs: ['One main output that is followed after the API call is complete.'],
    notes:
      'In the mappings, use dot notation for the response path (e.g. `user.address.city` or `items[0].name`). The value at that path is saved to the variable name you provide, which you can then use as `{{your_variable_name}}` in later steps.',
  },
];

export default function FlowBuilderDocsPage() {
  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Flow builder', href: '/wachat/flow-builder' },
        { label: 'Documentation' },
      ]}
      title="Flow builder documentation"
      description="Welcome to the flow builder guide. Learn about each building block and how to use them to create powerful automations for your WhatsApp conversations."
      actions={
        <Link href="/wachat/flow-builder" className="u-btn u-btn--ghost u-btn--sm">
          <ChevronLeft size={14} aria-hidden="true" />
          <span className="u-btn__label">Back to flow builder</span>
        </Link>
      }
      width="narrow"
    >
      <div className="flex flex-col gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Using variables</CardTitle>
            <CardDescription>
              Variables let you personalize your flows and use data dynamically.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4 text-sm">
            <p>
              Variables are placeholders for data that can change, such as a user&apos;s name or their
              answer to a question. Use double curly braces to insert a variable, like this:{' '}
              <Badge kind="outline" className="font-mono">{`{{name}}`}</Badge>.
            </p>
            <p>
              The &quot;Get user input&quot; block is the primary way to create custom variables. When
              you configure it to save an answer to a variable named{' '}
              <Badge kind="outline">color</Badge>, you can later use the user&apos;s
              answer by writing{' '}
              <Badge kind="outline" className="font-mono">{`{{color}}`}</Badge> in a
              &quot;Send message&quot; block.
            </p>
            <p>
              There are pre-defined variables you can use:{' '}
              <Badge kind="outline" className="font-mono">{`{{name}}`}</Badge> (the
              user&apos;s WhatsApp profile name) and{' '}
              <Badge kind="outline" className="font-mono">{`{{waId}}`}</Badge> (their phone
              number). Variables you save from an API call can also be used this way.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Common pattern: button-based menu</CardTitle>
            <CardDescription>
              Present a menu to the user and perform an action based on their choice.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4 text-sm">
            <p>Here&apos;s how to build a &apos;Show balance&apos; flow that checks the user&apos;s input:</p>
            <ol className="list-inside list-decimal space-y-2">
              <li>
                <strong>Add buttons block</strong>: create a button with the text &apos;Show
                balance&apos; and another with &apos;Speak to agent&apos;.
              </li>
              <li>
                <strong>Add condition block</strong>: add a &apos;Condition&apos; block. Configure it
                to check if the input <em>Equals</em> the value &apos;Show balance&apos;.
              </li>
              <li>
                <strong>Add API call block</strong>: add a &apos;Call API&apos; block to fetch the
                balance from your server. Map the result to a variable named <code>balance</code>.
              </li>
              <li>
                <strong>Add message blocks</strong>: add two &apos;Send message&apos; blocks. One
                saying &apos;Your balance is {`{{balance}}`}&apos;, and another saying
                &apos;Connecting you to an agent…&apos;.
              </li>
              <li>
                <strong>Connect them</strong>:
                <ul className="ml-4 mt-1 list-inside list-disc">
                  <li>
                    Drag from the &apos;Show balance&apos; button output to the input of the{' '}
                    <strong>Condition</strong> block.
                  </li>
                  <li>
                    Connect the <strong>Yes</strong> output of Condition to your{' '}
                    <strong>API call</strong> block.
                  </li>
                  <li>Connect the API call output to the &quot;Your balance is…&quot; message block.</li>
                  <li>
                    Connect the <strong>No</strong> output of Condition to the &quot;Connecting
                    you…&quot; message block.
                  </li>
                </ul>
              </li>
            </ol>
            <Callout tone="neutral" title="Key insight">
              When you connect a button to a Condition block, the block automatically uses the
              button&apos;s text as the input to check. You don&apos;t need a separate &quot;Get
              user input&quot; block. This makes building menus fast and intuitive.
            </Callout>
          </CardBody>
        </Card>

        <Separator />

        <div>
          <h2 className="text-2xl">Flow blocks</h2>
          <p className="mt-1 opacity-60">
            An overview of all available blocks and their configurations.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {blockDocs.map((doc, index) => (
            <AccordionItem value={`item-${index}`} key={index}>
              <AccordionTrigger className="text-lg">{doc.title}</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <p className="text-base opacity-60">{doc.description}</p>

                <div className="space-y-2">
                  <h4 className="font-semibold">Properties:</h4>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {doc.properties.map((prop, pIndex) => (
                      <li key={pIndex}>
                        <strong>{prop.name}:</strong> {prop.desc}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Outputs:</h4>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {doc.outputs.map((out, oIndex) => (
                      <li key={oIndex}>{out}</li>
                    ))}
                  </ul>
                </div>

                {doc.notes && (
                  <Callout tone="neutral" title="Note">
                    {doc.notes}
                  </Callout>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </WachatPage>
  );
}
