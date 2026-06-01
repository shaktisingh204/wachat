// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: Activates the Postgres `unaccent` extension and creates a custom IMMUTABLE wrapper function.
// This is a pure Postgres/full-text-search feature with no direct Mongo analogue.
// In SabNode/Mongo, accent-insensitive text search is handled by MongoDB Atlas Search with
// the `diacriticSensitive: false` option, or by normalising text before insert using a
// helper such as `str.normalize("NFD").replace(/\p{M}/gu, "")`.

/**
 * Migration 1758117800000 – ActivateUnaccentExtension
 *
 * Postgres intent:
 *   UP:   CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
 *         CREATE OR REPLACE FUNCTION public.unaccent_immutable(input text) RETURNS text ...
 *   DOWN: DROP FUNCTION IF EXISTS public.unaccent_immutable(text);
 *
 * Mongo equivalent:
 *   No DDL required.  Text normalisation should be applied at the application layer before
 *   persisting searchable strings, or Atlas Search / $text with `diacriticSensitive: false`
 *   should be used for accent-insensitive queries.
 */

export const migrationNote = {
  id: "1758117800000",
  name: "ActivateUnaccentExtension",
  mongoEquivalent:
    "No-op – use Atlas Search diacriticSensitive:false or NFD normalisation at write time",
} as const;
