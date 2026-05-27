'use server';

/**
 * Public project-rating actions — back `/share/project-rating/[hash]`.
 *
 * Lookup keyed on `crm_projects.publicRatingHash` (separate from the
 * Gantt/Taskboard `publicHash` so admin can share a rating link without
 * exposing the full project board).
 *
 * Writes:
 *   crm_project_ratings — one row per submission, IP captured for
 *   light-touch dedupe. No auth.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { isValidPublicHash } from '@/lib/public-hash';

type PublicProjectRatingCategories = {
  communication: number;
  quality: number;
  timeliness: number;
  value: number;
};

type PublicProjectRatingSubmission = {
  overall: number;
  categories: PublicProjectRatingCategories;
  comment: string;
  raterName?: string;
  raterEmail?: string;
};

type SyndicationUrl = {
  platform: string;
  url: string;
};

type PublicProjectRatingView = {
  project: {
    _id: string;
    name: string;
    clientName: string | null;
    syndicationUrls?: SyndicationUrl[];
  };
  alreadyRated: boolean;
  existingRating?: {
    overall: number;
    comment: string;
  };
};

type PublicProjectRatingResult =
  | { success: true; message: string }
  | { success: false; error: string };

async function clientMeta(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  try {
    const h = await headers();
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      null;
    const userAgent = h.get('user-agent') || null;
    return { ip, userAgent };
  } catch {
    return { ip: null, userAgent: null };
  }
}

function clampRating(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export async function getPublicProjectRating(
  hash: string,
): Promise<PublicProjectRatingView | null> {
  if (!isValidPublicHash(hash)) return null;
  try {
    const { db } = await connectToDatabase();
    const project = await db
      .collection('crm_projects')
      .findOne({ publicRatingHash: hash });
    if (!project) return null;

    const meta = await clientMeta();
    let alreadyRated = false;
    let existingRating: { overall: number; comment: string } | undefined;

    if (meta.ip) {
      const existing = await db.collection('crm_project_ratings').findOne({
        projectId: project._id,
        raterIp: meta.ip,
      });
      if (existing) {
        alreadyRated = true;
        existingRating = {
          overall: existing.rating || 0,
          comment: existing.comment || '',
        };
      }
    }

    return {
      project: {
        _id: (project._id as ObjectId).toString(),
        name:
          (project.name as string) ||
          (project.projectName as string) ||
          'Project',
        clientName: (project.clientName as string | undefined) ?? null,
        syndicationUrls: Array.isArray(project.syndicationUrls)
          ? project.syndicationUrls
          : [
              { platform: 'Google', url: 'https://google.com' },
              { platform: 'G2', url: 'https://g2.com' },
            ],
      },
      alreadyRated,
      existingRating,
    };
  } catch (e) {
    console.error('[getPublicProjectRating] failed:', e);
    return null;
  }
}

export async function submitProjectRating(
  hash: string,
  data: PublicProjectRatingSubmission,
): Promise<PublicProjectRatingResult> {
  if (!isValidPublicHash(hash)) {
    return { success: false, error: 'Invalid link.' };
  }
  const overall = clampRating(data.overall);
  if (!overall) {
    return { success: false, error: 'Please pick an overall rating.' };
  }
  const categories: PublicProjectRatingCategories = {
    communication: clampRating(data.categories?.communication),
    quality: clampRating(data.categories?.quality),
    timeliness: clampRating(data.categories?.timeliness),
    value: clampRating(data.categories?.value),
  };
  try {
    const { db } = await connectToDatabase();
    const project = await db
      .collection('crm_projects')
      .findOne({ publicRatingHash: hash });
    if (!project) return { success: false, error: 'Project not found.' };

    const tenantUserId = project.userId as ObjectId | string | undefined;
    if (!tenantUserId) {
      return { success: false, error: 'Project has no owner.' };
    }

    const meta = await clientMeta();
    if (meta.ip) {
      const dupe = await db.collection('crm_project_ratings').findOne({
        projectId: project._id,
        raterIp: meta.ip,
      });
      if (dupe) {
        return {
          success: false,
          error: "You've already submitted feedback for this project.",
        };
      }
    }

    const now = new Date();
    await db.collection('crm_project_ratings').insertOne({
      userId: tenantUserId,
      projectId: project._id,
      rating: overall,
      categories,
      comment: (data.comment || '').slice(0, 4000),
      raterName: (data.raterName || '').slice(0, 200) || null,
      raterEmail: (data.raterEmail || '').slice(0, 200) || null,
      raterIp: meta.ip,
      raterUserAgent: meta.userAgent,
      source: 'public-share',
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath(`/share/project-rating/${hash}`);
    return {
      success: true,
      message: 'Thank you! Your feedback has been recorded.',
    };
  } catch (e) {
    console.error('[submitProjectRating] failed:', e);
    return {
      success: false,
      error: (e as Error)?.message || 'Could not save feedback.',
    };
  }
}
