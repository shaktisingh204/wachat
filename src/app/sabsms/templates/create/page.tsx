import { redirect } from "next/navigation";

/**
 * Legacy `/sabsms/templates/create` was a dead mock (no save handler,
 * fake DLT import, hardcoded duplicate-check). The canonical create
 * surface is the real template editor at `/sabsms/templates/new`
 * (`templates/[id]/page.tsx` with `id === "new"`), which is fully wired
 * to the template store (saveDraft / publishTemplate / submitForApproval).
 * This route now redirects there so no one lands on the theater page.
 */
export default function CreateTemplateRedirect(): never {
  redirect("/sabsms/templates/new");
}
