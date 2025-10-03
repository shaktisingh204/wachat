'use server';
/**
 * @fileOverview A flow for generating a promotional video from a text prompt.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';
import { MediaPart } from 'genkit/media';

const GeneratePromoVideoInputSchema = z.object({
  prompt: z.string().describe('The text prompt describing the video to generate.'),
  durationSeconds: z.number().optional().default(5).describe('The duration of the video in seconds (5-8).'),
  aspectRatio: z.enum(['16:9', '9:16']).optional().default('16:9').describe('The aspect ratio of the video.'),
});
export type GeneratePromoVideoInput = z.infer<typeof GeneratePromoVideoInputSchema>;

const GeneratePromoVideoOutputSchema = z.object({
  videoUrl: z.string().describe("The generated video as a data URI in 'video/mp4' format."),
});
export type GeneratePromoVideoOutput = z.infer<typeof GeneratePromoVideoOutputSchema>;

export async function generatePromoVideo(input: GeneratePromoVideoInput): Promise<GeneratePromoVideoOutput> {
  return generatePromoVideoFlow(input);
}

const generatePromoVideoFlow = ai.defineFlow(
  {
    name: 'generatePromoVideoFlow',
    inputSchema: GeneratePromoVideoInputSchema,
    outputSchema: GeneratePromoVideoOutputSchema,
  },
  async (input) => {
    let { operation } = await ai.generate({
      model: googleAI.model('veo-2.0-generate-001'),
      prompt: input.prompt,
      config: {
        durationSeconds: input.durationSeconds,
        aspectRatio: input.aspectRatio,
      },
    });

    if (!operation) {
      throw new Error('Expected the model to return an operation for video generation.');
    }

    // Poll the operation status until it's complete
    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds before checking again
      operation = await ai.checkOperation(operation);
    }

    if (operation.error) {
      throw new Error(`Video generation failed: ${operation.error.message}`);
    }

    const videoPart = operation.output?.message?.content.find((p) => !!p.media) as MediaPart | undefined;
    if (!videoPart || !videoPart.media?.url) {
      throw new Error('Failed to find the generated video in the operation result.');
    }

    // The URL returned by Veo is a temporary download link. We need to fetch it
    // and convert it to a data URI to send back to the client.
    const fetch = (await import('node-fetch')).default;
    const videoDownloadResponse = await fetch(
        `${videoPart.media.url}&key=${process.env.GOOGLE_API_KEY}`
    );

    if (!videoDownloadResponse.ok || !videoDownloadResponse.body) {
        throw new Error(`Failed to download the generated video: ${videoDownloadResponse.statusText}`);
    }
    
    const videoBuffer = await videoDownloadResponse.buffer();
    const base64Video = videoBuffer.toString('base64');
    const videoUrl = `data:video/mp4;base64,${base64Video}`;

    return { videoUrl };
  }
);
