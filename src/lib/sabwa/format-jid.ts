/**
 * Convert a WhatsApp JID into a human-friendly display string.
 *
 * - `91XXXXXXXXXX@s.whatsapp.net` → `+91 XXXXX XXXXX` (formatted)
 * - `12345@lid`                    → `Linked ID · 12345`
 * - `1234567890-1234@g.us`         → `Group · 1234567890`  (truncated)
 * - `status@broadcast`             → `Status`
 * - falls back to the raw JID
 *
 * Pass a `displayName` (chat.name / contact.pushName) to short-circuit.
 */
export function formatJid(
  jid: string | undefined,
  displayName?: string | null,
): string {
  if (displayName?.trim()) return displayName.trim();
  if (!jid) return 'Unknown';
  const at = jid.indexOf('@');
  if (at === -1) return jid;
  const local = jid.slice(0, at);
  const host = jid.slice(at + 1);
  if (host === 's.whatsapp.net' || host === 'c.us') {
    // Format as international phone: take all digits, prepend +.
    const digits = local.replace(/\D/g, '');
    if (digits.length >= 10) {
      const cc = digits.slice(0, digits.length - 10);
      const ten = digits.slice(-10);
      return `+${cc} ${ten.slice(0, 5)} ${ten.slice(5)}`;
    }
    return `+${digits}`;
  }
  if (host === 'lid') {
    return `Linked ID · ${local.slice(-6)}`;
  }
  if (host === 'g.us') {
    return `Group · ${local.slice(0, 12)}`;
  }
  if (host === 'broadcast') return local === 'status' ? 'Status' : `Broadcast · ${local}`;
  return jid;
}
