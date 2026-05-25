import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, Collection } from 'mongodb';
import type { Review } from './types';

interface ReviewDoc extends Omit<Review, '_id'> {
  _id: ObjectId;
}

async function getReviewsCollection(): Promise<Collection<ReviewDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<ReviewDoc>('marketplace_reviews');
  try {
    await col.createIndex({ appId: 1, authorId: 1 }, { unique: true });
    await col.createIndex({ appId: 1 });
  } catch {}
  return col;
}

export async function submitReview(
  appId: string,
  tenantId: string,
  authorId: string,
  rating: number,
  body?: string
): Promise<void> {
  const reviews = await getReviewsCollection();
  const now = new Date();

  await reviews.updateOne(
    { appId, authorId },
    {
      $set: {
        appId,
        tenantId,
        authorId,
        rating,
        body,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );

  await updateAppRating(appId);
}

export async function getReview(appId: string, authorId: string): Promise<Review | null> {
  const reviews = await getReviewsCollection();
  const doc = await reviews.findOne({ appId, authorId });
  if (!doc) return null;
  return {
    _id: doc._id.toString(),
    appId: doc.appId,
    tenantId: doc.tenantId,
    authorId: doc.authorId,
    rating: doc.rating,
    body: doc.body,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function updateAppRating(appId: string) {
  const reviews = await getReviewsCollection();
  const appReviews = await reviews.find({ appId }).toArray();
  
  const count = appReviews.length;
  const avg = count > 0 ? appReviews.reduce((sum, r) => sum + r.rating, 0) / count : null;

  const { db } = await connectToDatabase();
  await db.collection('marketplace_apps').updateOne(
    { appId },
    { $set: { averageRating: avg, reviewCount: count } }
  );
}
