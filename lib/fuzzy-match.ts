const NOISE = new Set([
  "gmbh",
  "ag",
  "se",
  "sa",
  "ltd",
  "llc",
  "inc",
  "co",
  "corp",
  "kg",
  "kgaa",
])

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((part) => part && !NOISE.has(part))
    .join(" ")
}

function bigrams(value: string): Set<string> {
  const grams = new Set<string>()
  for (let i = 0; i < value.length - 1; i++) grams.add(value.slice(i, i + 2))
  return grams
}

/** Dice coefficient on character bigrams with a containment boost. */
export function fuzzyScore(query: string, target: string): number {
  const q = normalize(query)
  const t = normalize(target)
  if (!q || !t) return 0
  if (q === t) return 1
  if (t.includes(q) || q.includes(t)) return 0.9
  const qb = bigrams(q)
  const tb = bigrams(t)
  let overlap = 0
  for (const gram of qb) if (tb.has(gram)) overlap++
  return (2 * overlap) / (qb.size + tb.size)
}

export interface SupplierLike {
  id: string
  name: string
}

/** Exact id match first, then fuzzy name matches above the threshold. */
export function matchSuppliers<T extends SupplierLike>(
  query: string,
  suppliers: T[],
  limit = 5
): T[] {
  const idQuery = query.trim().toUpperCase()
  const exact = suppliers.filter((s) => s.id === idQuery)
  if (exact.length) return exact
  return suppliers
    .map((s) => ({ supplier: s, score: fuzzyScore(query, s.name) }))
    .filter((hit) => hit.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((hit) => hit.supplier)
}
