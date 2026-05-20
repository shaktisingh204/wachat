/** Pure utility: stable duplicate-detection key for a lead field value. */
export function leadDuplicateSignature(key: 'email' | 'phone', value: string): string {
  return `${key}:${value.trim().toLowerCase()}`;
}
