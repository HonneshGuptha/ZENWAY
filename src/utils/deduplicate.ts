/**
 * Deduplicates an array of items with unique `id` properties.
 * If duplicate IDs are encountered, the first occurrence is preserved.
 */
export function deduplicateById<T extends { id: string | number }>(items: T[]): T[] {
  if (!items || !Array.isArray(items)) return []
  const seen = new Set<string | number>()
  return items.filter((item) => {
    if (!item || item.id == null) return false
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

/**
 * Merges a new item or list of items into an existing array, ensuring no duplicates by `id`.
 * Newer items take precedence if updated.
 */
export function mergeDeduplicatedById<T extends { id: string | number }>(
  existing: T[],
  incoming: T[] | T
): T[] {
  const incomingList = Array.isArray(incoming) ? incoming : [incoming]
  const map = new Map<string | number, T>()

  for (const item of existing || []) {
    if (item && item.id != null) {
      map.set(item.id, item)
    }
  }
  for (const item of incomingList) {
    if (item && item.id != null) {
      map.set(item.id, item)
    }
  }

  return Array.from(map.values())
}
