export function normalizeEmail(input?: string | null) {
  if (!input) return null;
  const candidate = input.trim().toLowerCase();
  if (!candidate.includes("@")) return null;
  return candidate;
}
