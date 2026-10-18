import { HAZARD_META, regionForSupplier, type HazardKind } from "@/lib/geo"
import type { Supplier } from "@/lib/supplier-data"

export interface ConcentrationWarning {
  title: string
  detail: string
}

/**
 * Flags clusters in a shortlist: same region, same hazard exposure,
 * same sourcing-risk level. A comparison is only as resilient as its
 * most concentrated failure mode.
 */
export function concentrationWarnings(
  suppliers: Supplier[]
): ConcentrationWarning[] {
  if (suppliers.length < 2) return []
  const warnings: ConcentrationWarning[] = []
  const total = suppliers.length

  const byRegion = new Map<string, number>()
  for (const s of suppliers) {
    const region = regionForSupplier(s.id)
    byRegion.set(region.name, (byRegion.get(region.name) ?? 0) + 1)
  }
  const [topRegion, topCount] = [...byRegion.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0]
  if (topCount >= 3 && topCount / total >= 0.3) {
    warnings.push({
      title: `${topCount} of ${total} suppliers in ${topRegion}`,
      detail: "One regional disruption hits this share of your shortlist.",
    })
  }

  // SAFETY: HAZARD_META keys are exactly the HazardKind union by construction.
  for (const kind of Object.keys(HAZARD_META) as HazardKind[]) {
    const exposed = suppliers.filter(
      (s) => regionForSupplier(s.id).hazards[kind] >= 2
    ).length
    if (exposed >= 3 && exposed / total >= 0.3) {
      warnings.push({
        title: `${exposed} of ${total} exposed to ${HAZARD_META[kind].label.toLowerCase()}`,
        detail: "Correlated natural-hazard risk across the shortlist.",
      })
    }
  }

  const risky = suppliers.filter(
    (s) => s.sourcing === "High" || s.sourcing === "Critical"
  ).length
  if (risky / total >= 0.5) {
    warnings.push({
      title: `${risky} of ${total} at ${risky === total ? "high" : "elevated"} sourcing risk`,
      detail: "More than half the shortlist is already flagged by procurement.",
    })
  }

  return warnings
}
