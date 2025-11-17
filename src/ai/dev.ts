import { config } from 'dotenv';
config();

if (process.env.NODE_ENV === "production") {
  process.env.GENKIT_DISABLE_SERVER = "1";
}

import '@/ai/flows/generate-post-suggestions.ts';
import '@/ai/flows/generate-promo-video.ts';
