"use client"

import { AlertTriangle, Info, ArrowUpRight } from "lucide-react"
import {
  AnimatedNumber,
  deliveryFormat,
  exposureFormat,
} from "@/components/dashboard/animated-number"
import { MarkdownAnswer } from "@/components/dashboard/markdown-answer"
import { RiskBadge } from "@/components/dashboard/risk-badge"
import { RiskBar } from "@/components/dashboard/risk-bar"
import { riskDimensions } from "@/lib/risk"
import type { Supplier } from "@/lib/supplier-data"
import type { AnswerBlock } from "@/lib/analyst/schema"

export interface BlockContext {
  suppliers: Supplier[]
  onOpenProfile: (supplier: Supplier) => void
}

type BlockOf<T extends AnswerBlock["type"]> = Extract<AnswerBlock, { type: T }>

const dimensionLabel = new Map<string, string>(
  riskDimensions.map((d) => [d.key, d.label])
)

function findSupplier(
  suppliers: Supplier[],
  id: string
): Supplier | undefined {
  return suppliers.find((s) => s.id === id)
}

export function TextBlock({ block }: { block: BlockOf<"text"> }) {
  return (
    <div className="text-sm leading-relaxed">
      <MarkdownAnswer>{block.markdown}</MarkdownAnswer>
    </div>
  )
}

export function StatBlock({
  block,
  suppliers,
}: { block: BlockOf<"stat"> } & BlockContext) {
  const supplier = findSupplier(suppliers, block.supplierId)
  if (!supplier)
    return (
      <p className="text-sm text-muted-foreground">
        {block.supplierId} not found in the dataset.
      </p>
    )
  const value =
    block.dimension === "delivery"
      ? supplier.delivery
      : block.dimension === "exposure"
        ? supplier.exposure
        : supplier[block.dimension]
  return (
    <div className="rounded-xl border px-4 py-3">
      <p className="text-xs text-muted-foreground">{block.label}</p>
      <p className="mt-1 text-2xl font-medium tracking-tight tabular-nums">
        <AnimatedNumber
          value={value}
          format={
            block.dimension === "exposure"
              ? exposureFormat
              : block.dimension === "delivery"
                ? deliveryFormat
                : { maximumFractionDigits: 1 }
          }
          suffix={block.dimension === "delivery" ? "%" : undefined}
        />
        {block.dimension !== "delivery" && block.dimension !== "exposure" && (
          <span className="text-xs font-normal text-muted-foreground">
            {" "}
            / 100
          </span>
        )}
      </p>
      {block.hint && (
        <p className="mt-1 text-xs text-muted-foreground">{block.hint}</p>
      )}
    </div>
  )
}

export function RiskBarsBlock({
  block,
  suppliers,
}: { block: BlockOf<"risk_bars"> } & BlockContext) {
  const supplier = findSupplier(suppliers, block.supplierId)
  if (!supplier) return null
  const sorted = [...block.dimensions].sort(
    (a, b) => supplier[b] - supplier[a]
  )
  return (
    <div className="space-y-2.5 rounded-xl border px-4 py-3">
      {sorted.map((dimension, i) => (
        <div
          key={dimension}
          className={`grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 text-xs ${
            i < block.highlightTop ? "" : "opacity-70"
          }`}
        >
          <span className="text-muted-foreground">
            {dimensionLabel.get(dimension) ?? dimension}
          </span>
          <RiskBar value={supplier[dimension]} enter />
        </div>
      ))}
    </div>
  )
}

const columnLabels = {
  name: "Supplier",
  risk: "Risk",
  level: "Level",
  delivery: "Delivery",
  exposure: "PO exposure",
  financial: "Financial",
} as const

export function MiniTableBlock({
  block,
  suppliers,
}: { block: BlockOf<"mini_table"> } & BlockContext) {
  const rows = block.supplierIds
    .map((id) => findSupplier(suppliers, id))
    .filter((s): s is Supplier => Boolean(s))
  const sortKey = block.sortBy
  if (sortKey) {
    rows.sort(
      (a, b) => (a[sortKey] - b[sortKey]) * (block.order === "desc" ? -1 : 1)
    )
  }
  if (rows.length === 0) return null
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {block.columns.map((column) => (
              <th key={column} className="px-3 py-2 font-medium">
                {columnLabels[column]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b last:border-0">
              {block.columns.map((column) => (
                <td key={column} className="px-3 py-2 tabular-nums">
                  {column === "name" ? (
                    <span>
                      <span className="font-medium">{s.name}</span>{" "}
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {s.id}
                      </span>
                    </span>
                  ) : column === "level" ? (
                    <RiskBadge level={s.level} />
                  ) : column === "delivery" ? (
                    <AnimatedNumber
                      value={s.delivery}
                      format={deliveryFormat}
                      suffix="%"
                    />
                  ) : column === "exposure" ? (
                    <AnimatedNumber value={s.exposure} format={exposureFormat} />
                  ) : (
                    <AnimatedNumber value={s[column]} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SupplierChipsBlock({
  block,
  suppliers,
  onOpenProfile,
}: { block: BlockOf<"supplier_chips"> } & BlockContext) {
  return (
    <div className="flex flex-wrap gap-2">
      {block.supplierIds.map((id) => {
        const supplier = findSupplier(suppliers, id)
        if (!supplier) return null
        return (
          <button
            key={id}
            type="button"
            onClick={() => onOpenProfile(supplier)}
            className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-muted"
          >
            <span className="font-medium">{supplier.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {supplier.id}
            </span>
            <ArrowUpRight className="size-3 text-muted-foreground" />
          </button>
        )
      })}
    </div>
  )
}

export function CalloutBlock({ block }: { block: BlockOf<"callout"> }) {
  const Icon = block.tone === "warning" ? AlertTriangle : Info
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-relaxed ${
        block.tone === "warning"
          ? "border-[var(--risk-high)]/40 bg-[var(--risk-high)]/10"
          : "bg-muted/60"
      }`}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <p>{block.text}</p>
    </div>
  )
}

export function SourceNoteBlock() {
  return (
    <p className="text-[11px] text-muted-foreground">
      Source: supplier_risk_dataset.csv · Scores 0–100, lower risk is better.
    </p>
  )
}
