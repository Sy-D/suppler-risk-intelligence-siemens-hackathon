"use client"

import { Accordion } from "@base-ui/react/accordion"
import { ChevronDown } from "lucide-react"
import { RiskBar } from "./risk-bar"
import { riskDimensionGroups } from "@/lib/risk"
import type { Supplier } from "@/lib/supplier-data"

function groupScore(
  supplier: Supplier,
  dimensions: (typeof riskDimensionGroups)[number]["dimensions"]
) {
  const total = dimensions.reduce(
    // SAFETY: every dimension key names a numeric score field on Supplier.
    (sum, d) => sum + (supplier[d.key] as number),
    0
  )
  return Math.round(total / dimensions.length)
}

/**
 * All 18 risk dimensions, grouped into collapsible sections. The highest-risk
 * group opens by default; bars render statically (no number animation).
 */
export function DimensionGroups({ supplier }: { supplier: Supplier }) {
  const worst = riskDimensionGroups.reduce((top, group, index) =>
    groupScore(supplier, group.dimensions) >
    groupScore(supplier, riskDimensionGroups[top].dimensions)
      ? index
      : top
  , 0)

  return (
    <Accordion.Root
      defaultValue={[String(worst)]}
      multiple
      className="divide-y divide-border/60 rounded-xl border"
    >
      {riskDimensionGroups.map((group, index) => {
        const score = groupScore(supplier, group.dimensions)
        return (
          <Accordion.Item key={group.label} value={String(index)}>
            <Accordion.Header>
              <Accordion.Trigger className="group/trigger flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium">
                <span>{group.label}</span>
                <span className="flex items-center gap-3">
                  <span
                    className="text-xs font-normal tabular-nums"
                    style={{
                      color:
                        score >= 66
                          ? "var(--risk-critical)"
                          : score >= 50
                            ? "var(--risk-high)"
                            : "var(--muted-foreground)",
                    }}
                  >
                    {score}/100
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-data-[panel-open]/trigger:rotate-180" />
                </span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel className="px-4 pb-4">
              <div className="space-y-3 pt-1">
                {group.dimensions.map((d) => {
                  // SAFETY: every dimension key names a numeric score field on Supplier.
                  const value = supplier[d.key] as number
                  return (
                    <div
                      key={d.key}
                      className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-2 text-xs"
                    >
                      <span className="text-muted-foreground">{d.label}</span>
                      <RiskBar value={value} />
                    </div>
                  )
                })}
              </div>
            </Accordion.Panel>
          </Accordion.Item>
        )
      })}
    </Accordion.Root>
  )
}
