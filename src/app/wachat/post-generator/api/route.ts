import { ai } from '@/ai/genkit';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || !lastMessage.content) {
      return new Response('Missing input', { status: 400 });
    }

    const prompt = `You are a social media expert. Given the following Facebook data, generate 3 engaging social media posts. Separate each post suggestion strictly with the string "---". Do not add any other markdown blocks or headings for the separation.

Facebook Data: ${lastMessage.content}

Post Suggestions:`;

    const { stream } = await ai.generateStream(prompt);
    
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          // Vercel AI SDK expects data-stream v1 format.
          // Format for text: 0:"text"
          if (chunk.text) {
            controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(chunk.text)}\n`));
          }
        }
        controller.close();
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-vercel-ai-data-stream': 'v1'
      }
    });
  } catch (error) {
    console.error('Streaming error:', error);
    return new Response('Error during generation', { status: 500 });
  }
}
