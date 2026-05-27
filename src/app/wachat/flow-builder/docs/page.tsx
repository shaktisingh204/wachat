'use client';

import { Accordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';
import { GitBranch } from 'lucide-react';
import { WaPage, PageHeader, Section } from '@/components/wachat-ui';

const blockDocs = [
  {
    title: 'Start',
    description: 'Every flow must begin with a Start block. This defines how the flow is triggered.',
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
      { name: 'Image URL', desc: 'A public URL for the image. Must be a direct link to a JPG or PNG file.' },
      { name: 'Caption', desc: 'Optional text that will be sent along with the image.' },
    ],
    outputs: ['One main output to continue the flow.'],
  },
  {
    title: 'Add buttons',
    description:
      "Sends a message with interactive quick reply buttons. The user's choice can be used to branch the flow.",
    properties: [
      { name: 'Message text', desc: 'The text that appears above the buttons.' },
      {
        name: 'Buttons',
        desc: 'Up to 3 quick reply buttons. Each press can lead to a different path in your flow.',
      },
    ],
    outputs: [
      'Each button acts as its own output path. Connect each button to a different block to create branching logic.',
    ],
    notes:
      'This block waits for the user to press a button before continuing. Only quick reply buttons are supported in flows.',
  },
  {
    title: 'Get user input',
    description: "Asks the user a question and saves their text response to a variable.",
    properties: [
      { name: 'Question to ask', desc: 'The message sent to the user to prompt their input.' },
      {
        name: 'Save answer to variable',
        desc: 'The name of the variable where the reply will be stored (e.g. "user_name"). No brackets.',
      },
    ],
    outputs: ['One main output that is followed after the user provides their response.'],
    notes: 'This block waits for the user to send a text message before continuing.',
  },
  {
    title: 'Add condition',
    description:
      "Create branches based on rules and variables. Can check a pre-existing variable or pause the flow to wait for the user's next message.",
    properties: [
      {
        name: 'Condition type',
        desc: '"Variable" checks data already saved. "User response" pauses the flow and checks the next message the user sends.',
      },
      { name: 'Variable (if type is Variable)', desc: 'The variable to check, e.g. {{user_input}} or {{age}}.' },
      { name: 'Operator', desc: 'The comparison to perform: equals, contains, is one of, etc.' },
      {
        name: 'Value',
        desc: 'The value to compare against. Can be a fixed value (e.g. "yes") or another variable.',
      },
    ],
    outputs: ['Yes: condition is true.', 'No: condition is false.'],
    notes:
      'If you connect a button to this block, it will automatically use the button text for the comparison, regardless of the "Condition type" setting.',
  },
  {
    title: 'Add delay',
    description: 'Pauses the flow for a specified number of seconds.',
    properties: [
      { name: 'Delay (seconds)', desc: 'The number of seconds to wait before proceeding.' },
      {
        name: 'Show typing indicator',
        desc: 'If checked, a "typing..." indicator will be shown during the delay.',
      },
    ],
    outputs: ['One main output that is followed after the delay is complete.'],
  },
  {
    title: 'Call API / webhook',
    description: 'Make a request to an external server and save parts of the response to variables.',
    properties: [
      { name: 'Method', desc: 'The HTTP method (GET, POST, PUT).' },
      { name: 'URL', desc: 'The endpoint URL. Variables are supported.' },
      { name: 'Headers / body', desc: 'JSON for headers or request body. Variables are supported.' },
      { name: 'Response to variable mappings', desc: 'Define how to extract data and save it to flow variables.' },
    ],
    outputs: ['One main output that is followed after the API call is complete.'],
    notes:
      'Use dot notation for the response path (e.g. `user.address.city` or `items[0].name`). The value is saved to the variable name you provide.',
  },
];

export default function FlowBuilderDocsPage() {
  return (
    <WaPage>
      <PageHeader
        title="Flow builder documentation"
        description="Learn about each building block and how to use them to create powerful WhatsApp automations."
        kicker="Wachat"
        eyebrowIcon={GitBranch}
        backHref="/wachat/flow-builder"
      />

      <Section title="Using variables" description="Variables let you personalize and use data dynamically.">
        <div className="space-y-3 text-[13px] leading-relaxed text-zinc-700">
          <p>
            Variables are placeholders for data that can change, such as a user's name or their answer
            to a question. Use double curly braces to insert a variable, like this{' '}
            <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-zinc-700">{`{{name}}`}</code>.
          </p>
          <p>
            The "Get user input" block is the primary way to create custom variables. When configured
            to save an answer to a variable named{' '}
            <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-zinc-700">color</code>, you can
            later use it by writing{' '}
            <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-zinc-700">{`{{color}}`}</code>{' '}
            in any send message block.
          </p>
          <p>
            Pre-defined variables you can use:{' '}
            <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-zinc-700">{`{{name}}`}</code>{' '}
            (WhatsApp profile name) and{' '}
            <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-zinc-700">{`{{waId}}`}</code>{' '}
            (their phone number).
          </p>
        </div>
      </Section>

      <div className="mt-6">
        <Section
          title="Common pattern: button-based menu"
          description="Present a menu to the user and perform an action based on their choice."
        >
          <ol className="list-inside list-decimal space-y-2 text-[13px] leading-relaxed text-zinc-700">
            <li>
              <strong>Add buttons block</strong>: create a button with the text "Show balance" and
              another with "Speak to agent".
            </li>
            <li>
              <strong>Add condition block</strong>: configure it to check if the input{' '}
              <em>equals</em> the value "Show balance".
            </li>
            <li>
              <strong>Add API call block</strong>: fetch the balance from your server. Map the result
              to a variable named <code className="font-mono">balance</code>.
            </li>
            <li>
              <strong>Add message blocks</strong>: one saying "Your balance is {`{{balance}}`}",
              another saying "Connecting you to an agent...".
            </li>
            <li>
              <strong>Connect them</strong>: drag from the "Show balance" button output to the
              condition block; connect "Yes" to the API call block; connect the API call output to
              the balance message; connect "No" to the agent message.
            </li>
          </ol>
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-[12.5px] leading-relaxed text-zinc-700">
            <strong>Key insight:</strong> when you connect a button to a condition block, the block
            automatically uses the button text as the input to check. You don't need a separate "Get
            user input" block.
          </div>
        </Section>
      </div>

      <div className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Flow blocks</h2>
        <p className="mt-1 text-[13px] text-zinc-600">An overview of all available blocks and their configurations.</p>
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-200 bg-white">
        <Accordion type="single" collapsible className="w-full">
          {blockDocs.map((doc, index) => (
            <ZoruAccordionItem value={`item-${index}`} key={index} className="px-5">
              <ZoruAccordionTrigger>
                <span className="text-[14px] font-semibold tracking-tight text-zinc-950">{doc.title}</span>
              </ZoruAccordionTrigger>
              <ZoruAccordionContent>
                <div className="space-y-4 pt-2">
                  <p className="text-[13px] leading-relaxed text-zinc-600">{doc.description}</p>

                  <div className="space-y-2">
                    <h4 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Properties
                    </h4>
                    <ul className="list-inside list-disc space-y-1.5 text-[12.5px] leading-relaxed text-zinc-700">
                      {doc.properties.map((prop, pIndex) => (
                        <li key={pIndex}>
                          <strong>{prop.name}:</strong> {prop.desc}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Outputs</h4>
                    <ul className="list-inside list-disc space-y-1.5 text-[12.5px] leading-relaxed text-zinc-700">
                      {doc.outputs.map((out, oIndex) => (
                        <li key={oIndex}>{out}</li>
                      ))}
                    </ul>
                  </div>

                  {doc.notes && (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-[12.5px] leading-relaxed text-zinc-700">
                      <strong>Note:</strong> {doc.notes}
                    </div>
                  )}
                </div>
              </ZoruAccordionContent>
            </ZoruAccordionItem>
          ))}
        </Accordion>
      </div>
    </WaPage>
  );
}
