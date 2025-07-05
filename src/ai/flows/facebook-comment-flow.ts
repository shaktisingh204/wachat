
'use server';
/**
 * @fileOverview Manages AI-powered moderation and replies for Facebook comments.
 * - processFacebookComment: A function that decides whether to delete a comment or generate a reply.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ProcessCommentInputSchema = z.object({
  commentText: z.string().describe('The content of the Facebook comment.'),
  moderationPrompt: z
    .string()
    .optional()
    .describe(
      'A custom prompt defining what is considered abusive or should be deleted. If not provided, moderation is skipped.'
    ),
  replyPrompt: z
    .string()
    .optional()
    .describe(
      'A custom prompt for generating a reply. If not provided, reply generation is skipped.'
    ),
});
export type ProcessCommentInput = z.infer<typeof ProcessCommentInputSchema>;

const ProcessCommentOutputSchema = z.object({
  shouldDelete: z
    .boolean()
    .describe('Whether the comment should be deleted based on the moderation prompt.'),
  reason: z
    .string()
    .optional()
    .describe('The reason for deleting the comment.'),
  reply: z
    .string()
    .optional()
    .describe('The generated reply to the comment. This will only be present if shouldDelete is false and a replyPrompt was provided.'),
});
export type ProcessCommentOutput = z.infer<typeof ProcessCommentOutputSchema>;

export async function processFacebookComment(
  input: ProcessCommentInput
): Promise<ProcessCommentOutput> {
  return facebookCommentFlow(input);
}

const prompt = ai.definePrompt({
    name: 'facebookCommentProcessor',
    input: { schema: ProcessCommentInputSchema },
    output: { schema: ProcessCommentOutputSchema },
    prompt: `You are an expert social media manager for a brand. Your task is to process an incoming Facebook comment based on a set of rules.

    **Comment:**
    "{{{commentText}}}"

    **Moderation Rules:**
    {{#if moderationPrompt}}
    Your first task is to moderate the comment. Read the comment and decide if it violates the following rule:
    "{{moderationPrompt}}"
    If it does violate the rule, set 'shouldDelete' to true and provide a brief 'reason' for the deletion (e.g., "Violates profanity rules"). Do not generate a reply if the comment is to be deleted.
    {{else}}
    No moderation rules provided. 'shouldDelete' should be false.
    {{/if}}

    **Reply Generation Rules:**
    {{#if replyPrompt}}
    If and only if 'shouldDelete' is false, your second task is to generate a helpful and brand-appropriate reply to the comment.
    Use the following prompt as your guide for the reply:
    "{{replyPrompt}}"
    Generate the reply and put it in the 'reply' field.
    {{else}}
    No reply prompt provided. The 'reply' field should be empty.
    {{/if}}

    Provide your response in the specified JSON format.
    `,
});

const facebookCommentFlow = ai.defineFlow(
  {
    name: 'facebookCommentFlow',
    inputSchema: ProcessCommentInputSchema,
    outputSchema: ProcessCommentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
