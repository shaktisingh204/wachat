"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Separator } from '@/components/sabcrm/20ui';
import {
  useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * /dashboard/facebook/custom-ecommerce/manage/[shopId]/flow-builder/docs
 *
 * Inline reference for the flow builder. All sections live inside a
 * `ZoruAccordion` (per the directive). Visuals are rebuilt on top of zoru
 * primitives — no clay, no @/components/ui/*, no wabasimplify visuals.
 */

import * as React from "react";
import Link from "next/link";

const blockDocs: Array<{
  title: string;
  description: string;
  properties: { name: string; desc: string }[];
  outputs: string[];
  notes?: string;
}> = [
  {
    title: "Start",
    description:
      "Every flow must begin with a Start block. This defines how the flow is triggered.",
    properties: [
      {
        name: "Trigger keywords",
        desc: 'A comma-separated list of words. If an incoming message contains any of these words, this flow will begin. (e.g., "help, support, menu")',
      },
    ],
    outputs: [
      "One main output that connects to the first block of your flow.",
    ],
  },
  {
    title: "Send message",
    description: "Sends a simple text message to the user.",
    properties: [
      {
        name: "Message text",
        desc: 'The content of the message you want to send. You can use variables here, like "Hello {{name}}".',
      },
    ],
    outputs: [
      "One main output to continue the flow after the message is sent.",
    ],
  },
  {
    title: "Send image",
    description: "Sends an image with an optional caption.",
    properties: [
      {
        name: "Image URL",
        desc: "A public URL for the image you want to send. Must be a direct link to a JPG or PNG file.",
      },
      {
        name: "Caption",
        desc: "Optional text that will be sent along with the image.",
      },
    ],
    outputs: ["One main output to continue the flow."],
  },
  {
    title: "Add quick replies",
    description:
      "Sends a message with interactive quick reply buttons. The user’s choice can be used to branch the flow.",
    properties: [
      { name: "Message text", desc: "The text that appears above the buttons." },
      {
        name: "Quick replies",
        desc: "You can add up to 13 quick reply buttons. Each button press can lead to a different path in your flow.",
      },
    ],
    outputs: [
      "Each button acts as its own output path. Connect each button to a different block to create branching logic.",
    ],
    notes:
      "This block waits for the user to press a button before continuing.",
  },
  {
    title: "Get user input",
    description:
      "Asks the user a question and saves their text response to a variable.",
    properties: [
      {
        name: "Question to ask",
        desc: "The message sent to the user to prompt their input.",
      },
      {
        name: "Save answer to variable",
        desc: 'The name of the variable where the user’s reply will be stored (e.g., "user_name"). Do not use brackets here.',
      },
    ],
    outputs: [
      "One main output that is followed after the user provides their response.",
    ],
    notes:
      "This block waits for the user to send a text message before continuing.",
  },
  {
    title: "Add condition",
    description:
      "Create branches in your flow based on rules and variables. This block can either check a pre-existing variable or pause the flow to wait for the user’s next message.",
    properties: [
      {
        name: "Condition type",
        desc: 'Choose what to check. "Variable" checks data already saved in a variable. "User response" pauses the flow and checks the next message the user sends.',
      },
      {
        name: "Variable (if type is Variable)",
        desc: "The variable to check, e.g., {{user_input}} or {{age}}.",
      },
      {
        name: "Operator",
        desc: "The comparison to perform: Equals, Contains, Is one of, etc.",
      },
      {
        name: "Value",
        desc: 'The value to compare against. This can be a fixed value (e.g., "yes") or another variable (e.g., {{expected_answer}}).',
      },
    ],
    outputs: [
      "Yes: If the condition is true.",
      "No: If the condition is false.",
    ],
    notes:
      'If you connect a button to this block, it will automatically use the button’s text for the condition check, regardless of the "Condition type" setting.',
  },
  {
    title: "Add delay",
    description: "Pauses the flow for a specified number of seconds.",
    properties: [
      {
        name: "Delay (seconds)",
        desc: "The number of seconds to wait before proceeding.",
      },
      {
        name: "Show typing indicator",
        desc: 'If checked, a "typing…" indicator will be shown to the user during the delay.',
      },
    ],
    outputs: [
      "One main output that is followed after the delay is complete.",
    ],
  },
  {
    title: "Call API / webhook",
    description:
      "Make a request to an external server or API and save parts of the response to variables.",
    properties: [
      {
        name: "Method",
        desc: "The HTTP method for the request (GET, POST, PUT).",
      },
      {
        name: "URL",
        desc: "The endpoint URL to send the request to. You can use variables here.",
      },
      {
        name: "Headers / body",
        desc: "Provide JSON for request headers or the request body. Variables are supported.",
      },
      {
        name: "Response to variable mappings",
        desc: "Define how to extract data from the API response and save it to flow variables.",
      },
    ],
    outputs: [
      "One main output that is followed after the API call is complete.",
    ],
    notes:
      "Use dot notation for the response path (e.g., `user.address.city` or `items[0].name`).",
  },
];

export default function FlowBuilderDocsPage() {
  const params = useParams();
  const shopId = params?.shopId as string | undefined;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button variant="ghost" asChild className="-ml-2 mb-4">
          <Link
            href={`/dashboard/facebook/custom-ecommerce/manage/${shopId}/flow-builder`}
          >
            <ChevronLeft />
            Back to flow builder
          </Link>
        </Button>
        <h2 className="text-[24px] tracking-tight text-[var(--st-text)]">
          Flow builder documentation
        </h2>
        <p className="mt-2 max-w-3xl text-[14px] text-[var(--st-text-secondary)]">
          Welcome to the Flow Builder guide. Here you can learn about each
          building block and how to use them to create powerful automations
          for your Messenger conversations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Using variables</CardTitle>
          <CardDescription>
            Variables let you personalize your flows and use data
            dynamically.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4 text-sm">
          <p>
            Variables are placeholders for data that can change, such as a
            user&rsquo;s name or their answer to a question. In the Flow
            Builder you use double curly braces to insert a variable, like
            this:{" "}
            <Badge variant="outline" className="font-mono">
              {"{{name}}"}
            </Badge>
            .
          </p>
          <p>
            The &ldquo;Get user input&rdquo; block is the primary way to
            create custom variables. When you configure it to save an answer
            to a variable named{" "}
            <Badge variant="outline">color</Badge>, you can later
            use the user&rsquo;s answer by writing{" "}
            <Badge variant="outline" className="font-mono">
              {"{{color}}"}
            </Badge>{" "}
            in a &ldquo;Send message&rdquo; block.
          </p>
          <p>
            Pre-defined variables you can also use:{" "}
            <Badge variant="outline" className="font-mono">
              {"{{name}}"}
            </Badge>{" "}
            (the user&rsquo;s Messenger profile name) and{" "}
            <Badge variant="outline" className="font-mono">
              {"{{psid}}"}
            </Badge>{" "}
            (the user&rsquo;s unique Page-Scoped ID).
          </p>
        </CardBody>
      </Card>

      <Separator />

      <div>
        <h3 className="text-[20px] tracking-tight text-[var(--st-text)]">
          Flow blocks
        </h3>
        <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
          An overview of all available blocks and their configurations.
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {blockDocs.map((doc, index) => (
          <AccordionItem value={`item-${index}`} key={index}>
            <AccordionTrigger className="text-base">
              {doc.title}
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <p className="text-[14px] text-[var(--st-text-secondary)]">
                {doc.description}
              </p>
              <div className="space-y-2">
                <h4 className="text-sm tracking-tight text-[var(--st-text)]">
                  Properties
                </h4>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {doc.properties.map((prop, pIndex) => (
                    <li key={pIndex}>
                      <strong>{prop.name}:</strong> {prop.desc}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm tracking-tight text-[var(--st-text)]">
                  Outputs
                </h4>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {doc.outputs.map((out, oIndex) => (
                    <li key={oIndex}>{out}</li>
                  ))}
                </ul>
              </div>
              {doc.notes ? (
                <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm">
                  <p>
                    <strong>Note:</strong> {doc.notes}
                  </p>
                </div>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
