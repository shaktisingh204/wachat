'use server';

/**
 * CRM Skills + Employee-skill assignments — backed by Mongo collections
 * `crm_skills` and `crm_employee_skills`.
 *
 * Standalone (no Rust crate yet). Two related entities:
 *
 *   crm_skills            — catalog of skill names available org-wide
 *   crm_employee_skills   — N:M assignments { employeeId, skillId, level? }
 *
 * RBAC: `crm_skill` (catalog) + `crm_employee_skill` (assignment).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type Filter, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';

const COL_SKILLS = 'crm_skills';
const COL_ASSIGNMENTS = 'crm_employee_skills';
const SKILLS_PATH = '/dashboard/hrm/payroll/employees/skills';
const ASSIGN_PATH = '/dashboard/hrm/payroll/employees/employee-skills';

type CrmSkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

interface CrmSkillDoc {
  _id: string;
  name: string;
  category?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface CrmEmployeeSkillDoc {
  _id: string;
  employeeId: string;
  skillId: string;
  level?: CrmSkillLevel;
  yearsOfExperience?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function serialize<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc));
}

function pickStr(fd: FormData, k: string): string | undefined {
  const v = fd.get(k);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickNum(fd: FormData, k: string): number | undefined {
  const v = fd.get(k);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function pickBool(fd: FormData, k: string): boolean | undefined {
  const v = fd.get(k);
  if (v == null) return undefined;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(t)) return true;
    if (['false', '0', 'off', 'no'].includes(t)) return false;
  }
  return undefined;
}

const VALID_LEVELS: ReadonlySet<CrmSkillLevel> = new Set<CrmSkillLevel>([
  'beginner',
  'intermediate',
  'advanced',
  'expert',
]);

function mapSkill(doc: WithId<Record<string, unknown>>): CrmSkillDoc {
  return {
    _id: String(doc._id),
    name: String(doc.name ?? ''),
    category:
      typeof doc.category === 'string' && doc.category.trim()
        ? String(doc.category)
        : undefined,
    description:
      typeof doc.description === 'string' && doc.description.trim()
        ? String(doc.description)
        : undefined,
    isActive: doc.isActive !== false,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : (doc.createdAt as string | undefined),
    updatedAt:
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : (doc.updatedAt as string | undefined),
  };
}

function mapAssignment(
  doc: WithId<Record<string, unknown>>,
): CrmEmployeeSkillDoc {
  return {
    _id: String(doc._id),
    employeeId: String(doc.employeeId ?? ''),
    skillId: String(doc.skillId ?? ''),
    level:
      typeof doc.level === 'string' && VALID_LEVELS.has(doc.level as CrmSkillLevel)
        ? (doc.level as CrmSkillLevel)
        : undefined,
    yearsOfExperience:
      typeof doc.yearsOfExperience === 'number'
        ? doc.yearsOfExperience
        : undefined,
    notes:
      typeof doc.notes === 'string' && doc.notes.trim()
        ? String(doc.notes)
        : undefined,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : (doc.createdAt as string | undefined),
    updatedAt:
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : (doc.updatedAt as string | undefined),
  };
}

/* ── Skills catalog ──────────────────────────────────────────────── */

interface SkillListParams {
  q?: string;
  category?: string;
  limit?: number;
}

export async function listSkills(
  options: SkillListParams = {},
): Promise<{ items: CrmSkillDoc[]; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { items: [], error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    const filter: Filter<Record<string, unknown>> = {
      userId: new ObjectId(session.user._id),
    };
    if (options.q) filter.name = { $regex: options.q.trim(), $options: 'i' };
    if (options.category) filter.category = options.category;
    const limit = Math.min(Math.max(1, options.limit ?? 200), 500);
    const docs = await db
      .collection(COL_SKILLS)
      .find(filter)
      .sort({ name: 1 })
      .limit(limit)
      .toArray();
    return { items: docs.map((d) => mapSkill(serialize(d))) };
  } catch (e) {
    return {
      items: [],
      error: e instanceof Error ? e.message : 'Failed to list skills.',
    };
  }
}

export async function saveSkillAction(
  _prev: unknown,
  fd: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const id = pickStr(fd, '_id');
  const name = pickStr(fd, 'name');
  if (!name) return { error: 'Skill name is required.' };

  const guard = await requirePermission('crm_skill', id ? 'edit' : 'create');
  if (!guard.ok) return { error: guard.error };

  const draft: Record<string, unknown> = {
    name,
    category: pickStr(fd, 'category'),
    description: pickStr(fd, 'description'),
    isActive: pickBool(fd, 'isActive') ?? true,
  };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const now = new Date();

    if (id && ObjectId.isValid(id)) {
      await db.collection(COL_SKILLS).updateOne(
        { _id: new ObjectId(id), userId },
        { $set: { ...draft, updatedAt: now } },
      );
      revalidatePath(SKILLS_PATH);
      revalidatePath(ASSIGN_PATH);
      return { message: 'Skill updated.', id };
    }

    const result = await db.collection(COL_SKILLS).insertOne({
      ...draft,
      userId,
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath(SKILLS_PATH);
    return { message: 'Skill created.', id: result.insertedId.toString() };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Failed to save skill.',
    };
  }
}

export async function deleteSkillAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  if (!ObjectId.isValid(id))
    return { success: false, error: 'Invalid id.' };

  const guard = await requirePermission('crm_skill', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    // Cascade: remove any assignments referencing this skill first.
    await db.collection(COL_ASSIGNMENTS).deleteMany({
      skillId: new ObjectId(id),
      userId,
    });
    await db.collection(COL_SKILLS).deleteOne({
      _id: new ObjectId(id),
      userId,
    });
    revalidatePath(SKILLS_PATH);
    revalidatePath(ASSIGN_PATH);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to delete skill.',
    };
  }
}

/* ── Employee-skill assignments ──────────────────────────────────── */

interface EmployeeSkillListParams {
  employeeId?: string;
  skillId?: string;
  limit?: number;
}

export async function listEmployeeSkills(
  options: EmployeeSkillListParams = {},
): Promise<{ items: CrmEmployeeSkillDoc[]; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { items: [], error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    const filter: Filter<Record<string, unknown>> = {
      userId: new ObjectId(session.user._id),
    };
    if (options.employeeId && ObjectId.isValid(options.employeeId)) {
      filter.employeeId = new ObjectId(options.employeeId);
    }
    if (options.skillId && ObjectId.isValid(options.skillId)) {
      filter.skillId = new ObjectId(options.skillId);
    }
    const limit = Math.min(Math.max(1, options.limit ?? 200), 500);
    const docs = await db
      .collection(COL_ASSIGNMENTS)
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return { items: docs.map((d) => mapAssignment(serialize(d))) };
  } catch (e) {
    return {
      items: [],
      error: e instanceof Error ? e.message : 'Failed to list assignments.',
    };
  }
}

export async function saveEmployeeSkillAction(
  _prev: unknown,
  fd: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const id = pickStr(fd, '_id');
  const employeeIdRaw = pickStr(fd, 'employeeId');
  const skillIdRaw = pickStr(fd, 'skillId');
  if (!employeeIdRaw || !ObjectId.isValid(employeeIdRaw))
    return { error: 'Employee is required.' };
  if (!skillIdRaw || !ObjectId.isValid(skillIdRaw))
    return { error: 'Skill is required.' };

  const guard = await requirePermission(
    'crm_employee_skill',
    id ? 'edit' : 'create',
  );
  if (!guard.ok) return { error: guard.error };

  const levelRaw = pickStr(fd, 'level');
  const level: CrmSkillLevel | undefined =
    levelRaw && VALID_LEVELS.has(levelRaw as CrmSkillLevel)
      ? (levelRaw as CrmSkillLevel)
      : undefined;

  const draft: Record<string, unknown> = {
    employeeId: new ObjectId(employeeIdRaw),
    skillId: new ObjectId(skillIdRaw),
    level,
    yearsOfExperience: pickNum(fd, 'yearsOfExperience'),
    notes: pickStr(fd, 'notes'),
  };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const now = new Date();

    if (id && ObjectId.isValid(id)) {
      await db.collection(COL_ASSIGNMENTS).updateOne(
        { _id: new ObjectId(id), userId },
        { $set: { ...draft, updatedAt: now } },
      );
      revalidatePath(ASSIGN_PATH);
      return { message: 'Assignment updated.', id };
    }

    // Prevent duplicate (employeeId, skillId) on insert.
    const existing = await db.collection(COL_ASSIGNMENTS).findOne({
      userId,
      employeeId: new ObjectId(employeeIdRaw),
      skillId: new ObjectId(skillIdRaw),
    });
    if (existing) {
      return { error: 'This employee already has that skill assigned.' };
    }

    const result = await db.collection(COL_ASSIGNMENTS).insertOne({
      ...draft,
      userId,
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath(ASSIGN_PATH);
    return {
      message: 'Skill assigned.',
      id: result.insertedId.toString(),
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Failed to save assignment.',
    };
  }
}

export async function deleteEmployeeSkillAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  if (!ObjectId.isValid(id))
    return { success: false, error: 'Invalid id.' };

  const guard = await requirePermission('crm_employee_skill', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const { db } = await connectToDatabase();
    await db.collection(COL_ASSIGNMENTS).deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id),
    });
    revalidatePath(ASSIGN_PATH);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to delete assignment.',
    };
  }
}
