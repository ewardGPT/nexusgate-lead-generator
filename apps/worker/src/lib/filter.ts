export function shouldKeepLead(site: string | undefined | null) {
  return !site || site.trim() === "";
}
