"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { Supplier } from "@/lib/supplier-data"

export type SupplierFilters = {
  maxRisk: number
  minDelivery: number
  maxFinancial: number
  sourcing: string
}
export const defaultFilters: SupplierFilters = {
  maxRisk: 100,
  minDelivery: 0,
  maxFinancial: 100,
  sourcing: "Any",
}
export function matchesFilters(s: Supplier, f: SupplierFilters) {
  return (
    s.risk <= f.maxRisk &&
    s.delivery >= f.minDelivery &&
    s.financial <= f.maxFinancial &&
    (f.sourcing === "Any" || s.sourcing === f.sourcing)
  )
}
export function filtersActive(f: SupplierFilters) {
  return (
    f.maxRisk !== 100 ||
    f.minDelivery !== 0 ||
    f.maxFinancial !== 100 ||
    f.sourcing !== "Any"
  )
}
export function SupplierFiltersControl({
  value,
  onChange,
  scope,
}: {
  value: SupplierFilters
  onChange: (value: SupplierFilters) => void
  scope: string
}) {
  const active = filtersActive(value)
  return (
    <details className="rounded-xl border px-4 py-2 text-sm">
      <summary
        aria-label={`${scope} advanced filters`}
        className="cursor-pointer py-1 text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        Advanced filters{active ? " · Active" : ""}
      </summary>
      <div className="mt-3 grid gap-4 pb-2 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            { key: "maxRisk", label: "Maximum total risk" },
            { key: "minDelivery", label: "Minimum delivery (%)" },
            { key: "maxFinancial", label: "Maximum financial risk" },
          ] as const
        ).map((field) => (
          <label
            key={field.key}
            className="space-y-2 text-xs text-muted-foreground"
          >
            {field.label}
            <Input
              type="number"
              aria-label={`${scope} ${field.label}`}
              min={0}
              max={100}
              step={1}
              value={value[field.key]}
              className="h-10 text-base tabular-nums md:text-sm"
              onChange={(e) =>
                onChange({
                  ...value,
                  [field.key]: Math.max(
                    0,
                    Math.min(100, Number(e.target.value))
                  ),
                })
              }
            />
          </label>
        ))}
        <label className="space-y-2 text-xs text-muted-foreground">
          Sourcing risk
          <Select
            items={["Any", "Low", "Medium", "High"].map((value) => ({
              value,
              label: value,
            }))}
            value={value.sourcing}
            onValueChange={(sourcing) =>
              onChange({ ...value, sourcing: sourcing ?? "Any" })
            }
          >
            <SelectTrigger
              aria-label={`${scope} Sourcing risk`}
              className="h-10! w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Any", "Low", "Medium", "High"].map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      {active && (
        <div className="flex flex-wrap items-center gap-2 border-t py-2 text-xs">
          <span>
            Risk ≤ {value.maxRisk} · Delivery ≥ {value.minDelivery}% · Financial
            ≤ {value.maxFinancial} · Sourcing: {value.sourcing}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(defaultFilters)}
          >
            Reset advanced filters
          </Button>
        </div>
      )}
    </details>
  )
}
