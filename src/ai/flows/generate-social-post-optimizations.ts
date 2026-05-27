'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InputSchema = z.object({
  content: z.string().describe('The content of the social media post.'),
  platform: z.string().describe('The platform (e.g., facebook, twitter).')
});

type GenerateSocialPostOptimizationsInput = z.infer<typeof InputSchema>;

const OutputSchema = z.object({
  suggestedTags: z.array(z.string()).describe('An array of suggested hashtags or tags.'),
  optimalPostingTime: z.string().describe('The suggested optimal posting time (e.g., "Tuesday 10:00 AM" or ISO string).')
});

type GenerateSocialPostOptimizationsOutput = z.infer<typeof OutputSchema>;

const generateSocialPostOptimizationsFlow = ai.defineFlow(
  {
    name: 'generateSocialPostOptimizationsFlow',
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
  },
  async input => {
    const { output } = await generateSocialPostOptimizationsPrompt(input);
    return output!;
  }
);

const generateSocialPostOptimizationsPrompt = ai.definePrompt({
  name: 'generateSocialPostOptimizationsPrompt',
  input: { schema: InputSchema },
  output: { schema: OutputSchema },
  prompt: `You are a social media marketing expert. Analyze the following content and platform to suggest an optimal posting time to maximize engagement, and a list of highly relevant tags.

Platform: {{{platform}}}
Content: {{{content}}}

Return a JSON object containing the optimal posting time and an array of suggested tags.`,
});

export async function generateSocialPostOptimizations(input: GenerateSocialPostOptimizationsInput): Promise<GenerateSocialPostOptimizationsOutput> {
  return generateSocialPostOptimizationsFlow(input);
}
