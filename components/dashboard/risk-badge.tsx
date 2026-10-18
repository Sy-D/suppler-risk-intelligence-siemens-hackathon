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

export { riskDimensions, euro } from "@/lib/risk"
