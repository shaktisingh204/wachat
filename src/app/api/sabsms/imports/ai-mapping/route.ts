import { NextResponse } from "next/server";

import { ai } from "@/ai/genkit";
import { gemini15Flash } from "@genkit-ai/googleai";
import { z } from "genkit";

/**
 * AI column-mapping for the CSV import wizard. Given the uploaded file's
 * headers (and a few sample rows) it asks the shared Genkit instance to
 * map standard contact fields onto the source columns.
 *
 * Uses the canonical `ai.generate({ output: { schema } })` contract from
 * `src/ai/genkit.ts` (the previous `@genkit-ai/ai` `generate()` call was
 * a broken signature — wrong arg count + a non-callable `.text`).
 */

const MappingSchema = z.object({
  phone: z.string().nullish(),
  name: z.string().nullish(),
  email: z.string().nullish(),
  tags: z.string().nullish(),
});

export async function POST(request: Request) {
  try {
    const { headers, sampleRows } = await request.json();

    if (!headers || !Array.isArray(headers)) {
      return NextResponse.json({ error: "Missing headers" }, { status: 400 });
    }

    const prompt = `
You map CSV columns to standard contact fields.
Given the CSV headers and some sample rows, return the exact source header
name for each standard field. If a field is not present, set it to null.

Standard fields:
- phone (the primary phone number)
- name (the person's full name, or first name if no full name)
- email (the email address)
- tags (a column containing tags/labels/categories)

Headers: ${headers.join(", ")}
Sample Rows: ${JSON.stringify(sampleRows ?? [])}
`;

    const { output } = await ai.generate({
      model: gemini15Flash,
      prompt,
      config: { temperature: 0.1 },
      output: { schema: MappingSchema },
    });

    // Drop null/absent fields so the wizard only auto-fills confident hits.
    const mapping: Record<string, string> = {};
    if (output) {
      for (const [field, header] of Object.entries(output)) {
        if (typeof header === "string" && header.trim()) {
          mapping[field] = header;
        }
      }
    }

    return NextResponse.json({ mapping });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI mapping failed";
    console.error("AI mapping error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
