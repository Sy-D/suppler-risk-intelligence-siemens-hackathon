import {
  analystAnswer,
  type AnalystAnswer,
  type ScoreDimension,
} from "./schema"
import { riskDimensions } from "@/lib/risk"
import type { Supplier } from "@/lib/supplier-data"

const mentionPattern = /(?:SUPP|RSCH)_\d{5}/g

export function composeAnswer(
  question: string,
  suppliers: Supplier[],
  selected: Supplier[]
): AnalystAnswer {
  const mentioned = new Set(question.toUpperCase().match(mentionPattern))
  // Names count as mentions too — longest first so "Continental, Siemens"
  // wins over "Continental" when both are substrings of the question.
  const lower = question.toLowerCase()
  for (const s of [...suppliers].sort(
    (a, b) => b.name.length - a.name.length
  )) {
    if (s.name.length >= 4 && lower.includes(s.name.toLowerCase())) {
      mentioned.add(s.id)
    }
  }

  if (/financ|finanz/i.test(question)) {
    const candidates = mentioned.size
      ? suppliers.filter((s) => mentioned.has(s.id))
      : selected
    if (candidates.length === 0)
      return analystAnswer.parse({
        summary:
          "Select suppliers or include their IDs to compare financial risk.",
        blocks: [
          {
            type: "callout",
            tone: "info",
            text: "Try: Which of SUPP_00012, SUPP_00450 and SUPP_00731 has the lowest financial risk?",
          },
        ],
      })
    const ranked = [...candidates].sort((a, b) => a.financial - b.financial)
    const best = ranked[0]
    return analystAnswer.parse({
      summary: `${best.name} (${best.id}) has the lowest financial risk in this selection.`,
      blocks: [
        {
          type: "mini_table",
          columns: ["name", "financial", "risk", "level"],
          supplierIds: ranked.slice(0, 10).map((s) => s.id),
          sortBy: "financial",
          order: "asc",
        },
        {
          type: "stat",
          label: "Lowest financial risk",
          supplierId: best.id,
          dimension: "financial",
          hint: `Credit ${best.credit}/100 · Total risk ${best.risk}/100`,
        },
        {
          type: "callout",
          tone: "info",
          text: "A financial lead alone is not an award recommendation.",
        },
        { type: "source_note" },
      ],
    })
  }

  if (mentioned.size) {
    const supplier = suppliers.find(
      (s) => s.id === mentioned.values().next().value
    )
    if (!supplier)
      return analystAnswer.parse({
        summary:
          "That supplier ID was not found in the dataset. Use an ID such as SUPP_00018.",
        blocks: [],
      })
    const concerns: ScoreDimension[] = [...riskDimensions]
      .sort((a, b) => supplier[b.key] - supplier[a.key])
      .slice(0, 3)
      .map((d) => d.key)
    return analystAnswer.parse({
      summary: `${supplier.name} (${supplier.id}) — total risk index ${supplier.risk}/100, ${supplier.level.toLowerCase()} risk.`,
      blocks: [
        { type: "supplier_chips", supplierIds: [supplier.id] },
        { type: "stat", label: "Total risk", supplierId: supplier.id, dimension: "risk" },
        {
          type: "risk_bars",
          supplierId: supplier.id,
          dimensions: concerns,
          highlightTop: 3,
        },
        {
          type: "stat",
          label: "Delivery rating",
          supplierId: supplier.id,
          dimension: "delivery",
        },
        {
          type: "stat",
          label: "PO exposure",
          supplierId: supplier.id,
          dimension: "exposure",
        },
        { type: "source_note" },
      ],
    })
  }

  return analystAnswer.parse({
    summary:
      "This preview supports financial-risk comparisons and supplier risk profiles.",
    blocks: [
      {
        type: "callout",
        tone: "info",
        text: "Include supplier IDs or try one of the example questions.",
      },
    ],
  })
}
