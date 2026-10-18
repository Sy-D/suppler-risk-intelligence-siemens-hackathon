import { Badge } from "@/components/ui/badge"
import type { RiskLevel } from "@/lib/supplier-data"

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <Badge
      variant={level === "Critical" ? "destructive" : "secondary"}
      className="gap-1.5 border-current/20 bg-transparent font-normal"
      style={{ color: `var(--risk-${level.toLowerCase()})` }}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {level}
    </Badge>
  )
}

export const riskDimensions = [
  { label: "Financial risk", key: "financial" },
  { label: "Quality risk", key: "quality" },
  { label: "Operational risk", key: "operational" },
  { label: "Compliance risk", key: "compliance" },
  { label: "ESG risk", key: "esg" },
  { label: "Digital security risk", key: "digital" },
  { label: "Governance risk", key: "governance" },
  { label: "Credit rating risk", key: "credit" },
] as const

export const euro = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 2,
})
