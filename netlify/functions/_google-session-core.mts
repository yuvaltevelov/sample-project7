export function chooseRefreshToken(
  newlyIssued?: string,
  existing?: string,
): string | null {
  return newlyIssued?.trim() || existing?.trim() || null;
}

export function isAllowedEmail(email: string, allowedEmail?: string): boolean {
  const allowed = allowedEmail?.trim().toLowerCase();
  if (!allowed) return true;
  return email.trim().toLowerCase() === allowed;
}
