import { ai } from './src/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai';
import { z } from 'genkit';

async function main() {
  try {
    const result = await ai.generate({
      model: gemini15Flash,
      prompt: "Give me a simple JSON object with a greeting",
      output: { schema: z.object({ message: z.string() }) }
    });
    console.log(result.output);
  } catch (e) {
    console.error(e);
  }
}
main();
