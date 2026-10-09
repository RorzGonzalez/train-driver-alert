/** "20/10/2026" -> "2026-10-20"; anything else is returned as given. */
export function ukDateToIso(s: string | null | undefined): string | null {
  const m = s?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return s?.trim() || null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
