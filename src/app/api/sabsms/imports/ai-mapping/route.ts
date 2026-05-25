import { NextResponse } from "next/server";
import { gemini15Flash } from "@genkit-ai/googleai";
import { generate } from "@genkit-ai/ai";

export async function POST(request: Request) {
  try {
    const { headers, sampleRows } = await request.json();
    
    if (!headers || !Array.isArray(headers)) {
      return NextResponse.json({ error: "Missing headers" }, { status: 400 });
    }

    const prompt = `
You are an AI that maps CSV columns to standard CRM fields.
Given the following CSV headers and some sample rows, return a JSON object mapping the standard fields to the exact CSV header names.
If a field is not present, omit it or set it to null.
The fields are:
- phone (the primary phone number)
- name (the person's full name, or first name if no full name)
- email (the email address)
- tags (a column containing tags/labels/categories)

Headers: ${headers.join(", ")}
Sample Rows: ${JSON.stringify(sampleRows)}

Return ONLY valid JSON in this format, and no markdown formatting or backticks:
{
  "phone": "Header Name",
  "name": "Header Name",
  "email": "Header Name",
  "tags": "Header Name"
}
`;

    const response = await generate({
      model: gemini15Flash,
      prompt,
      config: {
        temperature: 0.1,
      },
    });

    const text = response.text;
    let cleanText = text;
    if (typeof text === 'function') {
        cleanText = text();
    }
    cleanText = cleanText.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
    const mapping = JSON.parse(cleanText);

    return NextResponse.json({ mapping });
  } catch (error: any) {
    console.error("AI mapping error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
