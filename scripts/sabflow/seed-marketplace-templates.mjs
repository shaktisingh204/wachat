#!/usr/bin/env node
/**
 * One-shot seed: upsert 10 first-party SabFlow templates into
 * `sabflow_marketplace_templates`.
 *
 * Phase C.10.9 — seed 10 first-party marketplace templates.
 *
 *   node scripts/sabflow/seed-marketplace-templates.mjs
 *
 * Idempotent — each document is upserted on `{ id }`, so running this script
 * multiple times is safe across dev / preview / prod without flag-guarding.
 *
 * Environment:
 *   MONGODB_URI   — required. MongoDB connection string.
 *   MONGODB_DB    — required. Target database name.
 *
 * Template files are read from:
 *   templates/<slug>/template.json
 *   templates/<slug>/flow.json
 *
 * The document shape written to the collection:
 *   {
 *     id:          string          (from template.json)
 *     name:        string
 *     description: string
 *     category:    string
 *     complexity:  string
 *     authorName:  string
 *     tags:        string[]
 *     version:     string
 *     flow:        object          (entire flow.json)
 *     source:      "first-party"
 *     updatedAt:   Date
 *     createdAt:   Date            (set only on insert via $setOnInsert)
 *   }
 */

import 'dotenv/config';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOG = '[sabflow:marketplace-templates:seed]';
const COLLECTION = 'sabflow_marketplace_templates';

// Resolve the templates/ directory from the repo root (two levels up from
// scripts/sabflow/).
const REPO_ROOT = resolve(__dirname, '..', '..');
const TEMPLATES_DIR = join(REPO_ROOT, 'templates');

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Read and JSON-parse a file. Throws if the file does not exist or is not
 * valid JSON, giving an actionable error message.
 *
 * @param {string} filePath
 * @returns {unknown}
 */
function readJson(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse JSON at ${filePath}: ${err.message}`);
  }
}

/**
 * Discover all non-hidden slug directories under templates/.
 *
 * @returns {string[]} slug names
 */
function discoverTemplateSlugs() {
  return readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.'))
    .map((entry) => entry.name);
}

/**
 * Load template metadata + flow for a given slug.
 *
 * @param {string} slug
 * @returns {{ meta: object, flow: object }}
 */
function loadTemplate(slug) {
  const dir = join(TEMPLATES_DIR, slug);
  const meta = readJson(join(dir, 'template.json'));
  const flow = readJson(join(dir, 'flow.json'));
  return { meta, flow };
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.MONGODB_URI || !process.env.MONGODB_DB) {
    console.error(
      `${LOG} MONGODB_URI and MONGODB_DB must be defined in the environment.`,
    );
    process.exit(1);
  }

  // Discover templates.
  let slugs;
  try {
    slugs = discoverTemplateSlugs();
  } catch (err) {
    console.error(`${LOG} Failed to read templates directory:`, err.message);
    process.exit(1);
  }

  if (slugs.length === 0) {
    console.warn(`${LOG} No template directories found under ${TEMPLATES_DIR}. Nothing to seed.`);
    process.exit(0);
  }

  console.log(`${LOG} discovered ${slugs.length} template(s): ${slugs.join(', ')}`);

  // Load all template data before connecting to MongoDB so we fail fast on any
  // malformed JSON, without leaving an open DB connection.
  const templates = [];
  for (const slug of slugs) {
    try {
      const { meta, flow } = loadTemplate(slug);
      templates.push({ slug, meta, flow });
    } catch (err) {
      console.error(`${LOG} [${slug}] skipping — ${err.message}`);
    }
  }

  if (templates.length === 0) {
    console.error(`${LOG} No valid templates loaded. Aborting.`);
    process.exit(1);
  }

  // Connect to MongoDB.
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    console.log(`${LOG} connected to db "${db.databaseName}"`);

    // Ensure the collection exists and has the id index.
    try {
      await db.createCollection(COLLECTION);
      console.log(`${LOG} created collection "${COLLECTION}"`);
    } catch (err) {
      if (err && err.codeName === 'NamespaceExists') {
        console.log(`${LOG} collection "${COLLECTION}" already exists`);
      } else {
        throw err;
      }
    }

    const col = db.collection(COLLECTION);

    // Ensure a unique index on id so upserts are safe.
    await col.createIndex({ id: 1 }, { name: 'id_1_unique', unique: true, background: true });
    console.log(`${LOG} index "id_1_unique" ensured`);

    // Upsert each template.
    const now = new Date();
    let upserted = 0;
    let modified = 0;
    let failed = 0;
    const total = templates.length;

    for (let i = 0; i < total; i++) {
      const { slug, meta, flow } = templates[i];

      const doc = {
        id: meta.id ?? slug,
        name: meta.name ?? slug,
        description: meta.description ?? '',
        category: meta.category ?? 'General',
        complexity: meta.complexity ?? 'beginner',
        authorName: meta.authorName ?? 'SabNode',
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        version: meta.version ?? '0.1.0',
        flow,
        source: 'first-party',
        updatedAt: now,
      };

      try {
        const result = await col.updateOne(
          { id: doc.id },
          {
            $set: doc,
            $setOnInsert: { createdAt: now },
          },
          { upsert: true },
        );

        const wasInsert = result.upsertedCount > 0;
        const wasUpdate = result.modifiedCount > 0;

        if (wasInsert) {
          upserted++;
          console.log(`${LOG} (${i + 1}/${total}) INSERTED "${doc.id}"`);
        } else if (wasUpdate) {
          modified++;
          console.log(`${LOG} (${i + 1}/${total}) UPDATED  "${doc.id}"`);
        } else {
          console.log(`${LOG} (${i + 1}/${total}) NO-OP    "${doc.id}" (already up-to-date)`);
        }
      } catch (err) {
        failed++;
        console.error(`${LOG} (${i + 1}/${total}) FAILED   "${doc.id}":`, err.message);
      }
    }

    console.log(
      `${LOG} done — ${total} processed: ${upserted} inserted, ${modified} updated, ${failed} failed`,
    );

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`${LOG} FAILED:`, err);
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => {
      /* ignore — exit path */
    });
  }
}

main();
