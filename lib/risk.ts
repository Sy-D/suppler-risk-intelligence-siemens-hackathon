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
