
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    // Dynamic import to ensure env vars are loaded first
    const { connectToDatabase } = await import('../src/lib/mongodb');

    console.log('Connecting to DB...');
    try {
        const { db } = await connectToDatabase();
        console.log('Connected.');

        const shortCode = 'YHJBer-';
        console.log(`Searching for shortCode: "${shortCode}"`);

        const result = await db.collection('short_urls').findOne({ shortCode });

        if (result) {
            console.log('Found record:', JSON.stringify(result, null, 2));
        } else {
            console.log('No record found for that shortCode.');

            // Also check for any with regex just in case involved hidden chars
            const regexResult = await db.collection('short_urls').findOne({ shortCode: { $regex: new RegExp(`^${shortCode}$`) } });
            if (regexResult) {
                console.log('Found via regex(only):', JSON.stringify(regexResult, null, 2));
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }

    process.exit(0);
}

main();
