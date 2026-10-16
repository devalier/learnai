/**
 * The identity of a piece of content in The List. The same video placed in two
 * modules is two Resource rows and one piece of content; its URL is what they
 * share. Safe to import from client components.
 */
export function resourceKey(url: string): string {
  return url.trim().replace(/^http:\/\//, "https://").replace(/\/+$/, "");
}
