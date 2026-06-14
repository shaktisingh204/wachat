/**
 * SabSMS compliance keyword defaults.
 *
 * Mirror of the engine's compiled-in defaults (`services/sabsms-engine/src/
 * keywords.rs`). These are ALWAYS active and cannot be edited away — shown as
 * read-only context in the UI.
 *
 * Kept out of `./actions` (a `'use server'` file, which may only export async
 * functions) so the page can import these read-only defaults directly.
 */
export const ENGINE_DEFAULTS = {
  stop: ["STOP", "STOPALL", "UNSUB", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"],
  start: ["START", "UNSTOP"],
  help: ["HELP", "INFO"],
  confirmOptOutText: "You have been unsubscribed. Reply START to resubscribe.",
  helpText: "Reply STOP to unsubscribe.",
} as const;
