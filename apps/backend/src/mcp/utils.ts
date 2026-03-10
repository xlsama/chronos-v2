/**
 * Slugify a connection name for use in tool naming.
 * Removes non-alphanumeric characters, replaces with underscore, lowercases.
 * Chinese characters are removed (description carries the original name).
 */
export function slugify(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
}
