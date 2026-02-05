import { connectToDatabase } from '@/lib/mongodb';
import { SeoCrawler } from '@/lib/seo/crawler';

export async function getResources() {
    const { db } = await connectToDatabase();
    // Lazy load crawler if needed, though for rank worker we might not need Puppeteer
    const crawler = new SeoCrawler();
    return { db, crawler };
}
