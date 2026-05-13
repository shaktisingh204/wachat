/**
 * Legacy `<EditContactForm>` — no longer used at runtime. The
 * `/dashboard/crm/sales/contacts/[contactId]/edit/page.tsx` route now
 * permanently redirects to the canonical
 * `/dashboard/crm/sales-crm/contacts/[contactId]/edit` route. The named
 * export is preserved as a typed re-export so any stale import path
 * still resolves (and TypeScript flags consumers, who can switch to the
 * canonical form module).
 *
 * @deprecated Use `<ContactForm>` from
 * `src/app/dashboard/crm/sales-crm/contacts/_components/contacts-form`.
 */

export { ContactForm as EditContactForm } from '../../../../sales-crm/contacts/_components/contacts-form';
